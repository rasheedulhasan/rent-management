/**
 * Report Routes
 * 
 * GET /api/reports/summary - Get summary report data for dashboard
 * GET /api/reports/monthly - Get monthly collection report
 */

const express = require('express');
const router = express.Router();
const transactionService = require('../services/RentTransactionService');
const tenantService = require('../services/TenantService');
const roomService = require('../services/RoomService');
const buildingService = require('../services/BuildingService');

/**
 * GET /api/reports/summary
 * 
 * Get a comprehensive summary report including:
 * - Total revenue (collected)
 * - Total pending amount
 * - Collection rate
 * - Active tenant count
 * - Occupied/vacant room counts
 * - Monthly collection breakdown
 */
router.get('/summary', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();

        // Get transaction dashboard stats
        const transactionStats = await transactionService.getDashboardStats();

        // Get monthly revenue for the year
        const monthlyRevenue = await transactionService.getMonthlyRevenue(currentYear);

        // Get active tenant count
        const tenantsResult = await tenantService.getActiveTenantsCount();
        const activeTenants = tenantsResult.success ? tenantsResult.count : 0;

        // Get room stats
        const roomsResult = await roomService.list();
        let vacantRooms = 0;
        let occupiedRooms = 0;

        if (roomsResult.success) {
            roomsResult.data.documents.forEach(room => {
                if (room.status === 'vacant') vacantRooms++;
                if (room.status === 'occupied') occupiedRooms++;
            });
        }

        // Get building count
        const buildingsResult = await buildingService.list([], 100);
        const totalBuildings = buildingsResult.success ? buildingsResult.data.total : 0;

        if (transactionStats.success && monthlyRevenue.success) {
            // Format monthly collection as array
            const monthlyCollection = [];
            for (let month = 1; month <= 12; month++) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                monthlyCollection.push({
                    month: monthNames[month - 1],
                    month_num: month,
                    amount: monthlyRevenue.data[month] || 0
                });
            }

            res.status(200).json({
                success: true,
                data: {
                    financial: {
                        total_revenue: transactionStats.data.total_revenue,
                        pending_amount: transactionStats.data.pending_amount,
                        total_transactions: transactionStats.data.total_transactions,
                        collection_rate: transactionStats.data.collection_rate,
                        paid_count: transactionStats.data.paid_count,
                        pending_count: transactionStats.data.pending_count,
                        partial_count: transactionStats.data.partial_count
                    },
                    properties: {
                        total_buildings: totalBuildings,
                        total_rooms: roomsResult.success ? roomsResult.data.total : 0,
                        vacant_rooms: vacantRooms,
                        occupied_rooms: occupiedRooms,
                        occupancy_rate: roomsResult.success && roomsResult.data.total > 0
                            ? ((occupiedRooms / roomsResult.data.total) * 100).toFixed(2)
                            : 0
                    },
                    tenants: {
                        active_tenants: activeTenants
                    },
                    monthly_collection: monthlyCollection,
                    year: currentYear
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to generate report summary'
            });
        }
    } catch (error) {
        console.error('Error in GET /api/reports/summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch report summary'
        });
    }
});

/**
 * GET /api/reports/monthly
 * 
 * Get a detailed monthly report for a specific month/year.
 */
router.get('/monthly', async (req, res) => {
    try {
        const { year, month } = req.query;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;

        // Get transactions for the period
        const periodTransactions = await transactionService.getTransactionsByPeriod(
            currentYear,
            currentMonth
        );

        if (periodTransactions.success) {
            const transactions = periodTransactions.data.documents;

            // Calculate totals
            let totalCollected = 0;
            let totalPending = 0;
            let paidCount = 0;
            let pendingCount = 0;

            transactions.forEach(txn => {
                if (txn.payment_status === 'paid') {
                    totalCollected += txn.amount;
                    paidCount++;
                } else if (txn.payment_status === 'pending') {
                    totalPending += txn.monthly_rent;
                    pendingCount++;
                } else if (txn.payment_status === 'partial') {
                    totalCollected += txn.amount;
                    totalPending += (txn.monthly_rent - txn.amount);
                }
            });

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            res.status(200).json({
                success: true,
                data: {
                    period: {
                        year: currentYear,
                        month: currentMonth,
                        month_name: monthNames[currentMonth - 1]
                    },
                    summary: {
                        total_transactions: transactions.length,
                        total_collected: totalCollected,
                        total_pending: totalPending,
                        paid_count: paidCount,
                        pending_count: pendingCount,
                        collection_rate: transactions.length > 0
                            ? ((paidCount / transactions.length) * 100).toFixed(2)
                            : 0
                    },
                    transactions: transactions.map(txn => ({
                        id: txn.$id,
                        tenant_id: txn.tenant_id,
                        room_id: txn.room_id,
                        amount: txn.amount,
                        monthly_rent: txn.monthly_rent,
                        payment_status: txn.payment_status,
                        payment_method: txn.payment_method,
                        transaction_date: txn.transaction_date,
                        rent_due_date: txn.rent_due_date,
                        collected_by: txn.collected_by
                    }))
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to fetch monthly report'
            });
        }
    } catch (error) {
        console.error('Error in GET /api/reports/monthly:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monthly report'
        });
    }
});

module.exports = router;
