const express = require('express');
const router = express.Router();
const transactionService = require('../services/RentTransactionService');

// Get all transactions
router.get('/', async (req, res) => {
    try {
        const { 
            status, 
            tenant_id, 
            room_id, 
            collected_by,
            period_year,
            period_month,
            limit = 25, 
            offset = 0 
        } = req.query;
        
        const queries = [];
        
        if (status) {
            queries.push(`equal("payment_status", "${status}")`);
        }
        
        if (tenant_id) {
            queries.push(`equal("tenant_id", "${tenant_id}")`);
        }
        
        if (room_id) {
            queries.push(`equal("room_id", "${room_id}")`);
        }
        
        if (collected_by) {
            queries.push(`equal("collected_by", "${collected_by}")`);
        }
        
        if (period_year) {
            queries.push(`equal("period_year", ${period_year})`);
        }
        
        if (period_month) {
            queries.push(`equal("period_month", ${period_month})`);
        }
        
        const result = await transactionService.list(queries, parseInt(limit), parseInt(offset), 'transaction_date', 'DESC');
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions'
        });
    }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await transactionService.getById(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transaction'
        });
    }
});

// Create new transaction
router.post('/', async (req, res) => {
    try {
        const transactionData = req.body;
        const result = await transactionService.createTransaction(transactionData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Transaction created successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create transaction'
        });
    }
});

// Update transaction
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const transactionData = req.body;
        const result = await transactionService.updateTransaction(id, transactionData);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Transaction updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update transaction'
        });
    }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await transactionService.delete(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Transaction deleted successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete transaction'
        });
    }
});

// Update payment status
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required'
            });
        }
        
        const result = await transactionService.updatePaymentStatus(id, status, reason);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'Payment status updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update payment status'
        });
    }
});

// Get transactions by tenant
router.get('/tenant/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { status } = req.query;
        const result = await transactionService.getTransactionsByTenant(tenantId, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions'
        });
    }
});

// Get transactions by room
router.get('/room/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { status } = req.query;
        const result = await transactionService.getTransactionsByRoom(roomId, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions'
        });
    }
});

// Get transactions by collector
router.get('/collector/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query;
        const result = await transactionService.getTransactionsByCollector(userId, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions'
        });
    }
});

// Get transactions by period
router.get('/period/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const { status } = req.query;
        const result = await transactionService.getTransactionsByPeriod(
            parseInt(year), 
            parseInt(month), 
            status
        );
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions'
        });
    }
});

// Search transactions
router.get('/search/:field/:query', async (req, res) => {
    try {
        const { field, query } = req.params;
        const result = await transactionService.searchTransactions(query, field);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data.documents,
                total: result.data.total
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to search transactions'
        });
    }
});

// Get monthly revenue
router.get('/revenue/monthly/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const result = await transactionService.getMonthlyRevenue(parseInt(year));
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monthly revenue'
        });
    }
});

module.exports = router;