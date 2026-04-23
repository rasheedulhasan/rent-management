const BaseService = require('./BaseService');
const { RENT_TRANSACTIONS_COLLECTION_ID, Query } = require('../config/appwrite');

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
        const validMethods = ['cash', 'online', 'bank_transfer'];
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
}

module.exports = new RentTransactionService();