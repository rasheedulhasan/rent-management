/**
 * ============================================
 * Rent Collection Controller
 * ============================================
 * 
 * Express request handler for rent collection.
 * Thin layer — delegates all logic to the service.
 * ============================================
 */

const RentCollectionService = require('./rentCollectionService');

const rentCollectionController = {
    /**
     * POST /api/rent/collect
     * 
     * Collect rent payment from a tenant.
     * Supports full, partial, and pending payments.
     */
    async collectRent(req, res, next) {
        try {
            const result = await RentCollectionService.collectRent(req.body);

            return res.status(result.statusCode || 200).json({
                success: result.success,
                message: result.message,
                data: result.data || undefined,
                details: result.details || undefined
            });
        } catch (error) {
            console.error('[RentCollectionController] Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
};

module.exports = rentCollectionController;
