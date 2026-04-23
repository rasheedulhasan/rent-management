const express = require('express');
const router = express.Router();
const { Query } = require('../config/appwrite');
const transactionService = require('../services/RentTransactionService');
const buildingService = require('../services/BuildingService');
const roomService = require('../services/RoomService');
const tenantService = require('../services/TenantService');
const userService = require('../services/UserService');

// Get overall dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Get transaction stats
        const transactionStats = await transactionService.getDashboardStats(start_date, end_date);
        
        // Get building count
        const buildingsResult = await buildingService.list([Query.equal('status', 'active')]);
        const buildingCount = buildingsResult.success ? buildingsResult.data.total : 0;
        
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
        
        // Get tenant stats
        const tenantsResult = await tenantService.getActiveTenantsCount();
        const activeTenants = tenantsResult.success ? tenantsResult.count : 0;
        
        // Get collector count
        const collectorsResult = await userService.getCollectors();
        const collectorCount = collectorsResult.success ? collectorsResult.data.total : 0;
        
        if (transactionStats.success) {
            res.status(200).json({
                success: true,
                data: {
                    financial: transactionStats.data,
                    properties: {
                        total_buildings: buildingCount,
                        total_rooms: roomsResult.success ? roomsResult.data.total : 0,
                        vacant_rooms: vacantRooms,
                        occupied_rooms: occupiedRooms,
                        occupancy_rate: roomsResult.success && roomsResult.data.total > 0 ? 
                            (occupiedRooms / roomsResult.data.total * 100).toFixed(2) : 0
                    },
                    tenants: {
                        active_tenants: activeTenants
                    },
                    staff: {
                        total_collectors: collectorCount
                    }
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: transactionStats.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard stats'
        });
    }
});

// Get financial overview
router.get('/financial', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();
        
        // Get monthly revenue
        const monthlyRevenue = await transactionService.getMonthlyRevenue(parseInt(currentYear));
        
        // Get transaction stats
        const transactionStats = await transactionService.getDashboardStats();
        
        if (monthlyRevenue.success && transactionStats.success) {
            res.status(200).json({
                success: true,
                data: {
                    monthly_revenue: monthlyRevenue.data,
                    overview: transactionStats.data,
                    year: currentYear
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to fetch financial data'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch financial overview'
        });
    }
});

// Get property overview
router.get('/properties', async (req, res) => {
    try {
        // Get active buildings
        const buildingsResult = await buildingService.getBuildingsByStatus('active');
        
        // Get room status distribution
        const roomsResult = await roomService.list();
        
        let roomStatusCount = {
            vacant: 0,
            occupied: 0,
            under_maintenance: 0
        };
        
        let buildingRoomStats = [];
        
        if (roomsResult.success) {
            roomsResult.data.documents.forEach(room => {
                if (roomStatusCount[room.status] !== undefined) {
                    roomStatusCount[room.status]++;
                }
            });
        }
        
        if (buildingsResult.success) {
            // For each building, get room count
            const buildingPromises = buildingsResult.data.documents.map(async (building) => {
                const rooms = await roomService.getRoomsByBuilding(building.$id);
                const roomCount = rooms.success ? rooms.data.total : 0;
                
                return {
                    building_id: building.$id,
                    building_name: building.name,
                    total_rooms: roomCount,
                    address: building.address
                };
            });
            
            buildingRoomStats = await Promise.all(buildingPromises);
        }
        
        res.status(200).json({
            success: true,
            data: {
                total_buildings: buildingsResult.success ? buildingsResult.data.total : 0,
                total_rooms: roomsResult.success ? roomsResult.data.total : 0,
                room_status_distribution: roomStatusCount,
                building_details: buildingRoomStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch property overview'
        });
    }
});

// Get tenant overview
router.get('/tenants', async (req, res) => {
    try {
        // Get tenants by status
        const activeTenants = await tenantService.getTenantsByStatus('active');
        const inactiveTenants = await tenantService.getTenantsByStatus('inactive');
        const movedOutTenants = await tenantService.getTenantsByStatus('moved_out');
        
        // Get recent tenants (last 30 days)
        const allTenants = await tenantService.list([], 50, 0, '$createdAt', 'DESC');
        
        let recentTenants = [];
        if (allTenants.success) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            recentTenants = allTenants.data.documents.filter(tenant => {
                const createdDate = new Date(tenant.$createdAt);
                return createdDate >= thirtyDaysAgo;
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                status_counts: {
                    active: activeTenants.success ? activeTenants.data.total : 0,
                    inactive: inactiveTenants.success ? inactiveTenants.data.total : 0,
                    moved_out: movedOutTenants.success ? movedOutTenants.data.total : 0
                },
                total_tenants: (activeTenants.success ? activeTenants.data.total : 0) +
                              (inactiveTenants.success ? inactiveTenants.data.total : 0) +
                              (movedOutTenants.success ? movedOutTenants.data.total : 0),
                recent_tenants: recentTenants.length,
                recent_tenants_list: recentTenants.slice(0, 10) // Top 10 recent tenants
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tenant overview'
        });
    }
});

// Get collection performance
router.get('/collection-performance', async (req, res) => {
    try {
        const { year, month } = req.query;
        const currentYear = year || new Date().getFullYear();
        const currentMonth = month || new Date().getMonth() + 1;
        
        // Get transactions for current period
        const currentPeriodTransactions = await transactionService.getTransactionsByPeriod(
            currentYear,
            currentMonth
        );
        
        // Get collector performance
        const collectorsResult = await userService.getCollectors();
        
        let collectorPerformance = [];
        
        if (collectorsResult.success && currentPeriodTransactions.success) {
            const transactions = currentPeriodTransactions.data.documents;
            
            // Group transactions by collector
            const collectorMap = {};
            
            transactions.forEach(transaction => {
                const collectorId = transaction.collected_by;
                if (!collectorMap[collectorId]) {
                    collectorMap[collectorId] = {
                        total_amount: 0,
                        transaction_count: 0,
                        paid_count: 0
                    };
                }
                
                collectorMap[collectorId].total_amount += transaction.amount;
                collectorMap[collectorId].transaction_count++;
                
                if (transaction.payment_status === 'paid') {
                    collectorMap[collectorId].paid_count++;
                }
            });
            
            // Get collector details
            for (const collectorId in collectorMap) {
                const collectorResult = await userService.getById(collectorId);
                if (collectorResult.success) {
                    collectorPerformance.push({
                        collector_id: collectorId,
                        collector_name: collectorResult.data.full_name,
                        ...collectorMap[collectorId],
                        success_rate: collectorMap[collectorId].transaction_count > 0 ?
                            (collectorMap[collectorId].paid_count / collectorMap[collectorId].transaction_count * 100).toFixed(2) : 0
                    });
                }
            }
        }
        
        res.status(200).json({
            success: true,
            data: {
                period: {
                    year: currentYear,
                    month: currentMonth
                },
                collector_performance: collectorPerformance,
                total_collectors: collectorsResult.success ? collectorsResult.data.total : 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch collection performance'
        });
    }
});

module.exports = router;