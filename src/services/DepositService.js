'use strict';

/**
 * DepositService — tenant security deposit ledger.
 *
 * The deposit ledger is the SOURCE OF TRUTH:
 *     remaining = SUM(amount)        received = +,  adjustment = -,  refund = -
 *
 * `tenants.security_deposit` is kept as a mirror for backward compatibility and
 * is updated inside the same DB transaction as every ledger write.
 *
 * Every multi-step operation (adjust / refund / settlement / move-out) runs in
 * `withTransaction()`, so a partial update can never be committed.
 *
 * NOTE: this service deliberately does NOT require TenantService (avoids a
 * circular import); the move-out write happens inline.
 */

const { query, withTransaction, generateId } = require('../config/db');
const RoomService = require('./RoomService');
const rentTransactionService = require('./RentTransactionService');

const TRANSACTION_TYPES = ['received', 'adjustment', 'refund'];
const REFERENCE_TYPES = ['opening_balance', 'rent_payment', 'move_out', 'manual', 'other_charge'];

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

class DepositError extends Error {
    constructor(message, statusCode = 400, code = 'deposit_error') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

class DepositService {
    // ──────────────────────────────────────────────────────────────
    // Reads
    // ──────────────────────────────────────────────────────────────

    async _getTenant(tenantId) {
        const res = await query(
            `SELECT id, full_name, room_id, monthly_rent, security_deposit, status
             FROM tenants WHERE id = $1`,
            [tenantId]
        );
        if (res.rows.length === 0) {
            throw new DepositError('Tenant not found', 404, 'tenant_not_found');
        }
        return res.rows[0];
    }

    /** Ledger totals: received / adjusted / refunded / remaining. */
    async getSummary(tenantId) {
        const res = await query(
            `SELECT
                COALESCE(SUM(CASE WHEN transaction_type = 'received'   THEN amount ELSE 0 END), 0) AS received,
                COALESCE(SUM(CASE WHEN transaction_type = 'adjustment' THEN -amount ELSE 0 END), 0) AS adjusted,
                COALESCE(SUM(CASE WHEN transaction_type = 'refund'     THEN -amount ELSE 0 END), 0) AS refunded,
                COALESCE(SUM(amount), 0) AS remaining
             FROM tenant_deposit_transactions
             WHERE tenant_id = $1`,
            [tenantId]
        );
        const r = res.rows[0];
        return {
            received: round2(r.received),
            adjusted: round2(r.adjusted),
            refunded: round2(r.refunded),
            remaining: round2(r.remaining)
        };
    }

    /** Outstanding rent = sum of the still-open ledger rows. */
    async getOutstandingRent(tenantId) {
        const res = await query(
            `SELECT COALESCE(SUM(pending_balance), 0) AS outstanding
             FROM rent_ledger
             WHERE tenant_id = $1 AND status IN ('pending', 'overdue', 'partial')`,
            [tenantId]
        );
        return round2(res.rows[0].outstanding);
    }

    async listTransactions(tenantId, limit = 100) {
        const res = await query(
            `SELECT id, tenant_id, amount, transaction_type, reference_type, reference_id,
                    description, created_by, created_at
             FROM tenant_deposit_transactions
             WHERE tenant_id = $1
             ORDER BY created_at DESC, id DESC
             LIMIT $2`,
            [tenantId, limit]
        );
        return res.rows;
    }

    /** Ledger statement (used by GET /tenants/:id/deposit). */
    async getStatement(tenantId, limit = 100) {
        const tenant = await this._getTenant(tenantId);
        const summary = await this.getSummary(tenantId);
        const transactions = await this.listTransactions(tenantId, limit);
        return {
            tenant_id: tenantId,
            tenant_name: tenant.full_name,
            ...summary,
            transactions
        };
    }

    // ──────────────────────────────────────────────────────────────
    // Writes
    // ──────────────────────────────────────────────────────────────

