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
 *
 * Debt-Clearing Logic (Arrears):
 *   When a payment is submitted, the money is distributed across the
 *   tenant's unpaid rent_ledger records — oldest month first. This
 *   ensures arrears are cleared before paying the current month.
 * ============================================
 */

const { ID, Query, databases, DATABASE_ID, TENANTS_COLLECTION_ID, RENT_LEDGER_COLLECTION_ID } = require('../config/appwrite');
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
     * Debt-Clearing Loop — The Core Arrears Logic
     *
     * Takes the submitted payment amount and distributes it across the
     * tenant's unpaid rent_ledger records, paying the oldest debt first.
     *
     * Flow:
     *   1. Fetch all unpaid ledger records for this tenant
     *      (status != "paid"), sorted by period_year ASC, period_month ASC
     *   2. Loop through records, subtracting debt from the remaining money
     *   3. Update each touched record's amount_paid, pending_balance, and status
     *
     * @param {string} tenantId - The tenant's Appwrite document ID
     * @param {number} totalAmount - The total cash amount received
     * @param {Object} dbData - The prepared DB data (for metadata like payment_method, transaction_id)
     * @param {string} transactionId - The created transaction's $id
     * @returns {Promise<Array<{ledger_id: string, status: string, amount_paid: number, pending_balance: number}>>}
     */
    async applyDebtClearing(tenantId, totalAmount, dbData, transactionId) {
        const touchedRecords = [];
        let remainingMoney = parseFloat(totalAmount) || 0;

        if (remainingMoney <= 0) {
            return touchedRecords;
        }

        // ── Step 1: Fetch unpaid ledger records, oldest first ──
        const ledgerResult = await databases.listDocuments(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            [
                Query.equal('tenant_id', tenantId),
                Query.notEqual('status', 'paid')
            ],
            100, // Max batch
            0,
            'period_year',
            'ASC'
        );

        // Sort by period_year ASC, period_month ASC (oldest first)
        // Appwrite doesn't support multi-field sort, so we do client-side
        let unpaidRecords = (ledgerResult.documents || []).sort((a, b) => {
            if (a.period_year !== b.period_year) return a.period_year - b.period_year;
            return a.period_month - b.period_month;
        });

        if (unpaidRecords.length === 0) {
            console.log(`[RentCollection] No unpaid ledger records found for tenant ${tenantId}.`);
            return touchedRecords;
        }

        // ── Step 2: Distribute the money across unpaid months ──
        for (const record of unpaidRecords) {
            if (remainingMoney <= 0) break; // No more money to distribute

            const monthlyRent = parseFloat(record.monthly_rent) || 0;
            const currentPaid = parseFloat(record.amount_paid) || 0;
            const currentPending = parseFloat(record.pending_balance) || monthlyRent;

            // How much is still owed for this month
            const debtForThisMonth = Math.max(0, monthlyRent - currentPaid);

            if (debtForThisMonth <= 0) continue; // Already fully paid (shouldn't happen but safety)

            let portionForThisMonth;
            let newStatus;

            if (remainingMoney >= debtForThisMonth) {
                // Full payment for this month's debt
                portionForThisMonth = debtForThisMonth;
                newStatus = 'paid';
            } else {
                // Partial payment — only what's left
                portionForThisMonth = remainingMoney;
                newStatus = 'partial';
            }

            const newTotalPaid = currentPaid + portionForThisMonth;
            const newPendingBalance = Math.max(0, monthlyRent - newTotalPaid);

            // ── Step 3: Update the database ──
            await databases.updateDocument(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                record.$id,
                {
                    status: newStatus,
                    payment_status: newStatus,
                    amount_paid: newTotalPaid,
                    pending_balance: newPendingBalance,
                    paid_at: dbData.transaction_date,
                    payment_method: dbData.payment_method,
                    transaction_id: transactionId,
                    notes: dbData.remarks || '',
                    updated_at: new Date().toISOString()
                }
            );

            console.log(
                `[RentCollection] Ledger ${record.$id} (${record.period_year}-${String(record.period_month).padStart(2, '0')}) ` +
                `updated: → ${newStatus} (portion: ${portionForThisMonth}, total_paid: ${newTotalPaid}, pending: ${newPendingBalance})`
            );

            touchedRecords.push({
                ledger_id: record.$id,
                period_month: record.period_month,
                period_year: record.period_year,
                status: newStatus,
                amount_paid: newTotalPaid,
                pending_balance: newPendingBalance,
                portion_applied: portionForThisMonth
            });

            remainingMoney -= portionForThisMonth;
        }

        // ── If money remains after clearing all unpaid records, create a prepaid/advance entry ──
        if (remainingMoney > 0) {
            console.log(
                `[RentCollection] ${remainingMoney} remaining after clearing all debts for tenant ${tenantId}. ` +
                `Creating advance payment entry.`
            );

            // Determine the next period after the last unpaid record
            const lastRecord = unpaidRecords[unpaidRecords.length - 1];
            let nextMonth = lastRecord ? lastRecord.period_month : (new Date().getMonth() + 1);
            let nextYear = lastRecord ? lastRecord.period_year : new Date().getFullYear();

            // Advance to next month
            nextMonth += 1;
            if (nextMonth > 12) {
                nextMonth = 1;
                nextYear += 1;
            }

            // Check if a ledger entry already exists for this future period
            const futureCheck = await databases.listDocuments(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                [
                    Query.equal('tenant_id', tenantId),
                    Query.equal('period_month', nextMonth),
                    Query.equal('period_year', nextYear)
                ],
                1
            );

            if (futureCheck.documents && futureCheck.documents.length > 0) {
                // Update existing future entry
                const futureEntry = futureCheck.documents[0];
                const futureMonthlyRent = parseFloat(futureEntry.monthly_rent) || 0;
                const futureCurrentPaid = parseFloat(futureEntry.amount_paid) || 0;
                const futureNewPaid = futureCurrentPaid + remainingMoney;
                const futurePending = Math.max(0, futureMonthlyRent - futureNewPaid);
                const futureStatus = futurePending > 0 ? 'partial' : 'paid';

                await databases.updateDocument(
                    DATABASE_ID,
                    RENT_LEDGER_COLLECTION_ID,
                    futureEntry.$id,
                    {
                        status: futureStatus,
                        payment_status: futureStatus,
                        amount_paid: futureNewPaid,
                        pending_balance: futurePending,
                        paid_at: dbData.transaction_date,
                        payment_method: dbData.payment_method,
                        transaction_id: transactionId,
                        notes: dbData.remarks || '',
                        updated_at: new Date().toISOString()
                    }
                );

                touchedRecords.push({
                    ledger_id: futureEntry.$id,
                    period_month: nextMonth,
                    period_year: nextYear,
                    status: futureStatus,
                    amount_paid: futureNewPaid,
                    pending_balance: futurePending,
                    portion_applied: remainingMoney
                });
            } else {
                // Create a new advance payment entry
                const monthlyRent = parseFloat(dbData.monthly_rent) || 0;
                const rentPeriod = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
                const dueDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
                const pendingBalance = Math.max(0, monthlyRent - remainingMoney);
                const status = pendingBalance > 0 ? 'partial' : 'paid';

                const newDoc = await databases.createDocument(
                    DATABASE_ID,
                    RENT_LEDGER_COLLECTION_ID,
                    ID.unique(),
                    {
                        tenant_id: tenantId,
                        tenant_name: dbData.tenant_name || '',
                        room_id: dbData.room_id,
                        room_number: dbData.room_number || '',
                        monthly_rent: monthlyRent,
                        expected_rent: monthlyRent,
                        amount_due: monthlyRent,
                        amount_paid: remainingMoney,
                        pending_balance: pendingBalance,
                        status: status,
                        payment_status: status,
                        period_month: nextMonth,
                        period_year: nextYear,
                        rent_period: rentPeriod,
                        rent_due_date: dueDateStr,
                        paid_at: dbData.transaction_date,
                        payment_method: dbData.payment_method,
                        transaction_id: transactionId,
                        notes: dbData.remarks || '',
                        overdue_days: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                );

                touchedRecords.push({
                    ledger_id: newDoc.$id,
                    period_month: nextMonth,
                    period_year: nextYear,
                    status: status,
                    amount_paid: remainingMoney,
                    pending_balance: pendingBalance,
                    portion_applied: remainingMoney
                });
            }
        }

        return touchedRecords;
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

            // Enrich with tenant/room info for ledger creation
            dbData.tenant_name = tenantCheck.tenant?.full_name || 'Unknown';
            dbData.room_number = roomCheck.room?.room_number || '';

            // ── Step 5: Generate receipt number ──
            dbData.receipt_number = this.generateReceiptNumber();

            // ── Step 6: Create transaction record (paper trail) ──
            const transactionResult = await this.transactionService.createTransaction(dbData);

            if (!transactionResult.success) {
                return {
                    success: false,
                    statusCode: 500,
                    ...RentCollectionDTO.formatErrorResponse('Failed to create transaction', transactionResult.error)
                };
            }

            const transaction = transactionResult.data;

            // ── Step 7: Debt-Clearing Loop (The Core Arrears Logic) ──
            // Distribute the payment across unpaid months, oldest first.
            // This replaces the old single-record update with a full arrears settlement.
            let touchedLedgers = [];
            try {
                const amountPaid = parseFloat(dbData.amount) || 0;

                if (amountPaid > 0) {
                    touchedLedgers = await this.applyDebtClearing(
                        dbData.tenant_id,
                        amountPaid,
                        dbData,
                        transaction.$id
                    );
                }

                console.log(
                    `[RentCollection] Debt-clearing complete for tenant ${dbData.tenant_id}. ` +
                    `Touched ${touchedLedgers.length} ledger records.`
                );
            } catch (ledgerError) {
                // Non-blocking — log but don't fail the response
                console.error('[RentCollection] Failed to apply debt-clearing (non-blocking):', ledgerError.message);
            }

            // ── Step 8: Send SMS receipt (if requested) ──
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

            // ── Step 9: Return success response ──
            return {
                success: true,
                statusCode: 200,
                ...RentCollectionDTO.formatSuccessResponse(
                    transaction,
                    tenantCheck.tenant,
                    roomCheck.room,
                    touchedLedgers
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
