/**
 * Security deposit ledger + move-out settlement — test suite.
 *
 * Covers the spec cases A–E plus the guard rails:
 *   A  deposit 5000 / outstanding 2000  -> adjust 2000, remaining 3000, refund 3000, move-out OK
 *   B  deposit 5000 / outstanding 5000  -> adjust 5000, remaining 0, refund 0, move-out OK
 *   C  deposit 5000 / outstanding 6500  -> adjust 5000, remaining 0, outstanding 1500, move-out BLOCKED
 *   D  deposit 5000 / outstanding 0     -> adjust 0, remaining 5000, refund 5000, move-out OK
 *   E  deposit 5000 / rent 2000, apply 1500 first -> deposit 3500, outstanding 500 (both txns kept)
 *   - adjustment greater than available deposit -> error
 *   - adjustment greater than outstanding       -> error
 *   - history is preserved (no updates/deletes)
 *
 * Runs against the real DB (DATABASE_URL) and cleans up after itself.
 *
 * Usage: node test/deposit-settlement.test.js
 */

require('dotenv').config();
const { query, pool, generateId } = require('../src/config/db');
const depositService = require('../src/services/DepositService');

let passed = 0;
let failed = 0;

function assert(condition, name, expected, actual) {
    if (condition) {
        passed++;
        console.log(`✅ ${name}`);
    } else {
        failed++;
        console.log(`❌ ${name}\n   expected: ${expected}\n   actual:   ${actual}`);
    }
}

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

async function createTenant({ rent = 5000, deposit = 0, outstanding = 0 } = {}) {
    const buildingId = generateId();
    const roomId = generateId();
    const tenantId = generateId();
    const stamp = Date.now() + Math.floor(Math.random() * 100000);

    await query(
        `INSERT INTO buildings (id, name, address, total_floors, total_rooms, description, status)
         VALUES ($1, $2, '', 1, 1, '', 'active')`,
        [buildingId, `TEST-TOWER-${stamp}`]
    );
    await query(
        `INSERT INTO rooms (id, building_id, room_number, floor, type, monthly_rent, size, amenities, status)
         VALUES ($1, $2, $3, 1, 'partition', $4, '', '', 'occupied')`,
        [roomId, buildingId, `R-${stamp}`, rent]
    );
    await query(
        `INSERT INTO tenants
            (id, room_id, full_name, phone_number, email, id_number, emergency_contact,
             check_in_date, check_out_date, monthly_rent, security_deposit, billing_day, status, notes)
         VALUES ($1,$2,$3,'0000000000','','','', now(), NULL, $4, 0, 1, 'active', '')`,
        [tenantId, roomId, `TEST TENANT ${stamp}`, rent]
    );

    if (deposit > 0) {
        await depositService.recordReceived(tenantId, { amount: deposit, description: 'test opening deposit' });
    }
    if (outstanding > 0) {
        await addLedgerRow(tenantId, roomId, outstanding, rent);
    }
    return { buildingId, roomId, tenantId };
}

async function addLedgerRow(tenantId, roomId, amountDue, monthlyRent, periodOffset = 0) {
    const now = new Date();
    const month = now.getMonth() + 1 - periodOffset;
    const year = now.getFullYear();
    const period = `${year}-${String(month).padStart(2, '0')}`;

    await query(
        `INSERT INTO rent_ledger
            (id, ledger_uid, room_id, tenant_id, rent_period, tenant_name, room_number,
             monthly_rent, expected_rent, amount_due, amount_paid, pending_balance,
             status, payment_status, period_month, period_year, rent_due_date, overdue_days,
             created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'TEST TENANT','',
             $6,$7,$7,0,$7,'overdue','overdue',$8,$9,$10,0,$11,$11)`,
        [
            generateId(),
            `TEST-${tenantId.slice(0, 8)}-${period}`,
            roomId,
            tenantId,
            period,
            monthlyRent,
            amountDue,
            month,
            year,
            `${year}-${String(month).padStart(2, '0')}-01`,
            new Date().toISOString()
        ]
    );
}

async function cleanup({ buildingId, tenantId }) {
    await query(`DELETE FROM rent_transactions WHERE tenant_id = $1`, [tenantId]);
    await query(`DELETE FROM tenant_deposit_transactions WHERE tenant_id = $1`, [tenantId]);
    await query(`DELETE FROM rent_ledger WHERE tenant_id = $1`, [tenantId]);
    await query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    await query(`DELETE FROM rooms WHERE building_id = $1`, [buildingId]);
    await query(`DELETE FROM buildings WHERE id = $1`, [buildingId]);
}

