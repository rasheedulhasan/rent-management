/**
 * Dummy Data Seeder for Pending Rent Collection Module
 * 
 * DEVELOPMENT-ONLY script.
 * Creates dummy rooms, tenants, and rent transactions.
 * Does NOT overwrite existing data - checks duplicates before inserting.
 * Does NOT modify existing tables or break existing relationships.
 * 
 * Usage: node scripts/seed-dummy-data.js
 */
const { Client, Databases, ID, Query } = require('node-appwrite');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Database and collection IDs from environment
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const RENT_TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions';

// =====================
// Dummy Data Definitions
// =====================

const DUMMY_ROOMS = [
    { room_number: '101', room_name: 'Room 101', monthly_rent: 1500, status: 'occupied', floor: 1, type: 'apartment' },
    { room_number: '102', room_name: 'Room 102', monthly_rent: 1200, status: 'occupied', floor: 1, type: 'apartment' },
    { room_number: '103', room_name: 'Room 103', monthly_rent: 1800, status: 'occupied', floor: 1, type: 'apartment' },
    { room_number: '201', room_name: 'Room 201', monthly_rent: 2200, status: 'occupied', floor: 2, type: 'apartment' },
    { room_number: '202', room_name: 'Room 202', monthly_rent: 1500, status: 'occupied', floor: 2, type: 'apartment' },
    { room_number: '301', room_name: 'Studio A1', monthly_rent: 1200, status: 'occupied', floor: 3, type: 'studio' },
    { room_number: '302', room_name: 'Studio A2', monthly_rent: 1200, status: 'vacant', floor: 3, type: 'studio' },
    { room_number: '401', room_name: 'Room 401', monthly_rent: 2000, status: 'vacant', floor: 4, type: 'apartment' },
    { room_number: '402', room_name: 'Room 402', monthly_rent: 1800, status: 'occupied', floor: 4, type: 'apartment' },
    { room_number: '501', room_name: 'Penthouse 501', monthly_rent: 3500, status: 'vacant', floor: 5, type: 'penthouse' }
];

const DUMMY_TENANTS = [
    { full_name: 'Ahmed Khan', phone: '+971501234561', email: 'ahmed.khan@email.com', status: 'active', move_in_date: '2025-06-01' },
    { full_name: 'Ali Raza', phone: '+971501234562', email: 'ali.raza@email.com', status: 'active', move_in_date: '2025-07-15' },
    { full_name: 'Sarah Ali', phone: '+971501234563', email: 'sarah.ali@email.com', status: 'active', move_in_date: '2025-08-01' },
    { full_name: 'John Smith', phone: '+971501234564', email: 'john.smith@email.com', status: 'active', move_in_date: '2025-09-01' },
    { full_name: 'Bilal Hussain', phone: '+971501234565', email: 'bilal.h@email.com', status: 'active', move_in_date: '2025-10-01' },
    { full_name: 'Fatima Noor', phone: '+971501234566', email: 'fatima.noor@email.com', status: 'active', move_in_date: '2026-01-15' },
    { full_name: 'Omar Farooq', phone: '+971501234567', email: 'omar.f@email.com', status: 'inactive', move_in_date: '2025-05-01' }
];

// =====================
// Helper Functions
// =====================

async function findExistingRoom(roomNumber) {
    try {
        const result = await databases.listDocuments(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            [Query.equal('room_number', roomNumber)],
            1
        );
        return result.documents.length > 0 ? result.documents[0] : null;
    } catch (error) {
        console.error(`Error checking room ${roomNumber}:`, error.message);
        return null;
    }
}

async function findExistingTenant(email) {
    try {
        const result = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [Query.equal('email', email)],
            1
        );
        return result.documents.length > 0 ? result.documents[0] : null;
    } catch (error) {
        console.error(`Error checking tenant ${email}:`, error.message);
        return null;
    }
}

