const { Client, Databases, ID, Query } = require('node-appwrite');
require('dotenv').config();

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Database and collection IDs
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const BUILDINGS_COLLECTION_ID = process.env.APPWRITE_BUILDINGS_COLLECTION_ID || 'buildings';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';
const RENT_TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions';

module.exports = {
    client,
    databases,
    ID,
    Query,
    DATABASE_ID,
    BUILDINGS_COLLECTION_ID,
    ROOMS_COLLECTION_ID,
    TENANTS_COLLECTION_ID,
    USERS_COLLECTION_ID,
    RENT_TRANSACTIONS_COLLECTION_ID
};