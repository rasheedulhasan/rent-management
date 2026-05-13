/**
 * =============================================================================
 * RENT PAYMENT STATE UPDATE — Appwrite Cloud Function
 * =============================================================================
 *
 * PURPOSE:
 *   When a collector records a successful rent payment (creating a transaction
 *   document in the 'rent_transactions' collection), this function performs an
 *   atomic-like state update on the dedicated 'rent_ledger' collection.
 *
 *   The 'rent_ledger' collection is a time-based ledger that tracks each
 *   tenant's monthly rent cycle. Each row represents one month of rent for one
 *   tenant in one room. The ledger starts with status="pending" and is flipped
 *   to "paid" when a matching transaction is recorded.
 *
 *   This decouples the audit trail (transactions) from the state machine
 *   (ledger), allowing the mobile app to fast-query:
 *     Query.equal("status", "pending")
 *   and get only the items that still need payment — paid items automatically
 *   drop off the "pending rent" list.
 *
 * EXECUTION FLOWS:
 *   Flow A — Event Webhook Trigger:
 *     Fires automatically on `databases.69e5580f00087e980ef3.collections.
 *     rent_transactions.documents.create`. The function reads the new document
 *     from the event payload and processes it.
 *
 *   Flow B — Direct API Call (functions.createExecution()):
 *     Accepts a JSON payload with { tenantId, roomId, rentPeriod, amountPaid,
 *     paymentMethod }. The function queries for the matching pending ledger
 *     record and updates it.
 *
 * DATA TRANSITION (Logical Flow):
 *   Transaction Created (payment_status="paid")
 *     ↓
 *   Function extracts: tenant_id, room_id, rent_period (from period_month/year)
 *     ↓
 *   Queries rent_ledger WHERE tenant_id=X AND rent_period="2026-05" AND status="pending"
 *     ↓
 *   Updates that ledger row: status="paid", amount_paid=..., paid_at=now()
 *     ↓
 *   Mobile app queries rent_ledger WHERE status="pending" → paid items are gone
 *
 * DEPENDENCIES:
 *   - node-appwrite (bundled in the Appwrite runtime)
 *   - No external third-party packages
 *
 * ENVIRONMENT VARIABLES (set via Appwrite Console → Function → Settings):
 *   APPWRITE_ENDPOINT              — e.g. https://fra.cloud.appwrite.io/v1
 *   APPWRITE_FUNCTION_PROJECT_ID   — Injected automatically by the runtime
 *   APPWRITE_DATABASE_ID           — "69e5580f00087e980ef3"
 *   RENT_LEDGER_COLLECTION_ID      — "rent_ledger"
 * =============================================================================
 */

const { Client, Databases, Query } = require('node-appwrite');

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PAYMENT_METHODS = ['cash', 'online', 'bank_transfer', 'cheque'];

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — Build the Appwrite SDK client with the function's execution key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises an authenticated Appwrite SDK client using the runtime-injected
 * API key. Every Appwrite Cloud Function automatically receives an execution
 * key scoped to the function's configured permissions.
 */
