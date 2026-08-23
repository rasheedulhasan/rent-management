/**
 * Monthly rent rollover — automated test.
 *
 * Runs against the REAL environment: Postgres via DATABASE_URL (.env / Neon),
 * and the REAL schema (rent_ledger, not "tenant_ledger").
 *
 * SAFETY NOTE:
 *   This test exercises the carry-forward logic via RentLedgerCycleService's
 *   per-tenant `_rolloverTenant()` so it ONLY touches the throwaway test tenant.
 *
 *   Do NOT point the global endpoints (POST /api/rent-ledger/cycle/rollover or
 *   /cycle/catchup) at this test — they iterate over ALL active tenants and
 *   would mutate real production rows.
 *
 * Run: node test/rent-rollover.test.js   (server need NOT be running)
 */

const { Pool } = require('pg');
require('dotenv').config();

const { databases, DATABASE_ID, TENANTS_COLLECTION_ID } = require('../src/config/appwrite');
const RentLedgerCycleService = require('../src/services/RentLedgerCycleService');

// Real DB connection (Neon serverless Postgres via .env)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TEST_TENANT_ID = `test-tenant-${Date.now()}`;
const TENANT_RENT = 10000;

let passed = 0;
let failed = 0;

function assert(condition, name, expected, actual) {
    if (condition) {
        passed++;
        console.log(`✅ ${name}`);
    } else {
        failed++;
        console.log(`❌ ${name}`);
        console.log(`   Expected: ${expected}`);
        console.log(`   Actual:   ${actual}`);
    }
    return condition;
}

async function getTestTenantDoc() {
    // Fetch via the shim so it has the exact shape _rolloverTenant expects
    // ({ $id, full_name, room_id, monthly_rent, ... }).
    return databases.getDocument(DATABASE_ID, TENANTS_COLLECTION_ID, TEST_TENANT_ID);
}

