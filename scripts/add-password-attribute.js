/**
 * Script to add the 'password' attribute to the Users collection in Appwrite.
 * 
 * Usage: node scripts/add-password-attribute.js
 * 
 * This script:
 * 1. Adds a 'password' string attribute to the users collection
 * 2. Updates existing users with a default password hash (if any exist)
 */

const { Client, Databases, ID, Query } = require('node-appwrite');
require('dotenv').config();

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';

async function addPasswordAttribute() {
    try {
        console.log('Adding password attribute to users collection...');

        // Add the password attribute (string, max 255 chars, not required)
        await databases.createStringAttribute(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            'password',
            255,
            false, // not required (backward compatibility)
            undefined, // default undefined
            true // array (false)
        );

        console.log('✓ Password attribute added successfully!');

        // Check if there are existing users without passwords
        const existingUsers = await databases.listDocuments(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.limit(100)]
        );

        if (existingUsers.documents.length > 0) {
            console.log(`Found ${existingUsers.documents.length} existing user(s). Checking for users without passwords...`);
            
            for (const user of existingUsers.documents) {
                if (!user.password) {
                    // Set a default password for existing users (demo123)
                    // In production, you should force users to set a new password
                    try {
                        const bcrypt = require('bcryptjs');
                        const hashedPassword = await bcrypt.hash('demo123', 10);
                        
                        await databases.updateDocument(
                            DATABASE_ID,
                            USERS_COLLECTION_ID,
                            user.$id,
                            { password: hashedPassword }
                        );
                        console.log(`  ✓ Updated password for user: ${user.username || user.email}`);
                    } catch (e) {
                        // bcrypt not available, store plain text
                        await databases.updateDocument(
                            DATABASE_ID,
                            USERS_COLLECTION_ID,
                            user.$id,
                            { password: 'demo123' }
                        );
                        console.log(`  ✓ Updated password (plain text) for user: ${user.username || user.email}`);
                    }
                }
            }
            console.log('✓ All existing users have been updated with passwords.');
        } else {
            console.log('No existing users found. Password attribute added for future users.');
        }

        console.log('\nDone! The users collection now has a password field.');
        console.log('You can now run: node seed-users.js to seed users with passwords.');

    } catch (error) {
        if (error.code === 409) {
            console.log('Password attribute already exists. Skipping creation.');
        } else if (error.code === 404) {
            console.error('Collection or database not found. Please run setup-database.js first.');
        } else {
            console.error('Error adding password attribute:', error.message);
        }
        process.exit(1);
    }
}

addPasswordAttribute();
