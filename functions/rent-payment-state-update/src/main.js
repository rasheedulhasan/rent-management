/**
 * =============================================================================
 * RENT PAYMENT STATE UPDATE — Appwrite Cloud Function
 * =============================================================================
 *
 * PURPOSE:
 *   When a collector records a successful rent payment (creating a transaction
 *   with payment_status = "paid"), this function performs the atomic-like state
 *   update: it finds the matching "pending" transaction record for the same
 *   tenant + period and flips it to "paid", recording the actual amount and
 *   timestamp.
 *
 * EXECUTION FLOWS:
 *   Flow A — Event Webhook Trigger:
 *     Fires automatically on `databases.69e5580f00087e980ef3.collections.
 *     rent_transactions.documents.create`. The function reads the new document
 *     from the event payload and processes it.
 *
 *   Flow B — Direct API Call (functions.createExecution()):
 *     Accepts a JSON payload with { tenantId, roomId, rentPeriodId, amountPaid,
 *     paymentMethod }. The function queries for the matching pending record and
 *     updates it.
 *
 * DEPENDENCIES:
 *   - node-appwrite (bundled in the Appwrite runtime)
 *   - No external third-party packages
 *
 * ENVIRONMENT VARIABLES (set via Appwrite Console → Function → Settings):
 *   APPWRITE_ENDPOINT       — e.g. https://fra.cloud.appwrite.io/v1
 *   APPWRITE_FUNCTION_PROJECT_ID — Injected automatically by the runtime
 *   APPWRITE_DATABASE_ID    — "69e5580f00087e980ef3"
 *   RENT_TRANSACTIONS_COLLECTION_ID — "rent_transactions"
 * =============================================================================
 */

const { Client, Databases, Query, ID } = require('node-appwrite');

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PAYMENT_METHODS = ['cash', 'online', 'bank_transfer', 'cheque'];

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — Build the Appwrite SDK client with the function's execution key
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises an authenticated Appwrite SDK client using the runtime-injected
 * API key.  Every Appwrite Cloud Function automatically receives an execution
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
        transactionsCollectionId:
            process.env.RENT_TRANSACTIONS_COLLECTION_ID || 'rent_transactions',
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
//  CORE LOGIC — Update the pending transaction to "paid"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomic-like state update.
 *
 * Given a validated payment event, this function:
 *   1. Queries the rent_transactions collection for a document matching the
 *      exact tenant + period_month + period_year with payment_status = "pending".
 *   2. If found, updates that document's payment_status to "paid", records the
 *      paid amount, payment method, and a paid_at timestamp.
 *   3. If NOT found, logs a warning — the record may have been updated already
 *      or the pending record may not exist yet.
 *
 * @param {Databases} databases   — Appwrite Databases SDK instance
 * @param {string}    databaseId  — Target database ID
 * @param {string}    collectionId — Target collection ID
 * @param {Object}    payment     — Normalised payment details
 * @param {string}    payment.tenantId
 * @param {string}    payment.roomId
 * @param {number}    payment.periodMonth
 * @param {number}    payment.periodYear
 * @param {number}    payment.amountPaid
 * @param {string}    payment.paymentMethod
 * @param {string}    [payment.collectedBy]
 * @param {string}    [payment.receiptNumber]
 *
 * @returns {Promise<Object>} { success, document|null, error }
 */