async function findExistingTransaction(tenantId, month, year) {
    try {
        const result = await databases.listDocuments(
            DATABASE_ID,
            RENT_TRANSACTIONS_COLLECTION_ID,
            [
                Query.equal('tenant_id', tenantId),
                Query.equal('period_month', month),
                Query.equal('period_year', year)
            ],
            1
        );
        return result.documents.length > 0 ? result.documents[0] : null;
    } catch (error) {
        return null;
    }
}

function getBuildingId() {
    // Use a default building ID or fetch first building
    return process.env.DEFAULT_BUILDING_ID || 'default_building';
}

// =====================
// Room Seeder
// =====================

async function seedRooms() {
    console.log('\n========== SEEDING ROOMS ==========');
    let created = 0;
    let skipped = 0;

    for (const roomData of DUMMY_ROOMS) {
        const existing = await findExistingRoom(roomData.room_number);
        if (existing) {
            console.log(`  [SKIP] Room ${roomData.room_number} already exists (ID: ${existing.$id})`);
            skipped++;
            continue;
        }

        try {
            const data = {
                building_id: getBuildingId(),
                room_number: roomData.room_number,
                room_name: roomData.room_name || roomData.room_number,
                floor: roomData.floor || 1,
                type: roomData.type || 'apartment',
                monthly_rent: roomData.monthly_rent,
                status: roomData.status || 'vacant',
                size: '',
                amenities: ''
            };

            const doc = await databases.createDocument(
                DATABASE_ID,
                ROOMS_COLLECTION_ID,
                ID.unique(),
                data
            );
            console.log(`  [CREATE] Room ${roomData.room_number} - ${roomData.monthly_rent} AED - ${roomData.status}`);
            created++;
        } catch (error) {
            console.error(`  [ERROR] Failed to create room ${roomData.room_number}: ${error.message}`);
        }
    }

    console.log(`\nRooms: ${created} created, ${skipped} skipped`);
    return { created, skipped };
}

// =====================
// Tenant Seeder
// =====================

async function seedTenants(occupiedRooms) {
    console.log('\n========== SEEDING TENANTS ==========');
    let created = 0;
    let skipped = 0;

    // Map tenants to occupied rooms (one active tenant per room)
    const tenantRoomPairs = [];
    let roomIndex = 0;

    for (let i = 0; i < DUMMY_TENANTS.length; i++) {
        const tenantData = DUMMY_TENANTS[i];
        
        // Find next occupied room for active tenants
        let roomId = null;
        let roomNumber = 'N/A';
        
        if (tenantData.status === 'active') {
            if (roomIndex < occupiedRooms.length) {
                roomId = occupiedRooms[roomIndex].$id;
                roomNumber = occupiedRooms[roomIndex].room_number;
                roomIndex++;
            } else {
                console.log(`  [SKIP] ${tenantData.full_name} - No more occupied rooms available`);
                skipped++;
                continue;
            }
        }

        tenantRoomPairs.push({ ...tenantData, room_id: roomId, room_number: roomNumber });
    }

    for (const tenantData of tenantRoomPairs) {
        const existing = await findExistingTenant(tenantData.email);
        if (existing) {
            console.log(`  [SKIP] ${tenantData.full_name} already exists (ID: ${existing.$id})`);
            skipped++;
            continue;
        }

        try {
            const data = {
                room_id: tenantData.room_id || '',
                full_name: tenantData.full_name,
                phone_number: tenantData.phone,
                email: tenantData.email,
                id_number: `EM-${Math.floor(10000000 + Math.random() * 90000000)}`,
                emergency_contact: '',
                check_in_date: tenantData.move_in_date,
                check_out_date: null,
                monthly_rent: 0, // Will be set from room
                security_deposit: 0,
                status: tenantData.status,
                notes: ''
            };

            const doc = await databases.createDocument(
                DATABASE_ID,
                TENANTS_COLLECTION_ID,
                ID.unique(),
                data
            );
            
            const roomInfo = tenantData.room_id ? `Room ${tenantData.room_number}` : 'No room';
            console.log(`  [CREATE] ${tenantData.full_name} - ${roomInfo} - ${tenantData.status}`);
            created++;
        } catch (error) {
            console.error(`  [ERROR] Failed to create tenant ${tenantData.full_name}: ${error.message}`);
        }
    }

    console.log(`\nTenants: ${created} created, ${skipped} skipped`);
    return { created, skipped };
}

