const BaseService = require('./BaseService');
const { USERS_COLLECTION_ID, Query } = require('../config/appwrite');

class UserService extends BaseService {
    constructor() {
        super(USERS_COLLECTION_ID);
    }

    async createUser(userData) {
        const requiredFields = ['username', 'full_name', 'email', 'role'];
        for (const field of requiredFields) {
            if (!userData[field]) {
                return { success: false, error: `Missing required field: ${field}` };
            }
        }

        // Check if username or email already exists
        const existingUser = await this.findByUsernameOrEmail(userData.username, userData.email);
        if (existingUser) {
            return { success: false, error: 'Username or email already exists' };
        }

        const data = {
            username: userData.username,
            full_name: userData.full_name,
            email: userData.email,
            phone: userData.phone || '',
            role: userData.role,
            status: userData.status || 'active',
            permissions: userData.permissions || JSON.stringify(['read', 'write'])
        };

        return await this.create(data);
    }

    async updateUser(userId, userData) {
        const updateData = { ...userData };

        return await this.update(userId, updateData);
    }

    async findByUsernameOrEmail(username, email) {
        try {
            // Try username
            const usernameResult = await this.list([Query.equal('username', username)], 1);
            if (usernameResult.success && usernameResult.data.documents.length > 0) {
                return usernameResult.data.documents[0];
            }

            // Try email
            const emailResult = await this.list([Query.equal('email', email)], 1);
            if (emailResult.success && emailResult.data.documents.length > 0) {
                return emailResult.data.documents[0];
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    async getUserByUsername(username) {
        const result = await this.list([Query.equal('username', username)], 1);
        if (result.success && result.data.documents.length > 0) {
            return { success: true, data: result.data.documents[0] };
        }
        return { success: false, error: 'User not found' };
    }

    async getUserByEmail(email) {
        const result = await this.list([Query.equal('email', email)], 1);
        if (result.success && result.data.documents.length > 0) {
            return { success: true, data: result.data.documents[0] };
        }
        return { success: false, error: 'User not found' };
    }

    async getUsersByRole(role) {
        return await this.list([Query.equal('role', role)]);
    }

    async updateUserStatus(userId, status) {
        const validStatuses = ['active', 'inactive', 'suspended'];
        if (!validStatuses.includes(status)) {
            return { success: false, error: 'Invalid status value' };
        }

        return await this.update(userId, { status });
    }

    async getCollectors() {
        return await this.getUsersByRole('collector');
    }

    async getAdmins() {
        return await this.getUsersByRole('admin');
    }

    async searchUsers(searchTerm) {
        // Search by name, username, or email
        const queries = [
            Query.search('full_name', searchTerm)
        ];
        
        try {
            const result = await this.list(queries);
            return result;
        } catch (error) {
            // If search fails, try exact match on username or email
            return await this.list([
                Query.equal('username', searchTerm),
                Query.equal('email', searchTerm)
            ]);
        }
    }

    async validateUserCredentials(username, password) {
        // Note: In a real application, you would use proper authentication
        // This is a simplified version for demonstration
        const userResult = await this.getUserByUsername(username);
        if (!userResult.success) {
            return { success: false, error: 'Invalid credentials' };
        }

        const user = userResult.data;
        if (user.status !== 'active') {
            return { success: false, error: 'User account is not active' };
        }

        // In a real app, you would verify password hash here
        // For demo purposes, we'll assume password validation happens elsewhere
        return { success: true, data: user };
    }
}

module.exports = new UserService();