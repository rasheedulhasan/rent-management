const BaseService = require('./BaseService');
const { TENANTS_COLLECTION_ID, RENT_LEDGER_COLLECTION_ID, RENT_TRANSACTIONS_COLLECTION_ID, BUILDINGS_COLLECTION_ID, Query, databases, DATABASE_ID } = require('../config/appwrite');
const { query, withTransaction, generateId } = require('../config/db');
const RoomService = require('./RoomService');

class TenantService extends BaseService {
    constructor() {
        super(TENANTS_COLLECTION_ID);
    }

    async createTenant(tenantData) {
        const requiredFields = ['room_id', 'full_name', 'phone_number', 'check_in_date', 'monthly_rent'];
        for (const field of requiredFields) {
            if (!tenantData[field]) {
                return { success: false, error: `Missing required field: ${field}` };
            }
        }

        // Derive billing_day from check_in_date (day of month)
        const checkInDate = new Date(tenantData.check_in_date);
        const billingDay = !isNaN(checkInDate.getTime())
            ? checkInDate.getUTCDate()
            : (tenantData.billing_day || 1);

        const data = {
            room_id: tenantData.room_id,
            full_name: tenantData.full_name,
            phone_number: tenantData.phone_number,
            email: tenantData.email || '',
            id_number: tenantData.id_number || '',
            emergency_contact: tenantData.emergency_contact || '',
            check_in_date: tenantData.check_in_date,
            check_out_date: tenantData.check_out_date || null,
            monthly_rent: parseFloat(tenantData.monthly_rent),
            security_deposit: tenantData.security_deposit ? parseFloat(tenantData.security_deposit) : 0,
            billing_day: billingDay,
            status: tenantData.status || 'active',
            notes: tenantData.notes || ''
        };

        return await this.create(data);
    }

    async updateTenant(tenantId, tenantData) {
        const updateData = {
            ...tenantData
        };

        if (tenantData.monthly_rent) {
            updateData.monthly_rent = parseFloat(tenantData.monthly_rent);
        }
        if (tenantData.security_deposit) {
            updateData.security_deposit = parseFloat(tenantData.security_deposit);
        }

        // Preserve last_payment_date as-is (already a string from the caller)
        // No parsing needed — it's passed through directly

        return await this.update(tenantId, updateData);
    }

    async getTenantsByRoom(roomId, status = 'active') {
        const queries = [
            `equal("room_id", "${roomId}")`,
            `equal("status", "${status}")`
        ];
        return await this.list(queries);
    }

    async getTenantsByStatus(status = 'active') {
        // IMPORTANT: BaseService.list defaults to 25 per page, which would make the
        // monthly rollover bill only the first 25 tenants. Page through everything.
        const pageSize = 500;
        let offset = 0;
        const all = [];

        while (true) {
            const page = await this.list([Query.equal('status', status)], pageSize, offset);
            if (!page.success) return page;

            const docs = (page.data && page.data.documents) || [];
            all.push(...docs);
            if (docs.length < pageSize) break;
            offset += pageSize;
        }

        return {
            success: true,
            data: {
                documents: all,
                total: all.length
            }
        };
    }

    async searchTenants(searchTerm) {
        // Search by name, phone, or email
        const queries = [
            `search("full_name", "${searchTerm}")`
        ];
        
        try {
            const result = await this.list(queries);
            return result;
        } catch (error) {
            // If search fails, try exact match on phone
            return await this.list([`equal("phone_number", "${searchTerm}")`]);
        }
    }

    async updateTenantStatus(tenantId, status) {
        const validStatuses = ['active', 'inactive', 'moved_out'];
        if (!validStatuses.includes(status)) {
            return { success: false, error: 'Invalid status value' };
        }

        // Fetch the tenant first so we know which room to release/occupy.
        const tenantResult = await this.getById(tenantId);
        if (!tenantResult.success) {
            return { success: false, error: 'Tenant not found' };
        }
        const tenant = tenantResult.data;

        const updateData = {
            status
        };

        // If moving out, set check_out_date; if re-activating, clear it.
        if (status === 'moved_out') {
            updateData.check_out_date = new Date().toISOString();
        } else if (status === 'active') {
            updateData.check_out_date = null;
        }

        const result = await this.update(tenantId, updateData);
        if (!result.success) {
            return result;
        }

        // Keep room occupancy in sync with the tenant status.
        await this._syncRoomOccupancy(tenant.room_id, status);

        return result;
    }

