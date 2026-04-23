const BaseService = require('./BaseService');
const { TENANTS_COLLECTION_ID, Query } = require('../config/appwrite');

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
}

module.exports = new TenantService();