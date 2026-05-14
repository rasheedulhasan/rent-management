/**
 * Reset & Setup Arrears Test Case
 * 
 * This script:
 * 1. Deletes ALL documents in rent_ledger and rent_transactions collections
 * 2. Finds the "Ahmed Khan" tenant
 * 3. Ensures their monthly_rent is set to 5000
 * 4. Creates April 2026 ledger entry (historical debt)
 * 5. Creates May 2026 ledger entry (current debt)
 * 
 * Usage: node scripts/reset-and-setup-arrears-test.js
 */

const { ID, Query, databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID, RENT_TRANSACTIONS_COLLECTION_ID, TENANTS_COLLECTION_ID } = require('../src/config/appwrite');

const TENANT_NAME = 'Ahmed Khan';
const MONTHLY_RENT = 5000;

/**
 * Delete all documents in a collection by paginating through all records.
 */
async function deleteAllDocuments(collectionId, label) {
    console.log(`\n🗑️  Deleting all documents in ${label}...`);
    let totalDeleted = 0;

    while (true) {
        const result = await databases.listDocuments(
            DATABASE_ID,
            collectionId,
            [],
            100
        );

        const docs = result.documents || [];
        if (docs.length === 0) {
            console.log(`   ✓ No more documents to delete in ${label}`);
            break;
        }

        for (const doc of docs) {
            await databases.deleteDocument(DATABASE_ID, collectionId, doc.$id);
            totalDeleted++;
        }

        console.log(`   Deleted ${totalDeleted} documents so far from ${label}...`);
    }

    console.log(`   ✅ Deleted ${totalDeleted} documents from ${label}`);
    return totalDeleted;
}

/**
 * Find a tenant by full_name.
 */
async function findTenantByName(name) {
    console.log(`\n🔍 Searching for tenant: "${name}"...`);
    
    const result = await databases.listDocuments(
        DATABASE_ID,
        TENANTS_COLLECTION_ID,
        [Query.equal('full_name', name)],
        10
    );

    const tenants = result.documents || [];
    if (tenants.length === 0) {
        console.log(`   ❌ Tenant "${name}" not found!`);
        return null;
    }

    const tenant = tenants[0];
    console.log(`   ✅ Found tenant:`);
    console.log(`      ID: ${tenant.$id}`);
    console.log(`      Name: ${tenant.full_name}`);
    console.log(`      Room ID: ${tenant.room_id}`);
    console.log(`      Current monthly_rent: ${tenant.monthly_rent}`);
    console.log(`      Status: ${tenant.status}`);

    return tenant;
}

/**
 * Update tenant's monthly_rent.
 */
async function updateTenantMonthlyRent(tenantId, newRent, billingDay) {
    console.log(`\n💰 Updating tenant ${tenantId} monthly_rent to ${newRent}...`);
    
    const updateData = { monthly_rent: newRent };
    // billing_day is required - use existing value or default to 1
    updateData.billing_day = billingDay || 1;
    
    await databases.updateDocument(
        DATABASE_ID,
        TENANTS_COLLECTION_ID,
        tenantId,
        updateData
    );

    console.log(`   ✅ monthly_rent updated to ${newRent}, billing_day set to ${updateData.billing_day}`);
}

/**
 * Create a rent_ledger document.
 */
async function createLedgerEntry(tenant, periodMonth, periodYear, amountDue) {
    const ledgerUid = `${tenant.$id}_${String(periodMonth).padStart(2, '0')}_${periodYear}`;
    const rentPeriod = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
    const dueDateStr = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[periodMonth] || periodMonth;

    console.log(`\n📝 Creating ledger entry for ${monthName} ${periodYear}...`);
    console.log(`   ledger_uid: ${ledgerUid}`);
    console.log(`   amount_due: ${amountDue}`);
    console.log(`   pending_balance: ${amountDue}`);
    console.log(`   payment_status: pending`);

    const doc = await databases.createDocument(
        DATABASE_ID,
        RENT_LEDGER_COLLECTION_ID,
        ID.unique(),
        {
            // Using ledger_uid as a unique identifier (user added unique index on this)
            ledger_uid: ledgerUid,
            tenant_id: tenant.$id,
            tenant_name: tenant.full_name,
            room_id: tenant.room_id || '',
            room_number: tenant.room_number || '',
            monthly_rent: amountDue,
            expected_rent: amountDue,
            amount_due: amountDue,
            amount_paid: 0,
            pending_balance: amountDue,
            status: 'pending',
            payment_status: 'pending',
            period_month: periodMonth,
            period_year: periodYear,
            rent_period: rentPeriod,
            rent_due_date: dueDateStr,
            overdue_days: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    );

    console.log(`   ✅ Created ledger entry: ${doc.$id}`);
    return doc;
}

/**
 * Main execution.
 */
async function main() {
    console.log('══════════════════════════════════════════════');
    console.log('  RESET & SETUP ARREARS TEST CASE');
    console.log('══════════════════════════════════════════════\n');

    // ── Step 1: Wipe Data ──
    console.log('─── STEP 1: Wipe Data ───');
    await deleteAllDocuments(RENT_LEDGER_COLLECTION_ID, 'rent_ledger');
    await deleteAllDocuments(RENT_TRANSACTIONS_COLLECTION_ID, 'rent_transactions');

    // ── Step 2: Find Ahmed Khan ──
    console.log('\n─── STEP 2: Find Test Tenant ───');
    const tenant = await findTenantByName(TENANT_NAME);
    if (!tenant) {
        console.error('\n❌ Cannot proceed without tenant. Exiting.');
        process.exit(1);
    }

    // ── Step 3: Ensure monthly_rent = 5000 ──
    console.log('\n─── STEP 3: Set Monthly Rent ───');
    if (parseFloat(tenant.monthly_rent) !== MONTHLY_RENT) {
        await updateTenantMonthlyRent(tenant.$id, MONTHLY_RENT, tenant.billing_day);
    } else {
        console.log(`   ✓ monthly_rent is already ${MONTHLY_RENT}`);
    }

    // ── Step 4: Create April 2026 Debt ──
    console.log('\n─── STEP 4: Create Historical Debt (April 2026) ───');
    const aprilEntry = await createLedgerEntry(tenant, 4, 2026, MONTHLY_RENT);

    // ── Step 5: Create May 2026 Debt ──
    console.log('\n─── STEP 5: Create Current Debt (May 2026) ───');
    const mayEntry = await createLedgerEntry(tenant, 5, 2026, MONTHLY_RENT);

    // ── Summary ──
    console.log('\n══════════════════════════════════════════════');
    console.log('  ✅ SETUP COMPLETE');
    console.log('══════════════════════════════════════════════');
    console.log(`\nTenant: ${tenant.full_name} (${tenant.$id})`);
    console.log(`Monthly Rent: ${MONTHLY_RENT}`);
    console.log(`\nLedger Entries Created:`);
    console.log(`  1. April 2026: ${aprilEntry.$id} (amount_due: ${aprilEntry.amount_due}, pending: ${aprilEntry.pending_balance})`);
    console.log(`  2. May 2026: ${mayEntry.$id} (amount_due: ${mayEntry.amount_due}, pending: ${mayEntry.pending_balance})`);
    console.log(`\nExpected API Response:`);
    console.log(`  - Tenant: ${tenant.full_name}`);
    console.log(`  - total_due: ${MONTHLY_RENT * 2} (10000)`);
    console.log(`  - arrears_months: 2`);
    console.log(`\nVerify by calling:`);
    console.log(`  curl http://localhost:3001/api/rent/pending`);
    console.log('\n══════════════════════════════════════════════\n');
}

main().catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
});