    /**
     * Keep room occupancy in sync with tenant status.
     *   - active      -> mark the room occupied
     *   - moved_out   -> release the room (vacant) if no other active tenant has it
     *
     * @param {string} roomId
     * @param {string} tenantStatus
     */
    async _syncRoomOccupancy(roomId, tenantStatus) {
        if (!roomId) return;

        try {
            if (tenantStatus === 'active') {
                await RoomService.updateRoomStatus(roomId, 'occupied');
                return;
            }

            if (tenantStatus === 'moved_out') {
                // Only release if no OTHER active tenant is still assigned.
                // (The tenant we just updated is already moved_out, so it is excluded.)
                const activeResult = await this.list(
                    [
                        Query.equal('room_id', roomId),
                        Query.equal('status', 'active')
                    ],
                    1
                );
                const stillOccupied = activeResult.success && activeResult.data.total > 0;
                if (!stillOccupied) {
                    await RoomService.updateRoomStatus(roomId, 'vacant');
                }
            }
        } catch (error) {
            console.error('[TenantService] Failed to sync room occupancy:', error.message);
        }
    }

    async getTenantWithTransactions(tenantId) {
        const tenantResult = await this.getById(tenantId);
        if (!tenantResult.success) {
            return tenantResult;
        }

        // In a real implementation, you would fetch transaction data
        // For now, return tenant data with placeholder transaction info
        const tenant = tenantResult.data;
        return {
            success: true,
            data: {
                ...tenant,
                transaction_history: [], // Would be populated from transaction service
                outstanding_balance: 0,
                last_payment_date: null
            }
        };
    }

    async getActiveTenantsCount() {
        const result = await this.getTenantsByStatus('active');
        if (result.success) {
            return { success: true, count: result.data.total };
        }
        return result;
    }

