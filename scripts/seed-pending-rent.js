const { Client, Databases, ID, Query } = require('node-appwrite');
require('dotenv').config();

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Database and collection IDs from environment
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';
const RENT_TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions';

/**
 * Generate pending rent transactions for active tenants.
 * Creates transactions for the current month and previous month
 * with payment_status = 'pending' so the dashboard shows pending rent data.
 */
async function seedPendingRent() {
    try {
        console.log('Starting pending rent seeding...');
        console.log(`Current time: ${new Date().toISOString()}`);

        // 1. Fetch active tenants
        console.log('\nFetching active tenants...');
        const tenantsResult = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [Query.equal('status', 'active')]
        );
        const activeTenants = tenantsResult.documents;
        console.log(`Found ${activeTenants.length} active tenants.`);

        if (activeTenants.length === 0) {
            console.log('No active tenants found. Please run seed-mock-tenants.js first.');
            return;
        }

        // 2. Fetch collector users
        console.log('\nFetching collector users...');
        const usersResult = await databases.listDocuments(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.equal('role', 'collector')]
        );
        const collectors = usersResult.documents;
        console.log(`Found ${collectors.length} collectors.`);

        if (collectors.length === 0) {
            console.log('No collectors found. Please run seed-users.js first.');
            return;
        }

        // 3. Fetch all rooms for building/room number lookup
        console.log('\nFetching rooms...');
        const roomsResult = await databases.listDocuments(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            [],
            100
        );
        const rooms = roomsResult.documents;
        const roomMap = {};
        rooms.forEach(room => {
            roomMap[room.$id] = room;
        });
        console.log(`Loaded ${rooms.length} rooms.`);

        // 4. Fetch existing pending transactions to avoid duplicates
        console.log('\nChecking for existing pending transactions...');
        const existingResult = await databases.listDocuments(
            DATABASE_ID,
            RENT_TRANSACTIONS_COLLECTION_ID,
            [Query.equal('payment_status', 'pending')],
            1000
        );
        const existingPending = existingResult.documents;
        console.log(`Found ${existingPending.length} existing pending transactions.`);

        // Build a set of "tenant_id:period_month:period_year" to check duplicates
        const existingKeySet = new Set();
        existingPending.forEach(txn => {
            existingKeySet.add(`${txn.tenant_id}:${txn.period_month}:${txn.period_year}`);
        });

        // 5. Determine periods to seed
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Previous month (handle January -> December of previous year)
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = currentYear - 1;
        }

        const periods = [
            { month: currentMonth, year: currentYear, label: 'current' },
            { month: prevMonth, year: prevYear, label: 'previous' }
        ];

        console.log(`\nTarget periods: ${periods.map(p => `${p.month}/${p.year} (${p.label})`).join(', ')}`);

        // 6. Generate pending transactions
        let createdCount = 0;
        let skippedCount = 0;

        for (const tenant of activeTenants) {
            const room = roomMap[tenant.room_id];
            const roomNumber = room ? room.room_number : 'N/A';

            for (const period of periods) {
                const key = `${tenant.$id}:${period.month}:${period.year}`;

                if (existingKeySet.has(key)) {
                    console.log(`  [SKIP] ${tenant.full_name} (Room ${roomNumber}) - ${period.month}/${period.year} already exists.`);
                    skippedCount++;
                    continue;
                }

                // Pick a random collector
                const collector = collectors[Math.floor(Math.random() * collectors.length)];

                // Determine pending reason
                const reasons = [
                    'Not yet collected',
                    'Tenant delayed payment',
                    'Awaiting collection',
                    'Payment pending'
                ];

                // Use a more specific reason for older periods
                const reason = period.label === 'previous'
                    ? 'Tenant delayed payment'
                    : reasons[Math.floor(Math.random() * reasons.length)];

                // Due date: 1st of the period month
                const dueDate = new Date(period.year, period.month - 1, 1);

                const transactionData = {
                    tenant_id: tenant.$id,
                    room_id: tenant.room_id,
                    collected_by: collector.$id,
                    amount: 0,
                    monthly_rent: tenant.monthly_rent,
                    payment_method: 'cash',
                    payment_status: 'pending',
                    transaction_date: dueDate.toISOString(),
                    rent_due_date: dueDate.toISOString(),
                    period_month: period.month,
                    period_year: period.year,
                    pending_reason: reason,
                    partial_payment_reason: '',
                    remarks: `Auto-seeded pending rent for ${period.month}/${period.year}`,
                    receipt_number: ''
                };

                try {
                    await databases.createDocument(
                        DATABASE_ID,
                        RENT_TRANSACTIONS_COLLECTION_ID,
                        ID.unique(),
                        transactionData
                    );
                    console.log(`  [CREATE] ${tenant.full_name} (Room ${roomNumber}) - ${period.month}/${period.year} - ${tenant.monthly_rent} AED - Reason: ${reason}`);
                    createdCount++;
                } catch (error) {
                    console.error(`  [ERROR] Failed to create transaction for ${tenant.full_name}: ${error.message}`);
                }
            }
        }

        console.log('\n========================================');
        console.log('Pending rent seeding completed!');
        console.log(`  Created: ${createdCount} transactions`);
        console.log(`  Skipped (already exist): ${skippedCount} transactions`);
        console.log('========================================\n');

    } catch (error) {
        console.error('Error during pending rent seeding:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedPendingRent();
}

module.exports = { seedPendingRent };