async function insertLedgerRow(periodMonth, periodYear, expectedRent, status, paymentStatus, pendingBalance) {
    const id = `test-ledger-${periodYear}${String(periodMonth).padStart(2, '0')}-${Date.now()}`;
    const rentPeriod = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
    const ledgerUid = `TEST-${TEST_TENANT_ID.substring(0, 8)}-${periodYear}${String(periodMonth).padStart(2, '0')}`;
    const rentDueDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;

    await pool.query(
        `INSERT INTO rent_ledger (
            id, ledger_uid, room_id, tenant_id, rent_period, tenant_name,
            monthly_rent, expected_rent, amount_due, amount_paid, pending_balance,
            status, payment_status, period_month, period_year, rent_due_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
            id, ledgerUid, 'test-room', TEST_TENANT_ID, rentPeriod, 'Test Tenant',
            TENANT_RENT, expectedRent, expectedRent, 0, pendingBalance,
            status, paymentStatus, periodMonth, periodYear, rentDueDate,
            new Date().toISOString(), new Date().toISOString()
        ]
    );
}

async function getLedgerRow(periodMonth, periodYear) {
    const { rows } = await pool.query(
        'SELECT * FROM rent_ledger WHERE tenant_id = $1 AND period_month = $2 AND period_year = $3',
        [TEST_TENANT_ID, periodMonth, periodYear]
    );
    return rows[0] || null;
}

async function setup() {
    console.log('\n🧪 SETTING UP TEST ENVIRONMENT...');
    await pool.query(
        `INSERT INTO tenants (id, room_id, full_name, phone_number, check_in_date, monthly_rent, billing_day, status)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6, 'active')`,
        [TEST_TENANT_ID, 'test-room', 'Test Tenant', '+0000000000', TENANT_RENT, 1]
    );
    console.log(`✅ Test tenant created: ${TEST_TENANT_ID}`);
}

async function cleanup() {
    console.log('\n🧹 CLEANING UP TEST DATA...');
    await pool.query('DELETE FROM rent_ledger WHERE tenant_id = $1', [TEST_TENANT_ID]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [TEST_TENANT_ID]);
    console.log('✅ Cleanup complete');
    await pool.end();
}

async function runAllTests() {
    console.log('\n🚀 ========================================');
    console.log('🚀 STARTING AUTOMATED ROLLOVER TESTS');
    console.log('🚀 ========================================\n');

    await setup();
    const tenant = await getTestTenantDoc();

    // ── TEST 1: Create initial January 2026 rent record ──
    await insertLedgerRow(1, 2026, TENANT_RENT, 'pending', 'pending', TENANT_RENT);
    const janBefore = await getLedgerRow(1, 2026);
    assert(
        janBefore && Number(janBefore.pending_balance) === TENANT_RENT && janBefore.status === 'pending',
        'Initial January rent record created',
        '1 record with balance 10000, status pending',
        `balance=${janBefore?.pending_balance}, status=${janBefore?.status}`
    );

    // ── TEST 2: Rollover January → February ──
    const febRollover = await RentLedgerCycleService._rolloverTenant(tenant, 2, 2026);
    const janAfter = await getLedgerRow(1, 2026);
    const febRow = await getLedgerRow(2, 2026);
    assert(
        janAfter?.status === 'rolled_over' &&
        febRow?.status === 'overdue' &&
        Number(febRow?.expected_rent) === 20000,
        'Rollover January → February (Jan rolled_over, Feb = 20000 overdue)',
        'Jan: rolled_over, Feb: 20000 overdue',
        `Jan=${janAfter?.status}, Feb=${febRow?.status}, expected_rent=${febRow?.expected_rent}, created=${febRollover.created}`
    );

    // ── TEST 3: Simulate partial payment of 5000 in February ──
    await pool.query(
        `UPDATE rent_ledger
         SET amount_paid = 5000, pending_balance = 15000, status = 'partial', payment_status = 'partial'
         WHERE tenant_id = $1 AND period_month = 2 AND period_year = 2026`,
        [TEST_TENANT_ID]
    );
    const febAfterPay = await getLedgerRow(2, 2026);
    assert(
        Number(febAfterPay?.pending_balance) === 15000 && febAfterPay?.status === 'partial',
        'Partial payment of 5000 applied (Feb = 15000 partial)',
        'Balance 15000, status partial',
        `balance=${febAfterPay?.pending_balance}, status=${febAfterPay?.status}`
    );

    // ── TEST 4: Rollover February → March ──
    await RentLedgerCycleService._rolloverTenant(tenant, 3, 2026);
    const febAfterRoll = await getLedgerRow(2, 2026);
    const marRow = await getLedgerRow(3, 2026);
    assert(
        febAfterRoll?.status === 'rolled_over' &&
        marRow?.status === 'overdue' &&
        Number(marRow?.expected_rent) === 25000,
        'Rollover February → March (Feb rolled_over, Mar = 25000 overdue)',
        'Feb: rolled_over, Mar: 25000 overdue',
        `Feb=${febAfterRoll?.status}, Mar=${marRow?.status}, expected_rent=${marRow?.expected_rent}`
    );

    // ── TEST 5: No double counting ──
    const { rows: sumRows } = await pool.query(
        `SELECT COALESCE(SUM(pending_balance), 0) AS total_pending
         FROM rent_ledger
         WHERE tenant_id = $1 AND status IN ('pending', 'overdue', 'partial')`,
        [TEST_TENANT_ID]
    );
    const totalPending = Number(sumRows[0].total_pending);
    assert(
        totalPending === 25000,
        'No double counting — only current (March) month is open',
        'Total open: 25000',
        `Total open: ${totalPending}`
    );

    // ── TEST 6: History preserved (rolled_over rows kept, not deleted) ──
    const { rows: histRows } = await pool.query(
        `SELECT COUNT(*) AS count FROM rent_ledger WHERE tenant_id = $1 AND status = 'rolled_over'`,
        [TEST_TENANT_ID]
    );
    const rolledOverCount = Number(histRows[0].count);
    assert(
        rolledOverCount === 2,
        'Historical data preserved (Jan & Feb kept as rolled_over)',
        '2 rolled_over records',
        `${rolledOverCount} rolled_over records`
    );

    // ── TEST 7: Full cycle summary table ──
    const { rows: allRows } = await pool.query(
        `SELECT period_year, period_month, expected_rent, pending_balance, status
         FROM rent_ledger WHERE tenant_id = $1 ORDER BY period_year, period_month`,
        [TEST_TENANT_ID]
    );
    console.log('\n📊 FULL HISTORY:');
    console.table(allRows);
    assert(
        allRows.length === 3 && allRows.filter(r => r.status === 'rolled_over').length === 2,
        'Complete cycle verified (3 total: 2 rolled_over, 1 active)',
        '3 rows, 2 rolled_over',
        `${allRows.length} rows, ${allRows.filter(r => r.status === 'rolled_over').length} rolled_over`
    );

    // ── SUMMARY ──
    console.log('\n📊 ========================================');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('📊 ========================================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total: ${passed + failed}`);
    console.log(`🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
    console.log(failed === 0 ? '\n🎉 ALL TESTS PASSED!' : `\n⚠️ ${failed} test(s) failed.`);

    await cleanup();
}

runAllTests().catch(async (error) => {
    console.error('❌ Fatal error:', error.message || error);
    try { await cleanup(); } catch (_) {}
    process.exit(1);
});
