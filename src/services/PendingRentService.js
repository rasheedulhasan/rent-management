/**
 * PendingRentService
 * 
 * ISOLATED SERVICE - Orchestrates pending rent collection logic.
 * All calculations are VIRTUAL - no database writes.
 * Does NOT modify existing tables or affect existing services.
 */
const RentCalculationService = require('./RentCalculationService');
const RoomService = require('./RoomService');
const TenantService = require('./TenantService');

class PendingRentService {
    /**
     * Get pending rent collection data with filters.
     * This is a READ-ONLY operation - no database modifications.
     * 
     * @param {Object} filters
     * @param {number} filters.month - Month (1-12), defaults to current
     * @param {number} filters.year - Year, defaults to current
     * @param {string} filters.room_id - Optional room ID filter
     * @param {string} filters.payment_status - Optional status filter (pending/overdue)
     * @param {string} filters.search - Optional search by tenant name
     * @param {number} filters.page - Page number (1-based), defaults to 1
     * @param {number} filters.limit - Items per page, defaults to 20
     * @returns {Object} { success, data, summary, total, page, limit, total_pages }
     */
    async getPendingRents(filters = {}) {
        try {
            const {
                month,
                year,
                room_id,
                payment_status,
                search,
                page = 1,
                limit = 20
            } = filters;

            // Calculate all pending rents dynamically
            const result = await RentCalculationService.calculateAllPendingRents(
                month ? parseInt(month) : null,
                year ? parseInt(year) : null,
                room_id || null,
                payment_status || null
            );

            if (!result.success) {
                return result;
            }

            let pendingData = result.data;

            // Apply search filter (by tenant name)
            if (search) {
                const searchLower = search.toLowerCase();
                pendingData = pendingData.filter(item =>
                    item.tenant_name.toLowerCase().includes(searchLower) ||
                    item.room_number.toLowerCase().includes(searchLower)
                );
            }

            // Calculate summary from filtered data
            const summary = RentCalculationService.calculateSummary(pendingData);

            // Apply pagination
            const totalItems = pendingData.length;
            const totalPages = Math.ceil(totalItems / limit);
            const startIndex = (page - 1) * limit;
            const paginatedData = pendingData.slice(startIndex, startIndex + limit);

            return {
                success: true,
                data: paginatedData,
                summary,
                total: totalItems,
                page: parseInt(page),
                limit: parseInt(limit),
                total_pages: totalPages
            };
        } catch (error) {
            console.error('Error in PendingRentService.getPendingRents:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get summary statistics for pending rents.
     * 
     * @param {Object} filters - Same filters as getPendingRents
     * @returns {Object} Summary stats only
     */
    async getPendingRentSummary(filters = {}) {
        const result = await this.getPendingRents({ ...filters, limit: 1, page: 1 });
        if (result.success) {
            return {
                success: true,
                summary: result.summary,
                total: result.total
            };
        }
        return result;
    }

    /**
     * Get occupied rooms count and pending tenants count for summary cards.
     */
    async getStats() {
        try {
            const roomsResult = await RoomService.list();
            const tenantsResult = await TenantService.getTenantsByStatus('active');

            let occupiedRooms = 0;
            if (roomsResult.success) {
                occupiedRooms = roomsResult.data.documents.filter(
                    room => room.status === 'occupied'
                ).length;
            }

            return {
                success: true,
                data: {
                    occupied_rooms: occupiedRooms,
                    active_tenants: tenantsResult.success ? tenantsResult.data.total : 0
                }
            };
        } catch (error) {
            console.error('Error in PendingRentService.getStats:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PendingRentService();
