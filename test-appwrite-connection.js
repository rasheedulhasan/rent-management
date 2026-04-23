const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config();

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';

async function testConnection() {
    try {
        console.log('Testing Appwrite connection...');
        console.log('Endpoint:', process.env.APPWRITE_ENDPOINT);
        console.log('Project ID:', process.env.APPWRITE_PROJECT_ID);
        console.log('Database ID:', DATABASE_ID);
        console.log('Tenants Collection ID:', TENANTS_COLLECTION_ID);
        
        // Test 1: List all tenants without filters
        console.log('\nTest 1: Listing all tenants...');
        const result = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID
        );
        console.log('Success! Total tenants:', result.total);
        console.log('Documents:', result.documents.length);
        
        // Test 2: List active tenants with query
        console.log('\nTest 2: Listing active tenants...');
        const activeResult = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [Query.equal('status', 'active')]
        );
        console.log('Success! Active tenants:', activeResult.total);
        
        // Test 3: Try the string query format used in BaseService
        console.log('\nTest 3: Testing string query format...');
        const stringQueryResult = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            ['equal("status", "active")']
        );
        console.log('Success with string query! Active tenants:', stringQueryResult.total);
        
        return { success: true };
    } catch (error) {
        console.error('Error testing Appwrite connection:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        if (error.response) {
            console.error('Response:', error.response);
        }
        return { success: false, error };
    }
}

testConnection().then(result => {
    if (result.success) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Tests failed');
        process.exit(1);
    }
});