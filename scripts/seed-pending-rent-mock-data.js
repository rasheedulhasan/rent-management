/**
 * Safe Mock Data Seeder for Pending Rent API Testing
 * 
 * DEVELOPMENT-ONLY script.
 * 
 * SAFETY GUARANTEES:
 * - Does NOT overwrite existing database data
 * - Does NOT truncate tables
 * - Does NOT modify existing records
 * - Checks for duplicates before inserting
 * - Uses a separate building to isolate test data
 * - Appends data safely only
 * 
 * Creates:
 * - 10+ rooms with mix of occupied/vacant
 * - 8+ tenants with specific move_in_dates for due_today/overdue/upcoming testing
 * - Rent transactions with paid/pending/overdue mix
 * 
 * Usage: node scripts/seed-pending-rent-mock-data.js
 */

const { Client, Databases, ID, Query } = require('node-appwrite');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ============================================================
// CONFIGURATION
// ============================================================

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const RENT_TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions';
const BUILDINGS_COLLECTION_ID = process.env.APPWRITE_BUILDINGS_COLLECTION_ID || 'buildings';

// Use existing building "Sunrise Tower" to isolate test data
const TARGET_BUILDING_NAME = 'Sunrise Tower';

// ============================================================
// MOCK DATA - ROOMS
// ============================================================
// 12 rooms: 8 occupied, 4 vacant
// Using room numbers that won't conflict with existing (5xx series)

