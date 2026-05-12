/**
 * ============================================
 * Tenant Booking Service
 * ============================================
 * 
 * Business logic for adding a tenant room booking.
 * 
 * Flow:
 *   1. Validate input
 *   2. Verify room exists and is vacant
 *   3. Create tenant record
 *   4. Update room status to 'occupied'
 *   5. Return success response
 * ============================================
 */

const TenantService = require('../services/TenantService');
const RoomService = require('../services/RoomService');
const TenantBookingDTO = require('./tenantBooking.dto');

class TenantBookingService {
    /**
     * Verify the room exists and is vacant.
     */
    async verifyRoom(roomId) {
        const roomResult = await RoomService.getById(roomId);
        if (!roomResult.success) {
            return { valid: false, error: 'Room not found' };
        }

        const room = roomResult.data;

        if (room.status !== 'vacant') {
            return { valid: false, error: `Room is not available. Current status: ${room.status}` };
        }

        return { valid: true, room };
    }

    /**
     * Book a tenant into a room.
     * 
     * @param {Object} requestData - Validated booking data
     * @returns {Promise<Object>} Standardized response
     */
    async bookTenant(requestData) {
        try {
            // ── Step 1: Validate input ──
            const validation = TenantBookingDTO.validate(requestData);
            if (!validation.valid) {
                return {
                    success: false,
                    statusCode: 400,
                    ...TenantBookingDTO.formatErrorResponse('Validation failed', validation.errors)
                };
            }

            // ── Step 2: Verify room exists and is vacant ──
            const roomCheck = await this.verifyRoom(requestData.room_id);
            if (!roomCheck.valid) {
                return {
                    success: false,
                    statusCode: 400,
                    ...TenantBookingDTO.formatErrorResponse(roomCheck.error)
                };
            }

            // ── Step 3: Prepare data and create tenant ──
            const dbData = TenantBookingDTO.prepareForDb(requestData);
            const tenantResult = await TenantService.createTenant(dbData);

            if (!tenantResult.success) {
                return {
                    success: false,
                    statusCode: 500,
                    ...TenantBookingDTO.formatErrorResponse('Failed to create tenant', tenantResult.error)
                };
            }

            const tenant = tenantResult.data;

            // ── Step 4: Update room status to 'occupied' ──
            const roomUpdateResult = await RoomService.updateRoomStatus(
                requestData.room_id,
                'occupied'
            );

            if (!roomUpdateResult.success) {
                // Log but don't fail — tenant was already created
                console.error(
                    '[TenantBooking] Failed to update room status to occupied:',
                    roomUpdateResult.error
                );
            }

            // ── Step 5: Return success response ──
            return {
                success: true,
                statusCode: 201,
                ...TenantBookingDTO.formatSuccessResponse(tenant, roomCheck.room)
            };

        } catch (error) {
            console.error('[TenantBookingService] Unexpected error:', error);
            return {
                success: false,
                statusCode: 500,
                ...TenantBookingDTO.formatErrorResponse('Internal server error', error.message)
            };
        }
    }
}

module.exports = new TenantBookingService();
