/**
 * ============================================
 * Rent Ledger Cycle Routes
 * ============================================
 *
 * POST /api/rent-ledger/cycle/run   - Run the monthly cycle job manually
 * GET  /api/rent-ledger/cycle/status - Check cycle status for a given period
 *
 * These endpoints allow manual triggering of the monthly cycle job
 * (creating pending ledger entries and closing previous month).
 * In production, this should be triggered by a cron job (e.g., node-cron)
 * on the 1st of each month.
 * ============================================
 */

const express = require('express');
const router = express.Router();
const RentLedgerCycleService = require('../services/RentLedgerCycleService');

/**
 * POST /api/rent-ledger/cycle/run
 *
 * Run the monthly cycle job manually.
 * Creates pending ledger entries for all active tenants for the specified month/year.
 * Also closes the previous month's pending entries (marks as overdue).
 *
 * Body (optional):
 *   { "month": 5, "year": 2026 }  — defaults to current month/year
 */
router.post('/cycle/run', async (req, res) => {
    try {
        const { month, year } = req.body || {};

        const result = await RentLedgerCycleService.runMonthlyCycle(
            month ? parseInt(month) : null,
            year ? parseInt(year) : null
        );

        if (result.success) {
            res.status(200).json({
                success: true,
                message: `Monthly cycle completed. Created ${result.data.created} entries, closed ${result.data.closed} overdue records.`,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in POST /api/rent-ledger/cycle/run:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run monthly cycle'
        });
    }
});

/**
 * GET /api/rent-ledger/cycle/status
 *
 * Check the status of the rent ledger for a given period.
 * Returns counts of pending, overdue, and paid entries.
 *
 * Query params:
 *   month (optional) - defaults to current month
 *   year  (optional) - defaults to current year
 */
router.get('/cycle/status', async (req, res) => {
    try {
        const { Query, databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID } = require('../config/appwrite');

        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : (now.getMonth() + 1);
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

        // Get counts for each status
        const [pendingResult, overdueResult, paidResult, partialResult] = await Promise.all([
            databases.listDocuments(DATABASE_ID, RENT_LEDGER_COLLECTION_ID, [
                Query.equal('period_month', month),
                Query.equal('period_year', year),
                Query.equal('payment_status', 'pending')
            ], 1),
            databases.listDocuments(DATABASE_ID, RENT_LEDGER_COLLECTION_ID, [
                Query.equal('period_month', month),
                Query.equal('period_year', year),
                Query.equal('payment_status', 'overdue')
            ], 1),
            databases.listDocuments(DATABASE_ID, RENT_LEDGER_COLLECTION_ID, [
                Query.equal('period_month', month),
                Query.equal('period_year', year),
                Query.equal('payment_status', 'paid')
            ], 1),
            databases.listDocuments(DATABASE_ID, RENT_LEDGER_COLLECTION_ID, [
                Query.equal('period_month', month),
                Query.equal('period_year', year),
                Query.equal('payment_status', 'partial')
            ], 1)
        ]);

        res.status(200).json({
            success: true,
            data: {
                month,
                year,
                pending: pendingResult.total || 0,
                overdue: overdueResult.total || 0,
                paid: paidResult.total || 0,
                partial: partialResult.total || 0,
                total: (pendingResult.total || 0) + (overdueResult.total || 0) +
                       (paidResult.total || 0) + (partialResult.total || 0)
            }
        });
    } catch (error) {
        console.error('Error in GET /api/rent-ledger/cycle/status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cycle status'
        });
    }
});

module.exports = router;
