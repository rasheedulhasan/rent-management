const express = require('express');
const router = express.Router();
const userService = require('../services/UserService');

// Get all users
router.get('/', async (req, res) => {
    try {
        const { role, status, limit = 25, offset = 0 } = req.query;
        const queries = [];
        
        if (role) {
            queries.push(`equal("role", "${role}")`);
        }
        
        if (status) {
            queries.push(`equal("status", "${status}")`);
        }
        
        const result = await userService.list(queries, parseInt(limit), parseInt(offset));
        
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
            error: 'Failed to fetch users'
        });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await userService.getById(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        });
    }
});

// Create new user
router.post('/', async (req, res) => {
    try {
        const userData = req.body;
        const result = await userService.createUser(userData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'User created successfully'
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
            error: 'Failed to create user'
        });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userData = req.body;
        const result = await userService.updateUser(id, userData);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'User updated successfully'
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
            error: 'Failed to update user'
        });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await userService.delete(id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'User deleted successfully'
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
            error: 'Failed to delete user'
        });
    }
});

// Get user by username
router.get('/username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await userService.getUserByUsername(username);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        });
    }
});

// Get user by email
router.get('/email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const result = await userService.getUserByEmail(email);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        });
    }
});

// Update user status
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required'
            });
        }
        
        const result = await userService.updateUserStatus(id, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'User status updated successfully'
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
            error: 'Failed to update user status'
        });
    }
});

// Get collectors
router.get('/role/collectors', async (req, res) => {
    try {
        const result = await userService.getCollectors();
        
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
            error: 'Failed to fetch collectors'
        });
    }
});

// Get admins
router.get('/role/admins', async (req, res) => {
    try {
        const result = await userService.getAdmins();
        
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
            error: 'Failed to fetch admins'
        });
    }
});

// Search users
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const result = await userService.searchUsers(query);
        
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
            error: 'Failed to search users'
        });
    }
});

// Validate user credentials (for login)
router.post('/validate', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }
        
        const result = await userService.validateUserCredentials(username, password);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: {
                    user: result.data,
                    token: 'jwt-token-placeholder' // In real app, generate JWT
                },
                message: 'Login successful'
            });
        } else {
            res.status(401).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to validate credentials'
        });
    }
});

module.exports = router;