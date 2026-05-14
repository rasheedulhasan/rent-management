/**
 * ============================================
 * Tenant Booking DTO & Validation
 * ============================================
 * 
 * Validates tenant booking requests before
 * passing to the service layer.
 * 
 * Fields match the existing tenants table:
 *   id_number, emergency_contact, check_in_date,
 *   check_out_date, monthly_rent, security_deposit,
 *   notes, room_id, full_name, phone_number, status
 * ============================================
 */

const MAX_LENGTHS = {
    id_number: 50,
    emergency_contact: 255,
    full_name: 255,
    phone_number: 20,
    notes: 1000,
    status: 50
};

class TenantBookingDTO {
    /**
     * Validate tenant booking request.
     * @returns {{ valid: boolean, errors: string[] }}
     */
    static validate(data) {
        const errors = [];

        // ── Required fields ──
        const requiredFields = [
            'room_id',
            'full_name',
            'phone_number',
            'check_in_date',
            'monthly_rent'
        ];

        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                errors.push(`${field} is required`);
            }
        }

        // Return early if basic required fields missing
        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // ── String length validation ──
        if (data.full_name && data.full_name.length > MAX_LENGTHS.full_name) {
            errors.push(`full_name must not exceed ${MAX_LENGTHS.full_name} characters`);
        }

        if (data.phone_number && data.phone_number.length > MAX_LENGTHS.phone_number) {
            errors.push(`phone_number must not exceed ${MAX_LENGTHS.phone_number} characters`);
        }

        if (data.id_number && data.id_number.length > MAX_LENGTHS.id_number) {
            errors.push(`id_number must not exceed ${MAX_LENGTHS.id_number} characters`);
        }

        if (data.emergency_contact && data.emergency_contact.length > MAX_LENGTHS.emergency_contact) {
            errors.push(`emergency_contact must not exceed ${MAX_LENGTHS.emergency_contact} characters`);
        }

        if (data.notes && data.notes.length > MAX_LENGTHS.notes) {
            errors.push(`notes must not exceed ${MAX_LENGTHS.notes} characters`);
        }

        // ── Numeric validation ──
        const monthlyRent = parseFloat(data.monthly_rent);
        if (isNaN(monthlyRent) || monthlyRent <= 0) {
            errors.push('monthly_rent must be a positive number');
        }

        if (data.security_deposit !== undefined && data.security_deposit !== null && data.security_deposit !== '') {
            const deposit = parseFloat(data.security_deposit);
            if (isNaN(deposit) || deposit < 0) {
                errors.push('security_deposit must be a non-negative number');
            }
        }

        // ── Date validation ──
        if (data.check_in_date && isNaN(Date.parse(data.check_in_date))) {
            errors.push('check_in_date is not a valid date');
        }

        if (data.check_out_date && data.check_out_date !== '' && data.check_out_date !== null) {
            if (isNaN(Date.parse(data.check_out_date))) {
                errors.push('check_out_date is not a valid date');
            }
        }

        // ── Status validation ──
        const validStatuses = ['active', 'inactive', 'moved_out'];
        if (data.status && !validStatuses.includes(data.status)) {
            errors.push(`status must be one of: ${validStatuses.join(', ')}`);
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Sanitize and prepare data for DB insertion.
     */
    static prepareForDb(data) {
        // Derive billing_day from check_in_date (day of month)
        const checkInDate = new Date(data.check_in_date);
        const billingDay = checkInDate.getUTCDate();

        return {
            room_id: data.room_id.trim(),
            full_name: data.full_name.trim(),
            phone_number: data.phone_number.trim(),
            email: (data.email || '').trim(),
            id_number: (data.id_number || '').trim(),
            emergency_contact: (data.emergency_contact || '').trim(),
            check_in_date: data.check_in_date,
            check_out_date: data.check_out_date || null,
            monthly_rent: parseFloat(data.monthly_rent),
            security_deposit: data.security_deposit ? parseFloat(data.security_deposit) : 0,
            billing_day: billingDay,
            notes: (data.notes || '').trim(),
            status: data.status || 'active'
        };
    }

    /**
     * Format success response.
     */
    static formatSuccessResponse(tenant, room) {
        return {
            success: true,
            message: 'Tenant added successfully',
            data: {
                tenant_id: tenant.$id,
                full_name: tenant.full_name,
                phone_number: tenant.phone_number,
                room_id: tenant.room_id,
                room_number: room?.room_number || 'N/A',
                monthly_rent: tenant.monthly_rent,
                check_in_date: tenant.check_in_date,
                status: tenant.status
            }
        };
    }

    /**
     * Format error response.
     */
    static formatErrorResponse(message, details = null) {
        const response = { success: false, message };
        if (details) {
            response.details = details;
        }
        return response;
    }
}

module.exports = TenantBookingDTO;
