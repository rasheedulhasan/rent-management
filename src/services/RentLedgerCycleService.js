/**
 * RentLedgerCycleService
 *
 * CYCLE-BASED LEDGER SERVICE WITH MONTHLY CARRY-FORWARD ROLLOVER
 *
 * Pre-populates the rent_ledger table at the start of each monthly cycle and
 * folds any unpaid balance from prior months into the new month's bill.
 *
 * Flow:
 *   1. Monthly Rollover (run on the 1st of each month, or manually):
 *      - For each ACTIVE tenant, sum pending_balance of all prior rows with
 *        payment_status IN ('pending','overdue','partial')  → carryForward
 *      - Create the new month's row:
 *          expected_rent = monthly_rent + carryForward
 *          status = 'overdue' if carryForward > 0 else 'pending'
 *      - Mark those prior rows as 'rolled_over' (history preserved, no deletion)
 *
 *   2. getPendingRents:
 *      - Single query on rent_ledger filtered by status/period
 *      - Returns the same JSON structure as before (mobile app unchanged)
 *
 *   3. markAsPaid:
 *      - Called when a payment is recorded; reduces pending_balance using
 *        expected_rent (which includes carry-forward) as the debt basis.
 */

const { ID, Query, databases, DATABASE_ID, RENT_LEDGER_COLLECTION_ID } = require('../config/appwrite');
const TenantService = require('./TenantService');
const RoomService = require('./RoomService');

class RentLedgerCycleService {
    /**
     * Legacy initializer: creates 'pending' rent_ledger entries for all active
     * tenants for the given month/year WITHOUT carry-forward.
     *
     * Kept for backward compatibility with POST /cycle/generate.
     * Prefer processMonthlyRollover() for the carry-forward behaviour.
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
                    const ledgerUid = `LEDGER-${tenant.$id.substring(0, 8)}-${targetYear}${String(targetMonth).padStart(2, '0')}`;
                    await databases.createDocument(
                        DATABASE_ID,
                        RENT_LEDGER_COLLECTION_ID,
                        ID.unique(),
                        {
                            ledger_uid: ledgerUid,
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
     * Backward-compatible alias for the monthly cycle job.
     * Delegates to processMonthlyRollover() so the carry-forward behaviour applies.
     */
    async runMonthlyCycle(month, year) {
        return this.processMonthlyRollover(month, year);
    }

