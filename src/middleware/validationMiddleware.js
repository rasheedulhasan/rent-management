const Validators = require('../utils/validators');

const validationMiddleware = {
    // Validate building data
    validateBuilding: (req, res, next) => {
        const errors = Validators.validateBuilding(req.body);
        
        if (errors.length > 0) {
            return res.status(400).json(Validators.formatValidationErrors(errors));
        }
        
        // Sanitize input
        req.body = Validators.sanitizeInput(req.body);
        next();
    },

    // Validate room data
    validateRoom: (req, res, next) => {
        const errors = Validators.validateRoom(req.body);
        
        if (errors.length > 0) {
            return res.status(400).json(Validators.formatValidationErrors(errors));
        }
        
        // Sanitize input
        req.body = Validators.sanitizeInput(req.body);
        next();
    },

    // Validate tenant data
    validateTenant: (req, res, next) => {
        const errors = Validators.validateTenant(req.body);
        
        if (errors.length > 0) {
            return res.status(400).json(Validators.formatValidationErrors(errors));
        }
        
        // Sanitize input
        req.body = Validators.sanitizeInput(req.body);
        next();
    },

    // Validate user data
    validateUser: (req, res, next) => {
        const errors = Validators.validateUser(req.body);
        
        if (errors.length > 0) {
            return res.status(400).json(Validators.formatValidationErrors(errors));
        }
        
        // Sanitize input
        req.body = Validators.sanitizeInput(req.body);
        next();
    },

    // Validate transaction data
    validateTransaction: (req, res, next) => {
        const errors = Validators.validateTransaction(req.body);
        
        if (errors.length > 0) {
            return res.status(400).json(Validators.formatValidationErrors(errors));
        }
        
        // Sanitize input
        req.body = Validators.sanitizeInput(req.body);
        next();
    },

    // Validate query parameters
    validateQuery: (allowedParams) => {
        return (req, res, next) => {
            const errors = Validators.validateQueryParams(req.query, allowedParams);
            
            if (errors.length > 0) {
                return res.status(400).json(Validators.formatValidationErrors(errors));
            }
            
            next();
        };
    },

    // Validate ID parameter
    validateId: (req, res, next) => {
        const { id } = req.params;
        
        if (!id || id.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID parameter is required'
            });
        }
        
        // Basic ID validation (Appwrite IDs are typically alphanumeric)
        if (!/^[a-zA-Z0-9]+$/.test(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }
        
        next();
    },

    // Validate pagination parameters
    validatePagination: (req, res, next) => {
        const { limit, offset } = req.query;
        
        if (limit && (!Validators.isPositiveInteger(limit) || parseInt(limit) > 100)) {
            return res.status(400).json({
                success: false,
                error: 'Limit must be a positive integer not exceeding 100'
            });
        }
        
        if (offset && (!Validators.isPositiveInteger(offset))) {
            return res.status(400).json({
                success: false,
                error: 'Offset must be a positive integer'
            });
        }
        
        next();
    },

    // Validate date range parameters
    validateDateRange: (req, res, next) => {
        const { start_date, end_date } = req.query;
        
        if (start_date && !Validators.isValidDate(start_date)) {
            return res.status(400).json({
                success: false,
                error: 'start_date must be a valid date (YYYY-MM-DD)'
            });
        }
        
        if (end_date && !Validators.isValidDate(end_date)) {
            return res.status(400).json({
                success: false,
                error: 'end_date must be a valid date (YYYY-MM-DD)'
            });
        }
        
        if (start_date && end_date) {
            const start = new Date(start_date);
            const end = new Date(end_date);
            
            if (start > end) {
                return res.status(400).json({
                    success: false,
                    error: 'start_date cannot be after end_date'
                });
            }
        }
        
        next();
    },

    // Validate status parameter
    validateStatus: (validStatuses) => {
        return (req, res, next) => {
            const { status } = req.query;
            
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Status must be one of: ${validStatuses.join(', ')}`
                });
            }
            
            next();
        };
    }
};

module.exports = validationMiddleware;