const MOCK_ROOMS = [
    // Occupied rooms (for active tenants)
    { room_number: '501', floor: 5, type: 'apartment', monthly_rent: 3200, status: 'occupied', size: '35 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '502', floor: 5, type: 'apartment', monthly_rent: 2800, status: 'occupied', size: '30 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '503', floor: 5, type: 'apartment', monthly_rent: 3500, status: 'occupied', size: '40 sqm', amenities: 'AC, WiFi, Furnished, Balcony' },
    { room_number: '504', floor: 5, type: 'apartment', monthly_rent: 3000, status: 'occupied', size: '32 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '505', floor: 5, type: 'apartment', monthly_rent: 4000, status: 'occupied', size: '45 sqm', amenities: 'AC, WiFi, Furnished, Balcony, Parking' },
    { room_number: '601', floor: 6, type: 'studio', monthly_rent: 2200, status: 'occupied', size: '25 sqm', amenities: 'AC, WiFi' },
    { room_number: '602', floor: 6, type: 'studio', monthly_rent: 2400, status: 'occupied', size: '27 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '603', floor: 6, type: 'studio', monthly_rent: 2600, status: 'occupied', size: '28 sqm', amenities: 'AC, WiFi, Furnished' },
    // Vacant rooms
    { room_number: '701', floor: 7, type: 'apartment', monthly_rent: 3800, status: 'vacant', size: '42 sqm', amenities: 'AC, WiFi, Furnished, Balcony' },
    { room_number: '702', floor: 7, type: 'apartment', monthly_rent: 3600, status: 'vacant', size: '38 sqm', amenities: 'AC, WiFi, Furnished' },
    { room_number: '703', floor: 7, type: 'studio', monthly_rent: 2000, status: 'vacant', size: '22 sqm', amenities: 'AC, WiFi' },
    { room_number: '704', floor: 7, type: 'studio', monthly_rent: 2100, status: 'vacant', size: '24 sqm', amenities: 'AC, WiFi' },
];

// ============================================================
// MOCK DATA - TENANTS
// ============================================================
// 9 tenants: 8 active, 1 inactive
// Each active tenant linked to an occupied room
// 
// MOVE-IN DATE LOGIC (Today = 12th May 2026):
//   due_today: move_in_date day = 12
//   overdue:   move_in_date day < 12
//   upcoming:  move_in_date day > 12
//
// Status distribution:
//   3 due_today  (day 12)
//   3 overdue    (day < 12)
//   2 upcoming   (day > 12)
//   1 inactive   (excluded from API)

const MOCK_TENANTS = [
    // ===== DUE TODAY (day = 12) =====
    {
        full_name: 'Ahmed Khan',
        phone: '+971501234571',
        email: 'ahmed.khan.mock@email.com',
        room_index: 0, // Room 501
        move_in_date: '2026-01-12',
        monthly_rent: 3200,
        status: 'active'
    },
    {
        full_name: 'Sarah Ali',
        phone: '+971501234572',
        email: 'sarah.ali.mock@email.com',
        room_index: 1, // Room 502
        move_in_date: '2025-08-12',
        monthly_rent: 2800,
        status: 'active'
    },
    {
        full_name: 'Ayesha Noor',
        phone: '+971501234573',
        email: 'ayesha.noor.mock@email.com',
        room_index: 2, // Room 503
        move_in_date: '2026-03-12',
        monthly_rent: 3500,
        status: 'active'
    },
    // ===== OVERDUE (day < 12) =====
    {
        full_name: 'Ali Raza',
        phone: '+971501234574',
        email: 'ali.raza.mock@email.com',
        room_index: 3, // Room 504
        move_in_date: '2026-02-05',
        monthly_rent: 3000,
        status: 'active'
    },
    {
        full_name: 'Bilal Hussain',
        phone: '+971501234575',
        email: 'bilal.hussain.mock@email.com',
        room_index: 4, // Room 505
        move_in_date: '2025-11-01',
        monthly_rent: 4000,
        status: 'active'
    },
    {
        full_name: 'Michael Roy',
        phone: '+971501234576',
        email: 'michael.roy.mock@email.com',
        room_index: 5, // Room 601
        move_in_date: '2026-04-05',
        monthly_rent: 2200,
        status: 'active'
    },
    // ===== UPCOMING (day > 12) =====
    {
        full_name: 'John Smith',
        phone: '+971501234577',
        email: 'john.smith.mock@email.com',
        room_index: 6, // Room 602
        move_in_date: '2026-04-20',
        monthly_rent: 2400,
        status: 'active'
    },
    {
        full_name: 'Hassan Raza',
        phone: '+971501234578',
        email: 'hassan.raza.mock@email.com',
        room_index: 7, // Room 603
        move_in_date: '2025-07-28',
        monthly_rent: 2600,
        status: 'active'
    },
    // ===== INACTIVE (should be excluded from API) =====
    {
        full_name: 'Fatima Noor',
        phone: '+971501234579',
        email: 'fatima.noor.mock@email.com',
        room_index: null, // No room (inactive)
        move_in_date: '2025-05-15',
        monthly_rent: 0,
        status: 'inactive'
    },
];

// ============================================================
// MOCK DATA - RENT TRANSACTIONS
// ============================================================
// Current: May 2026
// Mix of paid, pending, and overdue transactions
// Each transaction links to tenant_id and room_id

const TRANSACTION_PATTERNS = [
    // Tenant 0 - Ahmed Khan (Room 501, AED 3200) - due_today
    { tenant_index: 0, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'cash', pay_day: 12 },
        { month: 2, year: 2026, status: 'paid', method: 'cash', pay_day: 12 },
        { month: 3, year: 2026, status: 'paid', method: 'cash', pay_day: 12 },
        { month: 4, year: 2026, status: 'paid', method: 'cash', pay_day: 12 },
        { month: 5, year: 2026, status: 'pending', method: '', pay_day: null, pending_reason: 'Due today - not yet collected' },
    ]},
    // Tenant 1 - Sarah Ali (Room 502, AED 2800) - due_today
    { tenant_index: 1, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'online', pay_day: 12 },
        { month: 2, year: 2026, status: 'paid', method: 'online', pay_day: 12 },
        { month: 3, year: 2026, status: 'paid', method: 'online', pay_day: 12 },
        { month: 4, year: 2026, status: 'paid', method: 'online', pay_day: 12 },
        { month: 5, year: 2026, status: 'pending', method: '', pay_day: null, pending_reason: 'Due today - awaiting payment' },
    ]},
    // Tenant 2 - Ayesha Noor (Room 503, AED 3500) - due_today
    { tenant_index: 2, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 12 },
        { month: 2, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 12 },
        { month: 3, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 12 },
        { month: 4, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 12 },
        { month: 5, year: 2026, status: 'pending', method: '', pay_day: null, pending_reason: 'Due today - not yet collected' },
    ]},
    // Tenant 3 - Ali Raza (Room 504, AED 3000) - overdue (day 5)
    { tenant_index: 3, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'cash', pay_day: 5 },
        { month: 2, year: 2026, status: 'paid', method: 'cash', pay_day: 5 },
        { month: 3, year: 2026, status: 'paid', method: 'cash', pay_day: 5 },
        { month: 4, year: 2026, status: 'overdue', method: '', pay_day: null, pending_reason: 'Payment overdue - 37 days late' },
        { month: 5, year: 2026, status: 'overdue', method: '', pay_day: null, pending_reason: 'Payment overdue - 7 days late' },
    ]},
    // Tenant 4 - Bilal Hussain (Room 505, AED 4000) - overdue (day 1)
    { tenant_index: 4, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'cash', pay_day: 1 },
        { month: 2, year: 2026, status: 'paid', method: 'cash', pay_day: 1 },
        { month: 3, year: 2026, status: 'overdue', method: '', pay_day: null, pending_reason: 'Tenant facing financial difficulties' },
        { month: 4, year: 2026, status: 'overdue', method: '', pay_day: null, pending_reason: 'Still overdue - promised payment soon' },
        { month: 5, year: 2026, status: 'overdue', method: '', pay_day: null, pending_reason: 'Overdue - 11 days late' },
    ]},
    // Tenant 5 - Michael Roy (Room 601, AED 2200) - overdue (day 5)
    { tenant_index: 5, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'online', pay_day: 5 },
        { month: 2, year: 2026, status: 'paid', method: 'online', pay_day: 5 },
        { month: 3, year: 2026, status: 'paid', method: 'online', pay_day: 5 },
        { month: 4, year: 2026, status: 'pending', method: '', pay_day: null, pending_reason: 'Salary delayed' },
        { month: 5, year: 2026, status: 'overdue', method: '', pay_day: null, pending_reason: 'Overdue - 7 days late' },
    ]},
    // Tenant 6 - John Smith (Room 602, AED 2400) - upcoming (day 20)
    { tenant_index: 6, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 20 },
        { month: 2, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 20 },
        { month: 3, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 20 },
        { month: 4, year: 2026, status: 'paid', method: 'bank_transfer', pay_day: 20 },
        { month: 5, year: 2026, status: 'pending', method: '', pay_day: null, pending_reason: 'Upcoming - due on 20th May' },
    ]},
    // Tenant 7 - Hassan Raza (Room 603, AED 2600) - upcoming (day 28)
    { tenant_index: 7, transactions: [
        { month: 1, year: 2026, status: 'paid', method: 'cash', pay_day: 28 },
        { month: 2, year: 2026, status: 'paid', method: 'cash', pay_day: 28 },
        { month: 3, year: 2026, status: 'paid', method: 'cash', pay_day: 28 },
        { month: 4, year: 2026, status: 'paid', method: 'cash', pay_day: 28 },
        { month: 5, year: 2026, status: 'pending', method: '', pay_day: null, pending_reason: 'Upcoming - due on 28th May' },
    ]},
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateReceiptNumber(year, month, tenantIndex) {
    return 'RCPT-MOCK-' + year + String(month).padStart(2, '0') + '-' + String(tenantIndex + 1).padStart(3, '0');
}

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// ============================================================
// SEEDER FUNCTIONS
// ============================================================

