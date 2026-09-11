/**
 * TenantCsvService
 *
 * CSV template + bulk import for tenants.
 *
 * CSV columns (header row required, order-independent):
 *   full_name, phone_number, email, id_number, emergency_contact,
 *   check_in_date, check_out_date, monthly_rent, security_deposit,
 *   billing_day, status, room_number, building_name, notes
 *
 * - The room is identified by `room_number` + `building_name` (must already exist).
 * - Tenants are matched/upserted by `phone_number` (existing → update, new → insert).
 * - `billing_day` defaults to the day-of-month of `check_in_date`.
 * - Importing an `active` tenant marks its room `occupied`.
 */

const {
    ID,
    Query,
    databases,
    DATABASE_ID,
    TENANTS_COLLECTION_ID,
    ROOMS_COLLECTION_ID,
    BUILDINGS_COLLECTION_ID
} = require('../config/appwrite');
const { parseCsv } = require('../utils/csvParser');
const RoomService = require('./RoomService');

const VALID_STATUSES = ['active', 'inactive', 'moved_out'];

const TEMPLATE_HEADERS = [
    'full_name',
    'phone_number',
    'email',
    'id_number',
    'emergency_contact',
    'check_in_date',
    'check_out_date',
    'monthly_rent',
    'security_deposit',
    'billing_day',
    'status',
    'room_number',
    'building_name',
    'notes'
];

