/**
 * RoomCsvService
 *
 * CSV template + bulk import for rooms.
 *
 * CSV columns (header row required, order-independent):
 *   room_number, building_name, floor, type, monthly_rent, size, amenities, status
 *
 * - `room_number` + `building_name` identify the room (used as the upsert key).
 * - Existing rooms (same building + room number) are UPDATED, new ones are INSERTED.
 * - `building_name` must match an existing building (case-insensitive).
 */

const {
    ID,
    Query,
    databases,
    DATABASE_ID,
    ROOMS_COLLECTION_ID,
    BUILDINGS_COLLECTION_ID
} = require('../config/appwrite');

const VALID_STATUSES = ['vacant', 'occupied', 'under_maintenance'];

const TEMPLATE_HEADERS = [
    'room_number',
    'building_name',
    'floor',
    'type',
    'monthly_rent',
    'size',
    'amenities',
    'status'
];

/**
 * Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas,
 * escaped quotes, CRLF and a UTF-8 BOM).
 */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    // Strip BOM
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
            continue;
        }

        if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (c === '\r') {
            // ignore
        } else {
            field += c;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    // Drop fully-empty rows
    return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

class RoomCsvService {
    /**
     * CSV template with the expected headers and a sample row.
     */
    getTemplate() {
        const sample = [
            '101',
            'Al Noor Building',
            '1',
            'apartment',
            '3500',
            '45 sqm',
            '"AC, WiFi, Furnished"',
            'vacant'
        ];
        return `${TEMPLATE_HEADERS.join(',')}\n${sample.join(',')}\n`;
    }

    /**
     * Import rooms from CSV text.
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

        const requiredCols = ['room_number', 'building_name', 'monthly_rent'];
        const missing = requiredCols.filter(c => col(c) === -1);
        if (missing.length > 0) {
            return { success: false, error: `Missing required column(s): ${missing.join(', ')}` };
        }

        // Build a case-insensitive building name -> id map.
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

            const lineNo = r + 1; // header is line 1
            const roomNumber = get('room_number');
            const buildingName = get('building_name');
            const monthlyRentRaw = get('monthly_rent');

            // ── validate ──
            if (!roomNumber) {
                failed++;
                errors.push(`Line ${lineNo}: room_number is required`);
                continue;
            }
            if (!buildingName) {
                failed++;
                errors.push(`Line ${lineNo}: building_name is required`);
                continue;
            }
            const buildingId = buildingMap[buildingName.toLowerCase()];
            if (!buildingId) {
                failed++;
                errors.push(`Line ${lineNo}: unknown building "${buildingName}"`);
                continue;
            }
            const monthlyRent = parseFloat(monthlyRentRaw);
            if (isNaN(monthlyRent) || monthlyRent < 0) {
                failed++;
                errors.push(`Line ${lineNo}: invalid monthly_rent "${monthlyRentRaw}"`);
                continue;
            }

            const floor = parseInt(get('floor'), 10);
            const status = (get('status') || 'vacant').toLowerCase();
            if (!VALID_STATUSES.includes(status)) {
                failed++;
                errors.push(`Line ${lineNo}: invalid status "${status}" (allowed: ${VALID_STATUSES.join(', ')})`);
                continue;
            }

            const data = {
                room_number: roomNumber,
                building_id: buildingId,
                floor: isNaN(floor) ? 0 : floor,
                type: get('type') || 'apartment',
                monthly_rent: monthlyRent,
                size: get('size') || '',
                amenities: get('amenities') || '',
                status
            };

            try {
                // Upsert by (building_id, room_number)
                const existing = await databases.listDocuments(
                    DATABASE_ID,
                    ROOMS_COLLECTION_ID,
                    [
                        Query.equal('building_id', buildingId),
                        Query.equal('room_number', roomNumber)
                    ],
                    1
                );

                if (existing.documents && existing.documents.length > 0) {
                    await databases.updateDocument(
                        DATABASE_ID,
                        ROOMS_COLLECTION_ID,
                        existing.documents[0].$id,
                        data
                    );
                    updated++;
                } else {
                    await databases.createDocument(
                        DATABASE_ID,
                        ROOMS_COLLECTION_ID,
                        ID.unique(),
                        data
                    );
                    inserted++;
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

module.exports = new RoomCsvService();
