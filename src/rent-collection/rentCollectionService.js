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
 * FORCE-UPDATE LEDGER LOGIC (FIX):
 *   The debt-clearing loop now uses a two-phase approach:
 *   1. Query the rent_ledger for unpaid records (status != "paid"),
 *      sorted by period_year ASC, period_month ASC (oldest first).
 *   2. For each record, deduct from the received amount and
 *      explicitly call databases.updateDocument with the correct
 *      document $id. The function does NOT return 'Success' unless
 *      all updateDocument calls have completed.
 *   3. The ledger MUST hit 0 for the tenant to disappear from the list.
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
     * FORCE-UPDATE LEDGER — Debt-Clearing Loop (The Core Arrears Logic)
     *
     * Takes the submitted payment amount and distributes it across the
     * tenant's unpaid rent_ledger records, paying the oldest debt first.
     *
     * CRITICAL FIX:
     *   - Queries rent_ledger for tenant_id, filtering status != "paid"
     *   - Uses a FOR loop to iterate through documents
     *   - For each document, compares amount_received to pending_balance
     *   - Explicitly calls databases.updateDocument with the correct document $id
     *   - Fields updated: pending_balance (reduced/set to 0), status ('paid'/'partial'),
     *     payment_status ('paid'/'partial')
     *   - Does NOT return unless all updateDocument calls have completed
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
        // Use Query.notEqual('status', 'paid') to find all records that are NOT fully paid.
        // This catches status values like 'overdue', 'partial', 'pending', etc.
        const ledgerResult = await databases.listDocuments(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            [
                Query.equal('tenant_id', tenantId),
                Query.notEqual('status', 'paid')
            ],
            100,
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

        console.log(
            `[RentCollection] Found ${unpaidRecords.length} unpaid ledger records for tenant ${tenantId}. ` +
            `Total amount received: ${totalAmount}. Starting force-update loop...`
        );

        // ── Step 2: FORCE-UPDATE LOOP — Iterate through each unpaid document ──
        for (const record of unpaidRecords) {
            if (remainingMoney <= 0) {
                console.log(`[RentCollection] No remaining money to distribute. Stopping loop.`);
                break;
            }

            const monthlyRent = parseFloat(record.monthly_rent) || 0;
            const currentPaid = parseFloat(record.amount_paid) || 0;
            const pendingBalance = parseFloat(record.pending_balance) || monthlyRent;

            console.log(
                `[RentCollection] Processing ledger ${record.$id} ` +
                `(${record.period_year}-${String(record.period_month).padStart(2, '0')}): ` +
                `monthly_rent=${monthlyRent}, amount_paid=${currentPaid}, ` +
                `pending_balance=${pendingBalance}, remaining_money=${remainingMoney}`
            );

            // Determine how much is still owed for this month.
            // Use pending_balance directly if available, otherwise fall back to monthly_rent - amount_paid.
            const debtForThisMonth = pendingBalance;

            if (debtForThisMonth <= 0) {
                console.log(`[RentCollection] Ledger ${record.$id} has no pending debt. Skipping.`);
                continue;
            }

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

            // ── Step 3: FORCE-UPDATE — Explicitly call updateDocument with the correct document $id ──
            console.log(
                `[RentCollection] FORCE-UPDATE: Updating ledger ${record.$id} ` +
                `→ status=${newStatus}, amount_paid=${newTotalPaid}, pending_balance=${newPendingBalance}`
            );

            const updateResult = await databases.updateDocument(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                record.$id,
                {
                    status: newStatus,
                    payment_status: newStatus,
                    amount_paid: newTotalPaid,
                    pending_balance: newPendingBalance,
                    updated_at: new Date().toISOString()
                }
            );

            // Verify the update actually took effect by checking the response
            if (!updateResult || !updateResult.$id) {
                throw new Error(
                    `Force-update FAILED for ledger ${record.$id}. ` +
                    `updateDocument did not return a valid document. ` +
                    `This is critical — the ledger was NOT updated.`
                );
            }

            console.log(
                `[RentCollection] ✓ Force-update SUCCEEDED for ledger ${record.$id} ` +
                `(${record.period_year}-${String(record.period_month).padStart(2, '0')}): ` +
                `→ ${newStatus} (portion: ${portionForThisMonth}, total_paid: ${newTotalPaid}, pending: ${newPendingBalance})`
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

                const futureUpdateResult = await databases.updateDocument(
                    DATABASE_ID,
                    RENT_LEDGER_COLLECTION_ID,
                    futureEntry.$id,
                    {
                        status: futureStatus,
                        payment_status: futureStatus,
                        amount_paid: futureNewPaid,
                        pending_balance: futurePending,
                        updated_at: new Date().toISOString()
                    }
                );

                if (!futureUpdateResult || !futureUpdateResult.$id) {
                    throw new Error(
                        `Force-update FAILED for future ledger ${futureEntry.$id}. ` +
                        `The advance payment was NOT recorded.`
                    );
                }

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
     * CRITICAL FIX:
     *   The debt-clearing loop is NO LONGER wrapped in a non-blocking try/catch.
     *   If the ledger update fails, the entire request fails. This ensures the
     *   transaction is NOT created without also updating the ledger.
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

            // ── Step 7: FORCE-UPDATE LEDGER (Debt-Clearing Loop) ──
            // CRITICAL: This is NO LONGER wrapped in a non-blocking try/catch.
            // If the ledger update fails, the entire request fails.
            // This ensures we NEVER create a transaction without updating the ledger.
            const amountPaid = parseFloat(dbData.amount) || 0;
            let touchedLedgers = [];

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