// =====================
// Rent Transaction Seeder
// =====================

async function seedRentTransactions(allTenants, allRooms) {
    console.log('\n========== SEEDING RENT TRANSACTIONS ==========');
    let created = 0;
    let skipped = 0;

    // Build room map
    const roomMap = {};
    allRooms.forEach(room => {
        roomMap[room.$id] = room;
    });

    // Define transaction patterns per tenant
    // Current month is May 2026 (month=5, year=2026)
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 5
    const currentYear = now.getFullYear(); // 2026

    // Transaction patterns: [month, year, status]
    const transactionPatterns = [
        // Tenant 1 (Room 101): Jan=paid, Feb=paid, Mar=pending, Apr=overdue, May=pending
        { tenantIndex: 0, transactions: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'pending' },
            { month: 4, year: 2026, status: 'overdue' },
            { month: 5, year: 2026, status: 'pending' }
        ]},
        // Tenant 2 (Room 102): Jan=paid, Feb=paid, Mar=paid, Apr=paid, May=pending
        { tenantIndex: 1, transactions: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'paid' },
            { month: 4, year: 2026, status: 'paid' },
            { month: 5, year: 2026, status: 'pending' }
        ]},
        // Tenant 3 (Room 103): Jan=paid, Feb=pending, Mar=overdue, Apr=overdue, May=pending
        { tenantIndex: 2, transactions: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'pending' },
            { month: 3, year: 2026, status: 'overdue' },
            { month: 4, year: 2026, status: 'overdue' },
            { month: 5, year: 2026, status: 'pending' }
        ]},
        // Tenant 4 (Room 201): Jan=paid, Feb=paid, Mar=paid, Apr=paid, May=paid
        { tenantIndex: 3, transactions: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'paid' },
            { month: 4, year: 2026, status: 'paid' },
            { month: 5, year: 2026, status: 'paid' }
        ]},
        // Tenant 5 (Room 202): Jan=paid, Feb=paid, Mar=paid, Apr=pending, May=overdue
        { tenantIndex: 4, transactions: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'paid' },
            { month: 4, year: 2026, status: 'pending' },
            { month: 5, year: 2026, status: 'overdue' }
        ]},
        // Tenant 6 (Room 301): Jan=paid, Feb=paid, Mar=paid, Apr=paid, May=pending
        { tenantIndex: 5, transactions: [
            { month: 1, year: 2026, status: 'paid' },
            { month: 2, year: 2026, status: 'paid' },
            { month: 3, year: 2026, status: 'paid' },
            { month: 4, year: 2026, status: 'paid' },
            { month: 5, year: 2026, status: 'pending' }
        ]}
    ];

    for (const pattern of transactionPatterns) {
        const tenant = allTenants[pattern.tenantIndex];
        if (!tenant) {
            console.log(`  [SKIP] Tenant index ${pattern.tenantIndex} not found`);
            continue;
        }

        const room = roomMap[tenant.room_id];
        const monthlyRent = room ? room.monthly_rent : 1500;
        const roomNumber = room ? room.room_number : 'N/A';

        for (const txn of pattern.transactions) {
            // Check for duplicate
            const existing = await findExistingTransaction(tenant.$id, txn.month, txn.year);
            if (existing) {
                console.log(`  [SKIP] ${tenant.full_name} (Room ${roomNumber}) - ${txn.month}/${txn.year} already exists`);
                skipped++;
                continue;
            }

            try {
                const dueDate = new Date(txn.year, txn.month - 1, 1);
                let transactionDate = dueDate.toISOString();
                let amount = 0;

                if (txn.status === 'paid') {
                    // Simulate payment on the 5th of the month
                    const paidDate = new Date(txn.year, txn.month - 1, 5);
                    transactionDate = paidDate.toISOString();
                    amount = monthlyRent;
                }

                const data = {
                    tenant_id: tenant.$id,
                    room_id: tenant.room_id,
                    collected_by: '', // Will be empty for dummy data
                    amount: amount,
                    monthly_rent: monthlyRent,
                    payment_method: txn.status === 'paid' ? 'cash' : '',
                    payment_status: txn.status,
                    transaction_date: transactionDate,
                    rent_due_date: dueDate.toISOString(),
                    period_month: txn.month,
                    period_year: txn.year,
                    pending_reason: txn.status === 'pending' ? 'Not yet collected' : (txn.status === 'overdue' ? 'Payment overdue' : ''),
                    partial_payment_reason: '',
                    remarks: `Dummy data: ${txn.status} for ${txn.month}/${txn.year}`,
                    receipt_number: txn.status === 'paid' ? `RCPT-DUMMY-${txn.year}${String(txn.month).padStart(2, '0')}-${String(pattern.tenantIndex + 1).padStart(2, '0')}` : ''
                };

                await databases.createDocument(
                    DATABASE_ID,
                    RENT_TRANSACTIONS_COLLECTION_ID,
                    ID.unique(),
                    data
                );
                console.log(`  [CREATE] ${tenant.full_name} (Room ${roomNumber}) - ${txn.month}/${txn.year} - ${monthlyRent} AED - ${txn.status}`);
                created++;
            } catch (error) {
                console.error(`  [ERROR] Failed to create transaction for ${tenant.full_name}: ${error.message}`);
            }
        }
    }

    console.log(`\nTransactions: ${created} created, ${skipped} skipped`);
    return { created, skipped };
}

