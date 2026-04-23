const moment = require('moment');

class Validators {
    // Common validation patterns
    static patterns = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^[\+]?[1-9][\d]{0,15}$/, // International phone format
        date: /^\d{4}-\d{2}-\d{2}$/,
        datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
        numeric: /^\d+(\.\d+)?$/,
        alphanumeric: /^[a-zA-Z0-9\s\-_]+$/,
        url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
    };

    // Validate required fields
    static validateRequired(fields, data) {
        const errors = [];
        
        fields.forEach(field => {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                errors.push(`${field} is required`);
            }
        });
        
        return errors;
    }

    // Validate building data
    static validateBuilding(data) {
        const errors = [];
        
        // Required fields
        const requiredFields = ['name', 'address', 'total_floors', 'total_rooms'];
        errors.push(...this.validateRequired(requiredFields, data));
        
        // Numeric validation
        if (data.total_floors && !this.isPositiveInteger(data.total_floors)) {
            errors.push('total_floors must be a positive integer');
        }
        
        if (data.total_rooms && !this.isPositiveInteger(data.total_rooms)) {
            errors.push('total_rooms must be a positive integer');
        }
        
        // Status validation
        if (data.status && !['active', 'inactive'].includes(data.status)) {
            errors.push('status must be either "active" or "inactive"');
        }
        
        return errors;
    }

    // Validate room data
    static validateRoom(data) {
        const errors = [];
        
        // Required fields
        const requiredFields = ['building_id', 'room_number', 'floor', 'monthly_rent'];
        errors.push(...this.validateRequired(requiredFields, data));
        
        // Numeric validation
        if (data.floor && !this.isPositiveInteger(data.floor)) {
            errors.push('floor must be a positive integer');
        }
        
        if (data.monthly_rent && !this.isPositiveNumber(data.monthly_rent)) {
            errors.push('monthly_rent must be a positive number');
        }
        
        // Status validation
        if (data.status && !['vacant', 'occupied', 'under_maintenance'].includes(data.status)) {
            errors.push('status must be "vacant", "occupied", or "under_maintenance"');
        }
        
        // Type validation
        if (data.type && !['apartment', 'studio', 'shop', 'office', 'house'].includes(data.type)) {
            errors.push('type must be one of: apartment, studio, shop, office, house');
        }
        
        return errors;
    }

    // Validate tenant data
    static validateTenant(data) {
        const errors = [];
        
        // Required fields
        const requiredFields = ['room_id', 'full_name', 'phone_number', 'check_in_date', 'monthly_rent'];
        errors.push(...this.validateRequired(requiredFields, data));
        
        // Phone validation
        if (data.phone_number && !this.isValidPhone(data.phone_number)) {
            errors.push('phone_number must be a valid phone number');
        }
        
        // Email validation
        if (data.email && !this.isValidEmail(data.email)) {
            errors.push('email must be a valid email address');
        }
        
        // Date validation
        if (data.check_in_date && !this.isValidDate(data.check_in_date)) {
            errors.push('check_in_date must be a valid date');
        }
        
        if (data.check_out_date && !this.isValidDate(data.check_out_date)) {
            errors.push('check_out_date must be a valid date');
        }
        
        // Numeric validation
        if (data.monthly_rent && !this.isPositiveNumber(data.monthly_rent)) {
            errors.push('monthly_rent must be a positive number');
        }
        
        if (data.security_deposit && !this.isPositiveNumber(data.security_deposit)) {
            errors.push('security_deposit must be a positive number');
        }
        
        // Status validation
        if (data.status && !['active', 'inactive', 'moved_out'].includes(data.status)) {
            errors.push('status must be "active", "inactive", or "moved_out"');
        }
        
        return errors;
    }

    // Validate user data
    static validateUser(data) {
        const errors = [];
        
        // Required fields
        const requiredFields = ['username', 'full_name', 'email', 'role'];
        errors.push(...this.validateRequired(requiredFields, data));
        
        // Email validation
        if (data.email && !this.isValidEmail(data.email)) {
            errors.push('email must be a valid email address');
        }
        
        // Phone validation
        if (data.phone && !this.isValidPhone(data.phone)) {
            errors.push('phone must be a valid phone number');
        }
        
        // Role validation
        if (data.role && !['admin', 'collector', 'manager'].includes(data.role)) {
            errors.push('role must be "admin", "collector", or "manager"');
        }
        
        // Status validation
        if (data.status && !['active', 'inactive', 'suspended'].includes(data.status)) {
            errors.push('status must be "active", "inactive", or "suspended"');
        }
        
        return errors;
    }

    // Validate transaction data
    static validateTransaction(data) {
        const errors = [];
        
        // Required fields
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
        errors.push(...this.validateRequired(requiredFields, data));
        
        // Numeric validation
        if (data.amount && !this.isPositiveNumber(data.amount)) {
            errors.push('amount must be a positive number');
        }
        
        if (data.monthly_rent && !this.isPositiveNumber(data.monthly_rent)) {
            errors.push('monthly_rent must be a positive number');
        }
        
        // Payment method validation
        if (data.payment_method && !['cash', 'online', 'bank_transfer'].includes(data.payment_method)) {
            errors.push('payment_method must be "cash", "online", or "bank_transfer"');
        }
        
        // Payment status validation
        if (data.payment_status && !['paid', 'pending', 'partial'].includes(data.payment_status)) {
            errors.push('payment_status must be "paid", "pending", or "partial"');
        }
        
        // Date validation
        if (data.transaction_date && !this.isValidDate(data.transaction_date)) {
            errors.push('transaction_date must be a valid date');
        }
        
        if (data.rent_due_date && !this.isValidDate(data.rent_due_date)) {
            errors.push('rent_due_date must be a valid date');
        }
        
        // Period validation
        if (data.period_month && (!this.isPositiveInteger(data.period_month) || data.period_month < 1 || data.period_month > 12)) {
            errors.push('period_month must be between 1 and 12');
        }
        
        if (data.period_year && (!this.isPositiveInteger(data.period_year) || data.period_year < 2000)) {
            errors.push('period_year must be a valid year (2000 or later)');
        }
        
        // Amount validation for partial payments
        if (data.payment_status === 'partial' && data.amount && data.monthly_rent) {
            if (parseFloat(data.amount) >= parseFloat(data.monthly_rent)) {
                errors.push('For partial payment, amount must be less than monthly_rent');
            }
        }
        
        return errors;
    }

    // Helper validation methods
    static isValidEmail(email) {
        return this.patterns.email.test(email);
    }

    static isValidPhone(phone) {
        return this.patterns.phone.test(phone.replace(/\s/g, ''));
    }

    static isValidDate(dateString) {
        if (this.patterns.date.test(dateString) || this.patterns.datetime.test(dateString)) {
            return moment(dateString, moment.ISO_8601, true).isValid();
        }
        return false;
    }

    static isPositiveNumber(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
    }

    static isPositiveInteger(value) {
        const num = parseInt(value);
        return !isNaN(num) && num > 0 && Number.isInteger(num);
    }

    static isWithinRange(value, min, max) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= min && num <= max;
    }

    static isAlphanumeric(value) {
        return this.patterns.alphanumeric.test(value);
    }

    // Sanitize input data
    static sanitizeInput(data) {
        const sanitized = {};
        
        for (const key in data) {
            if (typeof data[key] === 'string') {
                // Trim whitespace
                sanitized[key] = data[key].trim();
                
                // Remove potential XSS scripts
                sanitized[key] = sanitized[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            } else {
                sanitized[key] = data[key];
            }
        }
        
        return sanitized;
    }

    // Validate query parameters
    static validateQueryParams(params, allowedParams) {
        const errors = [];
        
        for (const param in params) {
            if (!allowedParams.includes(param)) {
                errors.push(`Invalid query parameter: ${param}`);
            }
        }
        
        return errors;
    }

    // Format validation errors for API response
    static formatValidationErrors(errors) {
        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }
}

module.exports = Validators;