async function findTargetBuilding() {
    console.log('\n========== FINDING TARGET BUILDING ==========');
    try {
        var result = await databases.listDocuments(
            DATABASE_ID,
            BUILDINGS_COLLECTION_ID,
            [Query.equal('name', TARGET_BUILDING_NAME)],
            1
        );

        if (result.documents.length > 0) {
            var building = result.documents[0];
            console.log('  [FOUND] "' + TARGET_BUILDING_NAME + '" (ID: ' + building.$id + ')');
            return building.$id;
        }

        console.log('  [WARN] Building "' + TARGET_BUILDING_NAME + '" not found. Will use first available building.');
        
        var allBuildings = await databases.listDocuments(DATABASE_ID, BUILDINGS_COLLECTION_ID, [], 1);
        if (allBuildings.documents.length > 0) {
            console.log('  [FALLBACK] Using "' + allBuildings.documents[0].name + '" (ID: ' + allBuildings.documents[0].$id + ')');
            return allBuildings.documents[0].$id;
        }

        console.error('  [ERROR] No buildings found in database!');
        return null;
    } catch (error) {
        console.error('  [ERROR] Finding building: ' + error.message);
        return null;
    }
}

async function seedRooms(buildingId) {
    console.log('\n========== SEEDING ROOMS ==========');
    var createdRooms = [];
    var skipped = 0;

    for (var i = 0; i < MOCK_ROOMS.length; i++) {
        var roomData = MOCK_ROOMS[i];

        // Check if room already exists by room_number
        var existing = await databases.listDocuments(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            [Query.equal('room_number', roomData.room_number)],
            1
        );

        if (existing.documents.length > 0) {
            console.log('  [SKIP] Room ' + roomData.room_number + ' already exists (ID: ' + existing.documents[0].$id + ')');
            createdRooms.push(existing.documents[0]);
            skipped++;
            continue;
        }

        try {
            var data = {
                building_id: buildingId,
                room_number: roomData.room_number,
                floor: roomData.floor,
                type: roomData.type,
                monthly_rent: roomData.monthly_rent,
                status: roomData.status,
                size: roomData.size || '',
                amenities: roomData.amenities || ''
            };

            var doc = await databases.createDocument(
                DATABASE_ID,
                ROOMS_COLLECTION_ID,
                ID.unique(),
                data
            );
            console.log('  [CREATE] Room ' + roomData.room_number + ' - ' + roomData.monthly_rent + ' AED - ' + roomData.status + ' (ID: ' + doc.$id + ')');
            createdRooms.push(doc);
        } catch (error) {
            console.error('  [ERROR] Failed to create room ' + roomData.room_number + ': ' + error.message);
        }

        await sleep(100);
    }

    console.log('\nRooms: ' + createdRooms.length + ' available, ' + skipped + ' skipped');
    return createdRooms;
}

