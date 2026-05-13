/**
 * MoveInDateRentService
 *
 * CYCLE-BASED LEDGER SERVICE
 *
 * Refactored to use the rent_ledger collection instead of runtime calculations.
 * The heavy lifting happens in the monthly cycle job (RentLedgerCycleService).
 * This service now performs a SINGLE database query with pagination.
 *
 * The API response structure is IDENTICAL to the previous version —
 * the Flutter/React Native app sees no difference.
 *
 * Why this fixes the issues:
 *   - Speed: Ledger is pre-populated at month start; API just reads
 *   - Reliability: Rent records are physical DB documents; they don't "disappear"
 *   - Scalability: Works with 10,000+ tenants without slowdown
 *   - History: Query by month/year for historical data
 */

const RentLedgerCycleService = require('./RentLedgerCycleService');

class MoveInDateRentService {
    /**
     * Get pending rent data by querying the rent_ledger collection.
     * Single DB query with pagination — NO map/filter loops with external service calls.
     *
     * @param {Object} filters
     * @param {number} filters.month - Month (1-12), defaults to current
     * @param {number} filters.year - Year, defaults to current
     * @param {string} filters.room_id - Optional room ID filter
     * @param {string} filters.payment_status - Optional status filter (pending/overdue)
     * @param {string} filters.search - Optional search by tenant name
     * @param {string} filters.tenant_name - Alias for search
     * @param {number} filters.page - Page number (1-based), defaults to 1
     * @param {number} filters.limit - Items per page, defaults to 20
     * @returns {Object} { success, data, summary, total, page, limit, total_pages }
     */
    async getPendingRents(filters = {}) {
        // Delegate to RentLedgerCycleService which queries rent_ledger directly
        return await RentLedgerCycleService.getPendingRents(filters);
    }

    /**
     * Get summary statistics for pending rents.
     *
     * @param {Object} filters - Same filters as getPendingRents
     * @returns {Object} Summary stats only
     */
    async getPendingRentSummary(filters = {}) {
        const result = await this.getPendingRents({ ...filters, limit: 1, page: 1 });
        if (result.success) {
            return {
                success: true,
                summary: result.summary,
                total: result.total
            };
        }
        return result;
    }

    /**
     * Get occupied rooms count and pending tenants count for summary cards.
     */
    async getStats() {
        return await RentLedgerCycleService.getStats();
    }
}

module.exports = new MoveInDateRentService();
