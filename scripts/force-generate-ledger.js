/**
 * ============================================
 * FORCE GENERATE LEDGER ENTRY
 * ============================================
 *
 * Creates a rent_ledger entry for ANY tenant for a SPECIFIC month and year.
 * This allows testing the "Pending Rent" list for future months
 * without waiting for the actual date to change.
 *
 * USAGE:
 *   Interactive mode:
 *     node scripts/force-generate-ledger.js
 *
 *   Direct mode (all args):
 *     node scripts/force-generate-ledger.js --tenant "<name|room|id>" --month 6 --year 2026
 *
 *   With optional status:
 *     node scripts/force-generate-ledger.js --tenant "Ahmed" --month 7 --year 2026 --status pending
 *
 * LEDGER_UID FORMAT:
 *   {tenant_id}_{month}_{year}
 *   Example: 6789abc12345_6_2026
 *
 * SCENARIOS TESTED:
 *   New Tenant    - No ledger entries exist → Not shown in pending list
 *   Active Tenant - Has ledger + unpaid status → Shows in pending list
 *   Future Month  - Manually add ledger for June/July → App displays it correctly
 *
 * STATUS OPTIONS:
 *   pending  - (default) Shows in pending list, not yet overdue
 *   overdue  - Shows in pending list as overdue
 *   paid     - Does NOT show in pending list (for testing exclusion)
 * ============================================
 */

const { Client, Databases, ID, Query } = require('node-appwrite');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ── Appwrite Client ──────────────────────────────────────────
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const RENT_LEDGER_COLLECTION_ID = process.env.APPWRITE_RENT_LEDGER_COLLECTION_ID || 'rent_ledger';

// ── Helpers ───────────────────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {};

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--tenant':
                parsed.tenant = args[++i];
                break;
            case '--month':
                parsed.month = parseInt(args[++i]);
                break;
            case '--year':
                parsed.year = parseInt(args[++i]);
                break;
            case '--status':
                parsed.status = args[++i];
                break;
            case '--help':
            case '-h':
                parsed.help = true;
                break;
        }
    }

    return parsed;
}

function showHelp() {
    console.log(`
  FORCE GENERATE LEDGER ENTRY
  ───────────────────────────────────────────────────────────
  Creates a rent_ledger entry for any tenant for a specific
  month and year to test the Pending Rent list.

  USAGE:
    node scripts/force-generate-ledger.js
        → Interactive mode (prompts for inputs)

    node scripts/force-generate-ledger.js --tenant "<value>" --month <M> --year <Y>
        → Direct mode

  OPTIONS:
    --tenant "<value>"   Tenant name (partial match), room number, or Appwrite $id
    --month <1-12>       Target month (e.g., 6 for June)
    --year <YYYY>        Target year (e.g., 2026)
    --status <status>    Ledger status: pending (default), overdue, paid
    --help, -h           Show this help

  LEDGER_UID FORMAT: {tenant_id}_{month}_{year}
    Example: 6789abc12345_6_2026

  EXAMPLES:
    node scripts/force-generate-ledger.js --tenant "Ahmed" --month 6 --year 2026
    node scripts/force-generate-ledger.js --tenant "101" --month 7 --year 2026 --status overdue
    node scripts/force-generate-ledger.js --tenant "6789abc12345" --month 6 --year 2026
`);
}