function csvEscape(value) {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

class TenantCsvService {
    /**
     * CSV template with the expected headers and a sample row.
     */
    getTemplate() {
        const sample = [
            'John Doe',
            '+971500000000',
            'john@example.com',
            '784-1234-5678901-2',
            '+971500000001',
            '2026-01-01',
            '',
            '3500',
            '2000',
            '1',
            'active',
            '101',
            'Al Noor Building',
            'Corner unit'
        ];
        return `${TEMPLATE_HEADERS.join(',')}\n${sample.join(',')}\n`;
    }

    /**
     * Export all tenants as CSV — same columns as the template, so the file can
     * be edited and re-imported.
     */
    async exportCsv() {
        const tenantsResult = await databases.listDocuments(
            DATABASE_ID,
            TENANTS_COLLECTION_ID,
            [],
            1000
        );
        const tenants = tenantsResult.documents || [];

        const roomCache = {};
        const buildingCache = {};
        const lines = [TEMPLATE_HEADERS.join(',')];

        for (const t of tenants) {
            let roomNumber = '';
            let buildingName = '';

            if (t.room_id) {
                if (!(t.room_id in roomCache)) {
                    try {
                        roomCache[t.room_id] = await databases.getDocument(
                            DATABASE_ID, ROOMS_COLLECTION_ID, t.room_id
                        );
                    } catch (e) {
                        roomCache[t.room_id] = null;
                    }
                }
                const room = roomCache[t.room_id];
                if (room) {
                    roomNumber = room.room_number || '';
                    if (room.building_id) {
                        if (!(room.building_id in buildingCache)) {
                            try {
                                const b = await databases.getDocument(
                                    DATABASE_ID, BUILDINGS_COLLECTION_ID, room.building_id
                                );
                                buildingCache[room.building_id] = b.name || '';
                            } catch (e) {
                                buildingCache[room.building_id] = '';
                            }
                        }
                        buildingName = buildingCache[room.building_id];
                    }
                }
            }

            lines.push([
                t.full_name,
                t.phone_number,
                t.email,
                t.id_number,
                t.emergency_contact,
                this._dateOnly(t.check_in_date),
                this._dateOnly(t.check_out_date),
                t.monthly_rent,
                t.security_deposit === undefined || t.security_deposit === null ? '' : t.security_deposit,
                t.billing_day === undefined || t.billing_day === null ? '' : t.billing_day,
                t.status,
                roomNumber,
                buildingName,
                t.notes
            ].map(csvEscape).join(','));
        }

        return lines.join('\n') + '\n';
    }

    _dateOnly(value) {
        if (!value) return '';
        const d = new Date(value);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    }

    /**
     * Import tenants from CSV text.
     * @returns { success, data?: { inserted, updated, failed, errors }, error? }
     */
    async importCsv(csvText) {
        if (!csvText || !csvText.trim()) {
            return { success: false, error: 'CSV file is empty' };
        }

        const rows = parseCsv(csvText);
        if (rows.length < 2) {
            return { success: false, error: 'CSV must contain a header row and at least one data row' };
        }

        const header = rows[0].map(h => String(h).trim().toLowerCase());
        const col = (name) => header.indexOf(name);

        const requiredCols = ['full_name', 'phone_number', 'room_number', 'building_name', 'monthly_rent', 'check_in_date'];
        const missing = requiredCols.filter(c => col(c) === -1);
        if (missing.length > 0) {
            return { success: false, error: `Missing required column(s): ${missing.join(', ')}` };
        }

        // building name (lowercase) -> id
        const buildingsResult = await databases.listDocuments(
            DATABASE_ID,
            BUILDINGS_COLLECTION_ID,
            [],
            500
        );
        const buildingMap = {};
        for (const b of buildingsResult.documents || []) {
            buildingMap[String(b.name || '').trim().toLowerCase()] = b.$id;
        }

        let inserted = 0;
        let updated = 0;
        let failed = 0;
        const errors = [];

        for (let r = 1; r < rows.length; r++) {
            const cells = rows[r];
            const get = (name) => {
                const i = col(name);
                return i === -1 ? '' : String(cells[i] ?? '').trim();
            };
            const lineNo = r + 1;

            const fullName = get('full_name');
            const phone = get('phone_number');
            const roomNumber = get('room_number');
            const buildingName = get('building_name');
            const rentRaw = get('monthly_rent');
            const checkInRaw = get('check_in_date');

            // ── required fields ──
            if (!fullName) { failed++; errors.push(`Line ${lineNo}: full_name is required`); continue; }
            if (!phone) { failed++; errors.push(`Line ${lineNo}: phone_number is required`); continue; }
            if (!buildingName) { failed++; errors.push(`Line ${lineNo}: building_name is required`); continue; }
            if (!roomNumber) { failed++; errors.push(`Line ${lineNo}: room_number is required`); continue; }

            const buildingId = buildingMap[buildingName.toLowerCase()];
            if (!buildingId) {
                failed++;
                errors.push(`Line ${lineNo}: unknown building "${buildingName}"`);
                continue;
            }

            // ── resolve the room ──
            const roomResult = await databases.listDocuments(
                DATABASE_ID,
                ROOMS_COLLECTION_ID,
                [
                    Query.equal('building_id', buildingId),
                    Query.equal('room_number', roomNumber)
                ],
                1
            );
            if (!roomResult.documents || roomResult.documents.length === 0) {
                failed++;
                errors.push(`Line ${lineNo}: room "${roomNumber}" not found in "${buildingName}"`);
                continue;
            }
            const roomId = roomResult.documents[0].$id;

            // ── validate numbers / dates ──
            const monthlyRent = parseFloat(rentRaw);
            if (isNaN(monthlyRent) || monthlyRent < 0) {
                failed++;
                errors.push(`Line ${lineNo}: invalid monthly_rent "${rentRaw}"`);
                continue;
            }

            const checkIn = new Date(checkInRaw);
            if (!checkInRaw || isNaN(checkIn.getTime())) {
                failed++;
                errors.push(`Line ${lineNo}: invalid check_in_date "${checkInRaw}" (use YYYY-MM-DD)`);
                continue;
            }

            let checkOut = null;
            const checkOutRaw = get('check_out_date');
            if (checkOutRaw) {
                const d = new Date(checkOutRaw);
                if (isNaN(d.getTime())) {
                    failed++;
                    errors.push(`Line ${lineNo}: invalid check_out_date "${checkOutRaw}"`);
                    continue;
                }
                checkOut = d.toISOString();
            }

            const status = (get('status') || 'active').toLowerCase();
            if (!VALID_STATUSES.includes(status)) {
                failed++;
                errors.push(`Line ${lineNo}: invalid status "${status}" (allowed: ${VALID_STATUSES.join(', ')})`);
                continue;
            }

            const depositRaw = get('security_deposit');
            let deposit = null;
            if (depositRaw !== '') {
                deposit = parseFloat(depositRaw);
                if (isNaN(deposit) || deposit < 0) {
                    failed++;
                    errors.push(`Line ${lineNo}: invalid security_deposit "${depositRaw}"`);
                    continue;
                }
            }

            const billingRaw = get('billing_day');
            const billingDay = billingRaw ? parseInt(billingRaw, 10) : checkIn.getUTCDate();
            if (isNaN(billingDay) || billingDay < 1 || billingDay > 31) {
                failed++;
                errors.push(`Line ${lineNo}: invalid billing_day "${billingRaw}"`);
                continue;
            }

            const data = {
                room_id: roomId,
                full_name: fullName,
                phone_number: phone,
                email: get('email') || '',
                id_number: get('id_number') || '',
                emergency_contact: get('emergency_contact') || '',
                check_in_date: checkIn.toISOString(),
                check_out_date: checkOut,
                monthly_rent: monthlyRent,
                security_deposit: deposit,
                billing_day: billingDay,
                status,
                notes: get('notes') || ''
            };

            try {
                // Upsert by phone_number
                const existing = await databases.listDocuments(
                    DATABASE_ID,
                    TENANTS_COLLECTION_ID,
                    [Query.equal('phone_number', phone)],
                    1
                );

                if (existing.documents && existing.documents.length > 0) {
                    await databases.updateDocument(
                        DATABASE_ID,
                        TENANTS_COLLECTION_ID,
                        existing.documents[0].$id,
                        data
                    );
                    updated++;
                } else {
                    await databases.createDocument(
                        DATABASE_ID,
                        TENANTS_COLLECTION_ID,
                        ID.unique(),
                        data
                    );
                    inserted++;
                }

                // Keep room occupancy in sync: an active tenant occupies its room.
                if (status === 'active') {
                    try {
                        await RoomService.updateRoomStatus(roomId, 'occupied');
                    } catch (e) {
                        // non-fatal
                    }
                }
            } catch (e) {
                failed++;
                errors.push(`Line ${lineNo}: ${e.message}`);
            }
        }

        return {
            success: true,
            data: { inserted, updated, failed, errors, total: rows.length - 1 }
        };
    }
}

module.exports = new TenantCsvService();