function createClient() {
    const client = new Client()
        .setEndpoint(
            process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1'
        )
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    return client;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — Resolve collection IDs from environment or fallback
// ─────────────────────────────────────────────────────────────────────────────

function getCollectionIds() {
    return {
        databaseId:
            process.env.APPWRITE_DATABASE_ID || '69e5580f00087e980ef3',
        ledgerCollectionId:
            process.env.RENT_LEDGER_COLLECTION_ID || 'rent_ledger',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — Build a standardised JSON response
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a consistently shaped response object that Appwrite execution logs
 * and calling clients can parse reliably.
 *
 * @param {'success'|'error'} status
 * @param {string}             message  Human-readable summary
 * @param {Object|null}        data     Optional payload (updated document, etc.)
 * @param {string|null}        errorCode Optional machine-readable error code
 */
function buildResponse(status, message, data = null, errorCode = null) {
    const body = {
        status,
        message,
        timestamp: new Date().toISOString(),
    };
    if (data) body.data = data;
    if (errorCode) body.errorCode = errorCode;

    return {
        statusCode: status === 'success' ? 200 : 500,
        body: JSON.stringify(body, null, 2),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — Build a rent_period string from month and year
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts numeric month/year into the canonical rent_period string format
 * used by the rent_ledger collection: "YYYY-MM" (e.g. "2026-05").
 *
 * @param {number} month  (1-12)
 * @param {number} year   (e.g. 2026)
 * @returns {string} Formatted period string
 */
function buildRentPeriod(month, year) {
    const mm = String(month).padStart(2, '0');
    return `${year}-${mm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CORE LOGIC — Update the rent_ledger row from "pending" to "paid"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomic-like state update on the rent_ledger collection.
 *
 * Given a validated payment event, this function:
 *   1. Builds the rent_period string (e.g. "2026-05") from month/year.
 *   2. Queries the rent_ledger collection for a document matching the exact
 *      tenant_id + rent_period with status = "pending".
 *   3. If found, updates that ledger row:
 *        status       → "paid"
 *        amount_paid  → the amount from the transaction
 *        paid_at      → current timestamp
 *        payment_method → from the transaction
 *        transaction_id → the $id of the transaction that triggered this
 *   4. If NOT found, logs a warning — the record may have been updated already
 *      (idempotency) or the pending ledger row may not exist yet.
 *
 * @param {Databases} databases    — Appwrite Databases SDK instance
 * @param {string}    databaseId   — Target database ID
 * @param {string}    ledgerCollectionId — rent_ledger collection ID
 * @param {Object}    payment      — Normalised payment details
 * @param {string}    payment.tenantId
 * @param {string}    payment.roomId
 * @param {number}    payment.periodMonth
 * @param {number}    payment.periodYear
 * @param {number}    payment.amountPaid
 * @param {string}    payment.paymentMethod
 * @param {string}    [payment.transactionId] — The source transaction $id
 * @param {string}    [payment.collectedBy]
 * @param {string}    [payment.receiptNumber]
 *
 * @returns {Promise<Object>} { success, document|null, error }
 */
async function updateLedgerToPaid(
    databases,
    databaseId,
    ledgerCollectionId,
    payment
) {
    const {
        tenantId,
        roomId,
        periodMonth,
        periodYear,
        amountPaid,
        paymentMethod,
        transactionId,
        collectedBy,
        receiptNumber,
    } = payment;

    // Build the canonical rent_period string
    const rentPeriod = buildRentPeriod(periodMonth, periodYear);

    // ── Step 1: Query for the matching pending ledger row ────────────────
    // We search for a document in rent_ledger that has the exact tenant + period
    // and is still in "pending" status. This is the row that was created when
    // the rent period started (e.g. by a cron job or tenant booking flow).
    const queries = [
        Query.equal('tenant_id', tenantId),
        Query.equal('rent_period', rentPeriod),
        Query.equal('status', 'pending'),
        Query.limit(1), // There should be at most one pending row per tenant/period
    ];

    let pendingDocs;
    try {
        pendingDocs = await databases.listDocuments(
            databaseId,
            ledgerCollectionId,
            queries
        );
    } catch (err) {
        console.error(
            `[CRITICAL] Failed to query rent_ledger for tenant=${tenantId}, ` +
            `period=${rentPeriod}: ${err.message}`
        );
        return {
            success: false,
            document: null,
            error: `Ledger query failed: ${err.message}`,
        };
    }

    const pendingLedgerRow =
        Array.isArray(pendingDocs.documents) && pendingDocs.documents.length > 0
            ? pendingDocs.documents[0]
            : null;

    if (!pendingLedgerRow) {
        // No pending ledger row found — this could mean:
        //   a) The payment was already processed (idempotency — the row is
        //      already "paid").
        //   b) The pending ledger row was never created for this period.
        //   c) The tenant_id or rent_period don't match any existing row.
        console.warn(
            `[WARN] No pending ledger row found for tenant=${tenantId}, ` +
            `period=${rentPeriod}. The record may have been updated already ` +
            `or does not exist in the rent_ledger collection.`
        );
        return {
            success: true, // Not a failure — the system is idempotent
            document: null,
            error: null,
        };
    }

    // ── Step 2: Build the update payload ─────────────────────────────────
    const now = new Date().toISOString();
    const updateData = {
        status: 'paid',
        amount_paid: amountPaid,
        paid_at: now,
        payment_method: paymentMethod,
    };

    // Link back to the source transaction for full audit trail
    if (transactionId) {
        updateData.transaction_id = transactionId;
    }

    // If the caller provided a collector reference, store it in notes
    if (collectedBy) {
        updateData.notes = `Collected by: ${collectedBy}` +
            (receiptNumber ? ` | Receipt: ${receiptNumber}` : '');
    } else if (receiptNumber) {
        updateData.notes = `Receipt: ${receiptNumber}`;
    }

    // ── Step 3: Perform the update ───────────────────────────────────────
    let updatedDocument;
    try {
        updatedDocument = await databases.updateDocument(
            databaseId,
            ledgerCollectionId,
            pendingLedgerRow.$id,
            updateData
        );
    } catch (err) {
        console.error(
            `[SEVERE] Failed to update rent_ledger row ` +
            `(${pendingLedgerRow.$id}) for tenant=${tenantId}, ` +
            `period=${rentPeriod}: ${err.message}`
        );
        return {
            success: false,
            document: null,
            error: `Ledger update failed: ${err.message}`,
        };
    }

    console.log(
        `[OK] Ledger row ${pendingLedgerRow.$id} updated: ` +
        `"pending" → "paid", amount=${amountPaid}, method=${paymentMethod}, ` +
        `period=${rentPeriod}`
    );

    return {
        success: true,
        document: updatedDocument,
        error: null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  FLOW A — Parse event webhook payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts payment details from an Appwrite Event Webhook payload.
 *
 * The webhook fires when a document is created in the rent_transactions
 * collection. The new document is available under
 * `eventPayload.documents[0]`.
 *
 * This parser extracts the fields needed to update the rent_ledger:
 *   - tenant_id, room_id → to identify the tenant/room
 *   - period_month, period_year → to build the rent_period string
 *   - amount, payment_method → to record the payment details
 *   - $id → to link the ledger row back to the source transaction
 *
 * @param {Object} eventPayload — The raw webhook body
 * @returns {Object|null} Normalised payment object or null if invalid
 */
function parseWebhookEvent(eventPayload) {
    try {
        // The webhook delivers an array of affected documents
        const documents = eventPayload?.documents;
        if (!Array.isArray(documents) || documents.length === 0) {
            console.warn('[WARN] Webhook payload contains no documents array.');
            return null;
        }

        const doc = documents[0]; // The newly created transaction

        // Validate that this is a "paid" transaction (we only react to payments)
        if (doc.payment_status !== 'paid') {
            console.log(
                `[SKIP] Transaction ${doc.$id} has payment_status="${doc.payment_status}", ` +
                `not "paid". Skipping.`
            );
            return null;
        }

        // Extract and validate required fields
        const tenantId = doc.tenant_id;
        const roomId = doc.room_id;
        const periodMonth = doc.period_month;
        const periodYear = doc.period_year;
        const amountPaid = doc.amount;
        const paymentMethod = doc.payment_method;
        const transactionId = doc.$id;
        const collectedBy = doc.collected_by || null;
        const receiptNumber = doc.receipt_number || null;

        if (!tenantId || !roomId || !periodMonth || !periodYear || !amountPaid) {
            console.warn(
                `[WARN] Webhook transaction ${doc.$id} is missing required fields. ` +
                `tenantId=${tenantId}, roomId=${roomId}, ` +
                `period=${periodMonth}/${periodYear}, amount=${amountPaid}`
            );
            return null;
        }

        return {
            tenantId,
            roomId,
            periodMonth,
            periodYear,
            amountPaid,
            paymentMethod,
            transactionId,
            collectedBy,
            receiptNumber,
        };
    } catch (err) {
        console.error(`[ERROR] Failed to parse webhook payload: ${err.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FLOW B — Parse direct execution payload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts and validates payment details from a direct `createExecution()` call.
 *
 * Expected payload structure:
 * {
 *   "tenantId":     "<string>",
 *   "roomId":       "<string>",
 *   "rentPeriod":   "<YYYY-MM>",  // e.g. "2026-05"
 *   "amountPaid":   1234.56,
 *   "paymentMethod": "cash" | "online" | "bank_transfer" | "cheque"
 * }
 *
 * @param {Object} payload — The parsed JSON body from the execution request
 * @returns {Object|null} Normalised payment object or null if invalid
 */
function parseDirectPayload(payload) {
    try {
        if (!payload || typeof payload !== 'object') {
            console.warn('[WARN] Direct execution payload is empty or not an object.');
            return null;
        }

        const {
            tenantId,
            roomId,
            rentPeriod,
            amountPaid,
            paymentMethod,
        } = payload;

        // ── Validate required fields ──────────────────────────────────────
        const missing = [];
        if (!tenantId) missing.push('tenantId');
        if (!roomId) missing.push('roomId');
        if (!rentPeriod) missing.push('rentPeriod');
        if (amountPaid === undefined || amountPaid === null) missing.push('amountPaid');
        if (!paymentMethod) missing.push('paymentMethod');

        if (missing.length > 0) {
            console.warn(
                `[WARN] Direct payload missing required fields: ${missing.join(', ')}`
            );
            return null;
        }

        // ── Validate amount ───────────────────────────────────────────────
        const parsedAmount = parseFloat(amountPaid);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            console.warn(
                `[WARN] Invalid amountPaid: "${amountPaid}". Must be a positive number.`
            );
            return null;
        }

        // ── Validate payment method ───────────────────────────────────────
        if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
            console.warn(
                `[WARN] Invalid paymentMethod: "${paymentMethod}". ` +
                `Must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`
            );
            return null;
        }

        // ── Parse rentPeriod (format: "YYYY-MM", e.g. "2026-05") ──────────
        const periodParts = String(rentPeriod).split('-');
        if (periodParts.length !== 2) {
            console.warn(
                `[WARN] Invalid rentPeriod format: "${rentPeriod}". ` +
                `Expected "YYYY-MM" (e.g. "2026-05").`
            );
            return null;
        }

        const periodYear = parseInt(periodParts[0], 10);
        const periodMonth = parseInt(periodParts[1], 10);

        if (
            isNaN(periodMonth) ||
            periodMonth < 1 ||
            periodMonth > 12 ||
            isNaN(periodYear) ||
            periodYear < 2000
        ) {
            console.warn(
                `[WARN] Invalid period values from rentPeriod="${rentPeriod}": ` +
                `month=${periodMonth}, year=${periodYear}`
            );
            return null;
        }

        return {
            tenantId,
            roomId,
            periodMonth,
            periodYear,
            amountPaid: parsedAmount,
            paymentMethod,
            transactionId: payload.transactionId || null,
            collectedBy: payload.collectedBy || null,
            receiptNumber: payload.receiptNumber || null,
        };
    } catch (err) {
        console.error(`[ERROR] Failed to parse direct payload: ${err.message}`);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ENTRYPOINT — Called by the Appwrite runtime on each execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appwrite Cloud Function entrypoint.
 *
 * The runtime injects:
 *   - `req`  — { headers, payload (string), scheme, method, host, path, query }
 *   - `res`  — { send(text, status), json(obj, status), redirect(url, status) }
 *   - `log`  — (msg) => void  (Appwrite execution log)
 *   - `error`— (msg) => void  (Appwrite execution error log)
 *
 * The function auto-detects which flow triggered it:
 *   - If `req.headers['x-appwrite-event']` is present → Flow A (Webhook)
 *   - Otherwise → Flow B (Direct API call)
 */
module.exports = async function (req, res) {
    // ── Initialise SDK ────────────────────────────────────────────────────
    let client, databases, ids;
    try {
        client = createClient();
        databases = new Databases(client);
        ids = getCollectionIds();
    } catch (err) {
        console.error(`[FATAL] Failed to initialise Appwrite SDK: ${err.message}`);
        return res.json(
            buildResponse('error', 'SDK initialisation failed', null, 'SDK_INIT_ERROR'),
            500
        );
    }

    const { databaseId, ledgerCollectionId } = ids;

    // ── Detect execution flow ─────────────────────────────────────────────
    const isWebhook = Boolean(req.headers['x-appwrite-event']);
    let payment = null;
    let flowLabel = '';

    try {
        if (isWebhook) {
            // ── Flow A: Event Webhook ─────────────────────────────────────
            flowLabel = 'webhook';

            // The webhook body arrives as a JSON string in req.payload
            let eventPayload;
            try {
                eventPayload = JSON.parse(req.payload || '{}');
            } catch (parseErr) {
                console.error(
                    `[ERROR] Failed to parse webhook payload JSON: ${parseErr.message}`
                );
                return res.json(
                    buildResponse(
                        'error',
                        'Invalid webhook payload JSON',
                        null,
                        'INVALID_JSON'
                    ),
                    400
                );
            }

            payment = parseWebhookEvent(eventPayload);

            if (!payment) {
                // parseWebhookEvent already logged the reason.
                // Return 200 so Appwrite doesn't retry the webhook.
                return res.json(
                    buildResponse(
                        'success',
                        'Webhook event skipped (not a paid transaction or missing fields)'
                    ),
                    200
                );
            }

            console.log(
                `[FLOW A] Webhook triggered for tenant=${payment.tenantId}, ` +
                `period=${buildRentPeriod(payment.periodMonth, payment.periodYear)}`
            );
        } else {
            // ── Flow B: Direct API Call ───────────────────────────────────
            flowLabel = 'direct';

            let payload;
            try {
                payload = JSON.parse(req.payload || '{}');
            } catch (parseErr) {
                console.error(
                    `[ERROR] Failed to parse direct execution payload JSON: ${parseErr.message}`
                );
                return res.json(
                    buildResponse(
                        'error',
                        'Invalid execution payload JSON',
                        null,
                        'INVALID_JSON'
                    ),
                    400
                );
            }

            payment = parseDirectPayload(payload);

            if (!payment) {
                return res.json(
                    buildResponse(
                        'error',
                        'Invalid or incomplete payment payload. ' +
                        'Required: tenantId, roomId, rentPeriod (format "YYYY-MM"), ' +
                        'amountPaid, paymentMethod',
                        null,
                        'VALIDATION_ERROR'
                    ),
                    400
                );
            }

            console.log(
                `[FLOW B] Direct execution for tenant=${payment.tenantId}, ` +
                `period=${buildRentPeriod(payment.periodMonth, payment.periodYear)}`
            );
        }

        // ──────────────────────────────────────────────────────────────────
        //  EXECUTE THE LEDGER STATE UPDATE
        // ──────────────────────────────────────────────────────────────────
        const result = await updateLedgerToPaid(
            databases,
            databaseId,
            ledgerCollectionId,
            payment
        );

        if (!result.success) {
            // The update failed — this is a severe error that needs attention
            console.error(
                `[SEVERE] Ledger state update failed for flow=${flowLabel}, ` +
                `tenant=${payment.tenantId}, ` +
                `period=${buildRentPeriod(payment.periodMonth, payment.periodYear)}: ` +
                `${result.error}`
            );

            return res.json(
                buildResponse(
                    'error',
                    `Ledger state update failed: ${result.error}`,
                    {
                        tenantId: payment.tenantId,
                        periodMonth: payment.periodMonth,
                        periodYear: payment.periodYear,
                        amountPaid: payment.amountPaid,
                        flow: flowLabel,
                    },
                    'LEDGER_UPDATE_FAILED'
                ),
                500
            );
        }

        // ── Success ───────────────────────────────────────────────────────
        const responseData = {
            tenantId: payment.tenantId,
            rentPeriod: buildRentPeriod(payment.periodMonth, payment.periodYear),
            amountPaid: payment.amountPaid,
            paymentMethod: payment.paymentMethod,
            flow: flowLabel,
            updatedLedgerRowId: result.document ? result.document.$id : null,
            previousStatus: 'pending',
            newStatus: 'paid',
        };

        if (!result.document) {
            // No pending ledger row was found — the system is idempotent
            responseData.note =
                'No pending ledger row needed updating (already processed or not found).';
        }

        console.log(
            `[SUCCESS] Flow=${flowLabel} | tenant=${payment.tenantId} | ` +
            `period=${responseData.rentPeriod} | ` +
            `amount=${payment.amountPaid} | ` +
            `ledgerRowId=${responseData.updatedLedgerRowId || 'N/A'}`
        );

        return res.json(
            buildResponse('success', 'Rent ledger state updated successfully', responseData),
            200
        );
    } catch (err) {
        // ── Top-level catch-all ───────────────────────────────────────────
        console.error(
            `[FATAL] Unhandled exception in flow=${flowLabel}: ${err.stack || err.message}`
        );

        return res.json(
            buildResponse(
                'error',
                `Unhandled function error: ${err.message}`,
                null,
                'UNHANDLED_ERROR'
            ),
            500
        );
    }
};
