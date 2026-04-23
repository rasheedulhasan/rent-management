const express = require('express');
const router = express.Router();
const tenantService = require('../services/TenantService');

// Get all tenants
router.get('/', async (req, res) => {
    try {
        const { status, room_id, limit = 25, offset = 0 } = req.query;
        const queries = [];
        
        if (status) {
            queries.push(`equal("status", "${status}")`);
        }
        
        if (room_id) {
            queries.push(`equal("room_id", "${room_id}")`);
        }
        
        const result = await tenantService.list(queries, parseInt(limit), parseInt(offset));
        
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
            error: 'Failed to fetch tenants'
        });
    }
});

// Get tenant by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await tenantService.getById(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Tenant not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tenant'
        });
    }
});

// Create new tenant
router.post('/', async (req, res) => {
    try {
        const tenantData = req.body;
        const result = await tenantService.createTenant(tenantData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Tenant created successfully'
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
            error: 'Failed to create tenant'
        });
    }
});

// Update tenant
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tenantData = req.body;
        const result = await tenantService.updateTenant(id, tenantData);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Tenant updated successfully'
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
            error: 'Failed to update tenant'
        });
    }
});

// Delete tenant
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await tenantService.delete(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Tenant deleted successfully'
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
            error: 'Failed to delete tenant'
        });
    }
});

// Get tenants by room
router.get('/room/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { status } = req.query;
        const result = await tenantService.getTenantsByRoom(roomId, status);
        
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
            error: 'Failed to fetch tenants'
        });
    }
});

// Update tenant status
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
        
        const result = await tenantService.updateTenantStatus(id, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Tenant status updated successfully'
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
            error: 'Failed to update tenant status'
        });
    }
});

// Get tenant with transaction history
router.get('/:id/with-transactions', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await tenantService.getTenantWithTransactions(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Tenant not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tenant details'
        });
    }
});

// Search tenants
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const result = await tenantService.searchTenants(query);
        
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
            error: 'Failed to search tenants'
        });
    }
});

// Get active tenants count
router.get('/stats/active-count', async (req, res) => {
    try {
        const result = await tenantService.getActiveTenantsCount();
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: { active_tenants: result.count }
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
            error: 'Failed to get tenant stats'
        });
    }
});

module.exports = router;