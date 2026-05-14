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
 *   4. Apply debt-clearing loop across unpaid ledger records
 *   5. Update tenant's last_payment_date
 *   6. Return success response with ledger entry IDs
 *
 * Debt-Clearing Logic (Arrears):
 *   When a payment is submitted, the money is distributed across the
 *   tenant's unpaid rent_ledger records — oldest month first. This
 *   ensures arrears are cleared before paying the current month.
 * ============================================
 */

const { ID, Query, databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID } = require('../config/appwrite');
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
            100,
            0,
            'period_year',
            'ASC'
        );

        // Sort by period_year ASC, period_month ASC (oldest first)
        let unpaidRecords = (ledgerResult.documents || []).sort((a, b) => {
            if (a.period_year !== b.period_year) return a.period_year - b.period_year;
            return a.period_month - b.period_month;
        });

        if (unpaidRecords.length === 0) {
            console.log(`[RentLedgerService] No unpaid ledger records found for tenant ${tenantId}.`);
            return touchedRecords;
        }

        // ── Step 2: Distribute the money across unpaid months ──
        for (const record of unpaidRecords) {
            if (remainingMoney <= 0) break;

            const monthlyRent = parseFloat(record.monthly_rent) || 0;
            const currentPaid = parseFloat(record.amount_paid) || 0;
            const debtForThisMonth = Math.max(0, monthlyRent - currentPaid);

            if (debtForThisMonth <= 0) continue;

            let portionForThisMonth;
            let newStatus;

            if (remainingMoney >= debtForThisMonth) {
                portionForThisMonth = debtForThisMonth;
                newStatus = 'paid';
            } else {
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
                `[RentLedgerService] Ledger ${record.$id} (${record.period_year}-${String(record.period_month).padStart(2, '0')}) ` +
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

        // ── If money remains, create advance payment entry ──
        if (remainingMoney > 0) {
            console.log(
                `[RentLedgerService] ${remainingMoney} remaining after clearing all debts for tenant ${tenantId}. ` +
                `Creating advance payment entry.`
            );

            const lastRecord = unpaidRecords[unpaidRecords.length - 1];
            let nextMonth = lastRecord ? lastRecord.period_month : (new Date().getMonth() + 1);
            let nextYear = lastRecord ? lastRecord.period_year : new Date().getFullYear();

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
                        room_id: dbData.room_id || '',
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

            // Enrich with tenant info for ledger creation
            dbData.tenant_name = tenant.full_name || 'Unknown';
            dbData.room_number = '';

            // ── Step 4: Create transaction record (paper trail) ──
            const transactionResult = await this.transactionService.createTransaction(dbData);

            if (!transactionResult.success) {
                return {
                    success: false,
                    statusCode: 500,
                    ...RentLedgerDTO.formatErrorResponse('Failed to record payment', transactionResult.error)
                };
            }

            const transaction = transactionResult.data;

            // ── Step 5: Debt-Clearing Loop (The Core Arrears Logic) ──
            // Distribute the payment across unpaid months, oldest first.
            // This replaces the old single-record markAsPaid call.
            let touchedLedgers = [];
            try {
                const amountPaid = parseFloat(dbData.amount) || 0;

                if (amountPaid > 0) {
                    touchedLedgers = await this.applyDebtClearing(
                        tenant.$id,
                        amountPaid,
                        dbData,
                        transaction.$id
                    );
                }

                console.log(
                    `[RentLedgerService] Debt-clearing complete for tenant ${tenant.$id}. ` +
                    `Touched ${touchedLedgers.length} ledger records.`
                );
            } catch (ledgerError) {
                // Non-blocking — log but don't fail the response
                console.error(
                    '[RentLedgerService] Failed to apply debt-clearing:',
                    ledgerError.message
                );
            }

            // ── Step 6: Update tenant's last_payment_date ──
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

            // ── Step 7: Return success response ──
            return {
                success: true,
                statusCode: 201,
                ...RentLedgerDTO.formatSuccessResponse(transaction, tenant, touchedLedgers)
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
