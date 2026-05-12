/**
 * Script to add the 'password' attribute to the Users collection in Appwrite.
 *
 * Usage: node scripts/add-password-attribute.js
 *
 * This script:
 * 1. Adds a 'password' string attribute to the users collection
 * 2. Updates existing users with a default bcrypt-hashed password ('demo123')
 */

const { Client, Databases, ID, Query } = require('node-appwrite');
const bcrypt = require('bcryptjs');
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

        // First, try to delete the existing attribute if it was created as array type
        try {
            await databases.deleteAttribute(
                DATABASE_ID,
                USERS_COLLECTION_ID,
                'password'
            );
            console.log('✓ Deleted existing password attribute (was array type, recreating as string)');
            // Wait a moment for the deletion to propagate
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            // Attribute doesn't exist yet, that's fine
        }

        // Add the password attribute (string, max 255 chars, not required)
        await databases.createStringAttribute(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            'password',
            255,
            false, // not required (backward compatibility)
            undefined, // default undefined
            false // array (false = NOT an array)
        );

        console.log('✓ Password attribute added successfully!');
        // Wait for attribute creation to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if there are existing users without passwords
        const existingUsers = await databases.listDocuments(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.limit(100)]
        );

        if (existingUsers.documents.length > 0) {
            console.log(`Found ${existingUsers.documents.length} existing user(s). Checking for users without passwords...`);
            
            const hashedPassword = await bcrypt.hash('demo123', 10);
            
            for (const user of existingUsers.documents) {
                // Appwrite returns [] for empty attributes, so check both null/undefined and empty array
                const hasPassword = user.password &&
                    !(Array.isArray(user.password) && user.password.length === 0);
                
                if (!hasPassword) {
                    await databases.updateDocument(
                        DATABASE_ID,
                        USERS_COLLECTION_ID,
                        user.$id,
                        { password: hashedPassword }
                    );
                    console.log(`  ✓ Updated password for user: ${user.username || user.email}`);
                } else {
                    console.log(`  [SKIP] ${user.username || user.email} already has a password set.`);
                }
            }
            console.log('✓ All existing users have been updated with passwords.');
        } else {
            console.log('No existing users found. Password attribute added for future users.');
        }

        console.log('\nDone! The users collection now has a password field.');
        console.log('All users have password set to: demo123 (bcrypt-hashed)');
        console.log('You can now run: node seed-users.js to seed additional users with passwords.');

    } catch (error) {
        if (error.code === 409) {
            console.log('Password attribute already exists. Skipping creation.');
            console.log('Run the update-existing-users-password.js script to set passwords on existing users.');
        } else if (error.code === 404) {
            console.error('Collection or database not found. Please run setup-database.js first.');
        } else {
            console.error('Error adding password attribute:', error.message);
        }
        process.exit(1);
    }
}

addPasswordAttribute();
