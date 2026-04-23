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
const BUILDINGS_COLLECTION_ID = process.env.APPWRITE_BUILDINGS_COLLECTION_ID || 'buildings';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';
const RENT_TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions';

// Helper function to wait
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupDatabase() {
    try {
        console.log('Starting Appwrite database setup...');

        // 1. Create database if it doesn't exist
        try {
            await databases.get(DATABASE_ID);
            console.log(`Database "${DATABASE_ID}" already exists.`);
        } catch (error) {
            if (error.code === 404) {
                await databases.create(DATABASE_ID, 'Rent Collection Database');
                console.log(`Database "${DATABASE_ID}" created successfully.`);
            } else {
                throw error;
            }
        }

        // 2. Create collections
        await createCollections();

        // 3. Create attributes for each collection
        await createAttributes();

        // Wait for attributes to be ready (Appwrite needs time to process attributes)
        console.log('Waiting for attributes to become available (15 seconds)...');
        await wait(15000); // Increased wait time for attribute processing

        // 4. Create indexes with retry logic
        await createIndexesWithRetry();

        console.log('Database setup completed successfully!');
        console.log('\nCollection IDs:');
        console.log(`- Buildings: ${BUILDINGS_COLLECTION_ID}`);
        console.log(`- Rooms: ${ROOMS_COLLECTION_ID}`);
        console.log(`- Tenants: ${TENANTS_COLLECTION_ID}`);
        console.log(`- Users: ${USERS_COLLECTION_ID}`);
        console.log(`- Rent Transactions: ${RENT_TRANSACTIONS_COLLECTION_ID}`);

    } catch (error) {
        console.error('Error during database setup:', error);
        process.exit(1);
    }
}

async function createCollections() {
    const collections = [
        {
            id: BUILDINGS_COLLECTION_ID,
            name: 'Buildings',
            permissions: ['read("any")', 'write("any")'],
            documentSecurity: false
        },
        {
            id: ROOMS_COLLECTION_ID,
            name: 'Rooms/Partitions',
            permissions: ['read("any")', 'write("any")'],
            documentSecurity: false
        },
        {
            id: TENANTS_COLLECTION_ID,
            name: 'Tenants',
            permissions: ['read("any")', 'write("any")'],
            documentSecurity: false
        },
        {
            id: USERS_COLLECTION_ID,
            name: 'Users',
            permissions: ['read("any")', 'write("any")'],
            documentSecurity: false
        },
        {
            id: RENT_TRANSACTIONS_COLLECTION_ID,
            name: 'Rent Transactions',
            permissions: ['read("any")', 'write("any")'],
            documentSecurity: false
        }
    ];

    for (const collection of collections) {
        try {
            await databases.getCollection(DATABASE_ID, collection.id);
            console.log(`Collection "${collection.name}" already exists.`);
        } catch (error) {
            if (error.code === 404) {
                await databases.createCollection(
                    DATABASE_ID,
                    collection.id,
                    collection.name,
                    collection.permissions,
                    collection.documentSecurity
                );
                console.log(`Collection "${collection.name}" created successfully.`);
            } else {
                throw error;
            }
        }
    }
}

async function createAttributes() {
    // Buildings collection attributes
    await createBuildingAttributes();
    
    // Rooms collection attributes
    await createRoomAttributes();
    
    // Tenants collection attributes
    await createTenantAttributes();
    
    // Users collection attributes
    await createUserAttributes();
    
    // Rent Transactions collection attributes
    await createRentTransactionAttributes();
}

async function createBuildingAttributes() {
    const attributes = [
        { key: 'name', type: 'string', size: 255, required: true },
        { key: 'address', type: 'string', size: 500, required: true },
        { key: 'total_floors', type: 'integer', required: true, min: 1 },
        { key: 'total_rooms', type: 'integer', required: true, min: 0 },
        { key: 'description', type: 'string', size: 1000, required: false },
        { key: 'status', type: 'string', size: 50, required: true, default: 'active' }
    ];

    for (const attr of attributes) {
        await createAttribute(DATABASE_ID, BUILDINGS_COLLECTION_ID, attr);
    }
}

async function createRoomAttributes() {
    const attributes = [
        { key: 'building_id', type: 'string', size: 36, required: true },
        { key: 'room_number', type: 'string', size: 50, required: true },
        { key: 'floor', type: 'integer', required: true },
        { key: 'type', type: 'string', size: 50, required: true, default: 'apartment' },
        { key: 'monthly_rent', type: 'double', required: true, min: 0 },
        { key: 'size', type: 'string', size: 50, required: false },
        { key: 'amenities', type: 'string', size: 500, required: false },
        { key: 'status', type: 'string', size: 50, required: true, default: 'vacant' }
    ];

    for (const attr of attributes) {
        await createAttribute(DATABASE_ID, ROOMS_COLLECTION_ID, attr);
    }
}

