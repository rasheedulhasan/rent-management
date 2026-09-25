const express = require('express');
const router = express.Router();
const tenantService = require('../services/TenantService');
const tenantCsvService = require('../services/TenantCsvService');
const depositService = require('../services/DepositService');

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

// ============================================================
// CSV TEMPLATE + IMPORT (defined before /:id routes)
// ============================================================

// GET /api/tenants/csv/template - Download the tenant import template
router.get('/csv/template', (req, res) => {
    try {
        const csv = tenantCsvService.getTemplate();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="tenants-template.csv"');
        res.status(200).send(csv);
    } catch (error) {
        console.error('Error generating tenants CSV template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate template'
        });
    }
});

// GET /api/tenants/csv/export - Export all tenants as CSV
router.get('/csv/export', async (req, res) => {
    try {
        const csv = await tenantCsvService.exportCsv();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="tenants.csv"');
        res.status(200).send(csv);
    } catch (error) {
        console.error('Error exporting tenants CSV:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export tenants'
        });
    }
});

// POST /api/tenants/csv/import - Bulk import/update tenants from CSV
// Body: { "csv": "<csv text>" }
router.post('/csv/import', async (req, res) => {
    try {
        const { csv } = req.body || {};
        const result = await tenantCsvService.importCsv(csv);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: `Imported ${result.data.inserted} new, updated ${result.data.updated}, failed ${result.data.failed}.`,
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error importing tenants CSV:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import CSV'
        });
    }
});

// ============================================================
// SECURITY DEPOSIT LEDGER + MOVE-OUT SETTLEMENT
// ============================================================

// GET /api/tenants/:id/deposit - deposit statement (received/adjusted/refunded/remaining)
router.get('/:id/deposit', async (req, res) => {
    try {
        const data = await depositService.getStatement(req.params.id, parseInt(req.query.limit) || 100);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
});

// POST /api/tenants/:id/deposit - record deposit received
router.post('/:id/deposit', async (req, res) => {
    try {
        const data = await depositService.recordReceived(req.params.id, req.body || {});
        res.status(201).json({ success: true, message: 'Security deposit recorded.', data });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
});

// POST /api/tenants/:id/deposit/adjust - apply deposit against outstanding rent
router.post('/:id/deposit/adjust', async (req, res) => {
    try {
        const data = await depositService.applyToRent(req.params.id, req.body || {});
        res.status(200).json({ success: true, message: 'Security deposit applied to rent.', data });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
});

// POST /api/tenants/:id/deposit/refund - refund the remaining deposit
router.post('/:id/deposit/refund', async (req, res) => {
    try {
        const data = await depositService.refund(req.params.id, req.body || {});
        res.status(200).json({ success: true, message: 'Security deposit refunded.', data });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
});

// GET /api/tenants/:id/move-out/settlement - preview the final settlement
router.get('/:id/move-out/settlement', async (req, res) => {
    try {
        const data = await depositService.previewSettlement(req.params.id, req.query || {});
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
});

// POST /api/tenants/:id/move-out/settlement - execute the settlement (+ move out)
router.post('/:id/move-out/settlement', async (req, res) => {
    try {
        const data = await depositService.settleAndMoveOut(req.params.id, req.body || {});
        res.status(200).json({ success: true, message: 'Move-out settled.', data });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
});

// ============================================================
// BULK EDIT (mobile multi-select)
//   POST|PATCH /api/tenants/bulk-update
//   Body: { "tenants": [ { "id", "full_name?", "phone_number?",
//                          "monthly_rent?", "billing_day?", "rent_due_date?" } ] }
//   (a bare array body is also accepted)
// All-or-nothing: if any row is invalid nothing is updated.
// ============================================================

const bulkUpdateTenantsHandler = async (req, res) => {
    try {
        const payload = Array.isArray(req.body)
            ? req.body
            : (req.body && (req.body.tenants || req.body.updates)) || [];

        const result = await tenantService.bulkUpdateTenants(payload);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: `Updated ${result.data.updated} tenant(s).`,
                data: result.data
            });
        } else {
            res.status(result.statusCode || 400).json({
                success: false,
                error: result.error,
                errors: result.errors
            });
        }
    } catch (error) {
        console.error('Error in POST /api/tenants/bulk-update:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to bulk update tenants'
        });
    }
};

router.post('/bulk-update', bulkUpdateTenantsHandler);
router.patch('/bulk-update', bulkUpdateTenantsHandler);

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

/**
 * GET /api/tenants/:id/details
 * 
 * Fetch a single tenant's full enriched details for the Tenant Detail View.
 * Returns tenant profile, room info, building name, lease summary,
 * financial health (outstanding balance), and recent rent ledger history.
 * 
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     tenant: { ...core tenant fields },
 *     room: { room_number, floor, type } | null,
 *     building: { name } | null,
 *     lease: { start_date, end_date, days_remaining, monthly_rent, security_deposit },
 *     financial: { outstanding_balance, total_pending, total_overdue, next_payment_due_date },
 *     recent_transactions: [{ ...last 5 ledger entries }],
 *     status_badge: 'active' | 'overdue' | 'moving_out'
 *   }
 * }
 */
router.get('/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        
        // TODO: Add cross-tenant ownership validation here.
        // In a multi-tenant system, verify that the requesting user/landlord
        // has access to this tenant. For example:
        //   const userId = req.user.id;
        //   const tenant = await tenantService.getById(id);
        //   if (!tenant.success || tenant.data.landlord_id !== userId) {
        //     return res.status(403).json({ success: false, error: 'Forbidden' });
        //   }
        
        const result = await tenantService.getTenantDetails(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(result.statusCode || 404).json({
                success: false,
                error: result.error || 'Tenant not found'
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