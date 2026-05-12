/**
 * Comprehensive Dummy Data Seeder
 * 
 * DEVELOPMENT-ONLY script.
 * Creates rooms, tenants, and rent transactions with proper database references.
 * Uses the backend service layer (RoomService, TenantService, RentTransactionService)
 * to ensure data integrity and proper Appwrite document ID references.
 * 
 * This script creates data that feeds into:
 *   - GET /api/rent/pending (PendingRentScreen)
 *   - GET /api/transactions (Transaction history)
 *   - GET /api/dashboard (Dashboard stats)
 * 
 * Usage: node scripts/seed-comprehensive-dummy-data.js
 */

// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const RoomService = require('../src/services/RoomService');
const TenantService = require('../src/services/TenantService');
const RentTransactionService = require('../src/services/RentTransactionService');
const { databases, DATABASE_ID, BUILDINGS_COLLECTION_ID, Query, ID } = require('../src/config/appwrite');

// ============================================================
// DUMMY DATA DEFINITIONS
// ============================================================

const BUILDING_NAME = 'Al Ghurair Residence';

const DUMMY_ROOMS = [
    { room_number: '101', floor: 1, type: 'apartment', monthly_rent: 3200, status: 'occupied', size: '35 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '102', floor: 1, type: 'apartment', monthly_rent: 2800, status: 'occupied', size: '30 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '103', floor: 1, type: 'apartment', monthly_rent: 3500, status: 'occupied', size: '40 sqm', amenities: 'AC, WiFi, Furnished, Balcony' },
    { room_number: '104', floor: 1, type: 'apartment', monthly_rent: 3000, status: 'occupied', size: '32 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '105', floor: 1, type: 'apartment', monthly_rent: 4000, status: 'occupied', size: '45 sqm', amenities: 'AC, WiFi, Furnished, Balcony, Parking' },
    { room_number: '201', floor: 2, type: 'apartment', monthly_rent: 2600, status: 'occupied', size: '28 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '202', floor: 2, type: 'apartment', monthly_rent: 3100, status: 'occupied', size: '35 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '203', floor: 2, type: 'apartment', monthly_rent: 2900, status: 'occupied', size: '30 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '204', floor: 2, type: 'apartment', monthly_rent: 3700, status: 'occupied', size: '42 sqm', amenities: 'AC, WiFi, Furnished, Balcony' },
    { room_number: '205', floor: 2, type: 'apartment', monthly_rent: 3300, status: 'occupied', size: '38 sqm', amenities: 'AC, WiFi, Furnished, Balcony' },
    // Vacant rooms for realistic mix
    { room_number: '301', floor: 3, type: 'studio', monthly_rent: 2200, status: 'vacant', size: '25 sqm', amenities: 'AC, WiFi' },
    { room_number: '302', floor: 3, type: 'studio', monthly_rent: 2400, status: 'vacant', size: '27 sqm', amenities: 'AC, WiFi, Furnished' },
];

const DUMMY_TENANTS = [
    { full_name: 'Ahmed Al Mansouri', phone: '+971501234101', email: 'ahmed.mansouri@email.com', monthly_rent: 3200, room_index: 0 },
    { full_name: 'Mohammed Hassan', phone: '+971501234102', email: 'mohammed.hassan@email.com', monthly_rent: 2800, room_index: 1 },
    { full_name: 'Khalid Al Zaabi', phone: '+971501234103', email: 'khalid.zaabi@email.com', monthly_rent: 3500, room_index: 2 },
    { full_name: 'Saeed Al Ketbi', phone: '+971501234104', email: 'saeed.ketbi@email.com', monthly_rent: 3000, room_index: 3 },
    { full_name: 'Abdul Rahman Nasser', phone: '+971501234105', email: 'abdul.nasser@email.com', monthly_rent: 4000, room_index: 4 },
    { full_name: 'Rashid Al Falasi', phone: '+971501234106', email: 'rashid.falasi@email.com', monthly_rent: 2600, room_index: 5 },
    { full_name: 'Faisal Al Qasimi', phone: '+971501234107', email: 'faisal.qasimi@email.com', monthly_rent: 3100, room_index: 6 },
    { full_name: 'Omar Al Shamsi', phone: '+971501234108', email: 'omar.shamsi@email.com', monthly_rent: 2900, room_index: 7 },
    { full_name: 'Yousef Al Mazroui', phone: '+971501234109', email: 'yousef.mazroui@email.com', monthly_rent: 3700, room_index: 8 },
    { full_name: 'Hassan Al Nuaimi', phone: '+971501234110', email: 'hassan.nuaimi@email.com', monthly_rent: 3300, room_index: 9 },
];

// ============================================================
// TRANSACTION PATTERNS
// ============================================================
// Current time: May 2026 (month=5, year=2026)
// Each tenant has a pattern for months 2-5 (Feb, Mar, Apr, May)
//
// Status distribution per month:
//   May (current): 5 paid, 3 pending, 2 partial
//   Apr: 9 paid, 1 pending
//   Mar: 9 paid, 1 pending
//   Feb: 9 paid, 1 pending
//
// tenant_005 (Abdul Rahman Nasser, Room 105, AED 4000) is the chronically overdue tenant

const TRANSACTION_PATTERNS = [
    // Tenant 0 - Ahmed Al Mansouri (Room 101, AED 3200) - Always pays on time
    { tenant_index: 0, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'cash', days_after_due: 1 },
        { month: 3, year: 2026, status: 'paid', method: 'cash', days_after_due: 1 },
        { month: 4, year: 2026, status: 'paid', method: 'cash', days_after_due: 2 },
        { month: 5, year: 2026, status: 'paid', method: 'cash', days_after_due: 2 },
    ]},
    // Tenant 1 - Mohammed Hassan (Room 102, AED 2800) - Pays late but always pays
    { tenant_index: 1, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'bank_transfer', days_after_due: 3 },
        { month: 3, year: 2026, status: 'paid', method: 'bank_transfer', days_after_due: 4 },
        { month: 4, year: 2026, status: 'paid', method: 'bank_transfer', days_after_due: 9 },
        { month: 5, year: 2026, status: 'pending', method: '', days_after_due: 0, pending_reason: 'Salary delayed - Expected by 15th May' },
    ]},
    // Tenant 2 - Khalid Al Zaabi (Room 103, AED 3500) - Partial payer this month
    { tenant_index: 2, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'cash', days_after_due: 1 },
        { month: 3, year: 2026, status: 'paid', method: 'cash', days_after_due: 2 },
        { month: 4, year: 2026, status: 'paid', method: 'cash', days_after_due: 4 },
        { month: 5, year: 2026, status: 'partial', method: 'bank_transfer', days_after_due: 6, 
          partial_amount: 1500, partial_reason: 'Paid half of salary this month, remaining on 25th' },
    ]},
    // Tenant 3 - Saeed Al Ketbi (Room 104, AED 3000) - Always pays on time, online
    { tenant_index: 3, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'online', days_after_due: 0 },
        { month: 3, year: 2026, status: 'paid', method: 'online', days_after_due: 0 },
        { month: 4, year: 2026, status: 'paid', method: 'online', days_after_due: 0 },
        { month: 5, year: 2026, status: 'paid', method: 'online', days_after_due: 1 },
    ]},
    // Tenant 4 - Abdul Rahman Nasser (Room 105, AED 4000) - Chronically overdue
    { tenant_index: 4, patterns: [
        { month: 2, year: 2026, status: 'pending', method: '', days_after_due: 0, pending_reason: 'Tenant had medical emergency' },
        { month: 3, year: 2026, status: 'pending', method: '', days_after_due: 0, pending_reason: 'Tenant lost job - Payment promised next month' },
        { month: 4, year: 2026, status: 'pending', method: '', days_after_due: 0, pending_reason: 'Tenant had emergency travel' },
        { month: 5, year: 2026, status: 'pending', method: '', days_after_due: 0, pending_reason: 'Tenant travelling abroad - Promised payment on return' },
    ]},
    // Tenant 5 - Rashid Al Falasi (Room 201, AED 2600) - Always pays online
    { tenant_index: 5, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'online', days_after_due: 2 },
        { month: 3, year: 2026, status: 'paid', method: 'online', days_after_due: 3 },
        { month: 4, year: 2026, status: 'paid', method: 'online', days_after_due: 1 },
        { month: 5, year: 2026, status: 'paid', method: 'online', days_after_due: 3 },
    ]},
    // Tenant 6 - Faisal Al Qasimi (Room 202, AED 3100) - Pays cash, sometimes late
    { tenant_index: 6, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'cash', days_after_due: 4 },
        { month: 3, year: 2026, status: 'paid', method: 'cash', days_after_due: 1 },
        { month: 4, year: 2026, status: 'paid', method: 'cash', days_after_due: 5 },
        { month: 5, year: 2026, status: 'paid', method: 'cash', days_after_due: 4 },
    ]},
    // Tenant 7 - Omar Al Shamsi (Room 203, AED 2900) - Pending this month
    { tenant_index: 7, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'bank_transfer', days_after_due: 6 },
        { month: 3, year: 2026, status: 'paid', method: 'bank_transfer', days_after_due: 8 },
        { month: 4, year: 2026, status: 'paid', method: 'bank_transfer', days_after_due: 7 },
        { month: 5, year: 2026, status: 'pending', method: '', days_after_due: 0, pending_reason: 'Awaiting bank transfer from employer' },
    ]},
    // Tenant 8 - Yousef Al Mazroui (Room 204, AED 3700) - Partial payer
    { tenant_index: 8, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'cash', days_after_due: 1 },
        { month: 3, year: 2026, status: 'paid', method: 'cash', days_after_due: 2 },
        { month: 4, year: 2026, status: 'paid', method: 'cash', days_after_due: 3 },
        { month: 5, year: 2026, status: 'partial', method: 'bank_transfer', days_after_due: 5,
          partial_amount: 2000, partial_reason: 'Financial difficulty - Remaining amount promised next week' },
    ]},
    // Tenant 9 - Hassan Al Nuaimi (Room 205, AED 3300) - Always pays on time, online
    { tenant_index: 9, patterns: [
        { month: 2, year: 2026, status: 'paid', method: 'online', days_after_due: 0 },
        { month: 3, year: 2026, status: 'paid', method: 'online', days_after_due: 0 },
        { month: 4, year: 2026, status: 'paid', method: 'online', days_after_due: 0 },
        { month: 5, year: 2026, status: 'paid', method: 'online', days_after_due: 1 },
    ]},
];

