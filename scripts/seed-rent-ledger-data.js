/**
 * Seed Rent Ledger Data
 *
 * Populates the rent_ledger collection with realistic data so the
 * arrears-based PendingRentService returns meaningful results.
 *
 * Creates ledger entries for the past 3 months (March, April, May 2026)
 * with a realistic mix of paid/pending/overdue statuses.
 *
 * SCENARIO (Today = 14th May 2026):
 *   Test User  (Room 101, AED 5000) - Paid Jan-Apr, May pending (1 month arrears)
 *   Rizwan Ali (Room 102, AED 4500) - Paid Jan, Feb-Apr overdue, May overdue (4 months arrears)
 *   Tenant 105 (Room 105, AED 4000) - Paid Jan-Apr, May pending (1 month arrears)
 *   Tenant 205 (Room 205, AED 3300) - Paid Jan-Mar, Apr overdue, May overdue (2 months arrears)
 *
 * Usage: node scripts/seed-rent-ledger-data.js
 */

const { Client, Databases, ID, Query } = require('node-appwrite');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const RENT_LEDGER_COLLECTION_ID = process.env.APPWRITE_RENT_LEDGER_COLLECTION_ID || 'rent_ledger';

// ============================================================
// LEDGER SCENARIO DEFINITIONS
// ============================================================
// Each tenant has a pattern of monthly ledger entries.
// Status options: 'paid', 'pending', 'overdue', 'partial'
//
// For 'paid' entries: amount_paid = monthly_rent, pending_balance = 0
// For 'pending' entries: amount_paid = 0, pending_balance = monthly_rent
// For 'overdue' entries: amount_paid = 0, pending_balance = monthly_rent

const LEDGER_PATTERNS = [
    // Test User (Room 101, AED 5000) - 1 month arrears (May pending)
    {
        tenant_room_number: '101',
        entries: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'paid' },
            { month: 4, year: 2026, status: 'paid' },
            { month: 5, year: 2026, status: 'pending' }  // Due, not yet paid
        ]
    },
    // Rizwan Ali (Room 102, AED 4500) - 4 months deep arrears
    {
        tenant_room_number: '102',
        entries: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'overdue' },  // Never paid Feb
            { month: 3, year: 2026, status: 'overdue' },  // Never paid Mar
            { month: 4, year: 2026, status: 'overdue' },  // Never paid Apr
            { month: 5, year: 2026, status: 'overdue' }   // May also overdue
        ]
    },
    // Room 105 tenant (AED 4000) - 1 month arrears
    {
        tenant_room_number: '105',
        entries: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'paid' },
            { month: 4, year: 2026, status: 'paid' },
            { month: 5, year: 2026, status: 'pending' }
        ]
    },
    // Room 205 tenant (AED 3300) - 2 months arrears
    {
        tenant_room_number: '205',
        entries: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'paid' },
            { month: 4, year: 2026, status: 'overdue' },  // Apr overdue
            { month: 5, year: 2026, status: 'overdue' }   // May overdue
        ]
    }
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateLedgerUid(tenantId, month, year) {
    // Generate a unique ledger_uid like: LEDGER-{tenantId}-{year}{month}
    return `LEDGER-${tenantId.substring(0, 8)}-${year}${String(month).padStart(2, '0')}`;
}

/**
 * Determine the actual payment_status for a ledger entry.
 * 'pending' entries whose due date has passed become 'overdue'.
 */
function computeLedgerFields(entryStatus, monthlyRent, month, year) {
    const now = new Date();
    const dueDate = new Date(year, month - 1, 1);
    const diffTime = now.getTime() - dueDate.getTime();
    const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    let amountPaid = 0;
    let pendingBalance = monthlyRent;
    let status = entryStatus;
    let paymentStatus = entryStatus;

    if (entryStatus === 'paid') {
        amountPaid = monthlyRent;
        pendingBalance = 0;
        paymentStatus = 'paid';
        status = 'paid';
    } else if (entryStatus === 'pending') {
        // If the due date has passed, it's actually overdue
        if (overdueDays > 0) {
            status = 'overdue';
            paymentStatus = 'overdue';
        }
    } else if (entryStatus === 'overdue') {
        status = 'overdue';
        paymentStatus = 'overdue';
    }

    return { amountPaid, pendingBalance, status, paymentStatus, overdueDays };
}

// ============================================================
// MAIN SEEDER
// ============================================================

