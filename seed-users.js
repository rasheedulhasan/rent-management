const { Client, Databases, ID, Query } = require('node-appwrite');
require('dotenv').config();

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Database and collection IDs from environment
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';

// Mock users data matching the requirements
const mockUsers = [
    {
        username: 'ali_khan',
        full_name: 'Ali Khan',
        email: 'ali@test.com',
        phone: '0500000001',
        role: 'collector',
        status: 'active',
        permissions: 'collect,view'
    },
    {
        username: 'ahmed_raza',
        full_name: 'Ahmed Raza',
        email: 'ahmed@test.com',
        phone: '0500000002',
        role: 'collector',
        status: 'active',
        permissions: 'collect,view'
    },
    {
        username: 'usman_tariq',
        full_name: 'Usman Tariq',
        email: 'usman@test.com',
        phone: '0500000003',
        role: 'collector',
        status: 'active',
        permissions: 'collect,view'
    }
];

async function seedUsers() {
    try {
        console.log('Starting user seeding...');
        
        // Check if collection exists and has any users
        let existingUsers = [];
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                USERS_COLLECTION_ID,
                [Query.limit(1)]
            );
            existingUsers = response.documents;
            console.log(`Found ${existingUsers.length} existing users in the collection.`);
        } catch (error) {
            if (error.code === 404) {
                console.log('Users collection does not exist. Please run setup-database.js first.');
                return;
            }
            throw error;
        }

        // Only seed if collection is empty
        if (existingUsers.length === 0) {
            console.log('Collection is empty. Seeding mock users...');
            
            for (const userData of mockUsers) {
                try {
                    // Check if user with same email already exists
                    const existingUser = await databases.listDocuments(
                        DATABASE_ID,
                        USERS_COLLECTION_ID,
                        [Query.equal('email', userData.email)]
                    );
                    
                    if (existingUser.documents.length === 0) {
                        await databases.createDocument(
                            DATABASE_ID,
                            USERS_COLLECTION_ID,
                            ID.unique(),
                            userData
                        );
                        console.log(`Created user: ${userData.full_name} (${userData.email})`);
                    } else {
                        console.log(`User with email ${userData.email} already exists, skipping.`);
                    }
                } catch (error) {
                    console.error(`Error creating user ${userData.full_name}:`, error.message);
                }
            }
            
            console.log('User seeding completed successfully!');
        } else {
            console.log('Collection already has users. Skipping seeding.');
            console.log('To reseed, delete all users from the collection first.');
        }
        
    } catch (error) {
        console.error('Error during user seeding:', error);
        process.exit(1);
    }
}

// Run the seeding function
seedUsers();