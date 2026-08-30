const BaseService = require('./BaseService');
const { RENT_TRANSACTIONS_COLLECTION_ID, Query } = require('../config/appwrite');
const TenantService = require('./TenantService');
const RoomService = require('./RoomService');
const BuildingService = require('./BuildingService');
const UserService = require('./UserService');

class RentTransactionService extends BaseService {
    constructor() {
        super(RENT_TRANSACTIONS_COLLECTION_ID);
    }

    async createTransaction(transactionData) {
        const requiredFields = [
            'tenant_id', 
            'room_id', 
            'collected_by', 
            'amount', 
            'monthly_rent',
            'payment_method',
            'payment_status',
            'rent_due_date'
        ];
        
        for (const field of requiredFields) {
            if (!transactionData[field]) {
                return { success: false, error: `Missing required field: ${field}` };
            }
        }

        // Validate payment status
        const validStatuses = ['paid', 'pending', 'partial'];
        if (!validStatuses.includes(transactionData.payment_status)) {
            return { success: false, error: 'Invalid payment status' };
        }

        // Validate payment method
        const validMethods = ['cash', 'online', 'bank_transfer', 'cheque'];
        if (!validMethods.includes(transactionData.payment_method)) {
            return { success: false, error: 'Invalid payment method' };
        }

        const now = new Date();
        const transactionDate = transactionData.transaction_date || now.toISOString();
        const periodMonth = transactionData.period_month || now.getMonth() + 1;
        const periodYear = transactionData.period_year || now.getFullYear();

        const data = {
            tenant_id: transactionData.tenant_id,
            room_id: transactionData.room_id,
            collected_by: transactionData.collected_by,
            amount: parseFloat(transactionData.amount),
            monthly_rent: parseFloat(transactionData.monthly_rent),
            payment_method: transactionData.payment_method,
            payment_status: transactionData.payment_status,
            transaction_date: transactionDate,
            rent_due_date: transactionData.rent_due_date,
            period_month: parseInt(periodMonth),
            period_year: parseInt(periodYear),
            partial_payment_reason: transactionData.partial_payment_reason || '',
            pending_reason: transactionData.pending_reason || '',
            remarks: transactionData.remarks || '',
            receipt_number: transactionData.receipt_number || this.generateReceiptNumber()
        };

        return await this.create(data);
    }

    async updateTransaction(transactionId, transactionData) {
        const updateData = {
            ...transactionData
        };

        if (transactionData.amount) {
            updateData.amount = parseFloat(transactionData.amount);
        }
        if (transactionData.monthly_rent) {
            updateData.monthly_rent = parseFloat(transactionData.monthly_rent);
        }

        return await this.update(transactionId, updateData);
    }

    async updatePaymentStatus(transactionId, status, reason = '') {
        const validStatuses = ['paid', 'pending', 'partial'];
        if (!validStatuses.includes(status)) {
            return { success: false, error: 'Invalid payment status' };
        }

        const updateData = {
            payment_status: status,
            updatedAt: new Date().toISOString()
        };

        if (status === 'partial') {
            updateData.partial_payment_reason = reason;
        } else if (status === 'pending') {
            updateData.pending_reason = reason;
        }

        return await this.update(transactionId, updateData);
    }

    async getTransactionsByTenant(tenantId, status = null) {
        const queries = [Query.equal('tenant_id', tenantId)];
        if (status) {
            queries.push(Query.equal('payment_status', status));
        }
        return await this.list(queries, 100, 0, 'transaction_date', 'DESC');
    }

    async getTransactionsByRoom(roomId, status = null) {
        const queries = [Query.equal('room_id', roomId)];
        if (status) {
            queries.push(Query.equal('payment_status', status));
        }
        return await this.list(queries, 100, 0, 'transaction_date', 'DESC');
    }

    async getTransactionsByCollector(userId, status = null) {
        const queries = [Query.equal('collected_by', userId)];
        if (status) {
            queries.push(Query.equal('payment_status', status));
        }
        return await this.list(queries, 100, 0, 'transaction_date', 'DESC');
    }

    async getTransactionsByPeriod(year, month, status = null) {
        const queries = [
            Query.equal('period_year', parseInt(year)),
            Query.equal('period_month', parseInt(month))
        ];
        
        if (status) {
            queries.push(Query.equal('payment_status', status));
        }
        
        return await this.list(queries);
    }

