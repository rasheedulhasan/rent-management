/**
 * Seed a placeholder tenant for every room that has NO active tenant.
 *
 * Format (per business request):
 *   full_name     = "<room number without spaces/dashes> Tenant"   e.g. 115-C -> "115C Tenant"
 *   phone_number  = 500000000   (same for all)
 *   monthly_rent  = 1000
 *   billing_day   = 1
 *   security_deposit = 0
 *   status        = 'active'
 *
 * Existing tenants are NEVER touched/overwritten — only rooms with no active
 * tenant get a placeholder. The room is then marked 'occupied'.
 *
 * Idempotent: re-running finds only the rooms that are still vacant.
 *
 * Usage: node scripts/seed-missing-tenants.js
 */

require('dotenv').config();
const { query, pool, generateId, withTransaction } = require('../src/config/db');

const PLACEHOLDER_PHONE = '500000000';
const PLACEHOLDER_RENT = 1000;

const tenantNameFor = (roomNumber) =>
    `${String(roomNumber).replace(/[^A-Za-z0-9]/g, '')} Tenant`;

async function main() {
    console.log('=== SEED MISSING TENANTS ===\n');

    const vacant = await query(`
        SELECT r.id, r.room_number, r.building_id, b.name AS building_name
        FROM rooms r
        LEFT JOIN buildings b ON b.id = r.building_id
        WHERE NOT EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.room_id = r.id AND t.status = 'active'
        )
        ORDER BY b.name, r.room_number
    `);

    console.log(`Rooms with no active tenant: ${vacant.rows.length}`);
    if (vacant.rows.length > 0) {
        console.log('Sample of names that will be created:');
        vacant.rows.slice(0, 5).forEach(r =>
            console.log(`   room ${r.room_number}  ->  "${tenantNameFor(r.room_number)}"`)
        );
    }

    if (vacant.rows.length === 0) {
        console.log('Nothing to do.');
        await pool.end();
        return;
    }

    const result = await withTransaction(async () => {
        let created = 0;
        const nowIso = new Date().toISOString();

        for (const room of vacant.rows) {
            const tenantId = generateId();
            await query(
                `INSERT INTO tenants
                    (id, room_id, full_name, phone_number, email, id_number, emergency_contact,
                     check_in_date, check_out_date, monthly_rent, security_deposit, billing_day, status, notes)
                 VALUES ($1,$2,$3,$4,'','','',$5,NULL,$6,0,1,'active','placeholder')`,
                [
                    tenantId,
                    room.id,
                    tenantNameFor(room.room_number),
                    PLACEHOLDER_PHONE,
                    nowIso,
                    PLACEHOLDER_RENT
                ]
            );

            await query(`UPDATE rooms SET status = 'occupied', updated_at = now() WHERE id = $1`, [room.id]);
            created++;
        }

        return created;
    });

    console.log(`\nCreated ${result} placeholder tenant(s).`);

    const totals = await query(`
        SELECT
          (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenants,
          (SELECT COUNT(*) FROM rooms WHERE status = 'occupied') AS occupied_rooms,
          (SELECT COUNT(*) FROM rooms WHERE status = 'vacant')   AS vacant_rooms,
          (SELECT COUNT(*) FROM rooms)                           AS total_rooms
    `);
    console.log('\nAfter:');
    console.table(totals.rows);

    console.log('Sample:');
    const sample = await query(`
        SELECT t.full_name, t.phone_number, t.monthly_rent, r.room_number
        FROM tenants t JOIN rooms r ON r.id = t.room_id
        WHERE t.notes = 'placeholder'
        ORDER BY r.room_number LIMIT 8
    `);
    console.table(sample.rows);

    await pool.end();
    process.exit(0);
}

main().catch(async (err) => {
    console.error('FAILED:', err.message);
    try { await pool.end(); } catch (_) { /* ignore */ }
    process.exit(1);
});
