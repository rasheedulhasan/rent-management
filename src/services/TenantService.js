const BaseService = require('./BaseService');
const { TENANTS_COLLECTION_ID, RENT_LEDGER_COLLECTION_ID, RENT_TRANSACTIONS_COLLECTION_ID, BUILDINGS_COLLECTION_ID, Query, databases, DATABASE_ID } = require('../config/appwrite');
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
        return await this.list([Query.equal('status', status)]);
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

        const updateData = {
            status
        };

        // If moving out, set check_out_date
        if (status === 'moved_out') {
            updateData.check_out_date = new Date().toISOString();
        }

        return await this.update(tenantId, updateData);
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
                        Query.notEqual('status', 'paid')
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
}

module.exports = new TenantService();