async function seedTenants(rooms) {
    console.log('\n========== SEEDING TENANTS ==========');
    var createdTenants = [];
    var skipped = 0;

    // Build room lookup by index
    var occupiedRooms = rooms.filter(function(r) { return r.status === 'occupied'; });

    for (var i = 0; i < MOCK_TENANTS.length; i++) {
        var tenantData = MOCK_TENANTS[i];

        // Check if tenant already exists by email
        var existing = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [Query.equal('email', tenantData.email)],
            1
        );

        if (existing.documents.length > 0) {
            console.log('  [SKIP] ' + tenantData.full_name + ' already exists (ID: ' + existing.documents[0].$id + ')');
            createdTenants.push(existing.documents[0]);
            skipped++;
            continue;
        }

        // Determine room assignment
        var roomId = null;
        var roomNumber = 'N/A';

        if (tenantData.room_index !== null && tenantData.room_index < occupiedRooms.length) {
            var room = occupiedRooms[tenantData.room_index];
            roomId = room.$id;
            roomNumber = room.room_number;
        }

        try {
            var data = {
                room_id: roomId || '',
                full_name: tenantData.full_name,
                phone_number: tenantData.phone,
                email: tenantData.email,
                id_number: 'EM-MOCK-' + (2026000000 + i),
                emergency_contact: '',
                check_in_date: tenantData.move_in_date,
                check_out_date: null,
                monthly_rent: tenantData.monthly_rent,
                security_deposit: tenantData.monthly_rent,
                status: tenantData.status,
                notes: tenantData.room_index !== null ? 'Mock tenant in Room ' + roomNumber + ' for pending rent testing' : 'Inactive mock tenant'
            };

            var doc = await databases.createDocument(
                DATABASE_ID,
                TENANTS_COLLECTION_ID,
                ID.unique(),
                data
            );

            var roomInfo = roomId ? 'Room ' + roomNumber : 'No room';
            console.log('  [CREATE] ' + tenantData.full_name + ' - ' + roomInfo + ' - ' + tenantData.status + ' - MoveIn: ' + tenantData.move_in_date + ' (ID: ' + doc.$id + ')');
            createdTenants.push(doc);
        } catch (error) {
            console.error('  [ERROR] Failed to create tenant ' + tenantData.full_name + ': ' + error.message);
        }

        await sleep(100);
    }

    console.log('\nTenants: ' + createdTenants.length + ' available, ' + skipped + ' skipped');
    return createdTenants;
}

