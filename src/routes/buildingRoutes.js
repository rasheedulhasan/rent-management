const express = require('express');
const router = express.Router();
const buildingService = require('../services/BuildingService');

// Get all buildings
router.get('/', async (req, res) => {
    try {
        const { status, limit = 25, offset = 0 } = req.query;
        const queries = [];
        
        if (status) {
            queries.push(`equal("status", "${status}")`);
        }
        
        const result = await buildingService.list(queries, parseInt(limit), parseInt(offset));
        
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
            error: 'Failed to fetch buildings'
        });
    }
});

// Get building by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await buildingService.getById(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Building not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch building'
        });
    }
});

// Create new building
router.post('/', async (req, res) => {
    try {
        const buildingData = req.body;
        const result = await buildingService.createBuilding(buildingData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Building created successfully'
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
            error: 'Failed to create building'
        });
    }
});

// Update building
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const buildingData = req.body;
        const result = await buildingService.updateBuilding(id, buildingData);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Building updated successfully'
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
            error: 'Failed to update building'
        });
    }
});

// Delete building
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await buildingService.delete(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Building deleted successfully'
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
            error: 'Failed to delete building'
        });
    }
});

// Get building with stats
router.get('/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await buildingService.getBuildingWithStats(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Building not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch building stats'
        });
    }
});

// Search buildings
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const result = await buildingService.search(query, 'name');
        
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
            error: 'Failed to search buildings'
        });
    }
});

module.exports = router;