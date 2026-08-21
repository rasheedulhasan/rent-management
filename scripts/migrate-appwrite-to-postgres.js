/**
 * Migrate data from Appwrite (Cloud) into local PostgreSQL "RentPro".
 *
 * Usage:
 *   1. Ensure the Appwrite project is active (not paused).
 *   2. Ensure DATABASE_URL (or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD) is set
 *      in .env pointing at RentPro, and the schema has been applied (scripts/schema.sql).
 *   3. Run: node scripts/migrate-appwrite-to-postgres.js
 *
 * Idempotent: uses ON CONFLICT (id) DO NOTHING, so re-running is safe.
 */

const { Client, Databases, Query } = require('node-appwrite');
const { Pool } = require('pg');
require('dotenv').config();

// ---- Appwrite source ----
const appwrite = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(appwrite);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

// ---- Postgres target ----
const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
              host: process.env.PGHOST || 'localhost',
              port: parseInt(process.env.PGPORT || '5432', 10),
              database: process.env.PGDATABASE || 'RentPro',
              user: process.env.PGUSER || 'postgres',
              password: process.env.PGPASSWORD || ''
          }
);

// Tables, their target columns, and their Appwrite collection id.
// Insertion order respects parent/child dependencies.
const TABLES = [
    {
        collection: process.env.APPWRITE_BUILDINGS_COLLECTION_ID || 'buildings',
        table: 'buildings',
        columns: ['id', 'name', 'address', 'total_floors', 'total_rooms', 'description', 'status', 'created_at', 'updated_at']
    },
    {
        collection: process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms',
        table: 'rooms',
        columns: ['id', 'building_id', 'room_number', 'floor', 'type', 'monthly_rent', 'size', 'amenities', 'status', 'created_at', 'updated_at']
    },
    {
        collection: process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants',
        table: 'tenants',
        columns: ['id', 'room_id', 'full_name', 'phone_number', 'email', 'id_number', 'emergency_contact', 'check_in_date', 'check_out_date', 'monthly_rent', 'security_deposit', 'billing_day', 'status', 'notes', 'created_at', 'updated_at']
    },
    {
        collection: process.env.APPWRITE_USERS_COLLECTION_ID || 'users',
        table: 'users',
        columns: ['id', 'username', 'full_name', 'email', 'phone', 'role', 'status', 'permissions', 'password', 'created_at', 'updated_at']
    },
    {
        collection: process.env.APPWRITE_RENT_LEDGER_COLLECTION_ID || 'rent_ledger',
        table: 'rent_ledger',
        columns: ['id', 'ledger_uid', 'room_id', 'tenant_id', 'rent_period', 'tenant_name', 'room_number', 'monthly_rent', 'expected_rent', 'amount_due', 'amount_paid', 'pending_balance', 'status', 'payment_status', 'period_month', 'period_year', 'rent_due_date', 'overdue_days', 'created_at', 'updated_at']
    },
    {
        collection: process.env.APPWRITE_RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions',
        table: 'rent_transactions',
        columns: ['id', 'tenant_id', 'room_id', 'collected_by', 'amount', 'monthly_rent', 'payment_method', 'payment_status', 'transaction_date', 'rent_due_date', 'period_month', 'period_year', 'partial_payment_reason', 'pending_reason', 'remarks', 'receipt_number', 'ledger_id', 'created_at', 'updated_at']
    }
];

async function fetchAll(collectionId) {
    const docs = [];
    const pageSize = 100;
    let offset = 0;

    while (true) {
        const res = await databases.listDocuments(
            DATABASE_ID,
            collectionId,
            [Query.limit(pageSize), Query.offset(offset), Query.orderAsc('$id')]
        );
        docs.push(...res.documents);
        if (res.documents.length < pageSize) break;
        offset += pageSize;
    }
    return docs;
}

function toRow(doc, columns) {
    const row = {};
    for (const col of columns) {
        if (col === 'id') continue;
        row[col] = doc[col] !== undefined && doc[col] !== null ? doc[col] : null;
    }
    row.id = doc.$id;
    // rent_ledger stores its own app-managed created_at/updated_at strings;
    // all other tables derive them from Appwrite system fields.
    row.created_at = doc.created_at !== undefined && doc.created_at !== null ? doc.created_at : (doc.$createdAt || null);
    row.updated_at = doc.updated_at !== undefined && doc.updated_at !== null ? doc.updated_at : (doc.$updatedAt || null);
    return row;
}

async function main() {
    console.log('Appwrite -> PostgreSQL migration');
    console.log('Source:', process.env.APPWRITE_ENDPOINT, '| DB:', DATABASE_ID);
    console.log('Target:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:\/\/.*@/, '://***@') : (process.env.PGDATABASE || 'RentPro'));
    console.log('');

    for (const { collection, table, columns } of TABLES) {
        console.log(`Fetching ${collection} ...`);
        const docs = await fetchAll(collection);
        const rows = docs.map((d) => toRow(d, columns));
        console.log(`  ${rows.length} document(s)`);

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

        let inserted = 0;
        let failed = 0;
        for (const row of rows) {
            const values = columns.map((c) => row[c] !== undefined ? row[c] : null);
            try {
                const res = await pool.query(sql, values);
                inserted += res.rowCount;
            } catch (err) {
                failed++;
                console.warn(`    [warn] ${table} ${row.id}: ${err.message}`);
            }
        }
        console.log(`  -> inserted ${inserted}, failed ${failed}`);
    }

    await pool.end();
    console.log('\nMigration complete.');
}

main().catch((err) => {
    console.error('Migration error:', err.message);
    process.exit(1);
});
