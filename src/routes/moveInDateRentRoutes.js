/**
 * Move-In-Date Based Pending Rent Routes
 * 
 * ISOLATED ROUTES - Does NOT modify existing routes or APIs.
 * All operations are READ-ONLY.
 * 
 * GET /api/rent/pending - Get pending rent data based on move_in_date logic
 * 
 * Business Logic:
 *   - Uses tenant.move_in_date day as monthly due day
 *   - Only active tenants in occupied rooms
 *   - Dynamic calculation only - no database writes
 *   - No auto-creation of transaction records
 * 
 * Status Categories:
 *   - due_today: Today's date matches the monthly due day
 *   - overdue:   Today's date is AFTER the monthly due day
 *   - upcoming:  Today's date is BEFORE the monthly due day
 * 
 * Filters:
 *   ?status=overdue       - Filter by status (due_today, upcoming, overdue)
 *   ?room_id=abc123       - Filter by room ID
 *   ?tenant_name=Ahmed    - Search by tenant name (partial match)
 *   ?page=1               - Page number (default: 1)
 *   ?limit=20             - Items per page (default: 20, max: 100)
 */
const express = require('express');
const router = express.Router();
const moveInDateRentService = require('../services/MoveInDateRentService');
const validationMiddleware = require('../middleware/validationMiddleware');

// Valid status values for this API
const VALID_STATUSES = ['due_today', 'upcoming', 'overdue'];

/**
 * GET /api/rent/pending
 * 
 * Get pending rent collection data based on move-in-date logic.
 * Dynamic calculation only - no database writes.
 */
router.get(
    '/pending',
    // Validate pagination parameters
    validationMiddleware.validatePagination,
    // Validate status filter if provided
    (req, res, next) => {
        const { status } = req.query;
        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}`
            });
        }
        next();
    },
    // Validate room_id if provided
    (req, res, next) => {
        const { room_id } = req.query;
        if (room_id && (typeof room_id !== 'string' || room_id.trim() === '')) {
            return res.status(400).json({
                success: false,
                error: 'room_id must be a non-empty string'
            });
        }
        next();
    },
    // Main handler
    async (req, res) => {
        try {
            const {
                status,
                room_id,
                tenant_name,
                page,
                limit
            } = req.query;

            const result = await moveInDateRentService.getPendingRents({
                status: status || null,
                room_id: room_id || null,
                tenant_name: tenant_name || null,
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20
            });

            if (result.success) {
                res.status(200).json({
                    summary: result.summary,
                    data: result.data,
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    total_pages: result.total_pages
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Error in GET /api/rent/pending (move-in-date):', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch pending rent data'
            });
        }
    }
);

module.exports = router;