    async getDashboardStats(startDate = null, endDate = null) {
        try {
            // Get all transactions (in a real app, you would filter by date)
            const allTransactions = await this.list([], 1000);
            
            if (!allTransactions.success) {
                return allTransactions;
            }

            const transactions = allTransactions.data.documents;
            let totalRevenue = 0;
            let pendingAmount = 0;
            let paidCount = 0;
            let pendingCount = 0;
            let partialCount = 0;

            transactions.forEach(transaction => {
                if (transaction.payment_status === 'paid') {
                    totalRevenue += transaction.amount;
                    paidCount++;
                } else if (transaction.payment_status === 'pending') {
                    pendingAmount += transaction.monthly_rent;
                    pendingCount++;
                } else if (transaction.payment_status === 'partial') {
                    totalRevenue += transaction.amount;
                    pendingAmount += (transaction.monthly_rent - transaction.amount);
                    partialCount++;
                }
            });

            return {
                success: true,
                data: {
                    total_revenue: totalRevenue,
                    pending_amount: pendingAmount,
                    total_transactions: transactions.length,
                    paid_count: paidCount,
                    pending_count: pendingCount,
                    partial_count: partialCount,
                    collection_rate: transactions.length > 0 ? 
                        ((paidCount + partialCount) / transactions.length * 100).toFixed(2) : 0
                }
            };
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return { success: false, error: error.message };
        }
    }

    async getMonthlyRevenue(year) {
        const monthlyRevenue = {};
        
        for (let month = 1; month <= 12; month++) {
            const result = await this.getTransactionsByPeriod(year, month, 'paid');
            if (result.success) {
                const revenue = result.data.documents.reduce((sum, transaction) => 
                    sum + transaction.amount, 0
                );
                monthlyRevenue[month] = revenue;
            } else {
                monthlyRevenue[month] = 0;
            }
        }

        return { success: true, data: monthlyRevenue };
    }

