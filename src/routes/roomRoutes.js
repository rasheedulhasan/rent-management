const express = require('express');
const router = express.Router();
const roomService = require('../services/RoomService');

// Get all rooms
router.get('/', async (req, res) => {
    try {
        const { building_id, status, floor, limit = 25, offset = 0 } = req.query;
        const queries = [];
        
        if (building_id) {
            queries.push(`equal("building_id", "${building_id}")`);
        }
        
        if (status) {
            queries.push(`equal("status", "${status}")`);
        }
        
        if (floor) {
            queries.push(`equal("floor", ${floor})`);
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

// Get rooms by building
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

// Get room with tenant info
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

// Search rooms
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

module.exports = router;