const express = require('express');
const router = express.Router();
const roomService = require('../services/RoomService');
const { Query } = require('../config/appwrite');

// ============================================================
// MOBILE-FRIENDLY POPULATED ENDPOINTS (with building + tenant)
// MUST be defined BEFORE /:id routes to avoid route conflicts
// ============================================================

// GET /api/rooms/populated - Get all rooms with building name + current tenant
router.get('/populated', async (req, res) => {
    try {
        const { building_id, status, floor, limit = 25, offset = 0 } = req.query;
        const queries = [];
        
        if (building_id) {
            queries.push(Query.equal('building_id', building_id));
        }
        
        if (status) {
            queries.push(Query.equal('status', status));
        }
        
        if (floor) {
            queries.push(Query.equal('floor', parseInt(floor)));
        }
        
        const result = await roomService.getAllRoomsPopulated(
            queries,
            parseInt(limit),
            parseInt(offset)
        );
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error fetching populated rooms:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rooms'
        });
    }
});

// GET /api/rooms/building/:buildingId/populated - Rooms by building with populated data
router.get('/building/:buildingId/populated', async (req, res) => {
    try {
        const { buildingId } = req.params;
        const { status } = req.query;
        const result = await roomService.getRoomsByBuildingPopulated(buildingId, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error fetching populated rooms by building:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rooms'
        });
    }
});

// GET /api/rooms/search/filter - Search rooms
router.get('/search/filter', async (req, res) => {
    try {
        const { building_id, floor, min_rent, max_rent } = req.query;
        
        const result = await roomService.searchRooms(
            building_id,
            floor ? parseInt(floor) : null,
            min_rent ? parseFloat(min_rent) : null,
            max_rent ? parseFloat(max_rent) : null
        );
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to search rooms'
        });
    }
});

// ============================================================
// STANDARD CRUD ENDPOINTS
// ============================================================

// Get all rooms (raw)
router.get('/', async (req, res) => {
    try {
        const { building_id, status, floor, limit = 25, offset = 0 } = req.query;
        const queries = [];
        
        if (building_id) {
            queries.push(Query.equal('building_id', building_id));
        }
        
        if (status) {
            queries.push(Query.equal('status', status));
        }
        
        if (floor) {
            queries.push(Query.equal('floor', parseInt(floor)));
        }
        
        const result = await roomService.list(queries, parseInt(limit), parseInt(offset));
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rooms'
        });
    }
});

// Get room by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await roomService.getById(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch room'
        });
    }
});

// Create new room
router.post('/', async (req, res) => {
    try {
        const roomData = req.body;
        const result = await roomService.createRoom(roomData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Room created successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create room'
        });
    }
});

// Update room
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const roomData = req.body;
        const result = await roomService.updateRoom(id, roomData);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Room updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update room'
        });
    }
});

// Delete room
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await roomService.delete(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Room deleted successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete room'
        });
    }
});

// Get rooms by building (raw)
router.get('/building/:buildingId', async (req, res) => {
    try {
        const { buildingId } = req.params;
        const { status } = req.query;
        const result = await roomService.getRoomsByBuilding(buildingId, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rooms'
        });
    }
});

// Update room status
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required'
            });
        }
        
        const result = await roomService.updateRoomStatus(id, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Room status updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update room status'
        });
    }
});

// Get room with tenant info (populated single room)
router.get('/:id/with-tenant', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await roomService.getRoomWithTenant(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Room not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch room details'
        });
    }
});

module.exports = router;