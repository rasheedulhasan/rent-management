/**
 * RentCalculationService
 * 
 * ISOLATED SERVICE - Dynamically calculates pending rent at API level.
 * Does NOT create or modify any database records.
 * Does NOT affect existing RentTransactionService or any other service.
 */
const RoomService = require('./RoomService');
const TenantService = require('./TenantService');
const RentTransactionService = require('./RentTransactionService');
const { Query } = require('../config/appwrite');

class RentCalculationService {
    /**
     * Calculate pending rent for a specific tenant for a given period.
     * This is a VIRTUAL calculation - no DB writes.
     * 
     * @param {Object} tenant - Tenant document
     * @param {Object} room - Room document
     * @param {number} month - Month (1-12)
     * @param {number} year - Year (e.g., 2026)
     * @returns {Object} Pending rent info or null if not applicable
     */
    async calculateTenantPendingRent(tenant, room, month, year) {
        // Rule: Only active tenants in occupied rooms
        if (tenant.status !== 'active') return null;
        if (room.status !== 'occupied') return null;

        // Check if a paid transaction exists for this period
        const existingTransactions = await RentTransactionService.list(
            [
                Query.equal('tenant_id', tenant.$id),
                Query.equal('period_month', month),
                Query.equal('period_year', year)
            ],
            10
        );

        if (existingTransactions.success && existingTransactions.data.documents.length > 0) {
            const paidTransaction = existingTransactions.data.documents.find(
                txn => txn.payment_status === 'paid'
            );
            if (paidTransaction) {
                // Already paid for this period - not pending
                return null;
            }
        }

        // Calculate due date (1st of the month)
        const dueDate = new Date(year, month - 1, 1);
        const now = new Date();
        
        // Calculate overdue days
        const diffTime = now.getTime() - dueDate.getTime();
        const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        // Determine payment status
        let paymentStatus = 'pending';
        if (overdueDays > 0) {
            paymentStatus = 'overdue';
        }

        return {
            tenant_id: tenant.$id,
            tenant_name: tenant.full_name,
            room_id: room.$id,
            room_number: room.room_number,
            monthly_rent: room.monthly_rent || tenant.monthly_rent,
            rent_due_date: dueDate.toISOString().split('T')[0],
            pending_amount: room.monthly_rent || tenant.monthly_rent,
            overdue_days: overdueDays,
            payment_status: paymentStatus,
            period_month: month,
            period_year: year
        };
    }

    /**
     * Calculate all pending rents for a given period.
     * Dynamically computes from rooms + tenants + transactions.
     * 
     * @param {number} month - Month (1-12), defaults to current
     * @param {number} year - Year, defaults to current
     * @param {string} roomFilter - Optional room ID filter
     * @param {string} statusFilter - Optional status filter (pending/overdue)
     * @returns {Object} { data: [...], summary: {...} }
     */
    async calculateAllPendingRents(month, year, roomFilter = null, statusFilter = null) {
        const now = new Date();
        const targetMonth = month || (now.getMonth() + 1);
        const targetYear = year || now.getFullYear();

        // 1. Get all occupied rooms
        const roomsResult = await RoomService.getRoomsByStatus('occupied');
        if (!roomsResult.success) {
            return { success: false, error: roomsResult.error };
        }

        const occupiedRooms = roomsResult.data.documents;
        const pendingRents = [];

        // 2. For each occupied room, find active tenant
        for (const room of occupiedRooms) {
            // Apply room filter if specified
            if (roomFilter && room.$id !== roomFilter) continue;

            // Find active tenant in this room
            const tenantsResult = await TenantService.list(
                [
                    Query.equal('room_id', room.$id),
                    Query.equal('status', 'active')
                ],
                1
            );

            if (!tenantsResult.success || tenantsResult.data.documents.length === 0) {
                continue; // No active tenant in this occupied room (shouldn't happen but safe)
            }

            const tenant = tenantsResult.data.documents[0];

            // Calculate pending rent for this tenant
            const pendingInfo = await this.calculateTenantPendingRent(
                tenant, room, targetMonth, targetYear
            );

            if (pendingInfo) {
                // Apply status filter
                if (statusFilter && pendingInfo.payment_status !== statusFilter) continue;
                pendingRents.push(pendingInfo);
            }
        }

        // 3. Calculate summary
        const summary = this.calculateSummary(pendingRents);

        return {
            success: true,
            data: pendingRents,
            summary,
            total: pendingRents.length
        };
    }

    /**
     * Calculate summary statistics from pending rent data.
     */
    calculateSummary(pendingRents) {
        let totalPending = 0;
        let totalOverdue = 0;
        let pendingCount = 0;
        let overdueCount = 0;

        pendingRents.forEach(item => {
            if (item.payment_status === 'overdue') {
                totalOverdue += item.pending_amount;
                overdueCount++;
            } else {
                totalPending += item.pending_amount;
                pendingCount++;
            }
        });

        return {
            total_pending: totalPending,
            total_overdue: totalOverdue,
            pending_count: pendingCount,
            overdue_count: overdueCount,
            total_combined: totalPending + totalOverdue
        };
    }
}

module.exports = new RentCalculationService();
