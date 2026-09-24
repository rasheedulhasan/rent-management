/**
 * One-off importer: builds buildings / rooms / tenants from the rent collection
 * spreadsheets at the project root.
 *
 * Mapping (per the business rules):
 *   - Sheet            -> FLAT inside a building (sheet name = flat no, e.g. 1006)
 *   - "Pertition No."  -> ROOM          (room_number = "<flat>-<partition>", e.g. "1006-3L")
 *   - "CUSTOMER NAME"  -> TENANT        (full_name)
 *   - "ADVANCE"        -> security deposit
 *   - "RENT"           -> monthly_rent
 *   - floor is derived from the flat number (1006 -> floor 10, 607 -> floor 6)
 *
 * Safety:
 *   - Dumps every table to backups/<timestamp>/ BEFORE deleting anything.
 *   - Does NOT touch the `users` table (keeps logins).
 *   - Idempotent: re-running re-creates the same buildings/rooms/tenants.
 *
 * Usage: node scripts/import-sheets.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('../src/config/db');

const FILES = ['Sheikha Noora -May-2026.xlsx', 'JULY 26.xlsx'];

const TABLES_TO_BACKUP = [
    'buildings',
    'rooms',
    'tenants',
    'rent_ledger',
    'rent_transactions',
    'tenant_deposit_transactions'
];

const DELETE_ORDER = [
    'rent_transactions',
    'rent_ledger',
    'tenant_deposit_transactions',
    'tenants',
    'rooms',
    'buildings'
];

const uuid = () => require('crypto').randomUUID();
const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? null : n;
};
const txt = (v) => String(v === null || v === undefined ? '' : v).trim();

function floorFromFlat(flat) {
    const digits = String(flat).replace(/\D/g, '');
    if (digits.length <= 2) return parseInt(digits, 10) || 0;
    return parseInt(digits.slice(0, -2), 10) || 0;
}

function readSheet(file) {
    const wb = XLSX.readFile(file);
    const flats = [];

    for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', blankrows: false });

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 12); i++) {
            const j = (rows[i] || []).join('|').toLowerCase();
            if (j.includes('pertition') || j.includes('partition')) { headerIdx = i; break; }
        }
        if (headerIdx === -1) continue;

        // Building name sits on the row above the partition header (B column).
        let building = '';
        for (let i = headerIdx - 1; i >= 0 && i >= headerIdx - 3; i--) {
            const candidate = txt((rows[i] || [])[1]);
            if (candidate && !/buliding|building/i.test(candidate)) { building = candidate; break; }
            if (candidate) { building = candidate; break; }
        }

        const partitions = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const r = rows[i] || [];
            const partition = txt(r[0]);
            if (!partition || /total/i.test(partition)) break;
            partitions.push({
                partition,
                customer: txt(r[1]),
                mobile: txt(r[2]),
                nationality: txt(r[3]),
                advance: toNum(r[4]),
                rent: toNum(r[5]),
                paid: toNum(r[6]),
                checkIn: txt(r[7]),
                checkOut: txt(r[8]),
                remark: txt(r[9])
            });
        }

        flats.push({ sheet: sheetName, flat: txt(sheetName), building, partitions });
    }

    return flats;
}

async function backup() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join('backups', stamp);
    fs.mkdirSync(dir, { recursive: true });

    for (const table of TABLES_TO_BACKUP) {
        const res = await query(`SELECT * FROM ${table}`);
        fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(res.rows, null, 2));
        console.log(`  backed up ${table}: ${res.rows.length} row(s)`);
    }
    console.log(`  -> ${dir}`);
    return dir;
}

async function clean() {
    for (const table of DELETE_ORDER) {
        const res = await query(`DELETE FROM ${table}`);
        console.log(`  cleared ${table}: ${res.rowCount} row(s)`);
    }
}

async function main() {
    console.log('=== SHEET IMPORT ===\n');

    // 1. Parse all files up front (fail before touching the DB).
    const allFlats = [];
    for (const file of FILES) {
        if (!fs.existsSync(file)) {
            console.log(`(skipping missing file: ${file})`);
            continue;
        }
        const flats = readSheet(file);
        console.log(`${file}: ${flats.length} flat sheet(s)`);
        flats.forEach(f => allFlats.push({ ...f, source: file }));
    }

    const totalRooms = allFlats.reduce((n, f) => n + f.partitions.length, 0);
    const totalTenants = allFlats.reduce((n, f) => n + f.partitions.filter(p => p.customer).length, 0);
    console.log(`\nParsed: ${allFlats.length} flats, ${totalRooms} partitions (rooms), ${totalTenants} with a tenant name\n`);

    // 2. Backup
    console.log('--- Backing up existing data ---');
    await backup();

    // 3. Clean (keeps `users`)
    console.log('\n--- Clearing business data (users kept) ---');
    await clean();

    // 4. Insert
    console.log('\n--- Importing ---');
    const buildingCache = new Map();

    async function ensureBuilding(name) {
        if (buildingCache.has(name)) return buildingCache.get(name);
        const id = uuid();
        await query(
            `INSERT INTO buildings (id, name, address, total_floors, total_rooms, description, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, name, '', 0, 0, '', 'active']
        );
        buildingCache.set(name, id);
        console.log(`  + building "${name}"`);
        return id;
    }

    let roomCount = 0;
    let tenantCount = 0;
    let depositCount = 0;

    for (const flat of allFlats) {
        const buildingName = flat.building || path.basename(flat.source, path.extname(flat.source));
        const buildingId = await ensureBuilding(buildingName);
        const floor = floorFromFlat(flat.flat);

        for (const p of flat.partitions) {
            const roomId = uuid();
            const roomNumber = `${flat.flat}-${p.partition.replace(/\s+/g, '')}`;
            const hasTenant = Boolean(p.customer);

            await query(
                `INSERT INTO rooms (id, building_id, room_number, floor, type, monthly_rent, size, amenities, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    roomId,
                    buildingId,
                    roomNumber,
                    floor,
                    'partition',
                    p.rent === null ? 0 : p.rent,
                    '',
                    p.nationality ? `Nationality: ${p.nationality}` : '',
                    hasTenant ? 'occupied' : 'vacant'
                ]
            );
            roomCount++;

            if (hasTenant) {
                const tenantId = uuid();
                const checkIn = p.checkIn && !isNaN(new Date(p.checkIn).getTime())
                    ? new Date(p.checkIn).toISOString()
                    : new Date().toISOString();
                const billingDay = new Date(checkIn).getUTCDate();

                await query(
                    `INSERT INTO tenants
                        (id, room_id, full_name, phone_number, email, id_number, emergency_contact,
                         check_in_date, check_out_date, monthly_rent, security_deposit, billing_day, status, notes)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
                    [
                        tenantId,
                        roomId,
                        p.customer,
                        p.mobile || '',
                        '',
                        '',
                        '',
                        checkIn,
                        null,
                        p.rent === null ? 0 : p.rent,
                        p.advance === null ? 0 : p.advance,
                        billingDay,
                        'active',
                        [p.remark, p.nationality].filter(Boolean).join(' | ')
                    ]
                );
                tenantCount++;

                if (p.advance !== null && p.advance > 0) {
                    await query(
                        `INSERT INTO tenant_deposit_transactions
                            (id, tenant_id, amount, transaction_type, reference_type, reference_id, description, created_by)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                        [
                            uuid(), tenantId, p.advance, 'received', 'opening_balance', '',
                            'Opening security deposit (sheet import)', 'system'
                        ]
                    );
                    depositCount++;
                }
            }
        }

        // keep buildings total_rooms in sync (counted after inserts below)
    }

    // 5. Update buildings.total_rooms to the real room count
    await query(`
        UPDATE buildings b
        SET total_rooms = (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id),
            total_floors = COALESCE((SELECT MAX(r.floor) FROM rooms r WHERE r.building_id = b.id), 0)
    `);

    console.log('\n--- Summary ---');
    console.log(`  buildings: ${buildingCache.size}`);
    console.log(`  rooms:     ${roomCount}`);
    console.log(`  tenants:   ${tenantCount}`);
    console.log(`  deposits:  ${depositCount}`);

    await pool.end();
    process.exit(0);
}

main().catch(async (err) => {
    console.error('\nIMPORT FAILED:', err.message);
    console.error(err.stack);
    try { await pool.end(); } catch (_) { /* ignore */ }
    process.exit(1);
});
