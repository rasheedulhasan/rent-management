/**
 * PendingRentService
 * 
 * Queries the rent_ledger collection directly as the single source of truth.
 * Only fetches records where status == 'pending' (or 'overdue').
 * Once a payment is submitted and the ledger status flips to 'paid',
 * the item automatically disappears from this list on next refresh.
 * 
 * No runtime calculations — the work is done once a month by the
 * monthly cycle job (RentLedgerCycleService.generateMonthlyCycle).
 */

const { Query, databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID } = require('../config/appwrite');
const RoomService = require('./RoomService');
const TenantService = require('./TenantService');

class PendingRentService {
    /**
     * Get pending rent collection data with filters.
     * Queries rent_ledger directly — single source of truth.
     * 
     * @param {Object} filters
     * @param {number} filters.month - Month (1-12), defaults to current
     * @param {number} filters.year - Year, defaults to current
     * @param {string} filters.room_id - Optional room ID filter
     * @param {string} filters.payment_status - Optional status filter (pending/overdue)
     * @param {string} filters.search - Optional search by tenant name
     * @param {number} filters.page - Page number (1-based), defaults to 1
     * @param {number} filters.limit - Items per page, defaults to 20
     * @returns {Object} { success, data, summary, total, page, limit, total_pages }
     */
    async getPendingRents(filters = {}) {
        try {
            const {
                month,
                year,
                room_id,
                payment_status,
                search,
                page = 1,
                limit = 20
            } = filters;

            const now = new Date();
            const targetMonth = month ? parseInt(month) : (now.getMonth() + 1);
            const targetYear = year ? parseInt(year) : now.getFullYear();
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

            // Build queries for the rent_ledger collection
            const queries = [
                Query.equal('period_month', targetMonth),
                Query.equal('period_year', targetYear)
            ];

            // Filter by status — only show unpaid records
            if (payment_status) {
                // If a specific status is requested (e.g., 'pending' or 'overdue'), filter by it
                queries.push(Query.equal('payment_status', payment_status));
            } else {
                // Default: show both pending and overdue (exclude paid and partial)
                queries.push(Query.notEqual('payment_status', 'paid'));
                queries.push(Query.notEqual('payment_status', 'partial'));
            }

            if (room_id) {
                queries.push(Query.equal('room_id', room_id));
            }

            // First, get total count without pagination
            const countResult = await databases.listDocuments(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                queries,
                1 // Just need total
            );

            const totalItems = countResult.total || 0;
            const totalPages = Math.ceil(totalItems / limitNum) || 1;

            // Now get the actual page with pagination
            const offset = (pageNum - 1) * limitNum;
            const dataResult = await databases.listDocuments(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                queries,
                limitNum,
                offset
            );

            let ledgerEntries = dataResult.documents || [];

            // Apply search filter (by tenant name) — client-side filter
            if (search) {
                const searchLower = search.toLowerCase();
                ledgerEntries = ledgerEntries.filter(item =>
                    (item.tenant_name || '').toLowerCase().includes(searchLower) ||
                    (item.room_number || '').toLowerCase().includes(searchLower)
                );
            }

            // Transform to the exact format expected by the mobile app
            // The mobile app expects: tenant_name, monthly_rent, pending_amount,
            // total_due, overdue_days, payment_status, rent_due_date, room_number
            const transformedData = ledgerEntries.map(entry => ({
                tenant_id: entry.tenant_id,
                tenant_name: entry.tenant_name || 'Unknown',
                room_id: entry.room_id || '',
                room_number: entry.room_number || '',
                monthly_rent: parseFloat(entry.monthly_rent) || 0,
                pending_amount: parseFloat(entry.pending_balance) || parseFloat(entry.amount_due) || 0,
                total_due: parseFloat(entry.amount_due) || parseFloat(entry.monthly_rent) || 0,
                total_paid: parseFloat(entry.amount_paid) || 0,
                overdue_days: entry.overdue_days || 0,
                payment_status: entry.payment_status || 'pending',
                rent_due_date: entry.rent_due_date || '',
                period_month: entry.period_month || targetMonth,
                period_year: entry.period_year || targetYear
            }));

            // Calculate summary
            const summary = this._calculateSummary(transformedData);

            return {
                success: true,
                data: transformedData,
                summary,
                total: totalItems,
                page: pageNum,
                limit: limitNum,
                total_pages: totalPages
            };
        } catch (error) {
            console.error('Error in PendingRentService.getPendingRents:', error);
            return { success: false, error: error.message };
        }
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
        try {
            const roomsResult = await RoomService.list();
            const tenantsResult = await TenantService.getTenantsByStatus('active');

            let occupiedRooms = 0;
            if (roomsResult.success) {
                occupiedRooms = roomsResult.data.documents.filter(
                    room => room.status === 'occupied'
                ).length;
            }

            return {
                success: true,
                data: {
                    occupied_rooms: occupiedRooms,
                    active_tenants: tenantsResult.success ? tenantsResult.data.total : 0
                }
            };
        } catch (error) {
            console.error('Error in PendingRentService.getStats:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate summary statistics from pending rent data.
     * Matches the exact format expected by the mobile app.
     */
    _calculateSummary(pendingData) {
        let totalPending = 0;
        let totalOverdue = 0;
        let pendingCount = 0;
        let overdueCount = 0;

        pendingData.forEach(item => {
            const amount = parseFloat(item.pending_amount) || 0;
            if (item.payment_status === 'overdue') {
                totalOverdue += amount;
                overdueCount++;
            } else {
                totalPending += amount;
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

module.exports = new PendingRentService();
