const BaseService = require('./BaseService');
const { ROOMS_COLLECTION_ID, BUILDINGS_COLLECTION_ID, TENANTS_COLLECTION_ID, Query, databases, DATABASE_ID } = require('../config/appwrite');

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

        return await this.update(roomId, { status });
    }

    /**
     * Get room with current tenant info populated
     */
    async getRoomWithTenant(roomId) {
        const roomResult = await this.getById(roomId);
        if (!roomResult.success) {
            return roomResult;
        }

        const room = roomResult.data;
        
        // Fetch current active tenant for this room
        let currentTenant = null;
        try {
            const tenantsResult = await databases.listDocuments(
                DATABASE_ID,
                TENANTS_COLLECTION_ID,
                [
                    Query.equal('room_id', roomId),
                    Query.equal('status', 'active')
                ]
            );
            if (tenantsResult.documents && tenantsResult.documents.length > 0) {
                currentTenant = tenantsResult.documents[0];
            }
        } catch (error) {
            console.error(`Error fetching tenant for room ${roomId}:`, error);
        }

        // Fetch building name
        let buildingName = '';
        try {
            const buildingResult = await databases.getDocument(
                DATABASE_ID,
                BUILDINGS_COLLECTION_ID,
                room.building_id
            );
            buildingName = buildingResult.name || '';
        } catch (error) {
            console.error(`Error fetching building for room ${roomId}:`, error);
        }

        return {
            success: true,
            data: {
                ...room,
                building_name: buildingName,
                current_tenant: currentTenant
            }
        };
    }

    /**
     * Get all rooms with populated building name and current tenant info.
     * This is the primary endpoint for mobile app room listings.
     */
    async getAllRoomsPopulated(queries = [], limit = 25, offset = 0) {
        const listResult = await this.list(queries, limit, offset);
        if (!listResult.success) {
            return listResult;
        }

        const rooms = listResult.data.documents;
        const populatedRooms = await this._populateRooms(rooms);

        return {
            success: true,
            data: {
                documents: populatedRooms,
                total: listResult.data.total
            }
        };
    }

    /**
     * Get rooms by building with populated data
     */
    async getRoomsByBuildingPopulated(buildingId, status = null) {
        const queries = [Query.equal('building_id', buildingId)];
        if (status) {
            queries.push(Query.equal('status', status));
        }
        return await this.getAllRoomsPopulated(queries, 100, 0);
    }

    /**
     * Internal helper: populate building name + current tenant for an array of rooms
     */
    async _populateRooms(rooms) {
        if (!rooms || rooms.length === 0) return [];

        // Collect unique building IDs
        const buildingIds = [...new Set(rooms.map(r => r.building_id))];

        // Fetch all referenced buildings in one batch
        const buildingMap = {};
        try {
            for (const bId of buildingIds) {
                try {
                    const building = await databases.getDocument(
                        DATABASE_ID,
                        BUILDINGS_COLLECTION_ID,
                        bId
                    );
                    buildingMap[bId] = building.name || '';
                } catch (e) {
                    buildingMap[bId] = '';
                }
            }
        } catch (error) {
            console.error('Error fetching buildings for room population:', error);
        }

        // Fetch active tenants for all rooms in one batch
        const roomIds = rooms.map(r => r.$id);
        const tenantMap = {};
        try {
            for (const roomId of roomIds) {
                try {
                    const tenantsResult = await databases.listDocuments(
                        DATABASE_ID,
                        TENANTS_COLLECTION_ID,
                        [
                            Query.equal('room_id', roomId),
                            Query.equal('status', 'active')
                        ]
                    );
                    if (tenantsResult.documents && tenantsResult.documents.length > 0) {
                        tenantMap[roomId] = tenantsResult.documents[0];
                    }
                } catch (e) {
                    // No tenant found for this room
                }
            }
        } catch (error) {
            console.error('Error fetching tenants for room population:', error);
        }

        // Merge data
        return rooms.map(room => ({
            ...room,
            building_name: buildingMap[room.building_id] || '',
            current_tenant: tenantMap[room.$id] || null
        }));
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