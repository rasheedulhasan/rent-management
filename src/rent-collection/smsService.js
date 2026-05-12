/**
 * ============================================
 * SMS Service (Placeholder)
 * ============================================
 * 
 * Reusable SMS notification service.
 * Currently a placeholder — no actual SMS sent.
 * 
 * Future integrations:
 *   - Twilio / AWS SNS / local SMS gateway
 *   - WhatsApp receipt via Twilio or WATI
 *   - Receipt PDF via email
 * ============================================
 */

class SmsService {
    /**
     * Send an SMS receipt notification.
     * 
     * @param {Object} params
     * @param {string} params.phoneNumber - Recipient phone number
     * @param {string} params.tenantName  - Tenant display name
     * @param {string} params.receiptNumber - Generated receipt number
     * @param {number} params.amountPaid  - Amount paid
     * @param {string} params.paymentStatus - paid | partial | pending
     * @param {string} params.roomName    - Room identifier
     * 
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async sendReceiptSms({ phoneNumber, tenantName, receiptNumber, amountPaid, paymentStatus, roomName }) {
        // ── Placeholder: Log instead of sending ──
        console.log('[SMS Service] SMS receipt request received:', {
            to: phoneNumber,
            tenant: tenantName,
            receipt: receiptNumber,
            amount: amountPaid,
            status: paymentStatus,
            room: roomName
        });

        // TODO: Implement actual SMS sending via:
        //   - Twilio API
        //   - AWS SNS
        //   - Local SMS gateway provider
        // 
        // Example Twilio integration:
        //   const twilioClient = require('twilio')(accountSid, authToken);
        //   await twilioClient.messages.create({
        //       body: `Dear ${tenantName}, your rent payment of ${amountPaid} for ${roomName} has been received. Receipt: ${receiptNumber}`,
        //       from: smsFromNumber,
        //       to: phoneNumber
        //   });

        return {
            success: true,
            message: 'SMS receipt logged (placeholder — not actually sent)'
        };
    }

    /**
     * Send a WhatsApp receipt notification (future).
     * Placeholder for WhatsApp Business API / Twilio WhatsApp integration.
     */
    async sendWhatsAppReceipt(params) {
        console.log('[SMS Service] WhatsApp receipt request received (placeholder):', params);
        return {
            success: true,
            message: 'WhatsApp receipt logged (placeholder — not actually sent)'
        };
    }
}

module.exports = new SmsService();