async function createTenantAttributes() {
    const attributes = [
        { key: 'room_id', type: 'string', size: 36, required: true },
        { key: 'full_name', type: 'string', size: 255, required: true },
        { key: 'phone_number', type: 'string', size: 20, required: true },
        { key: 'email', type: 'string', size: 255, required: false },
        { key: 'id_number', type: 'string', size: 50, required: false },
        { key: 'emergency_contact', type: 'string', size: 255, required: false },
        { key: 'check_in_date', type: 'datetime', required: true },
        { key: 'check_out_date', type: 'datetime', required: false },
        { key: 'monthly_rent', type: 'double', required: true, min: 0 },
        { key: 'security_deposit', type: 'double', required: false, min: 0 },
        { key: 'status', type: 'string', size: 50, required: true, default: 'active' },
        { key: 'notes', type: 'string', size: 1000, required: false }
    ];

    for (const attr of attributes) {
        await createAttribute(DATABASE_ID, TENANTS_COLLECTION_ID, attr);
    }
}

async function createUserAttributes() {
    const attributes = [
        { key: 'username', type: 'string', size: 100, required: true },
        { key: 'full_name', type: 'string', size: 255, required: true },
        { key: 'email', type: 'string', size: 255, required: true },
        { key: 'phone', type: 'string', size: 20, required: false },
        { key: 'role', type: 'string', size: 50, required: true, default: 'collector' },
        { key: 'status', type: 'string', size: 50, required: true, default: 'active' },
        { key: 'permissions', type: 'string', size: 500, required: false }
    ];

    for (const attr of attributes) {
        await createAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr);
    }
}

async function createRentTransactionAttributes() {
    const attributes = [
        { key: 'tenant_id', type: 'string', size: 36, required: true },
        { key: 'room_id', type: 'string', size: 36, required: true },
        { key: 'collected_by', type: 'string', size: 36, required: true },
        { key: 'amount', type: 'double', required: true, min: 0 },
        { key: 'monthly_rent', type: 'double', required: true, min: 0 },
        { key: 'payment_method', type: 'string', size: 50, required: true },
        { key: 'payment_status', type: 'string', size: 50, required: true },
        { key: 'transaction_date', type: 'datetime', required: true },
        { key: 'rent_due_date', type: 'datetime', required: true },
        { key: 'period_month', type: 'integer', required: true, min: 1, max: 12 },
        { key: 'period_year', type: 'integer', required: true, min: 2000 },
        { key: 'partial_payment_reason', type: 'string', size: 500, required: false },
        { key: 'pending_reason', type: 'string', size: 500, required: false },
        { key: 'remarks', type: 'string', size: 1000, required: false },
        { key: 'receipt_number', type: 'string', size: 100, required: false }
    ];

    for (const attr of attributes) {
        await createAttribute(DATABASE_ID, RENT_TRANSACTIONS_COLLECTION_ID, attr);
    }
}

async function createAttribute(databaseId, collectionId, attr) {
    try {
        switch (attr.type) {
            case 'string':
                // For required string attributes, don't pass default value
                if (attr.required) {
                    await databases.createStringAttribute(
                        databaseId,
                        collectionId,
                        attr.key,
                        attr.size,
                        true // required
                    );
                } else {
                    await databases.createStringAttribute(
                        databaseId,
                        collectionId,
                        attr.key,
                        attr.size,
                        false, // not required
                        attr.default || ''
                    );
                }
                break;
            case 'integer':
                // For required integer attributes, don't pass default value
                if (attr.required) {
                    await databases.createIntegerAttribute(
                        databaseId,
                        collectionId,
                        attr.key,
                        true, // required
                        attr.min || null,
                        attr.max || null
                    );
                } else {
                    await databases.createIntegerAttribute(
                        databaseId,
                        collectionId,
                        attr.key,
                        false, // not required
                        attr.min || null,
                        attr.max || null,
                        attr.default || null
                    );
                }
                break;
            case 'double':
                // For required float attributes, don't pass default value
                if (attr.required) {
                    await databases.createFloatAttribute(
                        databaseId,
                        collectionId,
                        attr.key,
                        true, // required
                        attr.min || null,
                        attr.max || null
                    );
                } else {
                    await databases.createFloatAttribute(
                        databaseId,
                        collectionId,
                        attr.key,
                        false, // not required
                        attr.min || null,
                        attr.max || null,
                        attr.default || null
                    );
                }
                break;
            case 'datetime':
                await databases.createDatetimeAttribute(
                    databaseId,
                    collectionId,
                    attr.key,
                    attr.required
                );
                break;
        }
        console.log(`Attribute "${attr.key}" created in ${collectionId}`);
    } catch (error) {
        if (error.code === 409) {
            console.log(`Attribute "${attr.key}" already exists in ${collectionId}`);
        } else {
            console.error(`Error creating attribute "${attr.key}" in ${collectionId}:`, error.message);
        }
    }
}

