/**
 * MoveInDateRentService
 *
 * CALCULATED BALANCE SERVICE - Computes pending rent as a cumulative balance.
 *
 * Logic:
 *   1. Fetch all Active tenants and their rent_ledger records.
 *   2. For each tenant, calculate months elapsed from check_in_date to today.
 *   3. total_due = months_elapsed * monthly_rent
 *   4. total_paid = sum of all rent_transactions.amount for that tenant
 *   5. pending_balance = total_due - total_paid
 *   6. Only include tenants where pending_balance > 0
 *
 * Output: { tenant_id, full_name, room_id, total_due, total_paid, pending_balance }
 */
const TenantService = require('./TenantService');
const RentTransactionService = require('./RentTransactionService');
const { Query } = require('../config/appwrite');

class MoveInDateRentService {
    /**
     * Get pending rent data — calculated as cumulative balance.
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

            // 2. For each active tenant, calculate cumulative balance
            for (const tenant of activeTenants) {
                // Apply room_id filter early
                if (room_id && tenant.room_id !== room_id) continue;

                // Apply tenant_name search filter
                if (tenant_name) {
                    const searchLower = tenant_name.toLowerCase();
                    const nameMatch = (tenant.full_name || '').toLowerCase().includes(searchLower);
                    if (!nameMatch) continue;
                }

                // Calculate cumulative balance for this tenant
                const balanceInfo = await this.calculateTenantBalance(tenant);
                if (!balanceInfo) continue;

                // Only include tenants with pending_balance > 0
                if (balanceInfo.pending_balance <= 0) continue;

                pendingData.push(balanceInfo);
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
     * Calculate cumulative balance for a single tenant.
     *
     * @param {Object} tenant - Tenant document from Appwrite
     * @returns {Object|null} { tenant_id, full_name, room_id, total_due, total_paid, pending_balance }
     */
    async calculateTenantBalance(tenant) {
        // Validate tenant has a check_in_date
        const checkInDateStr = tenant.check_in_date || tenant.move_in_date;
        if (!checkInDateStr) return null;

        const checkInDate = new Date(checkInDateStr);
        if (isNaN(checkInDate.getTime())) return null;

        const now = new Date();

        // Calculate months elapsed between check_in_date and today
        const monthsElapsed = this.calculateMonthsElapsed(checkInDate, now);
        if (monthsElapsed < 0) return null;

        // Total Due = months_elapsed * monthly_rent
        const monthlyRent = parseFloat(tenant.monthly_rent) || 0;
        const totalDue = monthsElapsed * monthlyRent;

        // Total Paid = sum of all rent_transactions.amount for this tenant
        const totalPaid = await this.calculateTotalPaid(tenant.$id);

        // Pending Balance = total_due - total_paid
        const pendingBalance = totalDue - totalPaid;

        return {
            tenant_id: tenant.$id,
            full_name: tenant.full_name || 'Unknown',
            room_id: tenant.room_id || '',
            total_due: Math.round(totalDue * 100) / 100,
            total_paid: Math.round(totalPaid * 100) / 100,
            pending_balance: Math.round(pendingBalance * 100) / 100
        };
    }

    /**
     * Calculate the number of full calendar months between two dates.
     *
     * Example: check_in = March 13, today = May 13 → 2 months
     * Example: check_in = March 13, today = May 12 → 1 month (not yet a full month)
     *
     * @param {Date} checkInDate - The tenant's check-in date
     * @param {Date} today - The current date
     * @returns {number} Number of full months elapsed
     */
    calculateMonthsElapsed(checkInDate, today) {
        let months = (today.getFullYear() - checkInDate.getFullYear()) * 12;
        months += today.getMonth() - checkInDate.getMonth();

        // If today's day-of-month is before check-in day-of-month,
        // we haven't completed the current month yet
        if (today.getDate() < checkInDate.getDate()) {
            months--;
        }

        return Math.max(0, months);
    }

    /**
     * Calculate the total amount paid by a tenant across all rent_transactions.
     *
     * @param {string} tenantId - The tenant's document ID
     * @returns {number} Sum of all payment amounts
     */
    async calculateTotalPaid(tenantId) {
        try {
            const result = await RentTransactionService.getTransactionsByTenant(tenantId);
            if (!result.success || !result.data || !result.data.documents) {
                return 0;
            }

            const transactions = result.data.documents;
            let totalPaid = 0;

            for (const txn of transactions) {
                // Only count transactions with 'paid' or 'partial' status as payments
                if (txn.payment_status === 'paid' || txn.payment_status === 'partial') {
                    totalPaid += parseFloat(txn.amount) || 0;
                }
            }

            return totalPaid;
        } catch (error) {
            console.error(`Error calculating total paid for tenant ${tenantId}:`, error);
            return 0;
        }
    }

    /**
     * Calculate summary statistics from pending rent data.
     *
     * @param {Array} pendingData - Array of balance info objects
     * @returns {Object} Summary with totals
     */
    calculateSummary(pendingData) {
        let totalDueSum = 0;
        let totalPaidSum = 0;
        let totalPendingBalance = 0;
        let tenantCount = pendingData.length;

        pendingData.forEach(item => {
            totalDueSum += item.total_due;
            totalPaidSum += item.total_paid;
            totalPendingBalance += item.pending_balance;
        });

        return {
            total_tenants_with_balance: tenantCount,
            total_due: Math.round(totalDueSum * 100) / 100,
            total_paid: Math.round(totalPaidSum * 100) / 100,
            total_pending_balance: Math.round(totalPendingBalance * 100) / 100
        };
    }
}

module.exports = new MoveInDateRentService();
