/**
 * ============================================
 * Rent Ledger Controller
 * ============================================
 *
 * Express request handler for rent ledger entries.
 * Thin layer — delegates all logic to the service.
 * ============================================
 */

const RentLedgerService = require('./rentLedgerService');

const rentLedgerController = {
    /**
     * POST /api/rent-ledger/record
     *
     * Record a rent payment in the ledger.
     * Simplified endpoint for quick payment recording.
     */
    async recordPayment(req, res, next) {
        try {
            const result = await RentLedgerService.recordPayment(req.body);

            return res.status(result.statusCode || 201).json({
                success: result.success,
                message: result.message,
                data: result.data || undefined,
                details: result.details || undefined
            });
        } catch (error) {
            console.error('[RentLedgerController] Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
};

module.exports = rentLedgerController;
