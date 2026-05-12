/**
 * ============================================
 * Rent Collection DTO & Validation
 * ============================================
 * 
 * Centralized request validation for the
 * POST /api/rent/collect endpoint.
 * 
 * Reusable by:
 *   - Mobile App
 *   - Admin Dashboard
 *   - Future integrations
 * ============================================
 */

const ALLOWED_PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque'];
const ALLOWED_PAYMENT_STATUSES = ['paid', 'partial', 'pending'];
const MAX_STRING_LENGTHS = {
    partial_payment_reason: 500,
    pending_reason: 500,
    remarks: 1000,
    receipt_number: 100,
    bank_reference: 200
};

class RentCollectionDTO {
    /**
     * Validate the incoming rent collection request.
     * Returns { valid: boolean, errors: string[] }
     */
    static validate(data) {
        const errors = [];

        // ── Required fields ──
        const requiredFields = [
            'tenant_id',
            'room_id',
            'collected_by',
            'amount',
            'monthly_rent',
            'transaction_date',
            'rent_due_date',
            'period_month',
            'period_year',
            'payment_method'
        ];

        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                errors.push(`${field} is required`);
            }
        }

        // If basic required fields are missing, return early
        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // ── Numeric validation ──
        const amount = parseFloat(data.amount);
        const monthlyRent = parseFloat(data.monthly_rent);

        if (isNaN(amount) || amount < 0) {
            errors.push('amount must be a non-negative number');
        }

        if (isNaN(monthlyRent) || monthlyRent <= 0) {
            errors.push('monthly_rent must be a positive number');
        }

        // ── Overpayment validation ──
        if (!isNaN(amount) && !isNaN(monthlyRent) && amount > monthlyRent) {
            errors.push('Amount cannot exceed monthly rent');
        }

        // ── Payment method validation ──
        if (data.payment_method && !ALLOWED_PAYMENT_METHODS.includes(data.payment_method)) {
            errors.push(
                `Invalid payment method. Allowed: ${ALLOWED_PAYMENT_METHODS.join(', ')}`
            );
        }

        // ── Payment status validation (if provided) ──
        if (data.payment_status && !ALLOWED_PAYMENT_STATUSES.includes(data.payment_status)) {
            errors.push(
                `Invalid payment_status. Allowed: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`
            );
        }

        // ── Period validation ──
        const periodMonth = parseInt(data.period_month);
        const periodYear = parseInt(data.period_year);

        if (isNaN(periodMonth) || periodMonth < 1 || periodMonth > 12) {
            errors.push('period_month must be between 1 and 12');
        }

        if (isNaN(periodYear) || periodYear < 2000 || periodYear > 2100) {
            errors.push('period_year must be a valid year between 2000 and 2100');
        }

        // ── Date validation ──
        if (data.transaction_date && isNaN(Date.parse(data.transaction_date))) {
            errors.push('transaction_date is not a valid date');
        }

        if (data.rent_due_date && isNaN(Date.parse(data.rent_due_date))) {
            errors.push('rent_due_date is not a valid date');
        }

        // ── String length validation ──
        if (data.partial_payment_reason && data.partial_payment_reason.length > MAX_STRING_LENGTHS.partial_payment_reason) {
            errors.push(`partial_payment_reason must not exceed ${MAX_STRING_LENGTHS.partial_payment_reason} characters`);
        }

        if (data.pending_reason && data.pending_reason.length > MAX_STRING_LENGTHS.pending_reason) {
            errors.push(`pending_reason must not exceed ${MAX_STRING_LENGTHS.pending_reason} characters`);
        }

        if (data.remarks && data.remarks.length > MAX_STRING_LENGTHS.remarks) {
            errors.push(`remarks must not exceed ${MAX_STRING_LENGTHS.remarks} characters`);
        }

        // ── Partial payment requires reason ──
        if (amount > 0 && amount < monthlyRent && (!data.partial_payment_reason || data.partial_payment_reason.trim() === '')) {
            errors.push('partial_payment_reason is required for partial payments');
        }

        // ── Pending payment requires reason ──
        if (amount === 0 && (!data.pending_reason || data.pending_reason.trim() === '')) {
            errors.push('pending_reason is required for pending payments');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitize and prepare the validated data for DB insertion.
     */
    static prepareForDb(data) {
        const amount = parseFloat(data.amount);
        const monthlyRent = parseFloat(data.monthly_rent);

        // Determine payment status based on business logic
        let paymentStatus;
        if (amount === 0) {
            paymentStatus = 'pending';
        } else if (amount < monthlyRent) {
            paymentStatus = 'partial';
        } else {
            paymentStatus = 'paid';
        }

        return {
            tenant_id: data.tenant_id.trim(),
            room_id: data.room_id.trim(),
            collected_by: data.collected_by.trim(),
            amount: amount,
            monthly_rent: monthlyRent,
            transaction_date: data.transaction_date,
            rent_due_date: data.rent_due_date,
            period_month: parseInt(data.period_month),
            period_year: parseInt(data.period_year),
            payment_method: data.payment_method.trim(),
            payment_status: paymentStatus,
            partial_payment_reason: (data.partial_payment_reason || '').trim(),
            pending_reason: (data.pending_reason || '').trim(),
            remarks: (data.remarks || '').trim(),
            bank_reference: (data.bank_reference || '').trim(),
            send_sms_receipt: data.send_sms_receipt === true || data.send_sms_receipt === 'true'
        };
    }

    /**
     * Format the success response.
     */
    static formatSuccessResponse(transaction, tenant, room) {
        const amount = transaction.amount;
        const monthlyRent = transaction.monthly_rent;
        const remainingBalance = Math.max(0, monthlyRent - amount);

        return {
            success: true,
            message: 'Rent collected successfully',
            data: {
                transaction_id: transaction.$id,
                receipt_number: transaction.receipt_number,
                tenant_name: tenant?.full_name || 'Unknown',
                room_name: room?.room_number || 'N/A',
                amount_paid: amount,
                monthly_rent: monthlyRent,
                remaining_balance: remainingBalance,
                payment_status: transaction.payment_status,
                payment_method: transaction.payment_method,
                transaction_date: transaction.transaction_date
            }
        };
    }

    /**
     * Format an error response.
     */
    static formatErrorResponse(message, details = null) {
        const response = {
            success: false,
            message
        };
        if (details) {
            response.details = details;
        }
        return response;
    }
}

module.exports = RentCollectionDTO;