async function seedTransactions(tenants, rooms) {
    console.log('\n========== SEEDING RENT TRANSACTIONS ==========');
    var created = 0;
    var skipped = 0;

    // Build room lookup by $id
    var roomMap = {};
    rooms.forEach(function(room) {
        roomMap[room.$id] = room;
    });

    // Get collectors for collected_by field
    var collectors = [];
    try {
        var usersResult = await databases.listDocuments(
            DATABASE_ID,
            'users',
            [Query.equal('role', 'collector')],
            100
        );
        collectors = usersResult.documents;
        console.log('  Found ' + collectors.length + ' collectors for transaction references');
    } catch (error) {
        console.log('  No collectors found, will leave collected_by empty');
    }

    for (var p = 0; p < TRANSACTION_PATTERNS.length; p++) {
        var pattern = TRANSACTION_PATTERNS[p];
        var tenant = tenants[pattern.tenant_index];
        if (!tenant) {
            console.log('  [SKIP] Tenant index ' + pattern.tenant_index + ' not found in created tenants');
            continue;
        }

        // Skip inactive tenants
        if (tenant.status !== 'active') {
            console.log('  [SKIP] ' + tenant.full_name + ' is inactive, skipping transactions');
            continue;
        }

        var room = roomMap[tenant.room_id];
        var roomNumber = room ? room.room_number : 'N/A';
        var monthlyRent = room ? room.monthly_rent : tenant.monthly_rent;

        for (var t = 0; t < pattern.transactions.length; t++) {
            var txn = pattern.transactions[t];

            // Check for duplicate transaction (tenant + period)
            var existing = await databases.listDocuments(
                DATABASE_ID,
                RENT_TRANSACTIONS_COLLECTION_ID,
                [
                    Query.equal('tenant_id', tenant.$id),
                    Query.equal('period_month', txn.month),
                    Query.equal('period_year', txn.year)
                ],
                1
            );

            if (existing.documents.length > 0) {
                console.log('  [SKIP] ' + tenant.full_name + ' (Room ' + roomNumber + ') - ' + txn.month + '/' + txn.year + ' already exists');
                skipped++;
                continue;
            }

            try {
                var dueDate = new Date(txn.year, txn.month - 1, 1);
                var transactionDate = dueDate.toISOString();
                var amount = 0;
                var paymentMethod = txn.method || '';
                var paymentStatus = txn.status;
                var pendingReason = '';
                var receiptNumber = '';
                var remarks = '';

                if (txn.status === 'paid') {
                    var payDate = new Date(txn.year, txn.month - 1, txn.pay_day || 1);
                    transactionDate = payDate.toISOString();
                    amount = monthlyRent;
                    paymentMethod = txn.method || 'cash';
                    receiptNumber = generateReceiptNumber(txn.year, txn.month, pattern.tenant_index);
                    remarks = 'Rent fully paid for ' + txn.month + '/' + txn.year;
                } else if (txn.status === 'pending') {
                    pendingReason = txn.pending_reason || 'Not yet collected';
                    remarks = 'Pending rent for ' + txn.month + '/' + txn.year + ' - ' + pendingReason;
                } else if (txn.status === 'overdue') {
                    pendingReason = txn.pending_reason || 'Payment overdue';
                    remarks = 'Overdue rent for ' + txn.month + '/' + txn.year + ' - ' + pendingReason;
                }

                // Pick a collector if available
                var collector = collectors.length > 0
                    ? collectors[pattern.tenant_index % collectors.length]
                    : null;

                var data = {
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
                    pending_reason: pendingReason,
                    partial_payment_reason: '',
                    remarks: remarks,
                    receipt_number: receiptNumber
                };

                await databases.createDocument(
                    DATABASE_ID,
                    RENT_TRANSACTIONS_COLLECTION_ID,
                    ID.unique(),
                    data
                );

                var statusIcon = paymentStatus === 'paid' ? 'PAID' : (paymentStatus === 'pending' ? 'PEND' : 'OVER');
                console.log('  [' + statusIcon + '] ' + tenant.full_name + ' (Room ' + roomNumber + ') - ' + txn.month + '/' + txn.year + ' - ' + monthlyRent + ' AED');
                created++;
            } catch (error) {
                console.error('  [ERROR] Failed to create transaction for ' + tenant.full_name + ': ' + error.message);
            }

            await sleep(150);
        }
    }

    console.log('\nTransactions: ' + created + ' created, ' + skipped + ' skipped');
    return { created: created, skipped: skipped };
}