// ── Interactive Prompt ────────────────────────────────────────
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(query, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function interactiveMode() {
    console.log('\n  ╔══════════════════════════════════════════════╗');
    console.log('  ║     FORCE GENERATE LEDGER ENTRY              ║');
    console.log('  ║     Interactive Mode                         ║');
    console.log('  ╚══════════════════════════════════════════════╝\n');

    const tenant = await askQuestion('  Enter tenant name, room number, or ID: ');
    if (!tenant) {
        console.log('\n  [ABORT] No tenant identifier provided.\n');
        process.exit(0);
    }

    const monthStr = await askQuestion('  Enter month (1-12): ');
    const month = parseInt(monthStr);
    if (isNaN(month) || month < 1 || month > 12) {
        console.log('\n  [ERROR] Invalid month. Must be between 1 and 12.\n');
        process.exit(1);
    }

    const yearStr = await askQuestion('  Enter year (e.g., 2026): ');
    const year = parseInt(yearStr);
    if (isNaN(year) || year < 2000) {
        console.log('\n  [ERROR] Invalid year.\n');
        process.exit(1);
    }

    const statusStr = await askQuestion('  Enter status [pending/overdue/paid] (default: pending): ');
    const status = statusStr || 'pending';

    if (!['pending', 'overdue', 'paid'].includes(status)) {
        console.log('\n  [ERROR] Invalid status. Must be: pending, overdue, or paid.\n');
        process.exit(1);
    }

    return { tenant, month, year, status };
}

// ── Tenant Lookup ─────────────────────────────────────────────
async function findTenant(identifier) {
    console.log(`\n  🔍 Looking up tenant: "${identifier}"`);

    // Strategy 1: Try as Appwrite $id (direct match)
    try {
        const result = await databases.getDocument(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            identifier
        );
        if (result) {
            console.log(`  ✅ Found by ID: ${result.full_name} (Room: ${result.room_id || 'N/A'})`);
            return result;
        }
    } catch (e) {
        // Not a valid $id, continue to other strategies
    }

    // Strategy 2: Try as room number
    try {
        const roomsResult = await databases.listDocuments(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            [Query.equal('room_number', identifier)],
            1
        );
        if (roomsResult.documents && roomsResult.documents.length > 0) {
            const room = roomsResult.documents[0];
            // Find tenant in this room
            const tenantsResult = await databases.listDocuments(
                DATABASE_ID,
                TENANTS_COLLECTION_ID,
                [
                    Query.equal('room_id', room.$id),
                    Query.equal('status', 'active')
                ],
                1
            );
            if (tenantsResult.documents && tenantsResult.documents.length > 0) {
                const tenant = tenantsResult.documents[0];
                console.log(`  ✅ Found by Room ${identifier}: ${tenant.full_name} (ID: ${tenant.$id})`);
                return tenant;
            }
            console.log(`  ⚠️  Room ${identifier} found but no active tenant assigned.`);
            // Still return the room info so user knows
            return null;
        }
    } catch (e) {
        // Room lookup failed
    }

    // Strategy 3: Search by name (partial match)
    try {
        const tenantsResult = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [Query.equal('status', 'active')],
            100
        );

        if (tenantsResult.documents) {
            const searchLower = identifier.toLowerCase();
            const matches = tenantsResult.documents.filter(t =>
                (t.full_name || '').toLowerCase().includes(searchLower) ||
                (t.phone_number || '').includes(identifier) ||
                (t.email || '').toLowerCase().includes(searchLower)
            );

            if (matches.length === 1) {
                const tenant = matches[0];
                console.log(`  ✅ Found by name: ${tenant.full_name} (ID: ${tenant.$id})`);
                return tenant;
            }

            if (matches.length > 1) {
                console.log(`\n  ⚠️  Multiple tenants match "${identifier}":`);
                matches.forEach((t, i) => {
                    console.log(`     ${i + 1}. ${t.full_name} (ID: ${t.$id})`);
                });
                console.log('\n  Please use a more specific identifier or the exact $id.\n');
                return null;
            }
        }
    } catch (e) {
        console.error(`  [ERROR] Tenant search failed: ${e.message}`);
    }

    console.log(`  ❌ No tenant found matching "${identifier}".\n`);
    console.log('  Tips:');
    console.log('  - Use a partial name (e.g., "Ahmed" matches "Ahmed Khan")');
    console.log('  - Use a room number (e.g., "101")');
    console.log('  - Use the exact Appwrite document $id');
    console.log('  - Ensure the tenant has status = "active"\n');
    return null;
}

// ── Room Lookup ───────────────────────────────────────────────
async function getRoomDetails(roomId) {
    if (!roomId) return { room_number: '', monthly_rent: 0 };
    try {
        const room = await databases.getDocument(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            roomId
        );
        return {
            room_number: room.room_number || '',
            monthly_rent: parseFloat(room.monthly_rent) || 0
        };
    } catch (e) {
        return { room_number: '', monthly_rent: 0 };
    }
}

// ── Check for Existing Entry ──────────────────────────────────
async function checkExistingEntry(tenantId, month, year) {
    try {
        const result = await databases.listDocuments(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            [
                Query.equal('tenant_id', tenantId),
                Query.equal('period_month', month),
                Query.equal('period_year', year)
            ],
            1
        );
        return result.documents && result.documents.length > 0 ? result.documents[0] : null;
    } catch (e) {
        return null;
    }
}

