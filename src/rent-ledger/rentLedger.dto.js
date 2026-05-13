/**
 * ============================================
 * Rent Ledger DTO & Validation
 * ============================================
 *
 * Validates rent ledger entry requests before
 * passing to the service layer.
 *
 * Input fields:
 *   tenant_id     (required) - Appwrite tenant document ID
 *   amount_paid   (required) - Positive number
 *   payment_date  (required) - Date of payment (ISO string)
 *   payment_type  (required) - Cash | Bank Transfer | Security Deposit
 *   remarks       (optional) - Additional notes
 * ============================================
 */

const ALLOWED_PAYMENT_TYPES = ['cash', 'bank_transfer', 'security_deposit'];

class RentLedgerDTO {
    /**
     * Validate the incoming rent ledger entry request.
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(data) {
        const errors = [];

        // ── Required fields ──
        const requiredFields = ['tenant_id', 'amount_paid', 'payment_date', 'payment_type'];

        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                errors.push(`${field} is required`);
            }
        }

        // Return early if basic required fields missing
        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // ── Numeric validation ──
        const amountPaid = parseFloat(data.amount_paid);
        if (isNaN(amountPaid) || amountPaid <= 0) {
            errors.push('amount_paid must be a positive number');
        }

        // ── Payment type validation ──
        const paymentType = (data.payment_type || '').toLowerCase().trim();
        if (!ALLOWED_PAYMENT_TYPES.includes(paymentType)) {
            errors.push(
                `Invalid payment_type. Allowed: ${ALLOWED_PAYMENT_TYPES.join(', ')}`
            );
        }

        // ── Date validation ──
        if (data.payment_date && isNaN(Date.parse(data.payment_date))) {
            errors.push('payment_date is not a valid date');
        }

        // ── Remarks length validation ──
        if (data.remarks && data.remarks.length > 1000) {
            errors.push('remarks must not exceed 1000 characters');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Sanitize and prepare the validated data for DB insertion.
     * Maps the simplified input to the rent_transactions schema.
     */
    static prepareForDb(data) {
        const amountPaid = parseFloat(data.amount_paid);
        const paymentType = (data.payment_type || '').toLowerCase().trim();
        const now = new Date();
        const paymentDate = data.payment_date || now.toISOString();

        return {
            tenant_id: data.tenant_id.trim(),
            amount: amountPaid,
            transaction_date: paymentDate,
            payment_method: paymentType === 'security_deposit' ? 'cash' : paymentType,
            payment_status: 'paid',
            remarks: (data.remarks || '').trim(),
            // Auto-populated fields for schema compatibility
            room_id: data.room_id || '',
            collected_by: data.collected_by || '',
            monthly_rent: amountPaid,
            rent_due_date: paymentDate,
            period_month: now.getMonth() + 1,
            period_year: now.getFullYear()
        };
    }

    /**
     * Format the success response.
     */
    static formatSuccessResponse(transaction, tenant) {
        return {
            success: true,
            message: 'Rent payment recorded successfully',
            data: {
                ledger_entry_id: transaction.$id,
                tenant_id: transaction.tenant_id,
                tenant_name: tenant?.full_name || 'Unknown',
                amount_paid: transaction.amount,
                payment_date: transaction.transaction_date,
                payment_type: transaction.payment_method,
                remarks: transaction.remarks || ''
            }
        };
    }

    /**
     * Format an error response.
     */
    static formatErrorResponse(message, details = null) {
        const response = { success: false, message };
        if (details) {
            response.details = details;
        }
        return response;
    }
}

module.exports = RentLedgerDTO;
