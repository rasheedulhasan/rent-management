/**
 * Calculated Pending Rent Routes
 *
 * GET /api/rent/pending - Get pending rent as a calculated balance.
 *
 * Business Logic:
 *   - Fetches all Active tenants
 *   - Calculates months elapsed from check_in_date to today
 *   - total_due = months_elapsed * monthly_rent
 *   - total_paid = sum of all rent_transactions.amount for that tenant
 *   - pending_balance = total_due - total_paid
 *   - Only includes tenants where pending_balance > 0
 *
 * Output Format:
 *   {
 *     tenant_id, full_name, room_id,
 *     total_due, total_paid, pending_balance
 *   }
 *
 * Filters:
 *   ?room_id=abc123       - Filter by room ID
 *   ?tenant_name=Ahmed    - Search by tenant name (partial match)
 *   ?page=1               - Page number (default: 1)
 *   ?limit=20             - Items per page (default: 20, max: 100)
 */
const express = require('express');
const router = express.Router();
const moveInDateRentService = require('../services/MoveInDateRentService');
const validationMiddleware = require('../middleware/validationMiddleware');

/**
 * GET /api/rent/pending
 *
 * Get pending rent as a calculated cumulative balance.
 * Dynamic calculation only - no database writes.
 */
router.get(
    '/pending',
    // Validate pagination parameters
    validationMiddleware.validatePagination,
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
                room_id,
                tenant_name,
                page,
                limit
            } = req.query;

            const result = await moveInDateRentService.getPendingRents({
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
            console.error('Error in GET /api/rent/pending (calculated balance):', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch pending rent data'
            });
        }
    }
);

module.exports = router;