    /**
     * Fetch a single tenant's full details including room info, building name,
     * rent ledger history, and financial health.
     *
     * @param {string} tenantId - Appwrite tenant document ID
     * @returns {Object} { success, data } where data contains the enriched tenant profile
     *
     * Response shape:
     * {
     *   tenant: { ...core tenant fields },
     *   room: { room_number, floor, type, monthly_rent },
     *   building: { name },
     *   lease: {
     *     start_date, end_date, days_remaining,
     *     monthly_rent, security_deposit
     *   },
     *   financial: {
     *     outstanding_balance, next_payment_due_date,
     *     total_pending, total_overdue
     *   },
     *   recent_transactions: [{ ...last 5 ledger entries }],
     *   status_badge: 'active' | 'overdue' | 'moving_out'
     * }
     */
    async getTenantDetails(tenantId) {
        try {
            // ── Step 1: Fetch tenant ──
            const tenantResult = await this.getById(tenantId);
            if (!tenantResult.success) {
                return { success: false, error: 'Tenant not found', statusCode: 404 };
            }

            const tenant = tenantResult.data;

            // ── Step 2: Fetch room details ──
            let room = null;
            let buildingName = '';
            if (tenant.room_id) {
                try {
                    const roomResult = await RoomService.getById(tenant.room_id);
                    if (roomResult.success) {
                        room = roomResult.data;
                        // Fetch building name
                        if (room.building_id) {
                            try {
                                const buildingResult = await databases.getDocument(
                                    DATABASE_ID,
                                    BUILDINGS_COLLECTION_ID,
                                    room.building_id
                                );
                                buildingName = buildingResult.name || '';
                            } catch (e) {
                                // Building lookup failed
                            }
                        }
                        delete room.building_id;
                    }
                } catch (e) {
                    // Room lookup failed
                }
            }

            // ── Step 3: Fetch rent ledger history (last 5) ──
            let recentTransactions = [];
            try {
                const ledgerResult = await databases.listDocuments(
                    DATABASE_ID,
                    RENT_LEDGER_COLLECTION_ID,
                    [Query.equal('tenant_id', tenantId)],
                    5,
                    0,
                    'period_year',
                    'DESC'
                );

                if (ledgerResult.documents) {
                    // Sort by year desc, month desc to get most recent first
                    recentTransactions = (ledgerResult.documents || [])
                        .sort((a, b) => {
                            if (b.period_year !== a.period_year) return b.period_year - a.period_year;
                            return b.period_month - a.period_month;
                        })
                        .slice(0, 5)
                        .map(entry => ({
                            ledger_id: entry.$id,
                            period_month: entry.period_month,
                            period_year: entry.period_year,
                            rent_period: entry.rent_period || `${entry.period_year}-${String(entry.period_month).padStart(2, '0')}`,
                            rent_due_date: entry.rent_due_date,
                            amount_due: parseFloat(entry.amount_due) || 0,
                            amount_paid: parseFloat(entry.amount_paid) || 0,
                            pending_balance: parseFloat(entry.pending_balance) || 0,
                            monthly_rent: parseFloat(entry.monthly_rent) || 0,
                            status: entry.status || entry.payment_status || 'pending',
                            payment_status: entry.payment_status || entry.status || 'pending',
                            created_at: entry.created_at
                        }));
                }
            } catch (e) {
                console.error(`[TenantService] Failed to fetch ledger for tenant ${tenantId}:`, e.message);
            }

            // ── Step 4: Calculate financial health ──
            let outstandingBalance = 0;
            let totalPending = 0;
            let totalOverdue = 0;
            let nextPaymentDueDate = null;

            // Fetch ALL unpaid ledger records for accurate outstanding balance
            try {
                const allUnpaidResult = await databases.listDocuments(
                    DATABASE_ID,
                    RENT_LEDGER_COLLECTION_ID,
                    [
                        Query.equal('tenant_id', tenantId),
                        Query.equal('status', ['pending', 'overdue', 'partial'])
                    ],
                    100
                );

                const unpaidRecords = allUnpaidResult.documents || [];
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                for (const record of unpaidRecords) {
                    const balance = parseFloat(record.pending_balance) || 0;
                    outstandingBalance += balance;

                    const dueDate = record.rent_due_date ? new Date(record.rent_due_date) : null;
                    if (dueDate && !isNaN(dueDate.getTime())) {
                        if (dueDate < today) {
                            totalOverdue += balance;
                        } else {
                            totalPending += balance;
                        }
                        // Earliest due date that's in the future = next payment due
                        if (dueDate >= today && (!nextPaymentDueDate || dueDate < new Date(nextPaymentDueDate))) {
                            nextPaymentDueDate = record.rent_due_date;
                        }
                    }
                }
            } catch (e) {
                console.error(`[TenantService] Failed to calculate financial health for tenant ${tenantId}:`, e.message);
            }

            // ── Step 5: Determine status badge ──
            let statusBadge = tenant.status || 'active';
            if (totalOverdue > 0) {
                statusBadge = 'overdue';
            } else if (tenant.status === 'moved_out') {
                statusBadge = 'moving_out';
            }

            // ── Step 6: Build lease summary ──
            let daysRemaining = null;
            if (tenant.check_out_date) {
                const endDate = new Date(tenant.check_out_date);
                const now = new Date();
                const diffTime = endDate.getTime() - now.getTime();
                daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            }

            // ── Step 7: Assemble response ──
            const now = new Date();
            return {
                success: true,
                data: {
                    tenant: {
                        id: tenant.$id,
                        full_name: tenant.full_name,
                        phone_number: tenant.phone_number,
                        email: tenant.email || '',
                        id_number: tenant.id_number || '',
                        emergency_contact: tenant.emergency_contact || '',
                        status: tenant.status,
                        check_in_date: tenant.check_in_date,
                        check_out_date: tenant.check_out_date,
                        monthly_rent: parseFloat(tenant.monthly_rent) || 0,
                        security_deposit: parseFloat(tenant.security_deposit) || 0,
                        billing_day: tenant.billing_day,
                        last_payment_date: tenant.last_payment_date,
                        notes: tenant.notes || '',
                        created_at: tenant.$createdAt
                    },
                    room: room ? {
                        id: room.$id,
                        room_number: room.room_number,
                        floor: room.floor,
                        type: room.type,
                        monthly_rent: parseFloat(room.monthly_rent) || 0
                    } : null,
                    building: buildingName ? {
                        name: buildingName
                    } : null,
                    lease: {
                        start_date: tenant.check_in_date,
                        end_date: tenant.check_out_date,
                        days_remaining: daysRemaining,
                        monthly_rent: parseFloat(tenant.monthly_rent) || 0,
                        security_deposit: parseFloat(tenant.security_deposit) || 0
                    },
                    financial: {
                        outstanding_balance: Math.round(outstandingBalance * 100) / 100,
                        total_pending: Math.round(totalPending * 100) / 100,
                        total_overdue: Math.round(totalOverdue * 100) / 100,
                        next_payment_due_date: nextPaymentDueDate
                    },
                    recent_transactions: recentTransactions,
                    status_badge: statusBadge
                }
            };
        } catch (error) {
            console.error('[TenantService] Error in getTenantDetails:', error);
            return { success: false, error: error.message, statusCode: 500 };
        }
    }
    /**
     * Make sure the tenant has a rent_ledger row for the given period and keep it
     * in step with the tenant's edits.
     *
     *   - row missing           -> create it (pending) so the tenant shows rent + due date
     *   - row exists, unpaid    -> re-price it when monthly_rent changed
     *   - row exists            -> apply the new due date
     *
     * @returns {{ touched: number, created: boolean }}
     */
    async _syncCurrentPeriodLedger({ tenantId, tenant, periodYear, periodMonth, newRent, newDueDate, billingDayChanged }, nowIso) {
        const existing = await query(
            `SELECT id, amount_paid
             FROM rent_ledger
             WHERE tenant_id = $1 AND period_year = $2 AND period_month = $3
             LIMIT 1`,
            [tenantId, periodYear, periodMonth]
        );

        const rentForPeriod = newRent !== undefined
            ? newRent
            : (parseFloat(tenant.monthly_rent) || 0);

        const dueDate = newDueDate !== undefined
            ? newDueDate
            : `${periodYear}-${String(periodMonth).padStart(2, '0')}-${String(tenant.billing_day || 1).padStart(2, '0')}`;

        // ── existing row: patch it ──
        if (existing.rows.length > 0) {
            const row = existing.rows[0];
            const sets = [];
            const vals = [];
            let n = 1;

            // Only re-price a row nothing has been paid against.
            const amountPaid = parseFloat(row.amount_paid) || 0;
            if (newRent !== undefined && amountPaid === 0) {
                sets.push(`monthly_rent = $${n++}`, `expected_rent = $${n++}`, `amount_due = $${n++}`, `pending_balance = $${n++}`);
                vals.push(rentForPeriod, rentForPeriod, rentForPeriod, rentForPeriod);
            }
            const applyDueDate = newDueDate !== undefined || billingDayChanged === true;
            if (applyDueDate) {
                sets.push(`rent_due_date = $${n++}`);
                vals.push(dueDate);
            }
            if (sets.length === 0) {
                return { touched: 0, created: false };
            }

            sets.push(`updated_at = $${n++}`);
            vals.push(nowIso);
            vals.push(row.id);
            await query(`UPDATE rent_ledger SET ${sets.join(', ')} WHERE id = $${n}`, vals);
            return { touched: 1, created: false };
        }

        // ── no row yet: create this period's charge ──
        const roomRes = await query(`SELECT room_number FROM rooms WHERE id = $1`, [tenant.room_id]);
        const roomNumber = roomRes.rows[0] ? roomRes.rows[0].room_number : '';

        await query(
            `INSERT INTO rent_ledger
                (id, ledger_uid, room_id, tenant_id, rent_period, tenant_name, room_number,
                 monthly_rent, expected_rent, amount_due, amount_paid, pending_balance,
                 status, payment_status, period_month, period_year, rent_due_date, overdue_days, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$8,0,$8,'pending','pending',$9,$10,$11,0,$12,$12)`,
            [
                generateId(),
                `LEDGER-${tenantId.slice(0, 8)}-${periodYear}${String(periodMonth).padStart(2, '0')}`,
                tenant.room_id || '',
                tenantId,
                `${periodYear}-${String(periodMonth).padStart(2, '0')}`,
                tenant.full_name || 'Unknown',
                roomNumber,
                rentForPeriod,
                periodMonth,
                periodYear,
                dueDate,
                nowIso
            ]
        );
        return { touched: 1, created: true };
    }