// ── Generate Ledger UID ───────────────────────────────────────
function generateLedgerUid(tenantId, month, year) {
    // Format: {tenant_id}_{month}_{year}
    // Example: 6789abc12345_6_2026
    return `${tenantId}_${month}_${year}`;
}

// ── Create Ledger Entry ───────────────────────────────────────
async function createLedgerEntry(tenant, month, year, status, roomDetails) {
    const monthlyRent = parseFloat(tenant.monthly_rent) || roomDetails.monthly_rent || 0;

    if (monthlyRent <= 0) {
        console.log(`\n  ❌ Tenant "${tenant.full_name}" has monthly_rent = ${monthlyRent}. Cannot create ledger entry.\n`);
        return null;
    }

    const dueDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const rentPeriod = `${year}-${String(month).padStart(2, '0')}`;
    const ledgerUid = generateLedgerUid(tenant.$id, month, year);

    // Compute fields based on status
    let amountPaid = 0;
    let pendingBalance = monthlyRent;
    let paymentStatus = status;
    let entryStatus = status;
    let overdueDays = 0;

    if (status === 'paid') {
        amountPaid = monthlyRent;
        pendingBalance = 0;
        paymentStatus = 'paid';
        entryStatus = 'paid';
    } else if (status === 'overdue') {
        // Calculate overdue days from the 1st of the month
        const now = new Date();
        const dueDate = new Date(year, month - 1, 1);
        const diffTime = now.getTime() - dueDate.getTime();
        overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        paymentStatus = 'overdue';
        entryStatus = 'overdue';
    } else {
        // pending
        paymentStatus = 'pending';
        entryStatus = 'pending';
    }

    const entryData = {
        ledger_uid: ledgerUid,
        tenant_id: tenant.$id,
        tenant_name: tenant.full_name || 'Unknown',
        room_id: tenant.room_id || '',
        room_number: roomDetails.room_number,
        monthly_rent: monthlyRent,
        expected_rent: monthlyRent,
        amount_due: monthlyRent,
        amount_paid: amountPaid,
        pending_balance: pendingBalance,
        status: entryStatus,
        payment_status: paymentStatus,
        period_month: month,
        period_year: year,
        rent_period: rentPeriod,
        rent_due_date: dueDateStr,
        overdue_days: overdueDays,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    try {
        const doc = await databases.createDocument(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            ID.unique(),
            entryData
        );

        console.log(`\n  ✅ LEDGER ENTRY CREATED SUCCESSFULLY`);
        console.log(`  ─────────────────────────────────────────────`);
        console.log(`  Tenant:        ${tenant.full_name}`);
        console.log(`  Room:          ${roomDetails.room_number || 'N/A'}`);
        console.log(`  Period:        ${month}/${year}`);
        console.log(`  Monthly Rent:  AED ${monthlyRent}`);
        console.log(`  Status:        ${entryStatus}`);
        console.log(`  Ledger UID:    ${ledgerUid}`);
        console.log(`  Document ID:   ${doc.$id}`);
        console.log(`  Due Date:      ${dueDateStr}`);
        if (overdueDays > 0) {
            console.log(`  Overdue Days:  ${overdueDays}`);
        }
        console.log(`  ─────────────────────────────────────────────`);

        return doc;
    } catch (error) {
        console.error(`\n  ❌ Failed to create ledger entry: ${error.message}\n`);
        return null;
    }
}

// ── Show Pending Rent Impact ──────────────────────────────────
function showImpact(tenant, month, year, status) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    console.log(`\n  📋 PENDING RENT TEST IMPACT`);
    console.log(`  ─────────────────────────────────────────────`);

    if (status === 'paid') {
        console.log(`  This entry is "paid" — it will NOT appear in the`);
        console.log(`  pending rent list for ${monthNames[month - 1]} ${year}.`);
        console.log(`  Use this to verify paid entries are excluded.`);
    } else {
        console.log(`  This entry has status "${status}" — it WILL appear`);
        console.log(`  in the pending rent list for ${monthNames[month - 1]} ${year}.`);
        console.log(``);
        console.log(`  To verify, call the API:`);
        console.log(`    GET /api/rent/pending`);
        console.log(`    GET /api/rent-ledger/cycle/status?month=${month}&year=${year}`);
    }

    console.log(`  ─────────────────────────────────────────────`);
    console.log(`  Current time: ${new Date().toISOString()}`);
    console.log(`  User time:    ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' })} (UAE)`);
    console.log(`  ─────────────────────────────────────────────\n`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║     FORCE GENERATE LEDGER ENTRY              ║');
    console.log('  ║     Mock Data Script for Testing             ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log(`  Database: ${DATABASE_ID}`);
    console.log(`  Ledger Collection: ${RENT_LEDGER_COLLECTION_ID}`);
    console.log(`  Ledger UID Format: {tenant_id}_{month}_{year}`);
    console.log(`  Current Time: ${new Date().toISOString()}`);
    console.log('');

    const args = parseArgs();

    if (args.help) {
        showHelp();
        process.exit(0);
    }

    // Get inputs
    let tenantIdentifier, month, year, status;

    if (args.tenant && args.month && args.year) {
        tenantIdentifier = args.tenant;
        month = args.month;
        year = args.year;
        status = args.status || 'pending';

        if (month < 1 || month > 12) {
            console.log('  [ERROR] Invalid month. Must be between 1 and 12.\n');
            process.exit(1);
        }
        if (year < 2000) {
            console.log('  [ERROR] Invalid year.\n');
            process.exit(1);
        }
        if (!['pending', 'overdue', 'paid'].includes(status)) {
            console.log('  [ERROR] Invalid status. Must be: pending, overdue, or paid.\n');
            process.exit(1);
        }
    } else if (process.argv.length === 2) {
        // No args → interactive mode
        const answers = await interactiveMode();
        tenantIdentifier = answers.tenant;
        month = answers.month;
        year = answers.year;
        status = answers.status;
    } else {
        console.log('  [ERROR] Incomplete arguments. Use --tenant, --month, and --year.');
        console.log('  Run with --help for usage information.\n');
        process.exit(1);
    }

    // ── Step 1: Find the tenant ──
    const tenant = await findTenant(tenantIdentifier);
    if (!tenant) {
        process.exit(1);
    }

    // ── Step 2: Get room details ──
    const roomDetails = await getRoomDetails(tenant.room_id);

    // ── Step 3: Check for existing entry ──
    const existing = await checkExistingEntry(tenant.$id, month, year);
    if (existing) {
        console.log(`\n  ⚠️  DUPLICATE DETECTED`);
        console.log(`  ─────────────────────────────────────────────`);
        console.log(`  A ledger entry already exists for ${tenant.full_name}`);
        console.log(`  for period ${month}/${year}.`);
        console.log(`  Existing ledger_uid: ${existing.ledger_uid || 'N/A'}`);
        console.log(`  Existing status:     ${existing.status || 'N/A'}`);
        console.log(`  Document ID:         ${existing.$id}`);
        console.log(`  ─────────────────────────────────────────────`);
        console.log(`  The ledger_uid format [${tenant.$id}_${month}_${year}]`);
        console.log(`  prevented a duplicate. No new entry created.\n`);

        // Show impact anyway
        showImpact(tenant, month, year, existing.status || status);
        process.exit(0);
    }

    // ── Step 4: Create the ledger entry ──
    const doc = await createLedgerEntry(tenant, month, year, status, roomDetails);
    if (!doc) {
        process.exit(1);
    }

    // ── Step 5: Show impact ──
    showImpact(tenant, month, year, status);

    // ── Summary ──
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║     SUMMARY                                  ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log(`  Tenant:        ${tenant.full_name}`);
    console.log(`  Room:          ${roomDetails.room_number || 'N/A'}`);
    console.log(`  Period:        ${month}/${year}`);
    console.log(`  Status:        ${status}`);
    console.log(`  Ledger UID:    ${generateLedgerUid(tenant.$id, month, year)}`);
    console.log(`  Document ID:   ${doc.$id}`);
    console.log(`  ─────────────────────────────────────────────`);
    console.log(`  ✅ Done. Check the pending rent API to verify.\n`);
}

// ── Run ───────────────────────────────────────────────────────
if (require.main === module) {
    main().catch(error => {
        console.error('\n  [FATAL] Unexpected error:', error.message);
        process.exit(1);
    });
}

module.exports = { generateLedgerUid, findTenant, createLedgerEntry, checkExistingEntry };
