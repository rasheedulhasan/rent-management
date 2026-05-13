/**
 * Setup Rent Ledger Collection
 *
 * Creates the required attributes and indexes on the rent_ledger collection
 * in Appwrite. Run this once to set up the schema.
 *
 * Usage: node scripts/setup-rent-ledger-collection.js
 */

const { databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID } = require('../src/config/appwrite');

const ATTRIBUTES = [
    // Tenant info
    { key: 'tenant_id', type: 'string', size: 255, required: true },
    { key: 'tenant_name', type: 'string', size: 255, required: true },
    { key: 'room_id', type: 'string', size: 255, required: true },
    { key: 'room_number', type: 'string', size: 50, required: false },

    // Financial fields
    { key: 'monthly_rent', type: 'double', required: true },
    { key: 'expected_rent', type: 'double', required: true },
    { key: 'amount_due', type: 'double', required: true },
    { key: 'amount_paid', type: 'double', required: true },
    { key: 'pending_balance', type: 'double', required: true },

    // Status fields
    { key: 'status', type: 'string', size: 50, required: true },
    { key: 'payment_status', type: 'string', size: 50, required: true },

    // Period fields
    { key: 'period_month', type: 'integer', required: true },
    { key: 'period_year', type: 'integer', required: true },

    // Date fields
    { key: 'rent_due_date', type: 'string', size: 50, required: false },
    { key: 'overdue_days', type: 'integer', required: false },
    { key: 'created_at', type: 'string', size: 50, required: false },
    { key: 'updated_at', type: 'string', size: 50, required: false },
];

const INDEXES = [
    { key: 'tenant_period', type: 'key', attributes: ['tenant_id', 'period_month', 'period_year'], orders: ['ASC', 'ASC', 'ASC'] },
    { key: 'period_status', type: 'key', attributes: ['period_month', 'period_year', 'payment_status'], orders: ['ASC', 'ASC', 'ASC'] },
    { key: 'period_month_year', type: 'key', attributes: ['period_month', 'period_year'], orders: ['ASC', 'ASC'] },
    { key: 'payment_status_idx', type: 'key', attributes: ['payment_status'], orders: ['ASC'] },
    { key: 'room_id_idx', type: 'key', attributes: ['room_id'], orders: ['ASC'] },
];

async function createAttribute(attr) {
    try {
        if (attr.type === 'string') {
            await databases.createStringAttribute(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                attr.key,
                attr.size || 255,
                attr.required || false
            );
        } else if (attr.type === 'integer') {
            await databases.createIntegerAttribute(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                attr.key,
                attr.required || false
            );
        } else if (attr.type === 'double') {
            await databases.createFloatAttribute(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                attr.key,
                attr.required || false
            );
        }
        console.log(`  ✓ Created attribute: ${attr.key} (${attr.type})`);
        return true;
    } catch (error) {
        if (error.message && error.message.includes('already exists')) {
            console.log(`  - Already exists: ${attr.key}`);
            return true;
        }
        console.error(`  ✗ Failed to create attribute ${attr.key}:`, error.message);
        return false;
    }
}

async function createIndex(index) {
    try {
        await databases.createIndex(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            index.key,
            index.type,
            index.attributes,
            index.orders
        );
        console.log(`  ✓ Created index: ${index.key}`);
        return true;
    } catch (error) {
        if (error.message && error.message.includes('already exists')) {
            console.log(`  - Already exists: ${index.key}`);
            return true;
        }
        console.error(`  ✗ Failed to create index ${index.key}:`, error.message);
        return false;
    }
}

async function setupCollection() {
    console.log('Setting up rent_ledger collection...\n');

    console.log('Creating attributes:');
    for (const attr of ATTRIBUTES) {
        await createAttribute(attr);
    }

    console.log('\nCreating indexes:');
    for (const index of INDEXES) {
        await createIndex(index);
    }

    console.log('\nSetup complete!');
}

setupCollection().catch(console.error);