    /**
     * Bulk-edit several tenants in ONE request (mobile multi-select).
     *
     * Editable per tenant:
     *   full_name, phone_number, monthly_rent, billing_day,
     *   rent_due_date (due date of that tenant's open rent-ledger rows)
     *
     * All-or-nothing: every row is validated first; if any row is invalid the
     * request changes nothing and returns the per-row errors.
     *
     * @param {Array<{id, full_name?, phone_number?, monthly_rent?, billing_day?, rent_due_date?}>} updates
     */
    async bulkUpdateTenants(updates) {
        const EDITABLE = ['full_name', 'phone_number', 'monthly_rent', 'billing_day', 'rent_due_date'];

        try {
            if (!Array.isArray(updates) || updates.length === 0) {
                return { success: false, statusCode: 400, error: 'tenants must be a non-empty array' };
            }
            if (updates.length > 10) {
                return { success: false, statusCode: 400, error: 'Too many tenants in one request (max 10)' };
            }

            // ── Step 1: validate every row up-front (nothing is written yet) ──
            const errors = [];
            const rows = [];

            updates.forEach((raw, index) => {
                const row = raw || {};
                const id = row.id || row.tenant_id || row.$id;
                if (!id) {
                    errors.push({ index, id: null, error: 'id is required' });
                    return;
                }

                const has = (f) => row[f] !== undefined && row[f] !== null && row[f] !== '';
                const provided = EDITABLE.filter(has);
                if (provided.length === 0) {
                    errors.push({ index, id, error: `No editable field provided (${EDITABLE.join(', ')})` });
                    return;
                }

                const changes = {};

                if (has('full_name')) {
                    const v = String(row.full_name).trim();
                    if (!v) errors.push({ index, id, error: 'full_name cannot be empty' });
                    else changes.full_name = v;
                }
                if (has('phone_number')) {
                    const v = String(row.phone_number).trim();
                    if (!v) errors.push({ index, id, error: 'phone_number cannot be empty' });
                    else changes.phone_number = v;
                }
                if (has('monthly_rent')) {
                    const v = parseFloat(row.monthly_rent);
                    if (isNaN(v) || v < 0) errors.push({ index, id, error: 'monthly_rent must be a number >= 0' });
                    else changes.monthly_rent = v;
                }
                if (has('billing_day')) {
                    const v = parseInt(row.billing_day, 10);
                    if (isNaN(v) || v < 1 || v > 31) errors.push({ index, id, error: 'billing_day must be between 1 and 31' });
                    else changes.billing_day = v;
                }
                if (has('rent_due_date')) {
                    const d = new Date(row.rent_due_date);
                    if (isNaN(d.getTime())) errors.push({ index, id, error: 'rent_due_date must be a valid date (YYYY-MM-DD)' });
                    else changes.rent_due_date = String(row.rent_due_date).slice(0, 10);
                }

                rows.push({ index, id, changes });
            });

            if (errors.length > 0) {
                return {
                    success: false,
                    statusCode: 400,
                    error: `Validation failed for ${errors.length} tenant(s). Nothing was updated.`,
                    errors
                };
            }

            // ── Step 2: apply everything inside ONE transaction ──
            return await withTransaction(async () => {
                const results = [];
                const now = new Date();
                const nowIso = now.toISOString();

                for (const { index, id, changes } of rows) {
                    const existing = await query(
                        `SELECT id, room_id, full_name, monthly_rent, billing_day FROM tenants WHERE id = $1`,
                        [id]
                    );
                    if (existing.rows.length === 0) {
                        // throws -> whole batch rolls back (all-or-nothing)
                        const err = new Error(`Tenant not found: ${id}`);
                        err.statusCode = 400;
                        throw err;
                    }
                    const current = existing.rows[0];

                    const sets = [];
                    const vals = [];
                    let n = 1;

                    for (const field of ['full_name', 'phone_number', 'monthly_rent', 'billing_day']) {
                        if (changes[field] !== undefined) {
                            sets.push(`${field} = $${n++}`);
                            vals.push(changes[field]);
                        }
                    }

                    if (sets.length > 0) {
                        sets.push('updated_at = now()');
                        vals.push(id);
                        await query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = $${n}`, vals);
                    }

                    // Keep the CURRENT period's rent row in step. If the tenant has no row
                    // yet (e.g. created after the monthly rollover) we create it, so the
                    // rent amount / due date actually shows for that tenant.
                    let ledgerRowsUpdated = 0;
                    if (changes.monthly_rent !== undefined ||
                        changes.rent_due_date !== undefined ||
                        changes.billing_day !== undefined) {
                        const sync = await this._syncCurrentPeriodLedger({
                            tenantId: id,
                            tenant: {
                                room_id: current.room_id,
                                full_name: changes.full_name !== undefined ? changes.full_name : current.full_name,
                                monthly_rent: changes.monthly_rent !== undefined ? changes.monthly_rent : current.monthly_rent,
                                billing_day: changes.billing_day !== undefined ? changes.billing_day : current.billing_day
                            },
                            periodYear: now.getFullYear(),
                            periodMonth: now.getMonth() + 1,
                            newRent: changes.monthly_rent,
                            newDueDate: changes.rent_due_date,
                            billingDayChanged: changes.billing_day !== undefined
                        }, nowIso);
                        ledgerRowsUpdated = sync.touched;
                    }

                    results.push({
                        index,
                        id,
                        success: true,
                        updated_fields: Object.keys(changes),
                        ledger_rows_updated: ledgerRowsUpdated
                    });
                }

                return {
                    success: true,
                    data: {
                        requested: rows.length,
                        updated: results.length,
                        failed: 0,
                        results
                    }
                };
            });
        } catch (error) {
            console.error('[TenantService] Error in bulkUpdateTenants:', error);
            return { success: false, statusCode: error.statusCode || 500, error: error.message };
        }
    }
}

module.exports = new TenantService();