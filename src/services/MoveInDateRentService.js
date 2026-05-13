/**
 * MoveInDateRentService
 *
 * PER-PERIOD PENDING SERVICE - Computes pending rent by checking if the
 * current month's rent has been paid.
 *
 * Logic:
 *   1. Fetch all Active tenants.
 *   2. For each tenant, check if a 'paid' or 'partial' transaction exists
 *      for the current period (month/year).
 *   3. If NO paid transaction exists for the current period, the tenant
 *      is considered pending.
 *   4. pending_amount = monthly_rent (or remaining balance if partial).
 *   5. Only include tenants where the current period is unpaid.
 *
 * Output format matches mobile app expectations:
 *   { tenant_id, tenant_name, room_id, room_number, monthly_rent,
 *     pending_amount, overdue_days, payment_status, period_month, period_year }
 */
const TenantService = require('./TenantService');
const RoomService = require('./RoomService');
const RentTransactionService = require('./RentTransactionService');
const { Query, databases, DATABASE_ID, RENT_TRANSACTIONS_COLLECTION_ID } = require('../config/appwrite');

class MoveInDateRentService {
    /**
     * Get pending rent data — per-period check.
     * A tenant is pending only if the current month's rent hasn't been paid.
     *
     * @param {Object} filters
     * @param {string} filters.room_id - Filter by specific room ID
     * @param {string} filters.tenant_name - Search by tenant name (partial match)
     * @param {number} filters.page - Page number (1-based), defaults to 1
     * @param {number} filters.limit - Items per page, defaults to 20, max 100
     * @returns {Object} { success, data, summary, total, page, limit, total_pages }
     */
    async getPendingRents(filters = {}) {
        try {
            const {
                room_id,
                tenant_name,
                payment_status,
                page = 1,
                limit = 20
            } = filters;

            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

            // 1. Fetch all active tenants
            const tenantsResult = await TenantService.getTenantsByStatus('active');
            if (!tenantsResult.success) {
                return { success: false, error: tenantsResult.error };
            }

            const activeTenants = tenantsResult.data.documents;
            const pendingData = [];

            // 2. For each active tenant, check if current period is paid
            for (const tenant of activeTenants) {
                // Apply room_id filter early
                if (room_id && tenant.room_id !== room_id) continue;

                // Apply tenant_name search filter
                if (tenant_name) {
                    const searchLower = tenant_name.toLowerCase();
                    const nameMatch = (tenant.full_name || '').toLowerCase().includes(searchLower);
                    if (!nameMatch) continue;
                }

                // Check if current period is pending for this tenant
                const periodInfo = await this.checkCurrentPeriodPending(tenant);
                if (!periodInfo) continue;

                // Only include tenants with pending_amount > 0
                if (periodInfo.pending_amount <= 0) continue;

                // Apply payment_status filter
                if (payment_status && periodInfo.payment_status !== payment_status) continue;

                pendingData.push(periodInfo);
            }

            // 3. Calculate summary
            const summary = this.calculateSummary(pendingData);

            // 4. Apply pagination
            const totalItems = pendingData.length;
            const totalPages = Math.ceil(totalItems / limitNum) || 1;
            const startIndex = (pageNum - 1) * limitNum;
            const paginatedData = pendingData.slice(startIndex, startIndex + limitNum);

            return {
                success: true,
                data: paginatedData,
                summary,
                total: totalItems,
                page: pageNum,
                limit: limitNum,
                total_pages: totalPages
            };
        } catch (error) {
            console.error('Error in MoveInDateRentService.getPendingRents:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if the current month's rent is pending for a tenant.
     * Returns null if the current period has been paid (tenant should NOT appear in pending list).
     * Returns period info if the current period is unpaid (tenant SHOULD appear in pending list).
     *
     * @param {Object} tenant - Tenant document from Appwrite
     * @returns {Object|null} { tenant_id, tenant_name, room_id, room_number, monthly_rent, pending_amount, ... }
     */
    async checkCurrentPeriodPending(tenant) {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const monthlyRent = parseFloat(tenant.monthly_rent) || 0;
        if (monthlyRent <= 0) return null;

        // Default pending amount is the full monthly rent
        let pendingAmount = monthlyRent;

        // Check if there's a 'paid' or 'partial' transaction for the current period
        try {
            const queries = [
                Query.equal('tenant_id', tenant.$id),
                Query.equal('period_month', currentMonth),
                Query.equal('period_year', currentYear),
                Query.equal('payment_status', 'paid')
            ];

            const result = await databases.listDocuments(
                DATABASE_ID,
                RENT_TRANSACTIONS_COLLECTION_ID,
                queries
            );

            // If a 'paid' transaction exists for the current period, tenant is NOT pending
            if (result.documents && result.documents.length > 0) {
                return null;
            }

            // Check for 'partial' payment
            const partialQueries = [
                Query.equal('tenant_id', tenant.$id),
                Query.equal('period_month', currentMonth),
                Query.equal('period_year', currentYear),
                Query.equal('payment_status', 'partial')
            ];

            const partialResult = await databases.listDocuments(
                DATABASE_ID,
                RENT_TRANSACTIONS_COLLECTION_ID,
                partialQueries
            );

            if (partialResult.documents && partialResult.documents.length > 0) {
                // Partial payment exists — pending amount is the remaining balance
                const partialPaid = partialResult.documents.reduce(
                    (sum, txn) => sum + (parseFloat(txn.amount) || 0), 0
                );
                pendingAmount = Math.max(0, monthlyRent - partialPaid);
                if (pendingAmount <= 0) return null;
            }
        } catch (error) {
            console.error(`Error checking current period for tenant ${tenant.$id}:`, error);
            // If query fails, assume pending (conservative approach)
        }

        // Fetch room details to get room_number
        let roomNumber = '';
        try {
            const roomResult = await RoomService.getById(tenant.room_id);
            if (roomResult.success) {
                roomNumber = roomResult.data.room_number || '';
            }
        } catch (e) {
            // Room lookup failed, use empty string
        }

        // Determine payment status and overdue days
        let paymentStatus = 'pending';
        let overdueDays = 0;

        const dueDate = new Date(currentYear, currentMonth - 1, 1);
        const dueDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const diffTime = now.getTime() - dueDate.getTime();
        overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        // If the current month's due date has passed, mark as overdue
        if (overdueDays > 0) {
            paymentStatus = 'overdue';
        }

        return {
            tenant_id: tenant.$id,
            tenant_name: tenant.full_name || 'Unknown',
            room_id: tenant.room_id || '',
            room_number: roomNumber,
            monthly_rent: monthlyRent,
            pending_amount: pendingAmount,
            total_due: monthlyRent,
            total_paid: 0,
            overdue_days: overdueDays,
            payment_status: paymentStatus,
            rent_due_date: dueDateStr,
            period_month: currentMonth,
            period_year: currentYear
        };
    }

    /**
     * Calculate summary statistics from pending rent data.
     * Returns format expected by mobile app summary cards.
     *
     * @param {Array} pendingData - Array of period info objects
     * @returns {Object} Summary with totals
     */
    calculateSummary(pendingData) {
        let totalPending = 0;
        let totalOverdue = 0;
        let pendingCount = 0;
        let overdueCount = 0;

        pendingData.forEach(item => {
            if (item.payment_status === 'overdue') {
                totalOverdue += item.pending_amount;
                overdueCount++;
            } else {
                totalPending += item.pending_amount;
                pendingCount++;
            }
        });

        return {
            total_pending: Math.round(totalPending * 100) / 100,
            total_overdue: Math.round(totalOverdue * 100) / 100,
            pending_count: pendingCount,
            overdue_count: overdueCount,
            total_combined: Math.round((totalPending + totalOverdue) * 100) / 100
        };
    }
}

module.exports = new MoveInDateRentService();
