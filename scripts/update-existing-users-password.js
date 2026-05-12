/**
 * Script to update existing users with a default bcrypt-hashed password.
 * Run this if the password attribute already exists but users have empty passwords.
 * 
 * Usage: node scripts/update-existing-users-password.js
 */

const { Client, Databases, Query } = require('node-appwrite');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID || 'users';

async function updateExistingUsersPassword() {
    try {
        console.log('Checking existing users for missing passwords...');

        const existingUsers = await databases.listDocuments(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.limit(100)]
        );

        if (existingUsers.documents.length === 0) {
            console.log('No users found. Nothing to update.');
            return;
        }

        console.log(`Found ${existingUsers.documents.length} user(s).`);

        const hashedPassword = await bcrypt.hash('demo123', 10);
        let updated = 0;
        let skipped = 0;

        for (const user of existingUsers.documents) {
            // Appwrite returns [] for empty/unset string attributes
            const hasPassword = user.password &&
                !(Array.isArray(user.password) && user.password.length === 0) &&
                typeof user.password === 'string' &&
                user.password.length > 0;

            if (!hasPassword) {
                await databases.updateDocument(
                    DATABASE_ID,
                    USERS_COLLECTION_ID,
                    user.$id,
                    { password: hashedPassword }
                );
                console.log(`  ✓ Updated password for: ${user.username || user.email}`);
                updated++;
            } else {
                console.log(`  [SKIP] ${user.username || user.email} already has a password.`);
                skipped++;
            }
        }

        console.log(`\nDone! ${updated} user(s) updated, ${skipped} skipped.`);
        console.log('All users now have password: demo123 (bcrypt-hashed)');

    } catch (error) {
        console.error('Error updating passwords:', error.message);
        process.exit(1);
    }
}

updateExistingUsersPassword();
