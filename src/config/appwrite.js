'use strict';

/**
 * Backward-compatible config module.
 *
 * The app was built against Appwrite; this module now re-exports a
 * PostgreSQL-backed equivalent with the SAME named exports and method
 * signatures, so no service or route needs to change.
 */

require('dotenv').config();

const { Query } = require('../db/query');
const databases = require('../db/databases');
const { generateId } = require('./db');

const ID = {
    unique: () => generateId(),
    custom: (id) => id
};

// The shim resolves tables by collection id and ignores databaseId,
// so this value is only a stable identifier.
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rentpro';

const BUILDINGS_COLLECTION_ID = process.env.APPWRITE_BUILDINGS_COLLECTION_ID || 'buildings';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';
const RENT_TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions';
const RENT_LEDGER_COLLECTION_ID = process.env.APPWRITE_RENT_LEDGER_COLLECTION_ID || 'rent_ledger';

module.exports = {
    client: null,
    databases,
    ID,
    Query,
    DATABASE_ID,
    BUILDINGS_COLLECTION_ID,
    ROOMS_COLLECTION_ID,
    TENANTS_COLLECTION_ID,
    USERS_COLLECTION_ID,
    RENT_TRANSACTIONS_COLLECTION_ID,
    RENT_LEDGER_COLLECTION_ID
};
