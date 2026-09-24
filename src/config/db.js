const { Pool, types } = require('pg');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// Return NUMERIC/DECIMAL columns as JS numbers instead of strings,
// so arithmetic in the services (e.g. total += txn.amount) stays numeric.
types.setTypeParser(1700, parseFloat);

const config = {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
};

if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
} else {
    config.host = process.env.PGHOST || 'localhost';
    config.port = parseInt(process.env.PGPORT || '5432', 10);
    config.database = process.env.PGDATABASE || 'RentPro';
    config.user = process.env.PGUSER || 'postgres';
    config.password = process.env.PGPASSWORD || '';
}

if (process.env.PGSSL === 'true') {
    config.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(config);

pool.on('error', (err) => {
    console.error('Unexpected error on idle Postgres client', err);
});

// When set, all queries run on the transaction's connection instead of the pool.
// This lets existing service/shim code participate in a transaction without
// having to thread a client through every call.
const txStorage = new AsyncLocalStorage();

function getExecutor() {
    return txStorage.getStore() || pool;
}

function isInTransaction() {
    return Boolean(txStorage.getStore());
}

async function query(text, params) {
    const start = Date.now();
    const result = await getExecutor().query(text, params);
    const duration = Date.now() - start;
    if (process.env.LOG_QUERIES === 'true') {
        console.log('Executed query', { text: text.slice(0, 200), duration, rows: result.rowCount });
    }
    return result;
}

/**
 * Run `fn` inside a database transaction. Every `query()` / `databases.*` call
 * made inside (including nested service calls) uses the same connection, so a
 * failure anywhere rolls the whole thing back.
 *
 * Nested calls join the existing transaction rather than starting a new one.
 *
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function withTransaction(fn) {
    const existing = txStorage.getStore();
    if (existing) {
        // Already inside a transaction — reuse it.
        return fn(existing);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await txStorage.run(client, () => fn(client));
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('Rollback failed:', rollbackErr.message);
        }
        throw err;
    } finally {
        client.release();
    }
}

function getClient() {
    return pool.connect();
}

function generateId() {
    return crypto.randomUUID();
}

async function testConnection() {
    const result = await query('SELECT NOW() AS now, current_database() AS db');
    return result.rows[0];
}

module.exports = {
    pool,
    query,
    withTransaction,
    isInTransaction,
    getClient,
    generateId,
    testConnection
};
