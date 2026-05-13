/**
 * ============================================
 * Rent Ledger Service
 * ============================================
 *
 * Business logic for recording rent payments
 * into the rent ledger.
 *
 * Flow:
 *   1. Validate input via DTO
 *   2. Verify tenant exists and is active
 *   3. Prepare data and insert into rent_transactions
 *   4. Update tenant's last_payment_date
 *   5. Return success response with ledger entry ID
 * ============================================
 */

const { ID, Query } = require('../config/appwrite');
const BaseService = require('../services/BaseService');
const TenantService = require('../services/TenantService');
const RentTransactionService = require('../services/RentTransactionService');
const RentLedgerDTO = require('./rentLedger.dto');

class RentLedgerService {
    constructor() {
        this.transactionService = RentTransactionService;
    }

    /**
     * Verify that the tenant exists and is active.
     *
     * @returns {{ valid: boolean, tenant?: Object, error?: string }}
     */
    async verifyTenant(tenantId) {
        const tenantResult = await TenantService.getById(tenantId);
        if (!tenantResult.success) {
            return { valid: false, error: 'Tenant not found' };
        }

        const tenant = tenantResult.data;

        if (tenant.status !== 'active') {
            return { valid: false, error: 'Tenant is not active' };
        }

        return { valid: true, tenant };
    }

    /**
     * Record a rent payment in the ledger.
     *
     * @param {Object} requestData - The validated request body
     * @returns {Promise<Object>} Standardized response
     */
    async recordPayment(requestData) {
        try {
            // ── Step 1: Validate input ──
            const validation = RentLedgerDTO.validate(requestData);
            if (!validation.valid) {
                return {
                    success: false,
                    statusCode: 400,
                    ...RentLedgerDTO.formatErrorResponse('Validation failed', validation.errors)
                };
            }

            // ── Step 2: Verify tenant exists and is active ──
            const tenantCheck = await this.verifyTenant(requestData.tenant_id);
            if (!tenantCheck.valid) {
                return {
                    success: false,
                    statusCode: 400,
                    ...RentLedgerDTO.formatErrorResponse(tenantCheck.error)
                };
            }

            const tenant = tenantCheck.tenant;

            // ── Step 3: Prepare data for DB ──
            const dbData = RentLedgerDTO.prepareForDb(requestData);

            // Fill in room_id and collected_by from tenant context if not provided
            if (!dbData.room_id && tenant.room_id) {
                dbData.room_id = tenant.room_id;
            }
            if (!dbData.collected_by) {
                dbData.collected_by = requestData.collected_by || '';
            }
            // Use tenant's monthly_rent as the reference
            if (tenant.monthly_rent) {
                dbData.monthly_rent = parseFloat(tenant.monthly_rent);
            }

            // ── Step 4: Create transaction record ──
            const transactionResult = await this.transactionService.createTransaction(dbData);

            if (!transactionResult.success) {
                return {
                    success: false,
                    statusCode: 500,
                    ...RentLedgerDTO.formatErrorResponse('Failed to record payment', transactionResult.error)
                };
            }

            const transaction = transactionResult.data;

            // ── Step 5: Update tenant's last_payment_date ──
            try {
                await TenantService.updateTenant(tenant.$id, {
                    last_payment_date: dbData.transaction_date
                });
            } catch (updateError) {
                // Non-blocking — log but don't fail the response
                console.error(
                    '[RentLedgerService] Failed to update tenant last_payment_date:',
                    updateError.message
                );
            }

            // ── Step 6: Return success response ──
            return {
                success: true,
                statusCode: 201,
                ...RentLedgerDTO.formatSuccessResponse(transaction, tenant)
            };

        } catch (error) {
            console.error('[RentLedgerService] Unexpected error:', error);
            return {
                success: false,
                statusCode: 500,
                ...RentLedgerDTO.formatErrorResponse('Internal server error', error.message)
            };
        }
    }
}

module.exports = new RentLedgerService();