    /**
     * Run the monthly rollover — the carry-forward cycle.
     *
     * On the 1st of each month (or whenever triggered):
     *   1. For each ACTIVE tenant, sum pending_balance of all prior rows with
     *      payment_status IN ('pending','overdue','partial')  → carryForward
     *   2. Create the new month's row:
     *        expected_rent = monthly_rent + carryForward
     *        status = 'overdue' if carryForward > 0 else 'pending'
     *   3. Mark those prior rows as 'rolled_over' (history preserved, no deletion)
     *
     * Idempotent: skips tenants that already have a row for the target period.
     *
     * @param {number} [month] - target month (1-12), defaults to current
     * @param {number} [year]  - target year, defaults to current
     * @returns {Object} { success, data: { created, rolled_over, skipped, month, year } }
     */
    async processMonthlyRollover(month, year) {
        try {
            const now = new Date();
            const targetMonth = month ? parseInt(month) : (now.getMonth() + 1);
            const targetYear = year ? parseInt(year) : now.getFullYear();

            if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
                return { success: false, error: 'Invalid month. Must be between 1 and 12.' };
            }
            if (isNaN(targetYear) || targetYear < 2000) {
                return { success: false, error: 'Invalid year.' };
            }

            const tenantsResult = await TenantService.getTenantsByStatus('active');
            if (!tenantsResult.success || !tenantsResult.data.documents) {
                return { success: false, error: 'Failed to fetch active tenants' };
            }

            const activeTenants = tenantsResult.data.documents;
            let created = 0;
            let rolledOver = 0;
            let skipped = 0;

            for (const tenant of activeTenants) {
                try {
                    const res = await this._rolloverTenant(tenant, targetMonth, targetYear);
                    created += res.created;
                    rolledOver += res.rolledOver;
                    skipped += res.skipped;
                } catch (e) {
                    console.error(
                        `[RentLedgerCycleService] Rollover failed for tenant ${tenant.$id}:`,
                        e.message
                    );
                }
            }

            console.log(
                `[RentLedgerCycleService] processMonthlyRollover ${targetYear}-${this._pad2(targetMonth)}: ` +
                `created=${created}, rolled_over=${rolledOver}, skipped=${skipped}`
            );

            return {
                success: true,
                data: {
                    created,
                    rolled_over: rolledOver,
                    skipped,
                    month: targetMonth,
                    year: targetYear
                }
            };
        } catch (error) {
            console.error('[RentLedgerCycleService] Error in processMonthlyRollover:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Roll over a single tenant into the target period with carry-forward.
     */
    async _rolloverTenant(tenant, targetMonth, targetYear) {
        const tenantRent = parseFloat(tenant.monthly_rent) || 0;
        if (tenantRent <= 0) return { created: 0, rolledOver: 0, skipped: 0 };

        // Idempotency guard — never create a duplicate row for tenant+period.
        const existing = await databases.listDocuments(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            [
                Query.equal('tenant_id', tenant.$id),
                Query.equal('period_month', targetMonth),
                Query.equal('period_year', targetYear)
            ],
            1
        );
        if (existing.documents && existing.documents.length > 0) {
            return { created: 0, rolledOver: 0, skipped: 1 };
        }

        // Sum prior open balances (pending/overdue/partial) — excludes paid & rolled_over.
        const openRows = await databases.listDocuments(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            [
                Query.equal('tenant_id', tenant.$id),
                Query.equal('payment_status', ['pending', 'overdue', 'partial'])
            ],
            1000
        );

        let carryForward = 0;
        const priorOpen = [];
        for (const row of openRows.documents || []) {
            const isPrior =
                row.period_year < targetYear ||
                (row.period_year == targetYear && row.period_month < targetMonth);
            if (isPrior) {
                carryForward += parseFloat(row.pending_balance) || 0;
                priorOpen.push(row);
            }
        }
        carryForward = this._round2(carryForward);

        // Room monthly rent (prefer room rent, fall back to tenant rent).
        let monthlyRent = tenantRent;
        let roomNumber = '';
        try {
            const roomResult = await RoomService.getById(tenant.room_id);
            if (roomResult.success) {
                roomNumber = roomResult.data.room_number || '';
                monthlyRent = parseFloat(roomResult.data.monthly_rent) || tenantRent;
            }
        } catch (e) {
            // ignore room lookup failure
        }

        const expectedRent = this._round2(monthlyRent + carryForward);
        const status = carryForward > 0 ? 'overdue' : 'pending';
        const dueDateStr = `${targetYear}-${this._pad2(targetMonth)}-01`;
        const rentPeriod = `${targetYear}-${this._pad2(targetMonth)}`;
        const ledgerUid = `LEDGER-${tenant.$id.substring(0, 8)}-${targetYear}${this._pad2(targetMonth)}`;

        await databases.createDocument(
            DATABASE_ID,
            RENT_LEDGER_COLLECTION_ID,
            ID.unique(),
            {
                ledger_uid: ledgerUid,
                tenant_id: tenant.$id,
                tenant_name: tenant.full_name || 'Unknown',
                room_id: tenant.room_id || '',
                room_number: roomNumber,
                monthly_rent: this._round2(monthlyRent),
                expected_rent: expectedRent,
                amount_due: expectedRent,
                amount_paid: 0,
                pending_balance: expectedRent,
                status: status,
                payment_status: status,
                period_month: targetMonth,
                period_year: targetYear,
                rent_period: rentPeriod,
                rent_due_date: dueDateStr,
                overdue_days: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        );

        // Mark prior open rows as rolled_over — NO DELETION, history preserved.
        let rolledOver = 0;
        for (const row of priorOpen) {
            try {
                await databases.updateDocument(
                    DATABASE_ID,
                    RENT_LEDGER_COLLECTION_ID,
                    row.$id,
                    {
                        status: 'rolled_over',
                        payment_status: 'rolled_over',
                        updated_at: new Date().toISOString()
                    }
                );
                rolledOver++;
            } catch (e) {
                console.error(
                    `[RentLedgerCycleService] Failed to mark ${row.$id} rolled_over:`,
                    e.message
                );
            }
        }

        return { created: 1, rolledOver, skipped: 0 };
    }

    /**
     * Catch up any missed monthly rollovers (e.g. server was down on the 1st).
     * Starts from the month after the latest ledger period and rolls forward to
     * the current month, in order (each rollover carries the previous balance).
     */
    async catchUpMissedMonths() {
        try {
            const latest = await this._getLatestPeriod();
            const now = new Date();
            const curMonth = now.getMonth() + 1;
            const curYear = now.getFullYear();

            let startMonth, startYear;
            if (latest) {
                startMonth = latest.month + 1;
                startYear = latest.year;
                if (startMonth > 12) {
                    startMonth = 1;
                    startYear = latest.year + 1;
                }
            } else {
                // No ledger history yet — just process the current month.
                startMonth = curMonth;
                startYear = curYear;
            }

            const results = [];
            let m = startMonth;
            let y = startYear;
            while (y < curYear || (y === curYear && m <= curMonth)) {
                console.log(`[RentLedgerCycleService] Catching up ${y}-${this._pad2(m)}`);
                const res = await this.processMonthlyRollover(m, y);
                results.push({ month: m, year: y, ...(res.data || {}) });
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }

            return { success: true, data: results };
        } catch (error) {
            console.error('[RentLedgerCycleService] Error in catchUpMissedMonths:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get the latest (max) period present in rent_ledger.
     */
    async _getLatestPeriod() {
        const { query } = require('../config/db');
        const res = await query(
            'SELECT period_year AS year, period_month AS month FROM rent_ledger ORDER BY period_year DESC, period_month DESC LIMIT 1'
        );
        if (res.rows && res.rows.length > 0) {
            return {
                year: parseInt(res.rows[0].year, 10),
                month: parseInt(res.rows[0].month, 10)
            };
        }
        return null;
    }

    _pad2(n) {
        return String(n).padStart(2, '0');
    }

    _round2(n) {
        return Math.round((parseFloat(n) || 0) * 100) / 100;
    }

    /**
     * Mark a rent_ledger entry as "paid".
     * Called when a payment is recorded for a tenant's period.
     * This is what removes a tenant from the pending list.
     *
     * @param {string} tenantId - tenant document ID
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
                console.warn(
                    `[RentLedgerCycleService] No ledger entry found for tenant ${tenantId}, period ${month}/${year}. Creating on-the-fly.`
                );
                return await this._createAndMarkPaid(tenantId, month, year, amountPaid);
            }

            const ledgerEntry = result.documents[0];
            // Use expected_rent (which includes carry-forward) as the debt basis,
            // NOT monthly_rent — otherwise rolled-over balances get reset.
            const debtBasis =
                parseFloat(ledgerEntry.expected_rent) ||
                parseFloat(ledgerEntry.amount_due) ||
                parseFloat(ledgerEntry.monthly_rent) ||
                0;
            const currentPaid = parseFloat(ledgerEntry.amount_paid) || 0;
            const newTotalPaid = currentPaid + parseFloat(amountPaid);

            // Determine if fully paid or partial
            let newStatus = 'paid';
            let newPaymentStatus = 'paid';
            let newPendingBalance = Math.max(0, debtBasis - newTotalPaid);

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
            const ledgerUid = `LEDGER-${tenant.$id.substring(0, 8)}-${year}${String(month).padStart(2, '0')}`;

            const doc = await databases.createDocument(
                DATABASE_ID,
                RENT_LEDGER_COLLECTION_ID,
                ID.unique(),
                {
                    ledger_uid: ledgerUid,
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

            // Filter by status (pending or overdue) — exclude "paid", "partial" and "rolled_over"
            if (payment_status) {
                queries.push(Query.equal('payment_status', payment_status));
            } else {
                // Default: show both pending and overdue (but not paid/partial/rolled_over)
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

            // Apply search filter (by tenant name) — client-side filter
            if (search) {
                const searchLower = search.toLowerCase();
                ledgerEntries = ledgerEntries.filter(item =>
                    (item.tenant_name || '').toLowerCase().includes(searchLower) ||
                    (item.room_number || '').toLowerCase().includes(searchLower)
                );
            }

            // ── Compute status dynamically by comparing rent_due_date against the real current date ──
            const referenceDate = new Date();

            // Transform to the exact format expected by the mobile app
            const transformedData = ledgerEntries.map(entry => {
                // Compute payment_status dynamically
                let computedStatus = entry.payment_status || 'pending';
                const dueDateStr = entry.rent_due_date;
                if (dueDateStr && computedStatus !== 'paid' && computedStatus !== 'partial' && computedStatus !== 'rolled_over') {
                    const dueDateTime = new Date(dueDateStr).getTime();
                    const refTime = referenceDate.getTime();
                    if (dueDateTime < refTime) {
                        // Due date is in the past — this record is overdue
                        computedStatus = 'overdue';
                    } else if (dueDateTime > refTime) {
                        // Due date is in the future — this record is upcoming
                        computedStatus = 'upcoming';
                    }
                    // If due date is today, keep as 'pending'
                }

                return {
                    tenant_id: entry.tenant_id,
                    tenant_name: entry.tenant_name || 'Unknown',
                    room_id: entry.room_id || '',
                    room_number: entry.room_number || '',
                    monthly_rent: parseFloat(entry.monthly_rent) || 0,
                    pending_amount: parseFloat(entry.pending_balance) || parseFloat(entry.amount_due) || 0,
                    total_due: parseFloat(entry.amount_due) || parseFloat(entry.monthly_rent) || 0,
                    total_paid: parseFloat(entry.amount_paid) || 0,
                    overdue_days: entry.overdue_days || 0,
                    payment_status: computedStatus,
                    rent_due_date: entry.rent_due_date || '',
                    period_month: entry.period_month || targetMonth,
                    period_year: entry.period_year || targetYear
                };
            });

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
                // Includes 'pending' and 'upcoming' statuses
                totalPending += amount;
                pendingCount++;
            }
        });

        // total_combined is the sum of ALL pending_amount values across all items
        const totalCombined = Math.round((totalPending + totalOverdue) * 100) / 100;

        return {
            total_pending: Math.round(totalPending * 100) / 100,
            total_overdue: Math.round(totalOverdue * 100) / 100,
            pending_count: pendingCount,
            overdue_count: overdueCount,
            total_combined: totalCombined
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