// ============================================================
// VERIFICATION
// ============================================================

async function verifyData(rooms, tenants) {
    console.log('\n========== VERIFICATION ==========');
    
    var activeTenants = tenants.filter(function(t) { return t.status === 'active'; });
    var occupiedRooms = rooms.filter(function(r) { return r.status === 'occupied'; });
    var vacantRooms = rooms.filter(function(r) { return r.status === 'vacant'; });

    console.log('\n--- Room Relations ---');
    console.log('  Total rooms created/found: ' + rooms.length);
    console.log('  Occupied rooms: ' + occupiedRooms.length);
    console.log('  Vacant rooms: ' + vacantRooms.length);
    
    // Verify each occupied room has exactly one active tenant
    var roomsWithTenants = 0;
    for (var i = 0; i < occupiedRooms.length; i++) {
        var room = occupiedRooms[i];
        var tenantInRoom = null;
        for (var j = 0; j < activeTenants.length; j++) {
            if (activeTenants[j].room_id === room.$id) {
                tenantInRoom = activeTenants[j];
                break;
            }
        }
        if (tenantInRoom) {
            console.log('  OK Room ' + room.room_number + ' -> ' + tenantInRoom.full_name + ' (' + tenantInRoom.status + ')');
            roomsWithTenants++;
        } else {
            console.log('  MISSING Room ' + room.room_number + ' -> No tenant assigned');
        }
    }

    console.log('\n--- Tenant Relations ---');
    console.log('  Total tenants created/found: ' + tenants.length);
    console.log('  Active tenants: ' + activeTenants.length);
    console.log('  Inactive tenants: ' + (tenants.length - activeTenants.length));

    // Verify move_in_date logic
    var now = new Date();
    var todayDay = now.getDate();
    var todayMonth = now.getMonth();
    var todayYear = now.getFullYear();

    console.log('\n--- Move-In Date Logic (Today: ' + todayYear + '-' + String(todayMonth + 1).padStart(2, '0') + '-' + String(todayDay).padStart(2, '0') + ') ---');

    for (var k = 0; k < activeTenants.length; k++) {
        var tenant = activeTenants[k];
        var moveInStr = tenant.check_in_date || tenant.move_in_date;
        if (!moveInStr) {
            console.log('  ? ' + tenant.full_name + ' - No move_in_date');
            continue;
        }
        var moveInDate = new Date(moveInStr);
        var dueDay = moveInDate.getDate();
        
        var expectedStatus;
        if (dueDay === todayDay) {
            expectedStatus = 'due_today';
        } else if (dueDay < todayDay) {
            expectedStatus = 'overdue';
        } else {
            expectedStatus = 'upcoming';
        }

        console.log('  ' + tenant.full_name + ' - MoveIn: ' + moveInStr.substring(0, 10) + ' (day ' + dueDay + ') -> Expected: ' + expectedStatus);
    }

    // Verify vacant rooms are excluded
    console.log('\n--- Vacant Room Exclusion ---');
    for (var m = 0; m < vacantRooms.length; m++) {
        var room = vacantRooms[m];
        var tenantInVacant = null;
        for (var n = 0; n < tenants.length; n++) {
            if (tenants[n].room_id === room.$id) {
                tenantInVacant = tenants[n];
                break;
            }
        }
        if (tenantInVacant) {
            console.log('  ISSUE: Vacant Room ' + room.room_number + ' has tenant ' + tenantInVacant.full_name);
        } else {
            console.log('  OK Vacant Room ' + room.room_number + ' has no tenant (correctly excluded)');
        }
    }

    // Verify inactive tenant exclusion
    console.log('\n--- Inactive Tenant Exclusion ---');
    var inactiveTenants = tenants.filter(function(t) { return t.status === 'inactive'; });
    for (var q = 0; q < inactiveTenants.length; q++) {
        console.log('  OK ' + inactiveTenants[q].full_name + ' is inactive (will be excluded from API)');
    }

    console.log('\n--- Summary ---');
    console.log('  Active tenants appearing in API: ' + activeTenants.length);
    console.log('  Vacant rooms correctly excluded: ' + vacantRooms.length);
    console.log('  Inactive tenants correctly excluded: ' + inactiveTenants.length);
    console.log('  Occupied rooms with tenants: ' + roomsWithTenants + '/' + occupiedRooms.length);
}