async function updatePendingToPaid(databases, databaseId, collectionId, payment) {
    const {
        tenantId,
        roomId,
        periodMonth,
        periodYear,
        amountPaid,
        paymentMethod,
        collectedBy,
        receiptNumber,
    } = payment;

    // ── Step 1: Query for the matching pending transaction ────────────────
    // We search for a document that has the same tenant, period month/year,
    // and is still in "pending" status.  This is the "ledger" record that
    // was created when the rent period started.
    const queries = [
        Query.equal('tenant_id', tenantId),
        Query.equal('period_month', periodMonth),
        Query.equal('period_year', periodYear),
        Query.equal('payment_status', 'pending'),
        Query.limit(1), // There should be at most one pending record per period
    ];

    let pendingDocs;
    try {
        pendingDocs = await databases.listDocuments(
            databaseId,
            collectionId,
            queries
        );
    } catch (err) {
        console.error(
            `[CRITICAL] Failed to query pending transactions for tenant=${tenantId}, ` +
            `period=${periodMonth}/${periodYear}: ${err.message}`
        );
        return {
            success: false,
            document: null,
            error: `Database query failed: ${err.message}`,
        };
    }

    const pendingTransaction =
        Array.isArray(pendingDocs.documents) && pendingDocs.documents.length > 0
            ? pendingDocs.documents[0]
            : null;

    if (!pendingTransaction) {
        // No pending record found — this could mean:
        //   a) The payment was already processed (idempotency).
        //   b) The pending record was never created.
        //   c) The period identifiers don't match.
        console.warn(
            `[WARN] No pending transaction found for tenant=${tenantId}, ` +
            `period=${periodMonth}/${periodYear}. ` +
            `The record may have been updated already or does not exist.`
        );
        return {
            success: true, // Not a failure — the system may be idempotent
            document: null,
            error: null,
        };
    }

    // ── Step 2: Build the update payload ──────────────────────────────────
    const now = new Date().toISOString();
    const updateData = {
        payment_status: 'paid',
        amount: amountPaid,
        payment_method: paymentMethod,
        transaction_date: now,
        // Track the original pending reason for audit trail
        // (we keep pending_reason as-is for historical reference)
    };

    // If the caller provided a collector reference, update it
    if (collectedBy) {
        updateData.collected_by = collectedBy;
    }

    // If a receipt number was provided, attach it
    if (receiptNumber) {
        updateData.receipt_number = receiptNumber;
    }

    // ── Step 3: Perform the update ────────────────────────────────────────
    let updatedDocument;
    try {
        updatedDocument = await databases.updateDocument(
            databaseId,
            collectionId,
            pendingTransaction.$id,
            updateData
        );
    } catch (err) {
        console.error(
            `[SEVERE] Failed to update pending transaction ` +
            `(${pendingTransaction.$id}) for tenant=${tenantId}, ` +
            `period=${periodMonth}/${periodYear}: ${err.message}`
        );
        return {
            success: false,
            document: null,
            error: `Ledger update failed: ${err.message}`,
        };
    }

    console.log(
        `[OK] Transaction ${pendingTransaction.$id} updated: ` +
        `"pending" → "paid", amount=${amountPaid}, method=${paymentMethod}`
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
 * collection.  The new document is available under
 * `eventPayload.documents[0]`.
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
 *   "rentPeriodId": "<period_month>-<period_year>",  // e.g. "5-2026"
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
            rentPeriodId,
            amountPaid,
            paymentMethod,
        } = payload;

        // ── Validate required fields ──────────────────────────────────────
        const missing = [];
        if (!tenantId) missing.push('tenantId');
        if (!roomId) missing.push('roomId');
        if (!rentPeriodId) missing.push('rentPeriodId');
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

        // ── Parse rentPeriodId (format: "<month>-<year>", e.g. "5-2026") ──
        const periodParts = String(rentPeriodId).split('-');
        if (periodParts.length !== 2) {
            console.warn(
                `[WARN] Invalid rentPeriodId format: "${rentPeriodId}". ` +
                `Expected "<month>-<year>" (e.g. "5-2026").`
            );
            return null;
        }

        const periodMonth = parseInt(periodParts[0], 10);
        const periodYear = parseInt(periodParts[1], 10);

        if (
            isNaN(periodMonth) ||
            periodMonth < 1 ||
            periodMonth > 12 ||
            isNaN(periodYear) ||
            periodYear < 2000
        ) {
            console.warn(
                `[WARN] Invalid period values from rentPeriodId="${rentPeriodId}": ` +
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

    const { databaseId, transactionsCollectionId } = ids;

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
                `period=${payment.periodMonth}/${payment.periodYear}`
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
                        'Required: tenantId, roomId, rentPeriodId (format "<month>-<year>"), ' +
                        'amountPaid, paymentMethod',
                        null,
                        'VALIDATION_ERROR'
                    ),
                    400
                );
            }

            console.log(
                `[FLOW B] Direct execution for tenant=${payment.tenantId}, ` +
                `period=${payment.periodMonth}/${payment.periodYear}`
            );
        }

        // ──────────────────────────────────────────────────────────────────
        //  EXECUTE THE STATE UPDATE
        // ──────────────────────────────────────────────────────────────────
        const result = await updatePendingToPaid(
            databases,
            databaseId,
            transactionsCollectionId,
            payment
        );

        if (!result.success) {
            // The update failed — this is a severe error
            console.error(
                `[SEVERE] State update failed for flow=${flowLabel}, ` +
                `tenant=${payment.tenantId}, period=${payment.periodMonth}/${payment.periodYear}: ` +
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
            periodMonth: payment.periodMonth,
            periodYear: payment.periodYear,
            amountPaid: payment.amountPaid,
            paymentMethod: payment.paymentMethod,
            flow: flowLabel,
            updatedDocumentId: result.document ? result.document.$id : null,
            previousStatus: 'pending',
            newStatus: 'paid',
        };

        if (!result.document) {
            // No pending record was found — the system is idempotent
            responseData.note =
                'No pending record needed updating (already processed or not found).';
        }

        console.log(
            `[SUCCESS] Flow=${flowLabel} | tenant=${payment.tenantId} | ` +
            `period=${payment.periodMonth}/${payment.periodYear} | ` +
            `amount=${payment.amountPaid} | docId=${responseData.updatedDocumentId || 'N/A'}`
        );

        return res.json(
            buildResponse('success', 'Rent payment state updated successfully', responseData),
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