async function seedRentLedgerData() {
    console.log('==============================================');
    console.log('  RENT LEDGER DATA SEEDER');
    console.log('  Populates rent_ledger for arrears testing');
    console.log('==============================================');
    console.log(`  Database ID: ${DATABASE_ID}`);
    console.log(`  Current Time: ${new Date().toISOString()}`);
    console.log('==============================================\n');

    try {
        // Step 1: Fetch all rooms
        console.log('Fetching rooms...');
        const roomsResult = await databases.listDocuments(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            [],
            100
        );
        const rooms = roomsResult.documents;
        console.log(`  Found ${rooms.length} rooms.`);

        // Build room number -> room lookup
        const roomByNumber = {};
        rooms.forEach(room => { roomByNumber[room.room_number] = room; });

        // Step 2: Fetch all active tenants
        console.log('Fetching active tenants...');
        const tenantsResult = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [Query.equal('status', 'active')],
            100
        );
        const activeTenants = tenantsResult.documents;
        console.log(`  Found ${activeTenants.length} active tenants.`);

        // Build room_id -> tenant lookup
        const tenantByRoomId = {};
        activeTenants.forEach(t => { tenantByRoomId[t.room_id] = t; });

        // Step 3: Check existing ledger entries to avoid duplicates
        console.log('\nChecking existing rent_ledger entries...');
        const existingResult = await databases.listDocuments(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            [],
            1000
        );
        const existingLedgers = existingResult.documents;
        const existingKeySet = new Set();
        existingLedgers.forEach(entry => {
            existingKeySet.add(`${entry.tenant_id}:${entry.period_month}:${entry.period_year}`);
        });
        console.log(`  Found ${existingLedgers.length} existing ledger entries.`);

        // Step 4: Create ledger entries based on patterns
        console.log('\nCreating rent_ledger entries...');
        let createdCount = 0;
        let skippedCount = 0;

        for (const pattern of LEDGER_PATTERNS) {
            // Find the tenant by room number
            const room = roomByNumber[pattern.tenant_room_number];
            if (!room) {
                console.log(`  [SKIP] Room ${pattern.tenant_room_number} not found`);
                skippedCount++;
                continue;
            }

            const tenant = tenantByRoomId[room.$id];
            if (!tenant) {
                console.log(`  [SKIP] No active tenant in Room ${pattern.tenant_room_number}`);
                skippedCount++;
                continue;
            }

            const monthlyRent = parseFloat(room.monthly_rent) || parseFloat(tenant.monthly_rent) || 1500;
            const roomNumber = room.room_number;

            console.log(`\n  Processing: ${tenant.full_name} (Room ${roomNumber}, AED ${monthlyRent})`);

            for (const entry of pattern.entries) {
                const key = `${tenant.$id}:${entry.month}:${entry.year}`;

                if (existingKeySet.has(key)) {
                    console.log(`    [SKIP] ${entry.month}/${entry.year} already exists`);
                    skippedCount++;
                    continue;
                }

                const { amountPaid, pendingBalance, status, paymentStatus, overdueDays } =
                    computeLedgerFields(entry.status, monthlyRent, entry.month, entry.year);

                const dueDateStr = `${entry.year}-${String(entry.month).padStart(2, '0')}-01`;
                const rentPeriod = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
                const ledgerUid = generateLedgerUid(tenant.$id, entry.month, entry.year);

                try {
                    await databases.createDocument(
                        DATABASE_ID,
                        RENT_LEDGER_COLLECTION_ID,
                        ID.unique(),
                        {
                            ledger_uid: ledgerUid,
                            tenant_id: tenant.$id,
                            tenant_name: tenant.full_name || 'Unknown',
                            room_id: tenant.room_id || '',
                            room_number: roomNumber,
                            monthly_rent: monthlyRent,
                            expected_rent: monthlyRent,
                            amount_due: monthlyRent,
                            amount_paid: amountPaid,
                            pending_balance: pendingBalance,
                            status: status,
                            payment_status: paymentStatus,
                            period_month: entry.month,
                            period_year: entry.year,
                            rent_period: rentPeriod,
                            rent_due_date: dueDateStr,
                            overdue_days: overdueDays,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                    );

                    const statusIcon = status === 'paid' ? 'PAID' : (status === 'overdue' ? 'OVER' : 'PEND');
                    console.log(`    [${statusIcon}] ${entry.month}/${entry.year} - ${monthlyRent} AED - ${status}${overdueDays > 0 ? ` (${overdueDays}d overdue)` : ''}`);
                    createdCount++;
                } catch (error) {
                    console.error(`    [ERROR] Failed to create ledger for ${entry.month}/${entry.year}: ${error.message}`);
                }

                await sleep(100);
            }
        }

        // ============================================================
        // SUMMARY
        // ============================================================
        console.log('\n==============================================');
        console.log('  SEEDING COMPLETE');
        console.log('==============================================');
        console.log(`  Created:  ${createdCount} ledger entries`);
        console.log(`  Skipped:  ${skippedCount} entries`);
        console.log('');

        // Show what the API should return
        console.log('  Expected Pending Rent Results (arrears-based):');
        console.log('  ─────────────────────────────────────────────────────');
        console.log('  Rizwan Ali (Room 102) - AED 4500/mo - 4 months arrears = AED 18,000');
        console.log('  Room 205 Tenant       - AED 3300/mo - 2 months arrears = AED 6,600');
        console.log('  Test User  (Room 101) - AED 5000/mo - 1 month arrears  = AED 5,000');
        console.log('  Room 105 Tenant       - AED 4000/mo - 1 month arrears  = AED 4,000');
        console.log('');
        console.log('  To test the API:');
        console.log('  - GET http://localhost:3001/api/rent/pending');
        console.log('  - GET http://localhost:3001/api/rent/pending/summary');
        console.log('  - GET http://localhost:3001/api/rent/pending/stats');
        console.log('==============================================\n');

    } catch (error) {
        console.error('\nFatal error during seeding:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedRentLedgerData();
}

module.exports = { seedRentLedgerData };
