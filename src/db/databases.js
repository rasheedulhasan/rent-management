'use strict';

/**
 * Postgres-backed shim that mirrors node-appwrite's Databases API surface.
 *
 * Methods keep the exact Appwrite signatures:
 *   createDocument(databaseId, collectionId, documentId, data, permissions?)
 *   getDocument(databaseId, collectionId, documentId)
 *   updateDocument(databaseId, collectionId, documentId, data, permissions?)
 *   deleteDocument(databaseId, collectionId, documentId)
 *   listDocuments(databaseId, collectionId, queries?, limit?, offset?, orderField?, orderType?)
 *
 * Documents are returned in Appwrite shape ({ $id, $createdAt, $updatedAt, ...attrs }).
 */

const { pool } = require('../config/db');
const { generateId } = require('../config/db');
const { translateQueries, mapAttribute } = require('./query');

// Collection id -> table name + column metadata.
// systemTimestampCols are TIMESTAMPTZ columns backed by Appwrite's $createdAt/$updatedAt.
// rent_ledger keeps its own app-managed VARCHAR created_at/updated_at attributes.
const TABLES = {
    buildings: {
        columns: ['id', 'name', 'address', 'total_floors', 'total_rooms', 'description', 'status', 'created_at', 'updated_at'],
        systemTimestampCols: ['created_at', 'updated_at']
    },
    rooms: {
        columns: ['id', 'building_id', 'room_number', 'floor', 'type', 'monthly_rent', 'size', 'amenities', 'status', 'created_at', 'updated_at'],
        systemTimestampCols: ['created_at', 'updated_at']
    },
    tenants: {
        columns: ['id', 'room_id', 'full_name', 'phone_number', 'email', 'id_number', 'emergency_contact', 'check_in_date', 'check_out_date', 'monthly_rent', 'security_deposit', 'billing_day', 'status', 'notes', 'created_at', 'updated_at'],
        systemTimestampCols: ['created_at', 'updated_at']
    },
    users: {
        columns: ['id', 'username', 'full_name', 'email', 'phone', 'role', 'status', 'permissions', 'password', 'created_at', 'updated_at'],
        systemTimestampCols: ['created_at', 'updated_at']
    },
    rent_ledger: {
        columns: ['id', 'ledger_uid', 'room_id', 'tenant_id', 'rent_period', 'tenant_name', 'room_number', 'monthly_rent', 'expected_rent', 'amount_due', 'amount_paid', 'pending_balance', 'status', 'payment_status', 'period_month', 'period_year', 'rent_due_date', 'overdue_days', 'created_at', 'updated_at'],
        systemTimestampCols: []
    },
    rent_transactions: {
        columns: ['id', 'tenant_id', 'room_id', 'collected_by', 'amount', 'monthly_rent', 'payment_method', 'payment_status', 'transaction_date', 'rent_due_date', 'period_month', 'period_year', 'partial_payment_reason', 'pending_reason', 'remarks', 'receipt_number', 'ledger_id', 'created_at', 'updated_at'],
        systemTimestampCols: ['created_at', 'updated_at']
    }
};

function resolveTable(collectionId) {
    const table = String(collectionId);
    if (!TABLES[table]) {
        throw new Error(`Unknown collection: ${collectionId}`);
    }
    return table;
}

function notFound(documentId) {
    const err = new Error(`Document not found: ${documentId}`);
    err.code = 404;
    return err;
}

function rowToDoc(row, table, databaseId, collectionId) {
    const meta = TABLES[table];
    const doc = {
        $id: row.id,
        $databaseId: databaseId,
        $collectionId: collectionId,
        $permissions: []
    };
    for (const col of meta.columns) {
        if (col === 'id') continue;
        const val = row[col];
        if (meta.systemTimestampCols.includes(col)) {
            if (col === 'created_at') doc.$createdAt = val instanceof Date ? val.toISOString() : val;
            if (col === 'updated_at') doc.$updatedAt = val instanceof Date ? val.toISOString() : val;
            // not exposed as an attribute
        } else {
            doc[col] = val === undefined ? null : val;
        }
    }
    return doc;
}

