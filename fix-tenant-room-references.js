const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config();

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const TENANTS_COLLECTION_ID = process.env.APPWRITE_TENANTS_COLLECTION_ID || 'tenants';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';

async function fixTenantRoomReferences() {
    try {
        console.log('Fixing tenant room_id references...\n');

        // 1. Get all rooms and build a map: room_number -> room document
        console.log('Fetching rooms...');
        const roomsResult = await databases.listDocuments(DATABASE_ID, ROOMS_COLLECTION_ID, [], 100);
        const rooms = roomsResult.documents;
        console.log(`Found ${rooms.length} rooms.`);

        const roomByNumber = {};
        rooms.forEach(room => {
            roomByNumber[room.room_number] = room;
        });
        console.log('Room number -> ID mapping:');
        Object.entries(roomByNumber).forEach(([num, room]) => {
            console.log(`  Room ${num} -> ${room.$id}`);
        });

        // 2. Get all tenants
        console.log('\nFetching tenants...');
        const tenantsResult = await databases.listDocuments(DATABASE_ID, TENANTS_COLLECTION_ID, [], 100);
        const tenants = tenantsResult.documents;
        console.log(`Found ${tenants.length} tenants.`);

        // 3. Update each tenant's room_id if it's a string literal (not an Appwrite ID)
        let updatedCount = 0;
        let skippedCount = 0;

        for (const tenant of tenants) {
            const currentRoomId = tenant.room_id;
            
            // Check if the current room_id looks like a room number (e.g., '101', '102')
            // Appwrite document IDs are typically 20+ chars with format like "69e..."
            const isRoomNumber = /^\d{3,4}$/.test(currentRoomId) || currentRoomId.includes('test');
            
            if (!isRoomNumber) {
                console.log(`  [SKIP] ${tenant.full_name} - room_id "${currentRoomId}" already looks like a document ID.`);
                skippedCount++;
                continue;
            }

            // Find the room by room number
            const room = roomByNumber[currentRoomId];
            if (!room) {
                console.log(`  [WARN] ${tenant.full_name} - No room found with number "${currentRoomId}". Skipping.`);
                skippedCount++;
                continue;
            }

            // Update the tenant's room_id to the actual room document ID
            try {
                await databases.updateDocument(
                    DATABASE_ID,
                    TENANTS_COLLECTION_ID,
                    tenant.$id,
                    { room_id: room.$id }
                );
                console.log(`  [UPDATE] ${tenant.full_name} - room_id changed from "${currentRoomId}" to "${room.$id}"`);
                updatedCount++;
            } catch (error) {
                console.error(`  [ERROR] Failed to update ${tenant.full_name}: ${error.message}`);
            }
        }

        console.log('\n========================================');
        console.log('Tenant room reference fix completed!');
        console.log(`  Updated: ${updatedCount} tenants`);
        console.log(`  Skipped: ${skippedCount} tenants`);
        console.log('========================================\n');

    } catch (error) {
        console.error('Error fixing tenant room references:', error);
        process.exit(1);
    }
}

fixTenantRoomReferences();
