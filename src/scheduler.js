'use strict';

/**
 * Monthly rent rollover scheduler.
 *
 * Uses node-cron to run the rollover at 12:00 AM on the 1st of every month,
 * in the configured timezone (default Asia/Kolkata).
 *
 * Env overrides:
 *   RENT_TZ   - IANA timezone name (default Asia/Kolkata)
 *   RENT_CRON - cron expression (default "0 0 1 * *")
 */

const cron = require('node-cron');
const RentLedgerCycleService = require('./services/RentLedgerCycleService');

const TIMEZONE = process.env.RENT_TZ || 'Asia/Kolkata';
const CRON_EXPR = process.env.RENT_CRON || '0 0 1 * *';

let task = null;

function startScheduler() {
    if (task) {
        console.log('[Scheduler] Already started.');
        return;
    }

    if (!cron.validate(CRON_EXPR)) {
        console.error(`[Scheduler] Invalid cron expression: "${CRON_EXPR}". Scheduler NOT started.`);
        return;
    }

    task = cron.schedule(CRON_EXPR, () => {
        console.log(`[Scheduler] Running monthly rent rollover (${CRON_EXPR} ${TIMEZONE})`);
        RentLedgerCycleService.processMonthlyRollover()
            .then((res) => console.log('[Scheduler] Rollover result:', JSON.stringify(res)))
            .catch((err) => console.error('[Scheduler] Rollover failed:', err));
    }, { timezone: TIMEZONE });

    console.log(`[Scheduler] Monthly rollover scheduled at "${CRON_EXPR}" (${TIMEZONE})`);
}

function stopScheduler() {
    if (task) {
        task.destroy();
        task = null;
        console.log('[Scheduler] Stopped.');
    }
}

// Manual triggers (for tests / CLI)
function runNow(month, year) {
    return RentLedgerCycleService.processMonthlyRollover(month, year);
}

function runCatchUp() {
    return RentLedgerCycleService.catchUpMissedMonths();
}

module.exports = { startScheduler, stopScheduler, runNow, runCatchUp };
