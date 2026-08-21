const { Pool, types } = require('pg');
const crypto = require('crypto');
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

async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.LOG_QUERIES === 'true') {
        console.log('Executed query', { text: text.slice(0, 200), duration, rows: result.rowCount });
    }
    return result;
}

function getClient() {
    return pool.connect();
}

function generateId() {
    return crypto.randomUUID();
}

async function testConnection() {
    const result = await pool.query('SELECT NOW() AS now, current_database() AS db');
    return result.rows[0];
}

module.exports = {
    pool,
    query,
    getClient,
    generateId,
    testConnection
};
