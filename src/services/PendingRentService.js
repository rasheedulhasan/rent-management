/**
 * PendingRentService
 * 
 * ARREARS-BASED PENDING RENT SERVICE
 * 
 * Fetches ALL unpaid rent_ledger records (status != 'paid') across all months,
 * groups them by tenant_id, and aggregates totals to show accumulated debt (arrears).
 * 
 * Key changes from single-month approach:
 *   - No month/year filter — queries all unpaid records for all time
 *   - Groups by tenant_id, summing pending_balance, amount_due, amount_paid
 *   - rent_due_date is set to the OLDEST unpaid record's date (start of debt)
 *   - overdue_days calculated from that oldest date
 *   - Sorted so tenants with highest pending_amount / most overdue_days appear first
 */

const { Query, databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID } = require('../config/appwrite');
const RoomService = require('./RoomService');
const TenantService = require('./TenantService');

class PendingRentService {
    /**
     * Get pending rent collection data with arrears aggregation.
     * 
     * Queries ALL unpaid rent_ledger records (status != 'paid') across all months,
     * groups by tenant_id, and aggregates totals.
     * 
     * @param {Object} filters
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
                room_id,
                payment_status,
                search,
                page = 1,
                limit = 20
            } = filters;

            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

            // ── Step 1: Fetch ALL unpaid records across all time ──
            // We need to paginate through ALL results since Appwrite has a 100-doc limit per query.
            // We'll fetch in batches and aggregate client-side.
            const allUnpaidRecords = await this._fetchAllUnpaidRecords(room_id, payment_status);

            // ── Step 2: Apply search filter (by tenant name) — client-side ──
            let filteredRecords = allUnpaidRecords;
            if (search) {
                const searchLower = search.toLowerCase();
                filteredRecords = allUnpaidRecords.filter(item =>
                    (item.tenant_name || '').toLowerCase().includes(searchLower) ||
                    (item.room_number || '').toLowerCase().includes(searchLower)
                );
            }

            // ── Step 3: Group by tenant_id and aggregate ──
            const tenantArrearsMap = new Map();

            // Use the real current date for status computation.
            const referenceDate = new Date();

            for (const record of filteredRecords) {
                const tenantId = record.tenant_id;
                if (!tenantId) continue;

                if (!tenantArrearsMap.has(tenantId)) {
                    tenantArrearsMap.set(tenantId, {
                        tenant_id: tenantId,
                        tenant_name: record.tenant_name || 'Unknown',
                        room_id: record.room_id || '',
                        room_number: record.room_number || '',
                        monthly_rent: parseFloat(record.monthly_rent) || 0,
                        pending_amount: 0,
                        total_due: 0,
                        total_paid: 0,
                        oldest_due_date: null, // Track the oldest (earliest) rent_due_date
                        payment_status: 'pending', // Will be computed dynamically below
                        records_count: 0
                    });
                }

                const entry = tenantArrearsMap.get(tenantId);
                entry.pending_amount += parseFloat(record.pending_balance) || 0;
                entry.total_due += parseFloat(record.amount_due) || 0;
                entry.total_paid += parseFloat(record.amount_paid) || 0;
                entry.records_count++;

                // Track the oldest rent_due_date (earliest date = start of debt)
                const dueDate = record.rent_due_date;
                if (dueDate && (!entry.oldest_due_date || new Date(dueDate) < new Date(entry.oldest_due_date))) {
                    entry.oldest_due_date = dueDate;
                }

                // ── Compute status dynamically by comparing rent_due_date against reference date ──
                // This replaces the old logic that relied on the stored DB payment_status field,
                // which was unreliable (records were seeded with hardcoded 'overdue' status
                // regardless of actual date comparison).
                const recordDueDate = record.rent_due_date;
                if (recordDueDate) {
                    const dueDateTime = new Date(recordDueDate).getTime();
                    const refTime = referenceDate.getTime();
                    if (dueDateTime < refTime) {
                        // Due date is in the past — this record is overdue
                        entry.payment_status = 'overdue';
                    } else if (dueDateTime > refTime) {
                        // Due date is in the future — this record is upcoming
                        entry.payment_status = 'upcoming';
                    }
                    // If due date is today, keep as 'pending'
                }
            }

            // ── Step 4: Transform aggregated data into the response format ──
            const now = new Date();
            let aggregatedData = [];

            for (const [, entry] of tenantArrearsMap) {
                // Calculate overdue_days from the oldest unpaid record's due date
                let overdueDays = 0;
                if (entry.oldest_due_date) {
                    const oldestDate = new Date(entry.oldest_due_date);
                    const diffTime = now.getTime() - oldestDate.getTime();
                    overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                }

                aggregatedData.push({
                    tenant_id: entry.tenant_id,
                    tenant_name: entry.tenant_name,
                    room_id: entry.room_id,
                    room_number: entry.room_number,
                    monthly_rent: entry.monthly_rent,
                    pending_amount: Math.round(entry.pending_amount * 100) / 100,
                    total_due: Math.round(entry.total_due * 100) / 100,
                    total_paid: Math.round(entry.total_paid * 100) / 100,
                    overdue_days: overdueDays,
                    payment_status: entry.payment_status,
                    rent_due_date: entry.oldest_due_date || '',
                    arrears_months: entry.records_count // Number of unpaid months contributing to arrears
                });
            }

            // ── Step 5: Sort — highest pending_amount first, then most overdue_days ──
            aggregatedData.sort((a, b) => {
                // Primary sort: by pending_amount descending
                if (b.pending_amount !== a.pending_amount) {
                    return b.pending_amount - a.pending_amount;
                }
                // Secondary sort: by overdue_days descending
                return b.overdue_days - a.overdue_days;
            });

            // ── Step 6: Apply pagination ──
            const totalItems = aggregatedData.length;
            const totalPages = Math.ceil(totalItems / limitNum) || 1;
            const offset = (pageNum - 1) * limitNum;
            const paginatedData = aggregatedData.slice(offset, offset + limitNum);

            // ── Step 7: Calculate summary ──
            const summary = this._calculateSummary(aggregatedData);

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
            console.error('Error in PendingRentService.getPendingRents:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch ALL unpaid rent_ledger records across all time.
     * Appwrite limits queries to 100 documents per call, so we paginate
     * through all results using cursor-based pagination.
     * 
     * @param {string} room_id - Optional room filter
     * @param {string} payment_status - Optional status filter
     * @returns {Array} All unpaid ledger records
     */
    async _fetchAllUnpaidRecords(room_id, payment_status) {
        const allRecords = [];
        let cursor = null;
        const BATCH_SIZE = 100; // Appwrite max per query

        while (true) {
            const queries = [];

            // Filter by status — only unpaid records (exclude 'paid')
            if (payment_status) {
                // If a specific status is requested (e.g., 'pending' or 'overdue'), filter by it
                queries.push(Query.equal('payment_status', payment_status));
            } else {
                // Default: include pending, overdue, partial — exclude 'paid'
                // Appwrite's notEqual only supports a single value, so we use equal with
                // an array of the statuses we DO want to include
                queries.push(Query.equal('payment_status', ['pending', 'overdue', 'partial']));
            }

            if (room_id) {
                queries.push(Query.equal('room_id', room_id));
            }

            // Cursor-based pagination
            if (cursor) {
                queries.push(Query.cursorAfter(cursor));
            }

            const result = await databases.listDocuments(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                queries,
                BATCH_SIZE
            );

            const documents = result.documents || [];
            if (documents.length === 0) break;

            allRecords.push(...documents);

            // If we got fewer than BATCH_SIZE, we've reached the end
            if (documents.length < BATCH_SIZE) break;

            // Set cursor to the last document's $id for next batch
            cursor = documents[documents.length - 1].$id;
        }

        return allRecords;
    }

    /**
     * Get summary statistics for pending rents (arrears).
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
            // total_pending is the sum of ALL items (Upcoming + Overdue)
            totalPending += amount;
            pendingCount++;

            if (item.payment_status === 'overdue') {
                totalOverdue += amount;
                overdueCount++;
            }
        });

        // total_combined is the sum of ALL pending_amount values across all items
        const totalCombined = Math.round(totalPending * 100) / 100;

        return {
            total_pending: Math.round(totalPending * 100) / 100,
            total_overdue: Math.round(totalOverdue * 100) / 100,
            pending_count: pendingCount,
            overdue_count: overdueCount,
            total_combined: totalCombined
        };
    }
}

module.exports = new PendingRentService();
