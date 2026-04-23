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

// Mock buildings data
const mockBuildings = [
    {
        name: 'Al Noor Building',
        address: '123 Al Noor Street, Dubai',
        total_floors: 5,
        total_rooms: 20,
        description: 'Luxury residential building',
        status: 'active'
    },
    {
        name: 'Sunrise Tower',
        address: '456 Sunrise Road, Dubai',
        total_floors: 10,
        total_rooms: 40,
        description: 'Modern high-rise with amenities',
        status: 'active'
    },
    {
        name: 'Palm Residency',
        address: '789 Palm Jumeirah, Dubai',
        total_floors: 8,
        total_rooms: 32,
        description: 'Beachfront apartments',
        status: 'active'
    },
    {
        name: 'City View Apartments',
        address: '101 Downtown, Dubai',
        total_floors: 12,
        total_rooms: 48,
        description: 'City center luxury apartments',
        status: 'active'
    },
    {
        name: 'Green Park Building',
        address: '202 Green Park, Dubai',
        total_floors: 6,
        total_rooms: 24,
        description: 'Eco-friendly building with garden',
        status: 'active'
    }
];

async function seedMockBuildings() {
    try {
        console.log('Starting to seed mock buildings...');
        
        // First, list existing buildings to avoid duplicates
        let existingBuildings = [];
        try {
            const response = await databases.listDocuments(DATABASE_ID, BUILDINGS_COLLECTION_ID, []);
            existingBuildings = response.documents;
            console.log(`Found ${existingBuildings.length} existing buildings.`);
        } catch (error) {
            console.log('Could not list existing buildings, assuming empty:', error.message);
        }

        // Determine which mock buildings to insert (by checking if they already exist based on name)
        const buildingsToInsert = [];
        for (const mock of mockBuildings) {
            const exists = existingBuildings.some(b => b.name === mock.name);
            if (!exists) {
                buildingsToInsert.push(mock);
            } else {
                console.log(`Building "${mock.name}" already exists, skipping.`);
            }
        }

        if (buildingsToInsert.length === 0) {
            console.log('All mock buildings already exist. No new buildings inserted.');
            return;
        }

        console.log(`Inserting ${buildingsToInsert.length} new buildings...`);
        
        // Insert each building
        for (const building of buildingsToInsert) {
            try {
                await databases.createDocument(
                    DATABASE_ID,
                    BUILDINGS_COLLECTION_ID,
                    ID.unique(),
                    building
                );
                console.log(`Inserted building: ${building.name}`);
            } catch (error) {
                console.error(`Failed to insert building "${building.name}":`, error.message);
            }
        }

        console.log('Mock buildings seeding completed successfully.');
    } catch (error) {
        console.error('Error during mock buildings seeding:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    seedMockBuildings();
}

module.exports = { seedMockBuildings };