async function createDocument(databaseId, collectionId, documentId, data, permissions) {
    const table = resolveTable(collectionId);
    const meta = TABLES[table];
    const now = new Date();

    const cols = ['id'];
    const vals = [documentId];

    for (const col of meta.columns) {
        if (col === 'id') continue;
        cols.push(col);
        if (meta.systemTimestampCols.includes(col)) {
            vals.push(now);
        } else {
            vals.push(data && data[col] !== undefined ? data[col] : null);
        }
    }

    const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const res = await pool.query(sql, vals);
    return rowToDoc(res.rows[0], table, databaseId, collectionId);
}

async function getDocument(databaseId, collectionId, documentId) {
    const table = resolveTable(collectionId);
    const res = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [documentId]);
    if (res.rows.length === 0) throw notFound(documentId);
    return rowToDoc(res.rows[0], table, databaseId, collectionId);
}

async function updateDocument(databaseId, collectionId, documentId, data, permissions) {
    const table = resolveTable(collectionId);
    const meta = TABLES[table];
    const now = new Date();

    const setParts = [];
    const vals = [];
    const addVal = (v) => {
        vals.push(v);
        return '$' + vals.length;
    };

    for (const col of meta.columns) {
        if (col === 'id') continue;
        if (data && Object.prototype.hasOwnProperty.call(data, col)) {
            setParts.push(`${col} = ${addVal(data[col])}`);
        }
    }

    // Always bump the system updated_at unless the caller supplied one.
    if (meta.systemTimestampCols.includes('updated_at') && !(data && Object.prototype.hasOwnProperty.call(data, 'updated_at'))) {
        setParts.push(`updated_at = ${addVal(now)}`);
    }

    if (setParts.length === 0) {
        return getDocument(databaseId, collectionId, documentId);
    }

    const where = `${addVal(documentId)}`;
    const sql = `UPDATE ${table} SET ${setParts.join(', ')} WHERE id = ${where} RETURNING *`;
    const res = await pool.query(sql, vals);
    if (res.rows.length === 0) throw notFound(documentId);
    return rowToDoc(res.rows[0], table, databaseId, collectionId);
}

async function deleteDocument(databaseId, collectionId, documentId) {
    const table = resolveTable(collectionId);
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [documentId]);
}

async function listDocuments(databaseId, collectionId, queries, limit, offset, orderField, orderType) {
    const table = resolveTable(collectionId);
    const translated = translateQueries(queries);
    const params = translated.params.slice();

    let effLimit = translated.limit;
    let effOffset = translated.offset;
    if (effLimit === null || effLimit === undefined) {
        effLimit = (limit !== undefined && limit !== null) ? parseInt(limit, 10) : null;
    }
    if (effOffset === null || effOffset === undefined) {
        effOffset = (offset !== undefined && offset !== null) ? parseInt(offset, 10) : null;
    }

    let orderSql = '';
    if (translated.order) {
        orderSql = ` ORDER BY ${translated.order.field} ${translated.order.dir}`;
    } else if (orderField) {
        orderSql = ` ORDER BY ${mapAttribute(orderField)} ${orderType === 'ASC' ? 'ASC' : 'DESC'}`;
    }

    const whereSql = translated.where ? ` WHERE ${translated.where}` : '';

    const countRes = await pool.query(`SELECT count(*) AS total FROM ${table}${whereSql}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    let selectSql = `SELECT * FROM ${table}${whereSql}${orderSql}`;
    if (effLimit !== null && effLimit !== undefined && !Number.isNaN(effLimit)) {
        selectSql += ` LIMIT ${effLimit}`;
    }
    if (effOffset !== null && effOffset !== undefined && !Number.isNaN(effOffset)) {
        selectSql += ` OFFSET ${effOffset}`;
    }

    const res = await pool.query(selectSql, params);
    const documents = res.rows.map((r) => rowToDoc(r, table, databaseId, collectionId));
    return { total, documents };
}

module.exports = {
    createDocument,
    getDocument,
    updateDocument,
    deleteDocument,
    listDocuments,
    generateId
};