    async _insertTransaction({
        tenant_id,
        amount,
        transaction_type,
        reference_type = '',
        reference_id = '',
        description = '',
        created_by = ''
    }) {
        if (!TRANSACTION_TYPES.includes(transaction_type)) {
            throw new DepositError(`Invalid transaction_type "${transaction_type}"`, 400, 'invalid_type');
        }
        const id = generateId();
        await query(
            `INSERT INTO tenant_deposit_transactions
                (id, tenant_id, amount, transaction_type, reference_type, reference_id, description, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, tenant_id, round2(amount), transaction_type, reference_type, reference_id, description, created_by]
        );
        return id;
    }

    /** Keep the legacy tenants.security_deposit column in step with the ledger. */
    async _syncTenantMirror(tenantId) {
        const summary = await this.getSummary(tenantId);
        await query(
            `UPDATE tenants SET security_deposit = $2, updated_at = now() WHERE id = $1`,
            [tenantId, summary.remaining]
        );
        return summary.remaining;
    }

    /** Serialize concurrent deposit operations for one tenant. */
    async _lockTenant(tenantId) {
        const res = await query(`SELECT id FROM tenants WHERE id = $1 FOR UPDATE`, [tenantId]);
        if (res.rows.length === 0) {
            throw new DepositError('Tenant not found', 404, 'tenant_not_found');
        }
    }

    /**
     * Record money received into the deposit account.
     */
    async recordReceived(tenantId, options = {}) {
        const amount = round2(options.amount);
        if (amount <= 0) {
            throw new DepositError('amount must be greater than 0', 400, 'invalid_amount');
        }

        return withTransaction(async () => {
            await this._lockTenant(tenantId);
            await this._insertTransaction({
                tenant_id: tenantId,
                amount,
                transaction_type: 'received',
                reference_type: options.reference_type || 'manual',
                reference_id: options.reference_id || '',
                description: options.description || 'Security deposit received',
                created_by: options.created_by || ''
            });
            const remaining = await this._syncTenantMirror(tenantId);
            return { tenant_id: tenantId, deposited: amount, remaining };
        });
    }

    /**
     * Apply part (or all) of the deposit against outstanding rent.
     *
     * Creates the deposit `adjustment` entry AND the corresponding rent payment
     * (payment_method = 'security_deposit'), then clears the oldest rent debt.
     * All of it commits or rolls back together.
     */
    async applyToRent(tenantId, options = {}) {
        const amount = round2(options.amount);
        if (amount <= 0) {
            throw new DepositError('amount must be greater than 0', 400, 'invalid_amount');
        }

        return withTransaction(async () => {
            await this._lockTenant(tenantId);
            const tenant = await this._getTenant(tenantId);
            const summary = await this.getSummary(tenantId);
            const outstanding = await this.getOutstandingRent(tenantId);

            if (amount > summary.remaining) {
                throw new DepositError(
                    `Adjustment (AED ${amount}) exceeds the available deposit (AED ${summary.remaining}).`,
                    400,
                    'insufficient_deposit'
                );
            }
            if (outstanding <= 0) {
                throw new DepositError('There is no outstanding rent to settle.', 400, 'nothing_outstanding');
            }
            if (amount > outstanding) {
                throw new DepositError(
                    `Adjustment (AED ${amount}) exceeds the outstanding rent (AED ${outstanding}).`,
                    400,
                    'exceeds_outstanding'
                );
            }

            const now = new Date();
            const periodYear = parseInt(options.period_year, 10) || now.getFullYear();
            const periodMonth = parseInt(options.period_month, 10) || now.getMonth() + 1;
            const collectedBy = options.collected_by || 'system';

            // 1. Deposit ledger: adjustment (negative).
            const depositTxnId = await this._insertTransaction({
                tenant_id: tenantId,
                amount: -amount,
                transaction_type: 'adjustment',
                reference_type: options.reference_type || 'rent_payment',
                reference_id: '',
                description: options.description || 'Security deposit applied to rent',
                created_by: collectedBy
            });

            // 2. Rent payment record (paper trail + payment method).
            const paymentResult = await rentTransactionService.createTransaction({
                tenant_id: tenantId,
                room_id: tenant.room_id || '',
                collected_by: collectedBy,
                amount,
                monthly_rent: parseFloat(tenant.monthly_rent) || 0,
                payment_method: 'security_deposit',
                payment_status: 'paid',
                transaction_date: now.toISOString(),
                rent_due_date: now.toISOString().split('T')[0],
                period_month: periodMonth,
                period_year: periodYear,
                remarks: options.description || 'Paid from security deposit',
                deposit_transaction_id: depositTxnId
            });
            if (!paymentResult.success) {
                throw new DepositError(
                    `Failed to create the rent payment: ${paymentResult.error}`,
                    500,
                    'payment_failed'
                );
            }
            const paymentId = paymentResult.data.$id;

            // 3. Link the deposit entry back to the payment.
            await query(
                `UPDATE tenant_deposit_transactions SET reference_id = $2, updated_at = now() WHERE id = $1`,
                [depositTxnId, paymentId]
            );

            // 4. Clear the oldest rent debt (reuses the existing ledger clearing logic).
            await require('../rent-ledger/rentLedgerService').applyDebtClearing(
                tenantId,
                amount,
                {
                    tenant_id: tenantId,
                    tenant_name: tenant.full_name,
                    room_id: tenant.room_id,
                    room_number: '',
                    monthly_rent: parseFloat(tenant.monthly_rent) || 0
                },
                paymentId
            );

            const remaining = await this._syncTenantMirror(tenantId);
            const outstandingAfter = await this.getOutstandingRent(tenantId);

            return {
                deposit_transaction_id: depositTxnId,
                payment_id: paymentId,
                applied: amount,
                deposit_remaining: remaining,
                outstanding_before: outstanding,
                outstanding_after: outstandingAfter
            };
        });
    }

    /**
     * Refund deposit money (normally at move-out).
     */
    async refund(tenantId, options = {}) {
        const amount = round2(options.amount);
        if (amount <= 0) {
            throw new DepositError('amount must be greater than 0', 400, 'invalid_amount');
        }

        return withTransaction(async () => {
            await this._lockTenant(tenantId);
            const summary = await this.getSummary(tenantId);

            if (amount > summary.remaining) {
                throw new DepositError(
                    `Refund (AED ${amount}) exceeds the remaining deposit (AED ${summary.remaining}).`,
                    400,
                    'insufficient_deposit'
                );
            }

            const refundId = await this._insertTransaction({
                tenant_id: tenantId,
                amount: -amount,
                transaction_type: 'refund',
                reference_type: options.reference_type || 'move_out',
                reference_id: options.reference_id || '',
                description: options.description || 'Security deposit refund',
                created_by: options.created_by || ''
            });

            const remaining = await this._syncTenantMirror(tenantId);
            return { deposit_transaction_id: refundId, refunded: amount, deposit_remaining: remaining };
        });
    }

    // ──────────────────────────────────────────────────────────────
    // Move-out settlement
    // ──────────────────────────────────────────────────────────────

    /**
     * Compute (without writing) the final settlement figures.
     *
     * @param {number} otherCharges - utilities / damages / other charges
     * @param {number} depositToApply - explicit amount to take from the deposit
     */
    async previewSettlement(tenantId, options = {}) {
        const tenant = await this._getTenant(tenantId);
        const summary = await this.getSummary(tenantId);
        const outstandingRent = await this.getOutstandingRent(tenantId);
        const otherCharges = round2(options.other_charges || options.otherCharges || 0);
        const totalOutstanding = round2(outstandingRent + otherCharges);

        const maxApplicable = round2(Math.min(summary.remaining, totalOutstanding));
        let depositAdjustment = options.deposit_to_apply === undefined && options.depositToApply === undefined
            ? maxApplicable
            : round2(options.deposit_to_apply !== undefined ? options.deposit_to_apply : options.depositToApply);

        if (depositAdjustment < 0) {
            throw new DepositError('deposit_to_apply cannot be negative', 400, 'invalid_amount');
        }
        if (depositAdjustment > maxApplicable) {
            throw new DepositError(
                `deposit_to_apply (AED ${depositAdjustment}) cannot exceed AED ${maxApplicable} ` +
                `(min of available deposit and total outstanding).`,
                400,
                'invalid_adjustment'
            );
        }

        const remainingOutstanding = round2(totalOutstanding - depositAdjustment);
        const refundAmount = round2(summary.remaining - depositAdjustment);

        return {
            tenant_id: tenantId,
            tenant_name: tenant.full_name,
            tenant_status: tenant.status,
            outstanding_rent: outstandingRent,
            other_charges: otherCharges,
            total_outstanding: totalOutstanding,
            security_deposit: {
                received: summary.received,
                adjusted: summary.adjusted,
                refunded: summary.refunded,
                remaining: summary.remaining
            },
            settlement: {
                deposit_adjustment: depositAdjustment,
                remaining_outstanding: remainingOutstanding,
                refund_amount: refundAmount,
                can_move_out: remainingOutstanding <= 0
            }
        };
    }

    /**
     * Execute the move-out settlement atomically:
     *   deposit adjustment -> optional extra payment -> refund -> move-out.
     *
     * Blocks the move-out (409) when money is still outstanding.
     */
    async settleAndMoveOut(tenantId, options = {}) {
        const completeMoveOut = options.complete_move_out !== false && options.completeMoveOut !== false;
        const collectedBy = options.collected_by || 'system';
        const additionalPayment = round2(options.additional_payment || options.additionalPayment || 0);

        return withTransaction(async () => {
            await this._lockTenant(tenantId);
            const tenant = await this._getTenant(tenantId);

            const preview = await this.previewSettlement(tenantId, options);

            // 1. Apply the deposit against the outstanding rent (only the rent part).
            let depositApplied = 0;
            if (preview.settlement.deposit_adjustment > 0) {
                const rentPortion = Math.min(preview.settlement.deposit_adjustment, preview.outstanding_rent);
                if (rentPortion > 0) {
                    const applied = await this.applyToRent(tenantId, {
                        amount: rentPortion,
                        collected_by: collectedBy,
                        description: options.description || 'Move-out settlement: deposit applied to rent'
                    });
                    depositApplied = applied.applied;
                }
            }

            // 2. Optional extra payment (cash/card) to clear any remaining balance.
            let extraPaid = 0;
            if (additionalPayment > 0) {
                const now = new Date();
                const paymentResult = await rentTransactionService.createTransaction({
                    tenant_id: tenantId,
                    room_id: tenant.room_id || '',
                    collected_by: collectedBy,
                    amount: additionalPayment,
                    monthly_rent: parseFloat(tenant.monthly_rent) || 0,
                    payment_method: options.payment_method || 'cash',
                    payment_status: 'paid',
                    transaction_date: now.toISOString(),
                    rent_due_date: now.toISOString().split('T')[0],
                    period_month: now.getMonth() + 1,
                    period_year: now.getFullYear(),
                    remarks: options.notes || 'Move-out settlement payment'
                });
                if (!paymentResult.success) {
                    throw new DepositError(`Failed to record the extra payment: ${paymentResult.error}`, 500, 'payment_failed');
                }
                await require('../rent-ledger/rentLedgerService').applyDebtClearing(
                    tenantId,
                    additionalPayment,
                    {
                        tenant_id: tenantId,
                        tenant_name: tenant.full_name,
                        room_id: tenant.room_id,
                        room_number: '',
                        monthly_rent: parseFloat(tenant.monthly_rent) || 0
                    },
                    paymentResult.data.$id
                );
                extraPaid = additionalPayment;
            }

            // 3. Re-check what is still owed after deposit + extra payment.
            const outstandingAfter = await this.getOutstandingRent(tenantId);
            const otherCharges = preview.other_charges;
            const stillOwed = round2(outstandingAfter + otherCharges);

            if (stillOwed > 0) {
                if (completeMoveOut) {
                    throw new DepositError(
                        `Cannot complete move-out. AED ${stillOwed} remains outstanding after applying the security deposit.`,
                        409,
                        'outstanding_balance'
                    );
                }
                const summary = await this.getSummary(tenantId);
                return {
                    tenant_id: tenantId,
                    moved_out: false,
                    deposit_applied: depositApplied,
                    additional_paid: extraPaid,
                    outstanding_after: stillOwed,
                    security_deposit: summary,
                    refund_amount: 0,
                    can_move_out: false
                };
            }

            // 4. Refund whatever deposit is left.
            const summaryBeforeRefund = await this.getSummary(tenantId);
            let refunded = 0;
            if (summaryBeforeRefund.remaining > 0) {
                const refundResult = await this.refund(tenantId, {
                    amount: summaryBeforeRefund.remaining,
                    created_by: collectedBy,
                    reference_type: 'move_out',
                    description: options.refund_description || 'Move-out deposit refund'
                });
                refunded = refundResult.refunded;
            }

            // 5. Complete the move-out and free the room.
            let movedOut = false;
            if (completeMoveOut) {
                await query(
                    `UPDATE tenants
                     SET status = 'moved_out', check_out_date = now(), updated_at = now()
                     WHERE id = $1`,
                    [tenantId]
                );

                if (tenant.room_id) {
                    const others = await query(
                        `SELECT COUNT(*)::int AS n FROM tenants
                         WHERE room_id = $1 AND status = 'active' AND id <> $2`,
                        [tenant.room_id, tenantId]
                    );
                    if (others.rows[0].n === 0) {
                        await RoomService.updateRoomStatus(tenant.room_id, 'vacant');
                    }
                }
                movedOut = true;
            }

            const finalSummary = await this.getSummary(tenantId);

            return {
                tenant_id: tenantId,
                moved_out: movedOut,
                deposit_applied: depositApplied,
                additional_paid: extraPaid,
                outstanding_after: 0,
                security_deposit: finalSummary,
                refund_amount: refunded,
                can_move_out: true
            };
        });
    }
}

module.exports = new DepositService();
module.exports.DepositError = DepositError;