// ============================================================
// COLLECTOR USERS (for collected_by field)
// ============================================================

const COLLECTOR_NAMES = [
    { name: 'Ali Al Hashimi', username: 'ali_hashimi' },
    { name: 'Sultan Al Marri', username: 'sultan_marri' },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateReceiptNumber(year, month, tenantIndex) {
    return `RCPT-${year}${String(month).padStart(2, '0')}-${String(tenantIndex + 1).padStart(3, '0')}`;
}

function getPendingReason(month, year) {
    const reasons = [
        'Not yet collected',
        'Tenant delayed payment',
        'Awaiting collection',
        'Payment pending',
        'Tenant requested extension',
    ];
    // Use deterministic reason based on month
    return reasons[(month + year) % reasons.length];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// SEEDER FUNCTIONS
// ============================================================

async function findOrCreateBuilding() {
    console.log('\n========== BUILDING ==========');
    try {
        // Try to find existing building
        const result = await databases.listDocuments(
            DATABASE_ID,
            BUILDINGS_COLLECTION_ID,
            [Query.equal('name', BUILDING_NAME)],
            1
        );

        if (result.documents.length > 0) {
            console.log(`  [FOUND] Building "${BUILDING_NAME}" (ID: ${result.documents[0].$id})`);
            return result.documents[0].$id;
        }

        // Create building
        const building = await databases.createDocument(
            DATABASE_ID,
            BUILDINGS_COLLECTION_ID,
            ID.unique(),
            {
                name: BUILDING_NAME,
                address: 'Al Rigga Road, Deira, Dubai, UAE',
                floors: 3,
                total_rooms: 12,
                description: 'Residential building with studio and apartment units'
            }
        );
        console.log(`  [CREATE] Building "${BUILDING_NAME}" (ID: ${building.$id})`);
        return building.$id;
    } catch (error) {
        console.error(`  [ERROR] Building: ${error.message}`);
        // Return a default building ID if creation fails
        return 'default_building';
    }
}

async function seedRooms(buildingId) {
    console.log('\n========== SEEDING ROOMS ==========');
    const createdRooms = [];
    let skipped = 0;

    for (let i = 0; i < DUMMY_ROOMS.length; i++) {
        const roomData = DUMMY_ROOMS[i];

        // Check if room already exists
        const existing = await databases.listDocuments(
            DATABASE_ID,
            'rooms',
            [Query.equal('room_number', roomData.room_number)],
            1
        );

        if (existing.documents.length > 0) {
            console.log(`  [SKIP] Room ${roomData.room_number} already exists (ID: ${existing.documents[0].$id})`);
            createdRooms.push(existing.documents[0]);
            skipped++;
            continue;
        }

        try {
            const result = await RoomService.createRoom({
                building_id: buildingId,
                room_number: roomData.room_number,
                floor: roomData.floor,
                type: roomData.type,
                monthly_rent: roomData.monthly_rent,
                status: roomData.status,
                size: roomData.size || '',
                amenities: roomData.amenities || ''
            });

            if (result.success) {
                console.log(`  [CREATE] Room ${roomData.room_number} - ${roomData.monthly_rent} AED - ${roomData.status} (ID: ${result.data.$id})`);
                createdRooms.push(result.data);
            } else {
                console.error(`  [ERROR] Room ${roomData.room_number}: ${result.error}`);
            }
        } catch (error) {
            console.error(`  [ERROR] Room ${roomData.room_number}: ${error.message}`);
        }

        // Small delay to avoid rate limiting
        await sleep(100);
    }

    console.log(`\nRooms: ${createdRooms.length} available, ${skipped} skipped`);
    return createdRooms;
}

async function seedTenants(rooms) {
    console.log('\n========== SEEDING TENANTS ==========');
    const createdTenants = [];
    let skipped = 0;

    // Build room lookup by room_number
    const roomMap = {};
    rooms.forEach(room => {
        roomMap[room.room_number] = room;
    });

    for (let i = 0; i < DUMMY_TENANTS.length; i++) {
        const tenantData = DUMMY_TENANTS[i];
        const room = rooms[tenantData.room_index];

        if (!room) {
            console.error(`  [ERROR] No room found for ${tenantData.full_name} at index ${tenantData.room_index}`);
            continue;
        }

        // Check if tenant already exists by email
        const existing = await databases.listDocuments(
            DATABASE_ID,
            'tenants',
            [Query.equal('email', tenantData.email)],
            1
        );

        if (existing.documents.length > 0) {
            console.log(`  [SKIP] ${tenantData.full_name} already exists (ID: ${existing.documents[0].$id})`);
            createdTenants.push(existing.documents[0]);
            skipped++;
            continue;
        }

        try {
            const result = await TenantService.createTenant({
                room_id: room.$id,
                full_name: tenantData.full_name,
                phone_number: tenantData.phone,
                email: tenantData.email,
                id_number: `EM-${2026000000 + i}`,
                emergency_contact: '',
                check_in_date: '2025-06-01',
                monthly_rent: tenantData.monthly_rent,
                security_deposit: tenantData.monthly_rent, // One month deposit
                status: 'active',
                notes: `Tenant in Room ${room.room_number}`
            });

            if (result.success) {
                console.log(`  [CREATE] ${tenantData.full_name} - Room ${room.room_number} - ${tenantData.monthly_rent} AED (ID: ${result.data.$id})`);
                createdTenants.push(result.data);
            } else {
                console.error(`  [ERROR] ${tenantData.full_name}: ${result.error}`);
            }
        } catch (error) {
            console.error(`  [ERROR] ${tenantData.full_name}: ${error.message}`);
        }

        await sleep(100);
    }

    console.log(`\nTenants: ${createdTenants.length} available, ${skipped} skipped`);
    return createdTenants;
}

async function findOrCreateCollectors() {
    console.log('\n========== COLLECTORS ==========');
    const collectors = [];

    for (const collectorData of COLLECTOR_NAMES) {
        try {
            // Check if collector user exists
            const existing = await databases.listDocuments(
                DATABASE_ID,
                'users',
                [Query.equal('username', collectorData.username)],
                1
            );

            if (existing.documents.length > 0) {
                console.log(`  [FOUND] Collector "${collectorData.name}" (ID: ${existing.documents[0].$id})`);
                collectors.push(existing.documents[0]);
            } else {
                // Create collector user
                const user = await databases.createDocument(
                    DATABASE_ID,
                    'users',
                    ID.unique(),
                    {
                        username: collectorData.username,
                        name: collectorData.name,
                        role: 'collector',
                        email: `${collectorData.username}@rentmanagement.com`,
                        status: 'active'
                    }
                );
                console.log(`  [CREATE] Collector "${collectorData.name}" (ID: ${user.$id})`);
                collectors.push(user);
            }
        } catch (error) {
            console.error(`  [ERROR] Collector ${collectorData.name}: ${error.message}`);
        }
    }

    return collectors;
}

async function seedTransactions(tenants, rooms, collectors) {
    console.log('\n========== SEEDING RENT TRANSACTIONS ==========');
    let created = 0;
    let skipped = 0;

    // Build room lookup by $id
    const roomMap = {};
    rooms.forEach(room => {
        roomMap[room.$id] = room;
    });

    for (const pattern of TRANSACTION_PATTERNS) {
        const tenant = tenants[pattern.tenant_index];
        if (!tenant) {
            console.log(`  [SKIP] Tenant index ${pattern.tenant_index} not found`);
            continue;
        }

        const room = roomMap[tenant.room_id];
        const roomNumber = room ? room.room_number : 'N/A';
        const monthlyRent = room ? room.monthly_rent : tenant.monthly_rent;

        for (const txn of pattern.patterns) {
            // Check if transaction already exists for this tenant+period
            const existing = await databases.listDocuments(
                DATABASE_ID,
                'rent_transactions',
                [
                    Query.equal('tenant_id', tenant.$id),
                    Query.equal('period_month', txn.month),
                    Query.equal('period_year', txn.year)
                ],
                1
            );

            if (existing.documents.length > 0) {
                console.log(`  [SKIP] ${tenant.full_name} (Room ${roomNumber}) - ${txn.month}/${txn.year} already exists (ID: ${existing.documents[0].$id})`);
                skipped++;
                continue;
            }

            // Calculate dates
            const dueDate = new Date(txn.year, txn.month - 1, 1);
            let transactionDate = dueDate.toISOString();
            let amount = 0;
            let paymentMethod = txn.method || 'cash';
            let paymentStatus = txn.status;
            let pendingReason = '';
            let partialReason = '';
            let remarks = '';
            let receiptNumber = '';

            if (txn.status === 'paid') {
                const paidDate = new Date(txn.year, txn.month - 1, 1 + txn.days_after_due);
                transactionDate = paidDate.toISOString();
                amount = monthlyRent;
                receiptNumber = generateReceiptNumber(txn.year, txn.month, pattern.tenant_index);
                remarks = `Rent fully paid for ${txn.month}/${txn.year}`;
                if (txn.days_after_due > 0) {
                    remarks += ` (${txn.days_after_due} days after due date)`;
                }
            } else if (txn.status === 'pending') {
                pendingReason = txn.pending_reason || getPendingReason(txn.month, txn.year);
                remarks = `Pending rent for ${txn.month}/${txn.year}`;
                if (pendingReason) {
                    remarks += ` - ${pendingReason}`;
                }
            } else if (txn.status === 'partial') {
                const paidDate = new Date(txn.year, txn.month - 1, 1 + txn.days_after_due);
                transactionDate = paidDate.toISOString();
                amount = txn.partial_amount || Math.floor(monthlyRent / 2);
                partialReason = txn.partial_reason || 'Partial payment';
                receiptNumber = generateReceiptNumber(txn.year, txn.month, pattern.tenant_index);
                remarks = `Partial payment received: AED ${amount} / ${monthlyRent}`;
            }

            // Pick a collector (alternate between the two)
            const collector = collectors[pattern.tenant_index % collectors.length];

            try {
                const result = await RentTransactionService.createTransaction({
                    tenant_id: tenant.$id,
                    room_id: tenant.room_id,
                    collected_by: collector ? collector.$id : '',
                    amount: amount,
                    monthly_rent: monthlyRent,
                    payment_method: paymentMethod,
                    payment_status: paymentStatus,
                    transaction_date: transactionDate,
                    rent_due_date: dueDate.toISOString(),
                    period_month: txn.month,
                    period_year: txn.year,
                    partial_payment_reason: partialReason,
                    pending_reason: pendingReason,
                    remarks: remarks,
                    receipt_number: receiptNumber
                });

                if (result.success) {
                    const statusIcon = paymentStatus === 'paid' ? '✅' : paymentStatus === 'pending' ? '⏳' : '⚡';
                    console.log(`  ${statusIcon} ${tenant.full_name} (Room ${roomNumber}) - ${txn.month}/${txn.year} - ${monthlyRent} AED - ${paymentStatus}`);
                    created++;
                } else {
                    console.error(`  [ERROR] ${tenant.full_name}: ${result.error}`);
                }
            } catch (error) {
                console.error(`  [ERROR] ${tenant.full_name}: ${error.message}`);
            }

            await sleep(150);
        }
    }

    console.log(`\nTransactions: ${created} created, ${skipped} skipped`);
    return { created, skipped };
}

// ============================================================
// MAIN SEEDER
// ============================================================

async function seedComprehensiveDummyData() {
    console.log('==============================================');
    console.log('  COMPREHENSIVE DUMMY DATA SEEDER');
    console.log('  Development Only');
    console.log('==============================================');
    console.log(`Database ID: ${DATABASE_ID}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Current Period: May 2026`);

    try {
        // Step 1: Find or create building
        const buildingId = await findOrCreateBuilding();

        // Step 2: Seed rooms
        const rooms = await seedRooms(buildingId);
        const occupiedRooms = rooms.filter(r => r.status === 'occupied');
        console.log(`Occupied rooms: ${occupiedRooms.length}/${rooms.length}`);

        if (occupiedRooms.length < 10) {
            console.warn('  WARNING: Expected 10 occupied rooms but found', occupiedRooms.length);
        }

        // Step 3: Seed tenants
        const tenants = await seedTenants(rooms);
        const activeTenants = tenants.filter(t => t.status === 'active');
        console.log(`Active tenants: ${activeTenants.length}/${tenants.length}`);

        // Step 4: Find or create collectors
        const collectors = await findOrCreateCollectors();

        // Step 5: Seed transactions
        const txnResult = await seedTransactions(activeTenants, rooms, collectors);

        // Step 6: Print summary
        console.log('\n==============================================');
        console.log('  SEEDING COMPLETE');
        console.log('==============================================');
        console.log(`  Building:     ${BUILDING_NAME}`);
        console.log(`  Rooms:        ${rooms.length} total (${occupiedRooms.length} occupied)`);
        console.log(`  Tenants:      ${activeTenants.length} active`);
        console.log(`  Collectors:   ${collectors.length}`);
        console.log(`  Transactions: ${txnResult.created} created, ${txnResult.skipped} skipped`);
        console.log('');
        console.log('  API Endpoints now available:');
        console.log('  - GET /api/rent/pending');
        console.log('  - GET /api/rent/pending/summary');
        console.log('  - GET /api/rent/pending/stats');
        console.log('  - GET /api/transactions');
        console.log('  - GET /api/dashboard');
        console.log('');
        console.log('  Pending Rent Screen will show:');
        console.log('  - 5 Paid tenants (Room 101, 104, 201, 202, 205)');
        console.log('  - 3 Pending tenants (Room 102, 105, 203)');
        console.log('  - 2 Partial payments (Room 103, 204)');
        console.log('==============================================\n');

    } catch (error) {
        console.error('\nFatal error during seeding:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedComprehensiveDummyData();
}

module.exports = { seedComprehensiveDummyData };
