const { Client, Databases, ID } = require('node-appwrite');
require('dotenv').config();

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Database and collection IDs from environment
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'rent_collection_db';
const BUILDINGS_COLLECTION_ID = process.env.APPWRITE_BUILDINGS_COLLECTION_ID || 'buildings';
const ROOMS_COLLECTION_ID = process.env.APPWRITE_ROOMS_COLLECTION_ID || 'rooms';

// Room definitions: room_number -> { floor, type, monthly_rent, size }
const roomDefinitions = {
    '101': { floor: 1, type: 'apartment', monthly_rent: 5000, size: '1 BHK' },
    '102': { floor: 1, type: 'apartment', monthly_rent: 4500, size: '1 BHK' },
    '103': { floor: 1, type: 'apartment', monthly_rent: 5200, size: '2 BHK' },
    '104': { floor: 1, type: 'apartment', monthly_rent: 5100, size: '2 BHK' },
    '201': { floor: 2, type: 'apartment', monthly_rent: 5500, size: '2 BHK' },
    '202': { floor: 2, type: 'apartment', monthly_rent: 4800, size: '1 BHK' },
    '203': { floor: 2, type: 'apartment', monthly_rent: 4700, size: '1 BHK' },
    '204': { floor: 2, type: 'apartment', monthly_rent: 5300, size: '2 BHK' },
    '301': { floor: 3, type: 'apartment', monthly_rent: 6000, size: '2 BHK' },
    '302': { floor: 3, type: 'apartment', monthly_rent: 5500, size: '2 BHK' },
    '401': { floor: 4, type: 'studio', monthly_rent: 3500, size: 'Studio' },
    '402': { floor: 4, type: 'studio', monthly_rent: 3800, size: 'Studio' },
};

async function seedRooms() {
    try {
        console.log('Starting rooms seeding...');

        // 1. Fetch existing buildings
        console.log('\nFetching buildings...');
        const buildingsResult = await databases.listDocuments(DATABASE_ID, BUILDINGS_COLLECTION_ID, [], 100);
        const buildings = buildingsResult.documents;
        console.log(`Found ${buildings.length} buildings.`);

        if (buildings.length === 0) {
            console.log('No buildings found. Please run seed-buildings.js first.');
            return;
        }

        // Use the first building as the primary one for our rooms
        const primaryBuilding = buildings[0];
        console.log(`Using building: "${primaryBuilding.name}" (ID: ${primaryBuilding.$id})`);

        // 2. Check existing rooms
        const existingRoomsResult = await databases.listDocuments(DATABASE_ID, ROOMS_COLLECTION_ID, [], 100);
        const existingRooms = existingRoomsResult.documents;
        console.log(`Found ${existingRooms.length} existing rooms.`);

        // Build set of existing room numbers
        const existingRoomNumbers = new Set(existingRooms.map(r => r.room_number));

        // 3. Create rooms
        let createdCount = 0;
        let skippedCount = 0;

        for (const [roomNumber, def] of Object.entries(roomDefinitions)) {
            if (existingRoomNumbers.has(roomNumber)) {
                console.log(`  [SKIP] Room ${roomNumber} already exists.`);
                skippedCount++;
                continue;
            }

            const roomData = {
                building_id: primaryBuilding.$id,
                room_number: roomNumber,
                floor: def.floor,
                type: def.type,
                monthly_rent: def.monthly_rent,
                size: def.size,
                amenities: '',
                status: 'vacant'
            };

            try {
                await databases.createDocument(
                    DATABASE_ID,
                    ROOMS_COLLECTION_ID,
                    ID.unique(),
                    roomData
                );
                console.log(`  [CREATE] Room ${roomNumber} (Floor ${def.floor}, ${def.type}, ${def.monthly_rent} AED)`);
                createdCount++;
            } catch (error) {
                console.error(`  [ERROR] Failed to create room ${roomNumber}: ${error.message}`);
            }
        }

        console.log('\n========================================');
        console.log('Rooms seeding completed!');
        console.log(`  Created: ${createdCount} rooms`);
        console.log(`  Skipped: ${skippedCount} rooms`);
        console.log('========================================\n');

    } catch (error) {
        console.error('Error during rooms seeding:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedRooms();
}

module.exports = { seedRooms };
