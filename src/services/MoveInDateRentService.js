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
 * Output format matches mobile app expectations:
 *   { tenant_id, tenant_name, room_id, room_number, monthly_rent,
 *     pending_amount, overdue_days, payment_status, period_month, period_year }
 */
const TenantService = require('./TenantService');
const RoomService = require('./RoomService');
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

                // Only include tenants with pending_amount > 0
                if (balanceInfo.pending_amount <= 0) continue;

                // Apply payment_status filter
                if (payment_status && balanceInfo.payment_status !== payment_status) continue;

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
     * Returns data in the format expected by the mobile app.
     *
     * @param {Object} tenant - Tenant document from Appwrite
     * @returns {Object|null} { tenant_id, tenant_name, room_id, room_number, monthly_rent, pending_amount, ... }
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

        // Determine current period (month/year) for display
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Determine payment status and overdue days
        // If pending_balance > 0, check if the most recent unpaid period is overdue
        let paymentStatus = 'pending';
        let overdueDays = 0;

        // Calculate the due date for the current month (use local date string to avoid UTC offset issues)
        const dueDate = new Date(currentYear, currentMonth - 1, 1);
        const dueDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const diffTime = now.getTime() - dueDate.getTime();
        overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        // If there's a balance and the current month's due date has passed, mark as overdue
        if (overdueDays > 0 && pendingBalance > 0) {
            paymentStatus = 'overdue';
        }

        return {
            tenant_id: tenant.$id,
            tenant_name: tenant.full_name || 'Unknown',
            room_id: tenant.room_id || '',
            room_number: roomNumber,
            monthly_rent: monthlyRent,
            pending_amount: Math.round(pendingBalance * 100) / 100,
            total_due: Math.round(totalDue * 100) / 100,
            total_paid: Math.round(totalPaid * 100) / 100,
            overdue_days: overdueDays,
            payment_status: paymentStatus,
            rent_due_date: dueDateStr,
            period_month: currentMonth,
            period_year: currentYear
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
     * Returns format expected by mobile app summary cards.
     *
     * @param {Array} pendingData - Array of balance info objects
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