    generateReceiptNumber() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `RCPT-${timestamp}-${random}`;
    }

    async searchTransactions(searchTerm, field = 'receipt_number') {
        const validFields = ['receipt_number', 'tenant_id', 'room_id', 'collected_by'];
        if (!validFields.includes(field)) {
            return { success: false, error: 'Invalid search field' };
        }

        return await this.list([Query.equal(field, searchTerm)]);
    }

    /**
     * Get a list of pending rent transactions enriched with tenant and room details.
     * Used by the dashboard's pending-rent endpoint.
     */
    async getPendingRentList() {
        try {
            const result = await this.list(
                [Query.equal('payment_status', 'pending')],
                100,
                0,
                'rent_due_date',
                'ASC'
            );

            if (!result.success) {
                return result;
            }

            const transactions = result.data.documents;
            const now = new Date();

            // Enrich each transaction with tenant name and room number
            const enrichedTransactions = await Promise.all(
                transactions.map(async (transaction) => {
                    try {
                        // Fetch tenant details
                        const tenantResult = await TenantService.getById(transaction.tenant_id);
                        const tenantName = tenantResult.success
                            ? tenantResult.data.full_name
                            : 'Unknown Tenant';

                        // Fetch room details
                        const roomResult = await RoomService.getById(transaction.room_id);
                        const roomNumber = roomResult.success
                            ? roomResult.data.room_number
                            : 'N/A';

                        // Calculate days overdue
                        const dueDate = new Date(transaction.rent_due_date);
                        const daysOverdue = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));

                        return {
                            id: transaction.$id,
                            tenant_id: transaction.tenant_id,
                            tenant_name: tenantName,
                            room_id: transaction.room_id,
                            room_number: roomNumber,
                            amount: transaction.amount,
                            monthly_rent: transaction.monthly_rent,
                            payment_method: transaction.payment_method,
                            payment_status: transaction.payment_status,
                            rent_due_date: transaction.rent_due_date,
                            period_month: transaction.period_month,
                            period_year: transaction.period_year,
                            pending_reason: transaction.pending_reason || '',
                            remarks: transaction.remarks || '',
                            days_overdue: daysOverdue,
                            collected_by: transaction.collected_by
                        };
                    } catch (err) {
                        console.error(`Error enriching transaction ${transaction.$id}:`, err.message);
                        return {
                            id: transaction.$id,
                            tenant_id: transaction.tenant_id,
                            tenant_name: 'Unknown Tenant',
                            room_id: transaction.room_id,
                            room_number: 'N/A',
                            amount: transaction.amount,
                            monthly_rent: transaction.monthly_rent,
                            payment_method: transaction.payment_method,
                            payment_status: transaction.payment_status,
                            rent_due_date: transaction.rent_due_date,
                            period_month: transaction.period_month,
                            period_year: transaction.period_year,
                            pending_reason: transaction.pending_reason || '',
                            remarks: transaction.remarks || '',
                            days_overdue: 0,
                            collected_by: transaction.collected_by
                        };
                    }
                })
            );

            // Calculate total pending amount
            const totalPendingAmount = enrichedTransactions.reduce(
                (sum, txn) => sum + txn.monthly_rent, 0
            );

            return {
                success: true,
                data: enrichedTransactions,
                total: enrichedTransactions.length,
                total_pending_amount: totalPendingAmount
            };
        } catch (error) {
            console.error('Error getting pending rent list:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enrich an array of transaction documents with tenant, room, building
     * and collector names for display in the dashboard/transactions UI.
     */
    async _enrichTransactions(transactions) {
        if (!transactions || transactions.length === 0) return [];

        const enriched = [];
        for (const transaction of transactions) {
            try {
                const tenantResult = await TenantService.getById(transaction.tenant_id);
                const tenantName = tenantResult.success
                    ? tenantResult.data.full_name
                    : 'Unknown Tenant';

                let roomNumber = 'N/A';
                let buildingName = '';
                if (transaction.room_id) {
                    const roomResult = await RoomService.getById(transaction.room_id);
                    if (roomResult.success) {
                        roomNumber = roomResult.data.room_number || 'N/A';
                        if (roomResult.data.building_id) {
                            const buildingResult = await BuildingService.getById(roomResult.data.building_id);
                            buildingName = buildingResult.success
                                ? buildingResult.data.name
                                : '';
                        }
                    }
                }

                let collectedByName = '';
                if (transaction.collected_by) {
                    const userResult = await UserService.getById(transaction.collected_by);
                    collectedByName = userResult.success
                        ? userResult.data.full_name
                        : '';
                }

                enriched.push({
                    id: transaction.$id,
                    tenant_id: transaction.tenant_id,
                    tenant_name: tenantName,
                    room_id: transaction.room_id,
                    room_number: roomNumber,
                    building_name: buildingName,
                    amount: transaction.amount,
                    monthly_rent: transaction.monthly_rent,
                    payment_status: transaction.payment_status,
                    collected_by: transaction.collected_by,
                    collected_by_name: collectedByName,
                    transaction_date: transaction.transaction_date,
                    payment_method: transaction.payment_method,
                    rent_due_date: transaction.rent_due_date,
                    period_month: transaction.period_month,
                    period_year: transaction.period_year,
                    receipt_number: transaction.receipt_number,
                    remarks: transaction.remarks || ''
                });
            } catch (err) {
                console.error(`Error enriching transaction ${transaction.$id}:`, err.message);
            }
        }

        return enriched;
    }

    /**
     * Get transactions filtered by optional building, date range,
     * collector and payment status, enriched for the transactions page.
     */
    async getFilteredTransactions({ buildingId = null, startDate = null, endDate = null, collectorId = null, status = null } = {}) {
        try {
            const queries = [];

            if (collectorId) queries.push(Query.equal('collected_by', collectorId));
            if (status) queries.push(Query.equal('payment_status', status));
            if (startDate) queries.push(Query.greaterThanEqual('transaction_date', startDate));
            if (endDate) queries.push(Query.lessThanEqual('transaction_date', endDate));

            if (buildingId) {
                const roomsResult = await RoomService.getRoomsByBuilding(buildingId);
                if (roomsResult.success && roomsResult.data.documents.length > 0) {
                    const roomIds = roomsResult.data.documents.map((room) => room.$id);
                    queries.push(Query.equal('room_id', roomIds));
                } else {
                    return { success: true, data: [], total: 0 };
                }
            }

            const result = await this.list(queries, 1000, 0, 'transaction_date', 'DESC');
            if (!result.success) return result;

            const enriched = await this._enrichTransactions(result.data.documents);
            return { success: true, data: enriched, total: enriched.length };
        } catch (error) {
            console.error('Error getting filtered transactions:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get the most recent transactions, enriched for display.
     */
    async getRecentTransactions(limit = 10) {
        try {
            const result = await this.list([], parseInt(limit), 0, 'transaction_date', 'DESC');
            if (!result.success) return result;

            const enriched = await this._enrichTransactions(result.data.documents);
            return { success: true, data: enriched, total: enriched.length };
        } catch (error) {
            console.error('Error getting recent transactions:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get daily collected amounts (paid + partial) grouped by date.
     */
    async getDailyCollection(startDate = null, endDate = null) {
        try {
            const result = await this.list([], 1000, 0, 'transaction_date', 'ASC');
            if (!result.success) return result;

            const dailyMap = {};
            result.data.documents.forEach((transaction) => {
                if (transaction.payment_status !== 'paid' && transaction.payment_status !== 'partial') {
                    return;
                }
                const date = new Date(transaction.transaction_date).toISOString().slice(0, 10);
                if (!dailyMap[date]) {
                    dailyMap[date] = { date, amount: 0, transactions: 0 };
                }
                dailyMap[date].amount += transaction.amount;
                dailyMap[date].transactions++;
            });

            let data = Object.values(dailyMap);
            if (startDate) data = data.filter((d) => d.date >= startDate.slice(0, 10));
            if (endDate) data = data.filter((d) => d.date <= endDate.slice(0, 10));

            return { success: true, data };
        } catch (error) {
            console.error('Error getting daily collection:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get counts of transactions by payment status.
     */
    async getPaymentStatusCounts() {
        try {
            const result = await this.list([], 1000);
            if (!result.success) return result;

            const counts = { paid: 0, pending: 0, partial: 0 };
            result.data.documents.forEach((transaction) => {
                if (counts[transaction.payment_status] !== undefined) {
                    counts[transaction.payment_status]++;
                }
            });

            return { success: true, data: counts };
        } catch (error) {
            console.error('Error getting payment status counts:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new RentTransactionService();