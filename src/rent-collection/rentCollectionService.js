/**
 * ============================================
 * Rent Collection Service
 * ============================================
 * 
 * Core business logic for collecting rent.
 * Uses service/repository pattern on top of
 * existing BaseService / Appwrite layer.
 * 
 * Reusable by:
 *   - Mobile App (POST /api/rent/collect)
 *   - Admin Dashboard (POST /api/rent/collect)
 *   - Future online payment gateway
 * ============================================
 */

const { ID, Query, databases, DATABASE_ID, TENANTS_COLLECTION_ID } = require('../config/appwrite');
const BaseService = require('../services/BaseService');
const TenantService = require('../services/TenantService');
const RoomService = require('../services/RoomService');
const RentTransactionService = require('../services/RentTransactionService');
const RentCollectionDTO = require('./rentCollection.dto');
const SmsService = require('./smsService');

class RentCollectionService {
    constructor() {
        this.transactionService = RentTransactionService;
    }

    /**
     * Generate a unique receipt number.
     * Format: RCPT-YYYYMMDD-XXXX (sequential-like)
     */
    generateReceiptNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        return `RCPT-${year}${month}${day}-${random}`;
    }

    /**
     * Verify that the tenant exists, is active, and belongs to the given room.
     * 
     * @returns {{ valid: boolean, tenant?: Object, error?: string }}
     */
    async verifyTenant(tenantId, roomId) {
        // 1. Fetch tenant
        const tenantResult = await TenantService.getById(tenantId);
        if (!tenantResult.success) {
            return { valid: false, error: 'Tenant not found' };
        }

        const tenant = tenantResult.data;

        // 2. Verify tenant is active
        if (tenant.status !== 'active') {
            return { valid: false, error: 'Tenant is not active' };
        }

        // 3. Verify tenant belongs to the specified room
        if (tenant.room_id !== roomId) {
            return { valid: false, error: 'Tenant does not belong to the specified room' };
        }

        return { valid: true, tenant };
    }

    /**
     * Verify that the room exists and is occupied.
     * Checks both the room status AND whether an active tenant is assigned.
     *
     * @returns {{ valid: boolean, room?: Object, error?: string }}
     */
    async verifyRoom(roomId) {
        const roomResult = await RoomService.getById(roomId);
        if (!roomResult.success) {
            return { valid: false, error: 'Room not found' };
        }

        const room = roomResult.data;

        // Primary check: room status
        if (room.status === 'occupied') {
            return { valid: true, room };
        }

        // Secondary check: if room status is not 'occupied', check if there's
        // an active tenant assigned to this room (handles cases where room
        // status wasn't updated when tenant was assigned)
        try {
            const tenantsResult = await databases.listDocuments(
                DATABASE_ID,
                TENANTS_COLLECTION_ID,
                [
                    Query.equal('room_id', roomId),
                    Query.equal('status', 'active')
                ]
            );
            if (tenantsResult.documents && tenantsResult.documents.length > 0) {
                return { valid: true, room };
            }
        } catch (error) {
            console.error(`[RentCollection] Error checking active tenant for room ${roomId}:`, error.message);
        }

        return { valid: false, error: 'Room is not occupied' };
    }

    /**
     * Collect rent — the main entry point.
     * 
     * @param {Object} requestData - The validated request body
     * @returns {Promise<Object>} Standardized response
     */
    async collectRent(requestData) {
        try {
            // ── Step 1: Validate input ──
            const validation = RentCollectionDTO.validate(requestData);
            if (!validation.valid) {
                return {
                    success: false,
                    statusCode: 400,
                    ...RentCollectionDTO.formatErrorResponse('Validation failed', validation.errors)
                };
            }

            // ── Step 2: Verify tenant ──
            const tenantCheck = await this.verifyTenant(requestData.tenant_id, requestData.room_id);
            if (!tenantCheck.valid) {
                return {
                    success: false,
                    statusCode: 400,
                    ...RentCollectionDTO.formatErrorResponse(tenantCheck.error)
                };
            }

            // ── Step 3: Verify room ──
            const roomCheck = await this.verifyRoom(requestData.room_id);
            if (!roomCheck.valid) {
                return {
                    success: false,
                    statusCode: 400,
                    ...RentCollectionDTO.formatErrorResponse(roomCheck.error)
                };
            }

            // ── Step 4: Prepare data for DB ──
            const dbData = RentCollectionDTO.prepareForDb(requestData);

            // ── Step 5: Generate receipt number ──
            dbData.receipt_number = this.generateReceiptNumber();

            // ── Step 6: Create transaction ──
            const transactionResult = await this.transactionService.createTransaction(dbData);

            if (!transactionResult.success) {
                return {
                    success: false,
                    statusCode: 500,
                    ...RentCollectionDTO.formatErrorResponse('Failed to create transaction', transactionResult.error)
                };
            }

            const transaction = transactionResult.data;

            // ── Step 7: Send SMS receipt (if requested) ──
            if (requestData.send_sms_receipt === true || requestData.send_sms_receipt === 'true') {
                const tenantPhone = tenantCheck.tenant?.phone_number;
                if (tenantPhone) {
                    // Fire and forget — do not block the response
                    SmsService.sendReceiptSms({
                        phoneNumber: tenantPhone,
                        tenantName: tenantCheck.tenant?.full_name || 'Tenant',
                        receiptNumber: dbData.receipt_number,
                        amountPaid: dbData.amount,
                        paymentStatus: dbData.payment_status,
                        roomName: roomCheck.room?.room_number || 'N/A'
                    }).catch(err => {
                        console.error('[RentCollection] SMS sending failed (non-blocking):', err.message);
                    });
                }
            }

            // ── Step 8: Return success response ──
            return {
                success: true,
                statusCode: 200,
                ...RentCollectionDTO.formatSuccessResponse(
                    transaction,
                    tenantCheck.tenant,
                    roomCheck.room
                )
            };

        } catch (error) {
            console.error('[RentCollectionService] Unexpected error:', error);
            return {
                success: false,
                statusCode: 500,
                ...RentCollectionDTO.formatErrorResponse('Internal server error', error.message)
            };
        }
    }
}

module.exports = new RentCollectionService();
