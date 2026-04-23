const BaseService = require('./BaseService');
const { ROOMS_COLLECTION_ID, Query } = require('../config/appwrite');

class RoomService extends BaseService {
    constructor() {
        super(ROOMS_COLLECTION_ID);
    }

    async createRoom(roomData) {
        const requiredFields = ['building_id', 'room_number', 'floor', 'monthly_rent'];
        for (const field of requiredFields) {
            if (!roomData[field]) {
                return { success: false, error: `Missing required field: ${field}` };
            }
        }

        const data = {
            building_id: roomData.building_id,
            room_number: roomData.room_number,
            floor: parseInt(roomData.floor),
            type: roomData.type || 'apartment',
            monthly_rent: parseFloat(roomData.monthly_rent),
            size: roomData.size || '',
            amenities: roomData.amenities || '',
            status: roomData.status || 'vacant'
        };

        return await this.create(data);
    }

    async updateRoom(roomId, roomData) {
        const updateData = {
            ...roomData
        };

        if (roomData.floor) {
            updateData.floor = parseInt(roomData.floor);
        }
        if (roomData.monthly_rent) {
            updateData.monthly_rent = parseFloat(roomData.monthly_rent);
        }

        return await this.update(roomId, updateData);
    }

    async getRoomsByBuilding(buildingId, status = null) {
        const queries = [Query.equal('building_id', buildingId)];
        if (status) {
            queries.push(Query.equal('status', status));
        }
        return await this.list(queries);
    }

    async getRoomsByStatus(status = 'vacant') {
        return await this.list([Query.equal('status', status)]);
    }

    async updateRoomStatus(roomId, status) {
        const validStatuses = ['vacant', 'occupied', 'under_maintenance'];
        if (!validStatuses.includes(status)) {
            return { success: false, error: 'Invalid status value' };
        }

        return await this.update(roomId, {
            status,
            updatedAt: new Date().toISOString()
        });
    }

    async getRoomWithTenant(roomId) {
        const roomResult = await this.getById(roomId);
        if (!roomResult.success) {
            return roomResult;
        }

        // In a real implementation, you would fetch tenant data
        // For now, return room data with placeholder tenant info
        const room = roomResult.data;
        return {
            success: true,
            data: {
                ...room,
                current_tenant: null // Would be populated from tenant service
            }
        };
    }

    async searchRooms(buildingId = null, floor = null, minRent = null, maxRent = null) {
        const queries = [];
        
        if (buildingId) {
            queries.push(Query.equal('building_id', buildingId));
        }
        
        if (floor) {
            queries.push(Query.equal('floor', parseInt(floor)));
        }
        
        if (minRent) {
            queries.push(Query.greaterThanEqual('monthly_rent', parseFloat(minRent)));
        }
        
        if (maxRent) {
            queries.push(Query.lessThanEqual('monthly_rent', parseFloat(maxRent)));
        }

        return await this.list(queries);
    }
}

module.exports = new RoomService();