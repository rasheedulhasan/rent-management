/**
 * ============================================
 * Rent Ledger Routes
 * ============================================
 *
 * POST /api/rent-ledger/record
 *
 * Simplified endpoint for recording rent payments
 * into the rent ledger.
 *
 * Input:
 *   tenant_id     (required) - Appwrite tenant document ID
 *   amount_paid   (required) - Positive number
 *   payment_date  (required) - Date of payment (ISO string)
 *   payment_type  (required) - Cash | Bank Transfer | Security Deposit
 *   remarks       (optional) - Additional notes
 * ============================================
 */

const express = require('express');
const router = express.Router();
const rentLedgerController = require('./rentLedgerController');

// ── Record a rent payment in the ledger ──
router.post('/record', rentLedgerController.recordPayment);

module.exports = router;