// Helper function to wait
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createIndexes() {
    try {
        // Buildings indexes
        await databases.createIndex(
            DATABASE_ID,
            BUILDINGS_COLLECTION_ID,
            'idx_buildings_status',
            'key',
            ['status'],
            []
        );
        console.log('Index idx_buildings_status created');
    } catch (error) {
        console.warn('Could not create idx_buildings_status:', error.message);
    }

    try {
        // Rooms indexes
        await databases.createIndex(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            'idx_rooms_building',
            'key',
            ['building_id'],
            []
        );
        console.log('Index idx_rooms_building created');
    } catch (error) {
        console.warn('Could not create idx_rooms_building:', error.message);
    }

    try {
        await databases.createIndex(
            DATABASE_ID,
            ROOMS_COLLECTION_ID,
            'idx_rooms_status',
            'key',
            ['status'],
            []
        );
        console.log('Index idx_rooms_status created');
    } catch (error) {
        console.warn('Could not create idx_rooms_status:', error.message);
    }

    try {
        // Tenants indexes
        await databases.createIndex(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            'idx_tenants_room',
            'key',
            ['room_id'],
            []
        );
        console.log('Index idx_tenants_room created');
    } catch (error) {
        console.warn('Could not create idx_tenants_room:', error.message);
    }

    try {
        await databases.createIndex(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            'idx_tenants_status',
            'key',
            ['status'],
            []
        );
        console.log('Index idx_tenants_status created');
    } catch (error) {
        console.warn('Could not create idx_tenants_status:', error.message);
    }

    try {
        await databases.createIndex(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            'idx_tenants_phone',
            'key',
            ['phone_number'],
            []
        );
        console.log('Index idx_tenants_phone created');
    } catch (error) {
        console.warn('Could not create idx_tenants_phone:', error.message);
    }

    try {
        // Users indexes
        await databases.createIndex(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            'idx_users_email',
            'key',
            ['email'],
            []
        );
        console.log('Index idx_users_email created');
    } catch (error) {
        console.warn('Could not create idx_users_email:', error.message);
    }

    try {
        await databases.createIndex(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            'idx_users_role',
            'key',
            ['role'],
            []
        );
        console.log('Index idx_users_role created');
    } catch (error) {
        console.warn('Could not create idx_users_role:', error.message);
    }

    try {
        // Rent Transactions indexes
        await databases.createIndex(
            DATABASE_ID,
            RENT_TRANSACTIONS_COLLECTION_ID,
            'idx_transactions_tenant',
            'key',
            ['tenant_id'],
            []
        );
        console.log('Index idx_transactions_tenant created');
    } catch (error) {
        console.warn('Could not create idx_transactions_tenant:', error.message);
    }

    try {
        await databases.createIndex(
            DATABASE_ID,
            RENT_TRANSACTIONS_COLLECTION_ID,
            'idx_transactions_status',
            'key',
            ['payment_status'],
            []
        );
        console.log('Index idx_transactions_status created');
    } catch (error) {
        console.warn('Could not create idx_transactions_status:', error.message);
    }

    try {
        await databases.createIndex(
            DATABASE_ID,
            RENT_TRANSACTIONS_COLLECTION_ID,
            'idx_transactions_period',
            'key',
            ['period_year', 'period_month'],
            []
        );
        console.log('Index idx_transactions_period created');
    } catch (error) {
        console.warn('Could not create idx_transactions_period:', error.message);
    }

    try {
        await databases.createIndex(
            DATABASE_ID,
            RENT_TRANSACTIONS_COLLECTION_ID,
            'idx_transactions_date',
            'key',
            ['transaction_date'],
            []
        );
        console.log('Index idx_transactions_date created');
    } catch (error) {
        console.warn('Could not create idx_transactions_date:', error.message);
    }

    console.log('Index creation completed.');
}

// Create indexes with retry logic
async function createIndexesWithRetry(maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Attempt ${attempt} to create indexes...`);
        
        try {
            await createIndexes();
            console.log('Indexes created successfully on attempt', attempt);
            return;
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                console.log(`Waiting 5 seconds before retry...`);
                await wait(5000);
            }
        }
    }
    
    console.error('Failed to create indexes after', maxRetries, 'attempts:', lastError.message);
    console.log('Some indexes may not have been created, but the database is still functional.');
}

// Run setup
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase, createIndexesWithRetry };