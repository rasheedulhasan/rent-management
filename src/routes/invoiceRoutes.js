/**
 * Invoice Routes
 * 
 * GET /api/invoices - List invoices with optional filters
 * GET /api/invoices/:id - Get a single invoice by ID
 */

const express = require('express');
const router = express.Router();
const { Query } = require('../config/appwrite');
const transactionService = require('../services/RentTransactionService');
const tenantService = require('../services/TenantService');
const roomService = require('../services/RoomService');

/**
 * GET /api/invoices
 * 
 * Get a list of invoices (rent transactions formatted as invoices).
 * Supports pagination, status filtering, and date range filtering.
 */
router.get('/', async (req, res) => {
    try {
        const {
            tenant_id,
            status,
            start_date,
            end_date,
            page,
            limit
        } = req.query;

        const pageNum = page ? parseInt(page) : 1;
        const limitNum = limit ? parseInt(limit) : 20;

        // Build queries for transaction service
        const queries = [];

        if (tenant_id) {
            queries.push(Query.equal('tenant_id', tenant_id));
        }

        if (status) {
            queries.push(Query.equal('payment_status', status));
        }

        if (start_date) {
            queries.push(Query.greaterThanEqual('transaction_date', start_date));
        }

        if (end_date) {
            queries.push(Query.lessThanEqual('transaction_date', end_date));
        }

        // Get transactions
        const result = await transactionService.list(queries, limitNum, (pageNum - 1) * limitNum);

        if (result.success) {
            // Enrich transactions with tenant and room details
            const enrichedData = await Promise.all(
                result.data.documents.map(async (doc) => {
                    let tenantName = 'N/A';
                    let roomNumber = 'N/A';
                    let buildingName = 'N/A';

                    if (doc.tenant_id) {
                        const tenantResult = await tenantService.getById(doc.tenant_id);
                        if (tenantResult.success) {
                            tenantName = tenantResult.data.full_name || tenantResult.data.name || 'Unknown';
                            
                            if (tenantResult.data.room_id) {
                                const roomResult = await roomService.getById(tenantResult.data.room_id);
                                if (roomResult.success) {
                                    roomNumber = roomResult.data.room_number || 'N/A';
                                    buildingName = roomResult.data.building_name || 'N/A';
                                }
                            }
                        }
                    }

                    return {
                        id: doc.$id,
                        invoice_number: `INV-${doc.$id?.substring(0, 8)?.toUpperCase() || '00000000'}`,
                        tenant_id: doc.tenant_id,
                        tenant_name: tenantName,
                        room_number: roomNumber,
                        building_name: buildingName,
                        amount: doc.amount || 0,
                        monthly_rent: doc.monthly_rent || 0,
                        payment_status: doc.payment_status || 'pending',
                        payment_method: doc.payment_method || 'N/A',
                        transaction_date: doc.transaction_date,
                        rent_due_date: doc.rent_due_date,
                        remarks: doc.remarks || '',
                        created_at: doc.$createdAt,
                        updated_at: doc.$updatedAt
                    };
                })
            );

            res.status(200).json({
                success: true,
                data: enrichedData,
                total: result.data.total,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(result.data.total / limitNum)
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || 'Failed to fetch invoices'
            });
        }
    } catch (error) {
        console.error('Error in GET /api/invoices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invoices'
        });
    }
});

/**
 * GET /api/invoices/:id
 * 
 * Get a single invoice by its transaction ID.
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await transactionService.getById(id);

        if (result.success) {
            const doc = result.data;
            
            // Enrich with tenant and room details
            let tenantName = 'N/A';
            let roomNumber = 'N/A';
            let buildingName = 'N/A';

            if (doc.tenant_id) {
                const tenantResult = await tenantService.getById(doc.tenant_id);
                if (tenantResult.success) {
                    tenantName = tenantResult.data.full_name || tenantResult.data.name || 'Unknown';
                    
                    if (tenantResult.data.room_id) {
                        const roomResult = await roomService.getById(tenantResult.data.room_id);
                        if (roomResult.success) {
                            roomNumber = roomResult.data.room_number || 'N/A';
                            buildingName = roomResult.data.building_name || 'N/A';
                        }
                    }
                }
            }

            res.status(200).json({
                success: true,
                data: {
                    id: doc.$id,
                    invoice_number: `INV-${doc.$id?.substring(0, 8)?.toUpperCase() || '00000000'}`,
                    tenant_id: doc.tenant_id,
                    tenant_name: tenantName,
                    room_number: roomNumber,
                    building_name: buildingName,
                    amount: doc.amount || 0,
                    monthly_rent: doc.monthly_rent || 0,
                    payment_status: doc.payment_status || 'pending',
                    payment_method: doc.payment_method || 'N/A',
                    transaction_date: doc.transaction_date,
                    rent_due_date: doc.rent_due_date,
                    collected_by: doc.collected_by || 'N/A',
                    remarks: doc.remarks || '',
                    created_at: doc.$createdAt,
                    updated_at: doc.$updatedAt
                }
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }
    } catch (error) {
        console.error('Error in GET /api/invoices/:id:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invoice'
        });
    }
});

module.exports = router;
