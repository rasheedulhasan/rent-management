const BaseService = require('./BaseService');
const { BUILDINGS_COLLECTION_ID, Query } = require('../config/appwrite');

class BuildingService extends BaseService {
    constructor() {
        super(BUILDINGS_COLLECTION_ID);
    }

    async createBuilding(buildingData) {
        // Provide defaults for missing required fields
        const data = {
            name: buildingData.name || '',
            address: buildingData.address || 'Not specified',
            total_floors: buildingData.total_floors ? parseInt(buildingData.total_floors) : 1,
            total_rooms: buildingData.total_rooms ? parseInt(buildingData.total_rooms) : 0,
            description: buildingData.description || '',
            status: buildingData.status || 'active'
        };

        // Ensure name is provided (minimum requirement)
        if (!data.name.trim()) {
            return { success: false, error: 'Building name is required' };
        }

        return await this.create(data);
    }

    async updateBuilding(buildingId, buildingData) {
        const updateData = {
            ...buildingData,
            updatedAt: new Date().toISOString()
        };

        if (buildingData.total_floors) {
            updateData.total_floors = parseInt(buildingData.total_floors);
        }
        if (buildingData.total_rooms) {
            updateData.total_rooms = parseInt(buildingData.total_rooms);
        }

        return await this.update(buildingId, updateData);
    }

    async getBuildingsByStatus(status = 'active') {
        return await this.list([Query.equal('status', status)]);
    }

    async getBuildingWithStats(buildingId) {
        const buildingResult = await this.getById(buildingId);
        if (!buildingResult.success) {
            return buildingResult;
        }

        // In a real implementation, you would fetch room statistics
        // For now, return building data with placeholder stats
        const building = buildingResult.data;
        return {
            success: true,
            data: {
                ...building,
                stats: {
                    total_rooms: building.total_rooms,
                    occupied_rooms: 0, // Would be calculated from rooms
                    vacant_rooms: 0,
                    monthly_revenue: 0
                }
            }
        };
    }
}

module.exports = new BuildingService();