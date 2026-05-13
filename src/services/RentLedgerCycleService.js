/**
 * RentLedgerCycleService
 *
 * CYCLE-BASED LEDGER SERVICE
 *
 * Eliminates runtime calculation lag by pre-populating a rent_ledger collection
 * at the start of each monthly cycle. The API then performs a single DB query
 * instead of looping through tenants and making N+1 service calls.
 *
 * Flow:
 *   1. Monthly Cycle Job (run on 1st of each month):
 *      - Finds all Active tenants with Occupied rooms
 *      - Creates a rent_ledger document for each with status: "pending"
 *      - Closes previous month: marks any remaining "pending" records as "overdue"
 *
 *   2. getPendingRents:
 *      - Single query on rent_ledger collection filtered by status
 *      - No map/filter loops with external service calls
 *      - Returns exact same JSON structure as before (mobile app unchanged)
 *
 *   3. markAsPaid:
 *      - Called when a payment is recorded
 *      - Updates the specific rent_ledger record to status: "paid"
 *      - This is what removes a tenant from the pending list (fixes the glitch)
 */

const { ID, Query, databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID } = require('../config/appwrite');
const TenantService = require('./TenantService');
const RoomService = require('./RoomService');

class RentLedgerCycleService {
    /**
     * Generate the monthly cycle — creates 'pending' rent_ledger entries
     * for all active tenants for the given month/year.
     *
     * This is the primary function that should be called by the monthly cron job.
     * It checks if entries already exist (idempotent) and skips duplicates.
     *
     * Flow:
     *   1. Check if rent_ledger already has entries for this month/year
     *   2. If not, get all Active Tenants from TenantService
     *   3. Create a 'pending' record in rent_ledger for each active tenant
     *      with their expected_rent
     *
     * @param {number} month - Month (1-12)
     * @param {number} year - Year (e.g., 2026)
     * @returns {Object} { success, data: { created, month, year } }
     */
    async generateMonthlyCycle(month, year) {
        try {
            const targetMonth = parseInt(month);
            const targetYear = parseInt(year);

            if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
                return { success: false, error: 'Invalid month. Must be between 1 and 12.' };
            }
            if (isNaN(targetYear) || targetYear < 2000) {
                return { success: false, error: 'Invalid year.' };
            }

            // Check if rent_ledger already has entries for this month/year
            const existingResult = await databases.listDocuments(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                [
                    Query.equal('period_month', targetMonth),
                    Query.equal('period_year', targetYear)
                ],
                1
            );

            if (existingResult.documents && existingResult.documents.length > 0) {
                return {
                    success: true,
                    data: {
                        created: 0,
                        month: targetMonth,
                        year: targetYear,
                        message: 'Entries already exist for this period. Skipping.'
                    }
                };
            }

            // Get all active tenants
            const tenantsResult = await TenantService.getTenantsByStatus('active');
            if (!tenantsResult.success || !tenantsResult.data.documents) {
                return { success: false, error: 'Failed to fetch active tenants' };
            }

            const activeTenants = tenantsResult.data.documents;
            let createdCount = 0;

            // Create a 'pending' record for each active tenant
            for (const tenant of activeTenants) {
                const monthlyRent = parseFloat(tenant.monthly_rent) || 0;
                if (monthlyRent <= 0) continue;

                // Get room details
                let roomNumber = '';
                let roomMonthlyRent = monthlyRent;
                try {
                    const roomResult = await RoomService.getById(tenant.room_id);
                    if (roomResult.success) {
                        roomNumber = roomResult.data.room_number || '';
                        roomMonthlyRent = parseFloat(roomResult.data.monthly_rent) || monthlyRent;
                    }
                } catch (e) {
                    // Room lookup failed, use tenant's monthly_rent
                }

                const dueDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
                const rentPeriod = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

                try {
                    await databases.createDocument(
                        DATABASE_ID,
                        RENT_LEDGER_COLLECTION_ID,
                        ID.unique(),
                        {
                            tenant_id: tenant.$id,
                            tenant_name: tenant.full_name || 'Unknown',
                            room_id: tenant.room_id || '',
                            room_number: roomNumber,
                            monthly_rent: roomMonthlyRent,
                            expected_rent: roomMonthlyRent,
                            amount_due: roomMonthlyRent,
                            amount_paid: 0,
                            pending_balance: roomMonthlyRent,
                            status: 'pending',
                            payment_status: 'pending',
                            period_month: targetMonth,
                            period_year: targetYear,
                            rent_period: rentPeriod,
                            rent_due_date: dueDateStr,
                            overdue_days: 0,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                    );
                    createdCount++;
                } catch (createError) {
                    console.error(
                        `[RentLedgerCycleService] Failed to create ledger for tenant ${tenant.$id}:`,
                        createError.message
                    );
                }
            }

            console.log(
                `[RentLedgerCycleService] generateMonthlyCycle: Created ${createdCount} entries for ${targetMonth}/${targetYear}`
            );

            return {
                success: true,
                data: {
                    created: createdCount,
                    month: targetMonth,
                    year: targetYear
                }
            };
        } catch (error) {
            console.error('[RentLedgerCycleService] Error in generateMonthlyCycle:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Run the monthly cycle job.
     * Should be called on the 1st of each month (via cron or manual trigger).
     *
     * Steps:
     *   1. Close previous month: mark all "pending" records from last month as "overdue"
     *   2. Create new ledger entries for all active tenants for the current month
     *
     * @param {number} month - Month (1-12), defaults to current
     * @param {number} year - Year, defaults to current
     * @returns {Object} { success, data: { created, closed } }
     */
    async runMonthlyCycle(month, year) {
        try {
            const now = new Date();
            const targetMonth = month || (now.getMonth() + 1);
            const targetYear = year || now.getFullYear();

            // Step 1: Close previous month — mark pending records as overdue
            const closeResult = await this._closePreviousCycle(targetMonth, targetYear);

            // Step 2: Create new ledger entries for current month
            const createResult = await this._createMonthlyLedger(targetMonth, targetYear);

            return {
                success: true,
                data: {
                    created: createResult.count,
                    closed: closeResult.count,
                    month: targetMonth,
                    year: targetYear
                }
            };
        } catch (error) {
            console.error('[RentLedgerCycleService] Error in runMonthlyCycle:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Close the previous month's cycle.
     * Any rent_ledger records with status "pending" from the previous month
     * are automatically marked as "overdue".
     *
     * @param {number} currentMonth
     * @param {number} currentYear
     * @returns {Object} { count: number }
     */
    async _closePreviousCycle(currentMonth, currentYear) {
        let closedCount = 0;

        try {
            // Determine previous month/year
            let prevMonth = currentMonth - 1;
            let prevYear = currentYear;
            if (prevMonth < 1) {
                prevMonth = 12;
                prevYear = currentYear - 1;
            }

            // Find all pending records from the previous month
            const pendingRecords = await databases.listDocuments(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                [
                    Query.equal('period_month', prevMonth),
                    Query.equal('period_year', prevYear),
                    Query.equal('status', 'pending')
                ],
                1000 // Max batch size
            );

            if (pendingRecords.documents && pendingRecords.documents.length > 0) {
                // Update each record to "overdue"
                for (const record of pendingRecords.documents) {
                    try {
                        await databases.updateDocument(
                            DATABASE_ID,
                            RENT_LEDGER_COLLECTION_ID,
                            record.$id,
                            {
                                status: 'overdue',
                                payment_status: 'overdue',
                                updated_at: new Date().toISOString()
                            }
                        );
                        closedCount++;
                    } catch (updateError) {
                        console.error(
                            `[RentLedgerCycleService] Failed to close ledger ${record.$id}:`,
                            updateError.message
                        );
                    }
                }
            }

            console.log(
                `[RentLedgerCycleService] Closed ${closedCount} pending records from ${prevMonth}/${prevYear}`
            );
        } catch (error) {
            console.error('[RentLedgerCycleService] Error closing previous cycle:', error);
        }

        return { count: closedCount };
    }

    /**
     * Create rent_ledger entries for all active tenants for the given month/year.
     *
     * @param {number} month
     * @param {number} year
     * @returns {Object} { count: number }
     */
    async _createMonthlyLedger(month, year) {
        let createdCount = 0;

        try {
            // 1. Get all active tenants
            const tenantsResult = await TenantService.getTenantsByStatus('active');
            if (!tenantsResult.success || !tenantsResult.data.documents) {
                console.warn('[RentLedgerCycleService] No active tenants found');
                return { count: 0 };
            }

            const activeTenants = tenantsResult.data.documents;

            // 2. For each active tenant, check if a ledger entry already exists for this period
            for (const tenant of activeTenants) {
                const monthlyRent = parseFloat(tenant.monthly_rent) || 0;
                if (monthlyRent <= 0) continue;

                // Check for existing entry (idempotent — prevents duplicates on re-run)
                const existingResult = await databases.listDocuments(
                    DATABASE_ID,
                    RENT_LEDGER_COLLECTION_ID,
                    [
                        Query.equal('tenant_id', tenant.$id),
                        Query.equal('period_month', month),
                        Query.equal('period_year', year)
                    ],
                    1
                );

                if (existingResult.documents && existingResult.documents.length > 0) {
                    // Entry already exists — skip
                    continue;
                }

                // Get room details
                let roomNumber = '';
                let roomMonthlyRent = monthlyRent;
                try {
                    const roomResult = await RoomService.getById(tenant.room_id);
                    if (roomResult.success) {
                        roomNumber = roomResult.data.room_number || '';
                        roomMonthlyRent = parseFloat(roomResult.data.monthly_rent) || monthlyRent;
                    }
                } catch (e) {
                    // Room lookup failed, use tenant's monthly_rent
                }

                // Calculate due date (1st of the month)
                const dueDateStr = `${year}-${String(month).padStart(2, '0')}-01`;

                // Create the ledger entry
                try {
                    const rentPeriod = `${year}-${String(month).padStart(2, '0')}`;
                    await databases.createDocument(
                        DATABASE_ID,
                        RENT_LEDGER_COLLECTION_ID,
                        ID.unique(),
                        {
                            tenant_id: tenant.$id,
                            tenant_name: tenant.full_name || 'Unknown',
                            room_id: tenant.room_id || '',
                            room_number: roomNumber,
                            monthly_rent: roomMonthlyRent,
                            expected_rent: roomMonthlyRent,
                            amount_due: roomMonthlyRent,
                            amount_paid: 0,
                            pending_balance: roomMonthlyRent,
                            status: 'pending',
                            payment_status: 'pending',
                            period_month: month,
                            period_year: year,
                            rent_period: rentPeriod,
                            rent_due_date: dueDateStr,
                            overdue_days: 0,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                    );
                    createdCount++;
                } catch (createError) {
                    console.error(
                        `[RentLedgerCycleService] Failed to create ledger for tenant ${tenant.$id}:`,
                        createError.message
                    );
                }
            }

            console.log(
                `[RentLedgerCycleService] Created ${createdCount} ledger entries for ${month}/${year}`
            );
        } catch (error) {
            console.error('[RentLedgerCycleService] Error creating monthly ledger:', error);
        }

        return { count: createdCount };
    }

    /**
     * Mark a rent_ledger entry as "paid".
     * Called when a payment is recorded for a tenant's period.
     * This is what removes a tenant from the pending list.
     *
     * @param {string} tenantId - Appwrite tenant document ID
     * @param {number} month - Period month
     * @param {number} year - Period year
     * @param {number} amountPaid - Amount paid
     * @returns {Object} { success, data? }
     */
    async markAsPaid(tenantId, month, year, amountPaid) {
        try {
            // Find the ledger entry for this tenant/period
            const result = await databases.listDocuments(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                [
                    Query.equal('tenant_id', tenantId),
                    Query.equal('period_month', month),
                    Query.equal('period_year', year)
                ],
                1
            );

            if (!result.documents || result.documents.length === 0) {
                // No ledger entry found — could create one as "paid" on the fly
                // This handles edge cases where payment comes before cycle job runs
                console.warn(
                    `[RentLedgerCycleService] No ledger entry found for tenant ${tenantId}, period ${month}/${year}. Creating on-the-fly.`
                );
                return await this._createAndMarkPaid(tenantId, month, year, amountPaid);
            }

            const ledgerEntry = result.documents[0];
            const monthlyRent = parseFloat(ledgerEntry.monthly_rent) || 0;
            const currentPaid = parseFloat(ledgerEntry.amount_paid) || 0;
            const newTotalPaid = currentPaid + parseFloat(amountPaid);

            // Determine if fully paid or partial
            let newStatus = 'paid';
            let newPaymentStatus = 'paid';
            let newPendingBalance = Math.max(0, monthlyRent - newTotalPaid);

            if (newPendingBalance > 0) {
                newStatus = 'partial';
                newPaymentStatus = 'partial';
            }

            // Update the ledger entry
            await databases.updateDocument(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                ledgerEntry.$id,
                {
                    status: newStatus,
                    payment_status: newPaymentStatus,
                    amount_paid: newTotalPaid,
                    pending_balance: newPendingBalance,
                    updated_at: new Date().toISOString()
                }
            );

            console.log(
                `[RentLedgerCycleService] Ledger ${ledgerEntry.$id} updated to ${newStatus} (paid: ${newTotalPaid}, pending: ${newPendingBalance})`
            );

            return {
                success: true,
                data: {
                    ledger_id: ledgerEntry.$id,
                    status: newStatus,
                    amount_paid: newTotalPaid,
                    pending_balance: newPendingBalance
                }
            };
        } catch (error) {
            console.error('[RentLedgerCycleService] Error marking as paid:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a ledger entry on-the-fly and mark as paid.
     * Handles edge case where payment arrives before the monthly cycle job.
     */
    async _createAndMarkPaid(tenantId, month, year, amountPaid) {
        try {
            // Get tenant info
            const tenantResult = await TenantService.getById(tenantId);
            if (!tenantResult.success) {
                return { success: false, error: 'Tenant not found' };
            }
            const tenant = tenantResult.data;
            const monthlyRent = parseFloat(tenant.monthly_rent) || 0;

            // Get room info
            let roomNumber = '';
            try {
                const roomResult = await RoomService.getById(tenant.room_id);
                if (roomResult.success) {
                    roomNumber = roomResult.data.room_number || '';
                }
            } catch (e) { /* ignore */ }

            const amountPaidNum = parseFloat(amountPaid) || 0;
            const pendingBalance = Math.max(0, monthlyRent - amountPaidNum);
            const status = pendingBalance > 0 ? 'partial' : 'paid';
            const dueDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const rentPeriod = `${year}-${String(month).padStart(2, '0')}`;

            const doc = await databases.createDocument(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                ID.unique(),
                {
                    tenant_id: tenant.$id,
                    tenant_name: tenant.full_name || 'Unknown',
                    room_id: tenant.room_id || '',
                    room_number: roomNumber,
                    monthly_rent: monthlyRent,
                    expected_rent: monthlyRent,
                    amount_due: monthlyRent,
                    amount_paid: amountPaidNum,
                    pending_balance: pendingBalance,
                    status: status,
                    payment_status: status,
                    period_month: month,
                    period_year: year,
                    rent_period: rentPeriod,
                    rent_due_date: dueDateStr,
                    overdue_days: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            );

            return {
                success: true,
                data: {
                    ledger_id: doc.$id,
                    status: status,
                    amount_paid: amountPaidNum,
                    pending_balance: pendingBalance
                }
            };
        } catch (error) {
            console.error('[RentLedgerCycleService] Error creating and marking paid:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get pending rents by querying the rent_ledger collection directly.
     * This is the REPLACEMENT for MoveInDateRentService.getPendingRents().
     *
     * Single DB query with pagination — NO map/filter loops with external service calls.
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

            // Filter by status (pending or overdue) — exclude "paid" and "partial"
            if (payment_status) {
                queries.push(Query.equal('payment_status', payment_status));
            } else {
                // Default: show both pending and overdue (but not paid/partial)
                // Appwrite's notEqual only supports a single value, so we use equal with
                // an array of the statuses we DO want to include
                queries.push(Query.equal('payment_status', ['pending', 'overdue']));
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

            // Apply search filter (by tenant name) — this is a client-side filter
            // since Appwrite doesn't support text search on arbitrary fields easily
            if (search) {
                const searchLower = search.toLowerCase();
                ledgerEntries = ledgerEntries.filter(item =>
                    (item.tenant_name || '').toLowerCase().includes(searchLower) ||
                    (item.room_number || '').toLowerCase().includes(searchLower)
                );
            }

            // Transform to the exact format expected by the mobile app
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
            console.error('[RentLedgerCycleService] Error in getPendingRents:', error);
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

    /**
     * Get stats for summary cards (occupied rooms, active tenants).
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
            console.error('[RentLedgerCycleService] Error in getStats:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new RentLedgerCycleService();
