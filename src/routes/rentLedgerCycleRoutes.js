/**
 * ============================================
 * Rent Ledger Cycle Routes
 * ============================================
 *
 * POST /api/rent-ledger/cycle/generate - Generate monthly ledger entries (legacy, no carry-forward)
 * POST /api/rent-ledger/cycle/run      - Run the monthly rollover (carry-forward)
 * POST /api/rent-ledger/cycle/rollover - Run the monthly rollover (carry-forward) — alias for /run
 * POST /api/rent-ledger/cycle/catchup  - Catch up missed monthly rollovers
 * GET  /api/rent-ledger/cycle/status   - Check cycle status for a given period
 *
 * In production, the rollover is triggered automatically by src/scheduler.js
 * (node-cron on the 1st of each month). These endpoints allow manual triggering
 * and testing.
 * ============================================
 */

const express = require('express');
const router = express.Router();
const RentLedgerCycleService = require('../services/RentLedgerCycleService');

/**
 * POST /api/rent-ledger/cycle/generate
 *
 * Generate monthly ledger entries for all active tenants (legacy, no carry-forward).
 * Idempotent — checks if entries already exist before creating.
 *
 * Body:
 *   { "month": 5, "year": 2026 }  — required
 */
router.post('/cycle/generate', async (req, res) => {
    try {
        const { month, year } = req.body || {};

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                error: 'month and year are required'
            });
        }

        const result = await RentLedgerCycleService.generateMonthlyCycle(
            parseInt(month),
            parseInt(year)
        );

        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.data.message || `Generated ${result.data.created} ledger entries for ${result.data.month}/${result.data.year}.`,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in POST /api/rent-ledger/cycle/generate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate monthly cycle'
        });
    }
});

/**
 * POST /api/rent-ledger/cycle/run
 *
 * Run the monthly rollover (with carry-forward).
 *
 * Body (optional):
 *   { "month": 5, "year": 2026 }  — defaults to current month/year
 */
router.post('/cycle/run', async (req, res) => {
    try {
        const { month, year } = req.body || {};

        const result = await RentLedgerCycleService.processMonthlyRollover(
            month ? parseInt(month) : null,
            year ? parseInt(year) : null
        );

        if (result.success) {
            res.status(200).json({
                success: true,
                message: `Monthly rollover completed. Created ${result.data.created} entries, rolled over ${result.data.rolled_over}, skipped ${result.data.skipped}.`,
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
 * POST /api/rent-ledger/cycle/rollover
 *
 * Run the monthly rollover (with carry-forward) — explicit endpoint.
 *
 * Body (optional):
 *   { "month": 9, "year": 2026 }  — defaults to current month/year
 */
router.post('/cycle/rollover', async (req, res) => {
    try {
        const { month, year } = req.body || {};

        const result = await RentLedgerCycleService.processMonthlyRollover(
            month ? parseInt(month) : null,
            year ? parseInt(year) : null
        );

        if (result.success) {
            res.status(200).json({
                success: true,
                message: `Rollover completed. Created ${result.data.created} entries, rolled over ${result.data.rolled_over}, skipped ${result.data.skipped}.`,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in POST /api/rent-ledger/cycle/rollover:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run rollover'
        });
    }
});

/**
 * POST /api/rent-ledger/cycle/catchup
 *
 * Catch up any missed monthly rollovers (e.g. server was down on the 1st).
 * Rolls forward month-by-month from the latest ledger period to the current month.
 */
router.post('/cycle/catchup', async (req, res) => {
    try {
        const result = await RentLedgerCycleService.catchUpMissedMonths();

        if (result.success) {
            res.status(200).json({
                success: true,
                message: `Catch-up completed for ${result.data.length} period(s).`,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error in POST /api/rent-ledger/cycle/catchup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run catch-up'
        });
    }
});

/**
 * GET /api/rent-ledger/cycle/status
 *
 * Check the status of the rent ledger for a given period.
 * Returns counts of pending, overdue, paid, partial, and rolled_over entries.
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
        const [pendingResult, overdueResult, paidResult, partialResult, rolledOverResult] = await Promise.all([
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
            ], 1),
            databases.listDocuments(DATABASE_ID, RENT_LEDGER_COLLECTION_ID, [
                Query.equal('period_month', month),
                Query.equal('period_year', year),
                Query.equal('payment_status', 'rolled_over')
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
                rolled_over: rolledOverResult.total || 0,
                total: (pendingResult.total || 0) + (overdueResult.total || 0) +
                       (paidResult.total || 0) + (partialResult.total || 0) +
                       (rolledOverResult.total || 0)
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