async function expectError(fn, name) {
    try {
        await fn();
        assert(false, name, 'an error', 'no error thrown');
    } catch (e) {
        assert(true, name, 'error', e.message);
        console.log(`      ↳ ${e.message}`);
    }
}

async function main() {
    console.log('=== DEPOSIT / SETTLEMENT TESTS ===\n');
    const created = [];

    // ── CASE A: deposit 5000, outstanding 2000 ──
    {
        console.log('CASE A — deposit 5000 / outstanding 2000');
        const ctx = await createTenant({ deposit: 5000, outstanding: 2000, rent: 2000 });
        created.push(ctx);

        const preview = await depositService.previewSettlement(ctx.tenantId);
        assert(preview.settlement.deposit_adjustment === 2000, 'A: deposit adjustment = 2000', 2000, preview.settlement.deposit_adjustment);
        assert(preview.settlement.remaining_outstanding === 0, 'A: remaining outstanding = 0', 0, preview.settlement.remaining_outstanding);
        assert(preview.settlement.refund_amount === 3000, 'A: refund amount = 3000', 3000, preview.settlement.refund_amount);
        assert(preview.settlement.can_move_out === true, 'A: can move out', true, preview.settlement.can_move_out);

        const settled = await depositService.settleAndMoveOut(ctx.tenantId, { collected_by: 'tester' });
        assert(settled.moved_out === true, 'A: moved out', true, settled.moved_out);
        assert(settled.deposit_applied === 2000, 'A: deposit applied 2000', 2000, settled.deposit_applied);
        assert(settled.refund_amount === 3000, 'A: refunded 3000', 3000, settled.refund_amount);
        assert(settled.security_deposit.remaining === 0, 'A: deposit remaining 0', 0, settled.security_deposit.remaining);

        const status = await query(`SELECT status FROM tenants WHERE id=$1`, [ctx.tenantId]);
        assert(status.rows[0].status === 'moved_out', 'A: tenant status moved_out', 'moved_out', status.rows[0].status);
        console.log('');
    }

    // ── CASE B: deposit 5000, outstanding 5000 ──
    {
        console.log('CASE B — deposit 5000 / outstanding 5000');
        const ctx = await createTenant({ deposit: 5000, outstanding: 5000, rent: 5000 });
        created.push(ctx);

        const settled = await depositService.settleAndMoveOut(ctx.tenantId, { collected_by: 'tester' });
        assert(settled.deposit_applied === 5000, 'B: deposit applied 5000', 5000, settled.deposit_applied);
        assert(settled.refund_amount === 0, 'B: refund 0', 0, settled.refund_amount);
        assert(settled.moved_out === true, 'B: moved out', true, settled.moved_out);
        assert((await depositService.getOutstandingRent(ctx.tenantId)) === 0, 'B: outstanding 0', 0, await depositService.getOutstandingRent(ctx.tenantId));
        console.log('');
    }

    // ── CASE C: deposit 5000, outstanding 6500 -> blocked ──
    {
        console.log('CASE C — deposit 5000 / outstanding 6500 (blocked)');
        const ctx = await createTenant({ deposit: 5000, outstanding: 6500, rent: 6500 });
        created.push(ctx);

        const previewC = await depositService.previewSettlement(ctx.tenantId);
        assert(previewC.settlement.deposit_adjustment === 5000, 'C: calculated deposit adjustment = 5000', 5000, previewC.settlement.deposit_adjustment);
        assert(previewC.settlement.remaining_outstanding === 1500, 'C: calculated remaining outstanding = 1500', 1500, previewC.settlement.remaining_outstanding);
        assert(previewC.settlement.refund_amount === 0, 'C: calculated refund = 0', 0, previewC.settlement.refund_amount);
        assert(previewC.settlement.can_move_out === false, 'C: can_move_out = false', false, previewC.settlement.can_move_out);

        await expectError(
            () => depositService.settleAndMoveOut(ctx.tenantId, { collected_by: 'tester' }),
            'C: move-out blocked with outstanding balance'
        );

        const tenant = await query(`SELECT status FROM tenants WHERE id=$1`, [ctx.tenantId]);
        assert(tenant.rows[0].status === 'active', 'C: tenant still active (not moved out)', 'active', tenant.rows[0].status);

        // The settlement is atomic: a blocked move-out rolls everything back.
        const summary = await depositService.getSummary(ctx.tenantId);
        assert(summary.remaining === 5000, 'C: nothing applied (atomic rollback)', 5000, summary.remaining);
        assert((await depositService.getOutstandingRent(ctx.tenantId)) === 6500, 'C: outstanding unchanged', 6500, await depositService.getOutstandingRent(ctx.tenantId));
        console.log('');
    }

    // ── CASE D: deposit 5000, outstanding 0 -> full refund ──
    {
        console.log('CASE D — deposit 5000 / outstanding 0');
        const ctx = await createTenant({ deposit: 5000, outstanding: 0, rent: 5000 });
        created.push(ctx);

        const preview = await depositService.previewSettlement(ctx.tenantId);
        assert(preview.settlement.deposit_adjustment === 0, 'D: no adjustment', 0, preview.settlement.deposit_adjustment);
        assert(preview.settlement.refund_amount === 5000, 'D: refund 5000', 5000, preview.settlement.refund_amount);

        const settled = await depositService.settleAndMoveOut(ctx.tenantId, { collected_by: 'tester' });
        assert(settled.refund_amount === 5000, 'D: refunded 5000', 5000, settled.refund_amount);
        assert(settled.moved_out === true, 'D: moved out', true, settled.moved_out);
        console.log('');
    }

    // ── CASE E: partial pre-move-out adjustment ──
    {
        console.log('CASE E — deposit 5000, rent 2000, apply 1500 early');
        const ctx = await createTenant({ deposit: 5000, outstanding: 2000, rent: 2000 });
        created.push(ctx);

        const applied = await depositService.applyToRent(ctx.tenantId, { amount: 1500, collected_by: 'tester' });
        assert(applied.applied === 1500, 'E: applied 1500', 1500, applied.applied);
        assert(applied.deposit_remaining === 3500, 'E: deposit remaining 3500', 3500, applied.deposit_remaining);
        assert(applied.outstanding_after === 500, 'E: outstanding 500', 500, applied.outstanding_after);

        const txns = await depositService.listTransactions(ctx.tenantId);
        assert(txns.length === 2, 'E: ledger keeps both transactions', 2, txns.length);
        assert(txns.some(t => t.transaction_type === 'received'), 'E: received entry preserved', true, true);
        assert(txns.some(t => t.transaction_type === 'adjustment' && round2(t.amount) === -1500), 'E: adjustment entry is -1500', -1500, 'see ledger');
        console.log('');
    }

    // ── Guard rails ──
    {
        console.log('GUARD RAILS');
        const ctx = await createTenant({ deposit: 1000, outstanding: 500, rent: 500 });
        created.push(ctx);

        await expectError(
            () => depositService.applyToRent(ctx.tenantId, { amount: 5000 }),
            'adjustment greater than available deposit rejected'
        );
        await expectError(
            () => depositService.applyToRent(ctx.tenantId, { amount: 900 }),
            'adjustment greater than outstanding rent rejected'
        );

        // history preserved after the failed attempts
        const txns = await depositService.listTransactions(ctx.tenantId);
        assert(txns.length === 1, 'no ledger rows written by rejected adjustments', 1, txns.length);

        // deposit payment is linked back to the deposit transaction
        const ok = await depositService.applyToRent(ctx.tenantId, { amount: 500, collected_by: 'tester' });
        const payment = await query(`SELECT payment_method, deposit_transaction_id, amount FROM rent_transactions WHERE id = $1`, [ok.payment_id]);
        assert(payment.rows[0].payment_method === 'security_deposit', 'payment method is security_deposit', 'security_deposit', payment.rows[0].payment_method);
        assert(payment.rows[0].deposit_transaction_id === ok.deposit_transaction_id, 'payment links back to the deposit entry', ok.deposit_transaction_id, payment.rows[0].deposit_transaction_id);
        assert(round2(payment.rows[0].amount) === 500, 'payment amount 500', 500, payment.rows[0].amount);
        console.log('');
    }

    // cleanup
    for (const ctx of created) {
        await cleanup(ctx);
    }
    console.log('cleanup done');

    console.log('\n=== RESULT ===');
    console.log(`passed: ${passed}`);
    console.log(`failed: ${failed}`);
    console.log(failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');

    await pool.end();
    process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
    console.error('FATAL:', err.message);
    console.error(err.stack);
    try { await pool.end(); } catch (_) { /* ignore */ }
    process.exit(1);
});