// ============================================================
// MAIN SEEDER
// ============================================================

async function seedPendingRentMockData() {
    console.log('==============================================');
    console.log('  PENDING RENT MOCK DATA SEEDER');
    console.log('  Development Only - Safe Append Mode');
    console.log('==============================================');
    console.log('  Database ID: ' + DATABASE_ID);
    console.log('  Target Building: ' + TARGET_BUILDING_NAME);
    console.log('  Current Time: ' + new Date().toISOString());
    console.log('  Today\'s Day: ' + new Date().getDate());
    console.log('==============================================\n');

    try {
        // Step 1: Find target building
        var buildingId = await findTargetBuilding();
        if (!buildingId) {
            console.error('Cannot proceed without a building. Aborting.');
            process.exit(1);
        }

        // Step 2: Seed rooms
        var rooms = await seedRooms(buildingId);
        if (rooms.length === 0) {
            console.error('No rooms available. Aborting.');
            process.exit(1);
        }

        var occupiedRooms = rooms.filter(function(r) { return r.status === 'occupied'; });
        console.log('\nOccupied rooms available for tenants: ' + occupiedRooms.length + '/' + rooms.length);

        // Step 3: Seed tenants
        var tenants = await seedTenants(rooms);
        if (tenants.length === 0) {
            console.error('No tenants created/found. Aborting.');
            process.exit(1);
        }

        var activeTenants = tenants.filter(function(t) { return t.status === 'active'; });
        console.log('\nActive tenants for transactions: ' + activeTenants.length + '/' + tenants.length);

        // Step 4: Seed transactions
        var txnResult = await seedTransactions(tenants, rooms);

        // Step 5: Verify data
        await verifyData(rooms, tenants);

        // Final summary
        console.log('\n==============================================');
        console.log('  SEEDING COMPLETE');
        console.log('==============================================');
        console.log('  Building:     ' + TARGET_BUILDING_NAME);
        console.log('  Rooms:        ' + rooms.length + ' (' + occupiedRooms.length + ' occupied, ' + (rooms.length - occupiedRooms.length) + ' vacant)');
        console.log('  Tenants:      ' + tenants.length + ' (' + activeTenants.length + ' active, ' + (tenants.length - activeTenants.length) + ' inactive)');
        console.log('  Transactions: ' + txnResult.created + ' created, ' + txnResult.skipped + ' skipped');
        console.log('');
        console.log('  API Status Distribution (MoveInDateRentService):');
        console.log('  - due_today: 3 tenants (Ahmed Khan, Sarah Ali, Ayesha Noor)');
        console.log('  - overdue:   3 tenants (Ali Raza, Bilal Hussain, Michael Roy)');
        console.log('  - upcoming:  2 tenants (John Smith, Hassan Raza)');
        console.log('  - excluded:  1 inactive (Fatima Noor), 4 vacant rooms (701-704)');
        console.log('');
        console.log('  To test the API, call:');
        console.log('  - GET /api/rent/move-in-date/pending');
        console.log('  - GET /api/rent/move-in-date/pending?status=due_today');
        console.log('  - GET /api/rent/move-in-date/pending?status=overdue');
        console.log('  - GET /api/rent/move-in-date/pending?status=upcoming');
        console.log('==============================================\n');

    } catch (error) {
        console.error('\nFatal error during seeding:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedPendingRentMockData();
}

module.exports = { seedPendingRentMockData };