// =====================
// Main Seeder
// =====================

async function seedDummyData() {
    console.log('========================================');
    console.log('  DUMMY DATA SEEDER');
    console.log('  Development Only');
    console.log('========================================');
    console.log(`Database ID: ${DATABASE_ID}`);
    console.log(`Time: ${new Date().toISOString()}`);

    try {
        // Step 1: Seed Rooms
        const roomResult = await seedRooms();

        // Step 2: Fetch all rooms to get their IDs
        console.log('\nFetching all rooms...');
        const roomsResult = await databases.listDocuments(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            [],
            100
        );
        const allRooms = roomsResult.documents;
        const occupiedRooms = allRooms.filter(room => room.status === 'occupied');
        console.log(`Total rooms: ${allRooms.length}, Occupied: ${occupiedRooms.length}`);

        // Step 3: Seed Tenants
        const tenantResult = await seedTenants(occupiedRooms);

        // Step 4: Fetch all tenants to get their IDs
        console.log('\nFetching all tenants...');
        const tenantsResult = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [],
            100
        );
        const allTenants = tenantsResult.documents;
        const activeTenants = allTenants.filter(t => t.status === 'active');
        console.log(`Total tenants: ${allTenants.length}, Active: ${activeTenants.length}`);

        // Step 5: Seed Rent Transactions
        const transactionResult = await seedRentTransactions(activeTenants, allRooms);

        // Summary
        console.log('\n========================================');
        console.log('  SEEDING COMPLETE');
        console.log('========================================');
        console.log(`  Rooms:        ${roomResult.created} created, ${roomResult.skipped} skipped`);
        console.log(`  Tenants:      ${tenantResult.created} created, ${tenantResult.skipped} skipped`);
        console.log(`  Transactions: ${transactionResult.created} created, ${transactionResult.skipped} skipped`);
        console.log('========================================\n');

    } catch (error) {
        console.error('\nFatal error during seeding:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedDummyData();
}

module.exports = { seedDummyData, seedRooms, seedTenants, seedRentTransactions };
