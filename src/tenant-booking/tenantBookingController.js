/**
 * ============================================
 * Tenant Booking Controller
 * ============================================
 * 
 * Express request handler for tenant booking.
 * Thin layer — delegates all logic to the service.
 * ============================================
 */

const TenantBookingService = require('./tenantBookingService');

const tenantBookingController = {
    /**
     * POST /api/tenants/booking
     * 
     * Add a new tenant booking with room assignment.
     */
    async bookTenant(req, res, next) {
        try {
            const result = await TenantBookingService.bookTenant(req.body);

            return res.status(result.statusCode || 201).json({
                success: result.success,
                message: result.message,
                data: result.data || undefined,
                details: result.details || undefined
            });
        } catch (error) {
            console.error('[TenantBookingController] Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
};

module.exports = tenantBookingController;
