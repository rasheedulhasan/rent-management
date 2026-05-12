/**
 * MoveInDateRentService
 * 
 * ISOLATED SERVICE - Calculates pending rent based on tenant's move_in_date.
 * The day-of-month from move_in_date is treated as the monthly rent due day.
 * 
 * This is a READ-ONLY, VIRTUAL calculation service.
 * Does NOT create or modify any database records.
 * Does NOT affect existing RentCalculationService, PendingRentService, or any other service.
 * 
 * Status Logic:
 *   - due_today:  Today's date matches the monthly due day
 *   - overdue:    Today's date is AFTER the monthly due day
 *   - upcoming:   Today's date is BEFORE the monthly due day
 */
const RoomService = require('./RoomService');
const TenantService = require('./TenantService');
const { Query } = require('../config/appwrite');

class MoveInDateRentService {
    /**
     * Get pending rent data based on move-in-date logic.
     * 
     * @param {Object} filters
     * @param {string} filters.status - Filter by status: due_today, upcoming, overdue
     * @param {string} filters.room_id - Filter by specific room ID
     * @param {string} filters.tenant_name - Search by tenant name (partial match)
     * @param {number} filters.page - Page number (1-based), defaults to 1
     * @param {number} filters.limit - Items per page, defaults to 20, max 100
     * @returns {Object} { success, data, summary, total, page, limit, total_pages }
     */
    async getPendingRents(filters = {}) {
        try {
            const {
                status,
                room_id,
                tenant_name,
                page = 1,
                limit = 20
            } = filters;

            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

            // 1. Get all occupied rooms
            const roomsResult = await RoomService.getRoomsByStatus('occupied');
            if (!roomsResult.success) {
                return { success: false, error: roomsResult.error };
            }

            const occupiedRooms = roomsResult.data.documents;
            const pendingData = [];

            // 2. For each occupied room, find the active tenant
            for (const room of occupiedRooms) {
                // Apply room_id filter early
                if (room_id && room.$id !== room_id) continue;

                // Find active tenant in this room
                const tenantsResult = await TenantService.list(
                    [
                        Query.equal('room_id', room.$id),
                        Query.equal('status', 'active')
                    ],
                    1
                );

                if (!tenantsResult.success || tenantsResult.data.documents.length === 0) {
                    continue; // No active tenant in this occupied room
                }

                const tenant = tenantsResult.data.documents[0];

                // Calculate pending rent info based on move_in_date
                const rentInfo = this.calculateRentInfo(tenant, room);
                if (!rentInfo) continue;

                // Apply status filter
                if (status && rentInfo.status !== status) continue;

                // Apply tenant_name search filter
                if (tenant_name) {
                    const searchLower = tenant_name.toLowerCase();
                    const nameMatch = rentInfo.tenant_name.toLowerCase().includes(searchLower);
                    if (!nameMatch) continue;
                }

                pendingData.push(rentInfo);
            }

            // 3. Calculate summary
            const summary = this.calculateSummary(pendingData);

            // 4. Apply pagination
            const totalItems = pendingData.length;
            const totalPages = Math.ceil(totalItems / limitNum) || 1;
            const startIndex = (pageNum - 1) * limitNum;
            const paginatedData = pendingData.slice(startIndex, startIndex + limitNum);

            return {
                success: true,
                data: paginatedData,
                summary,
                total: totalItems,
                page: pageNum,
                limit: limitNum,
                total_pages: totalPages
            };
        } catch (error) {
            console.error('Error in MoveInDateRentService.getPendingRents:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate rent info for a single tenant based on their move_in_date.
     * 
     * @param {Object} tenant - Tenant document from Appwrite
     * @param {Object} room - Room document from Appwrite
     * @returns {Object|null} Rent info object or null if tenant has no valid move_in_date
     */
    calculateRentInfo(tenant, room) {
        // Validate tenant has a move_in_date / check_in_date
        const moveInDateStr = tenant.move_in_date || tenant.check_in_date;
        if (!moveInDateStr) return null;

        const moveInDate = new Date(moveInDateStr);
        if (isNaN(moveInDate.getTime())) return null;

        // Extract the due day from move_in_date
        const dueDay = moveInDate.getDate();

        // Build the current month's due date
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-based

        // Handle edge case: month may not have the due day (e.g., Feb 31)
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const safeDueDay = Math.min(dueDay, lastDayOfMonth);

        const dueDate = new Date(currentYear, currentMonth, safeDueDay);

        // Normalize today to midnight for accurate day comparison
        const today = new Date(currentYear, currentMonth, now.getDate());

        // Determine status and calculate days
        let status;
        let overdueDays = 0;
        let remainingDays = 0;

        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            // Today is the due date
            status = 'due_today';
            overdueDays = 0;
            remainingDays = 0;
        } else if (diffDays > 0) {
            // Today is AFTER the due date
            status = 'overdue';
            overdueDays = diffDays;
            remainingDays = 0;
        } else {
            // Today is BEFORE the due date
            status = 'upcoming';
            overdueDays = 0;
            remainingDays = Math.abs(diffDays);
        }

        // Use tenant's monthly_rent as the rent amount
        const monthlyRent = parseFloat(tenant.monthly_rent) || 0;

        // Build room_name: use room_name if available, fall back to room_number
        const roomName = room.room_name || room.room_number || 'N/A';

        return {
            tenant_id: tenant.$id,
            tenant_name: tenant.full_name || 'Unknown',
            room_id: room.$id,
            room_name: roomName,
            room_number: room.room_number || 'N/A',
            monthly_rent: monthlyRent,
            due_date: this.formatDate(dueDate),
            overdue_days: overdueDays,
            remaining_days: remainingDays,
            status: status
        };
    }

    /**
     * Calculate summary statistics from pending rent data.
     * 
     * @param {Array} pendingData - Array of rent info objects
     * @returns {Object} Summary with counts and total amount
     */
    calculateSummary(pendingData) {
        let dueTodayCount = 0;
        let upcomingCount = 0;
        let overdueCount = 0;
        let totalPendingAmount = 0;

        pendingData.forEach(item => {
            totalPendingAmount += item.monthly_rent;

            switch (item.status) {
                case 'due_today':
                    dueTodayCount++;
                    break;
                case 'upcoming':
                    upcomingCount++;
                    break;
                case 'overdue':
                    overdueCount++;
                    break;
            }
        });

        return {
            due_today: dueTodayCount,
            upcoming: upcomingCount,
            overdue: overdueCount,
            total_pending_amount: totalPendingAmount
        };
    }

    /**
     * Format a Date object to YYYY-MM-DD string.
     * 
     * @param {Date} date
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

module.exports = new MoveInDateRentService();
