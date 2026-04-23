const { Client, Databases, ID } = require('node-appwrite');
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

// Mock tenants data from tenants.component.ts (adapted for Appwrite schema)
const mockTenants = [
    {
        room_id: '101',
        full_name: 'John Smith',
        phone_number: '+971501234567',
        email: 'john.smith@example.com',
        id_number: '784-1990-1234567-1',
        emergency_contact: '+971501234568',
        check_in_date: '2024-01-15T10:30:00.000Z',
        check_out_date: null,
        monthly_rent: 5000,
        security_deposit: 10000,
        status: 'active',
        notes: 'Pays on time',
    },
    {
        room_id: '102',
        full_name: 'Maria Garcia',
        phone_number: '+971502345678',
        email: 'maria.garcia@example.com',
        id_number: '784-1991-2345678-2',
        emergency_contact: '+971502345679',
        check_in_date: '2024-02-10T14:20:00.000Z',
        check_out_date: null,
        monthly_rent: 4500,
        security_deposit: 9000,
        status: 'active',
        notes: 'New tenant',
    },
    {
        room_id: '201',
        full_name: 'Ahmed Khan',
        phone_number: '+971503456789',
        email: 'ahmed.khan@example.com',
        id_number: '784-1992-3456789-3',
        emergency_contact: '+971503456780',
        check_in_date: '2023-11-05T09:15:00.000Z',
        check_out_date: null,
        monthly_rent: 5500,
        security_deposit: 11000,
        status: 'active',
        notes: 'Long-term tenant',
    },
    {
        room_id: '202',
        full_name: 'Sarah Johnson',
        phone_number: '+971504567890',
        email: 'sarah.j@example.com',
        id_number: '784-1993-4567890-4',
        emergency_contact: '+971504567891',
        check_in_date: '2024-03-01T11:45:00.000Z',
        check_out_date: null,
        monthly_rent: 4800,
        security_deposit: 9600,
        status: 'active',
        notes: 'Student',
    },
    {
        room_id: '103',
        full_name: 'David Lee',
        phone_number: '+971505678901',
        email: 'david.lee@example.com',
        id_number: '784-1994-5678901-5',
        emergency_contact: '+971505678902',
        check_in_date: '2023-12-20T16:30:00.000Z',
        check_out_date: null,
        monthly_rent: 5200,
        security_deposit: 10400,
        status: 'active',
        notes: 'Corporate tenant',
    },
    {
        room_id: '203',
        full_name: 'Fatima Ali',
        phone_number: '+971506789012',
        email: 'fatima.ali@example.com',
        id_number: '784-1995-6789012-6',
        emergency_contact: '+971506789013',
        check_in_date: '2024-01-25T13:10:00.000Z',
        check_out_date: null,
        monthly_rent: 4700,
        security_deposit: 9400,
        status: 'inactive',
        notes: 'Moved out last month',
    },
    {
        room_id: '104',
        full_name: 'Robert Chen',
        phone_number: '+971507890123',
        email: 'robert.chen@example.com',
        id_number: '784-1996-7890123-7',
        emergency_contact: '+971507890124',
        check_in_date: '2024-02-15T15:45:00.000Z',
        check_out_date: null,
        monthly_rent: 5100,
        security_deposit: 10200,
        status: 'active',
        notes: 'Pays via bank transfer',
    },
    {
        room_id: '204',
        full_name: 'Emma Wilson',
        phone_number: '+971508901234',
        email: 'emma.wilson@example.com',
        id_number: '784-1997-8901234-8',
        emergency_contact: '+971508901235',
        check_in_date: '2023-10-10T12:00:00.000Z',
        check_out_date: null,
        monthly_rent: 5300,
        security_deposit: 10600,
        status: 'active',
        notes: 'Family tenant',
    }
];

async function seedMockTenants() {
    try {
        console.log('Starting to seed mock tenants...');
        
        // First, list existing tenants to avoid duplicates
        let existingTenants = [];
        try {
            const response = await databases.listDocuments(DATABASE_ID, TENANTS_COLLECTION_ID, []);
            existingTenants = response.documents;
            console.log(`Found ${existingTenants.length} existing tenants.`);
        } catch (error) {
            console.log('Could not list existing tenants, assuming empty:', error.message);
        }

        // Determine which mock tenants to insert (by checking if they already exist based on phone or email)
        const tenantsToInsert = [];
        for (const mock of mockTenants) {
            const exists = existingTenants.some(t => 
                t.phone_number === mock.phone_number || 
                (mock.email && t.email === mock.email)
            );
            if (!exists) {
                tenantsToInsert.push(mock);
            } else {
                console.log(`Tenant ${mock.full_name} (${mock.phone_number}) already exists, skipping.`);
            }
        }

        if (tenantsToInsert.length === 0) {
            console.log('All mock tenants already exist in database.');
            return;
        }

        console.log(`Inserting ${tenantsToInsert.length} mock tenants...`);

        // Insert each tenant
        for (const tenant of tenantsToInsert) {
            try {
                // Remove id field (Appwrite will generate its own $id)
                const { id, ...tenantData } = tenant;
                // Use custom ID if we want to keep the mock id? Appwrite will auto-generate.
                // We'll let Appwrite generate IDs.
                const document = await databases.createDocument(
                    DATABASE_ID,
                    TENANTS_COLLECTION_ID,
                    ID.unique(),
                    tenantData
                );
                console.log(`Inserted tenant: ${tenant.full_name} (${tenant.phone_number})`);
            } catch (error) {
                console.error(`Failed to insert tenant ${tenant.full_name}:`, error.message);
            }
        }

        console.log('Mock tenants seeding completed.');
    } catch (error) {
        console.error('Error seeding mock tenants:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedMockTenants();
}

module.exports = { seedMockTenants };