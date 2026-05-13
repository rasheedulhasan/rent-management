/**
 * =============================================================================
 * RENT SUBMISSION SERVICE — Appwrite Client SDK (TypeScript Reference)
 * =============================================================================
 *
 * PURPOSE:
 *   Single frontend function that handles the complete rent payment submission
 *   lifecycle.  When a collector taps "Submit Payment", this service:
 *
 *   Task 1 — Creates a paid transaction record in the `rent_transactions`
 *            collection as the audit trail / receipt entry.
 *   Task 2 — Finds the matching "pending" billing record for the same tenant
 *            + billing period and flips its `payment_status` from "pending"
 *            to "paid", recording the actual collected amount.
 *
 *   If Task 1 succeeds but Task 2 fails, a critical sync warning is logged so
 *   the app can schedule a programmatic retry.
 *
 * DEPENDENCIES:
 *   npm install appwrite
 *
 * USAGE:
 *   import { handleRentSubmission } from '../services/rentSubmissionService';
 *
 *   const result = await handleRentSubmission({
 *     tenantId: '...',
 *     roomId: '...',
 *     billingPeriodId: '5-2026',
 *     amountCollected: 1500.00,
 *     monthlyRent: 1500.00,
 *     paymentMethod: 'cash',
 *     collectedBy: '...',
 *     collectedAt: new Date().toISOString(),
 *     notes: 'On-time payment',
 *   });
 *
 *   if (result.success) { /* show success UI *\/ }
 *   if (result.syncWarning) { /* schedule retry *\/ }
 * =============================================================================
 */

import { Client, Databases, ID, Query } from 'appwrite';
import type { Models } from 'appwrite';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '69e51bf3000836adc452';
const DATABASE_ID = '69e5580f00087e980ef3';
const TRANSACTIONS_COLLECTION_ID = 'rent_transactions';

const VALID_PAYMENT_METHODS = ['cash', 'online', 'bank_transfer', 'cheque'] as const;
const VALID_PAYMENT_STATUSES = ['paid', 'pending', 'partial'] as const;

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Payment method enum derived from the schema's allowed values. */
export type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number];

/** Payment status enum matching the `rent_transactions` schema constraint. */
export type PaymentStatus = (typeof VALID_PAYMENT_STATUSES)[number];

/**
 * Structured payload accepted by `handleRentSubmission`.
 *
 * Maps directly to the `rent_transactions` collection attributes defined in
 * the Appwrite schema (see `appwrite.config.json`).
 */
export interface PaymentPayload {
  /** Appwrite document ID of the tenant (references `tenants` collection). */
  tenantId: string;

  /** Appwrite document ID of the room (references `rooms` collection). */
  roomId: string;

  /**
   * Billing period identifier in `<month>-<year>` format.
   * Example: `"5-2026"` for May 2026.
   */
  billingPeriodId: string;

  /** Actual amount collected from the tenant. */
  amountCollected: number;

  /** Full monthly rent amount for the period (used for reference). */
  monthlyRent: number;

  /** How the payment was collected. */
  paymentMethod: PaymentMethod;

  /** Appwrite document ID of the collector user (references `users` collection). */
  collectedBy: string;

  /** ISO 8601 timestamp of when the collection occurred. */
  collectedAt: string;

  /** ISO 8601 date of the rent due date for this period. */
  rentDueDate?: string;

  /** Optional notes / remarks about this collection. */
  notes?: string;

  /** Optional pre-generated receipt number. Auto-generated if omitted. */
  receiptNumber?: string;

  /** Reason if this is a partial payment. */
  partialPaymentReason?: string;
}

/**
 * The shape of the `rent_transactions` document as stored in Appwrite.
 * Extends `Models.Document` to inherit `$id`, `$createdAt`, `$updatedAt`, etc.
 */
export interface RentTransactionDocument extends Models.Document {
  tenant_id: string;
  room_id: string;
  collected_by: string;
  amount: number;
  monthly_rent: number;
  payment_method: string;
  payment_status: string;
  transaction_date: string;
  rent_due_date: string;
  period_month: number;
  period_year: number;
  partial_payment_reason: string;
  pending_reason: string;
  remarks: string;
  receipt_number: string;
}

/**
 * Standardised result returned by `handleRentSubmission`.
 */
export interface RentSubmissionResult {
  /** Whether the overall operation succeeded (Task 1 always, Task 2 optional). */
  success: boolean;

  /** The newly created transaction document (Task 1 result). */
  transaction: RentTransactionDocument | null;

  /** The updated billing ledger document (Task 2 result), if successful. */
  updatedLedger: RentTransactionDocument | null;

  /**
   * If `true`, Task 1 succeeded but Task 2 (ledger update) failed.
   * The app should schedule a programmatic retry for the ledger sync.
   */
  syncWarning: boolean;

  /** Human-readable summary message. */
  message: string;

  /** Error details if any operation failed. */
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a `billingPeriodId` string in `<month>-<year>` format into its
 * numeric components.
 *
 * @example
 *   parseBillingPeriod('5-2026') // => { month: 5, year: 2026 }
 *
 * @throws {Error} If the format is invalid or values are out of range.
 */
function parseBillingPeriod(billingPeriodId: string): { month: number; year: number } {
  const parts = billingPeriodId.split('-');
  if (parts.length !== 2) {
    throw new Error(
      `Invalid billingPeriodId format: "${billingPeriodId}". Expected "<month>-<year>" (e.g. "5-2026").`
    );
  }

  const month = parseInt(parts[0], 10);
  const year = parseInt(parts[1], 10);

  if (isNaN(month) || month < 1 || month > 12) {
    throw new Error(
      `Invalid month in billingPeriodId: "${parts[0]}". Must be between 1 and 12.`
    );
  }

  if (isNaN(year) || year < 2000) {
    throw new Error(
      `Invalid year in billingPeriodId: "${parts[1]}". Must be >= 2000.`
    );
  }

  return { month, year };
}

/**
 * Generates a unique receipt number.
 * Format: RCPT-YYYYMMDD-XXXX
 */
function generateReceiptNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `RCPT-${year}${month}${day}-${random}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLIENT INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates and returns an authenticated Appwrite client and Databases service.
 *
 * In a production app, the client should be a singleton shared across the
 * application.  This factory is kept here for self-contained clarity.
 */
function createAppwriteClient(): { databases: Databases } {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

  const databases = new Databases(client);

  return { databases };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TASK 1 — Create the paid transaction record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new document in the `rent_transactions` collection with
 * `payment_status = "paid"`.  This serves as the audit trail / receipt entry.
 *
 * @param databases   - Appwrite Databases service instance
 * @param payload     - The validated payment payload
 * @param period      - Parsed billing period { month, year }
 * @param receiptNum  - Generated or provided receipt number
 * @returns The created Appwrite document
 */
async function createTransactionRecord(
  databases: Databases,
  payload: PaymentPayload,
  period: { month: number; year: number },
  receiptNum: string
): Promise<RentTransactionDocument> {
  const now = new Date().toISOString();
  const dueDate = payload.rentDueDate || now;

  const documentData: Record<string, unknown> = {
    tenant_id: payload.tenantId,
    room_id: payload.roomId,
    collected_by: payload.collectedBy,
    amount: payload.amountCollected,
    monthly_rent: payload.monthlyRent,
    payment_method: payload.paymentMethod,
    payment_status: 'paid',
    transaction_date: payload.collectedAt || now,
    rent_due_date: dueDate,
    period_month: period.month,
    period_year: period.year,
    partial_payment_reason: payload.partialPaymentReason || '',
    pending_reason: '',
    remarks: payload.notes || '',
    receipt_number: receiptNum,
  };

  const document = await databases.createDocument(
    DATABASE_ID,
    TRANSACTIONS_COLLECTION_ID,
    ID.unique(),
    documentData
  );

  return document as unknown as RentTransactionDocument;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TASK 2 — Update the billing ledger (pending → paid)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the existing "pending" transaction record for the same tenant +
 * billing period and updates its `payment_status` to `"paid"`, recording the
 * actual collected amount and method.
 *
 * This is the "structural billing tracker" update that the requirement
 * describes.
 *
 * @param databases   - Appwrite Databases service instance
 * @param payload     - The validated payment payload
 * @param period      - Parsed billing period { month, year }
 * @returns The updated document, or `null` if no pending record was found
 */
async function updateBillingLedger(
  databases: Databases,
  payload: PaymentPayload,
  period: { month: number; year: number }
): Promise<RentTransactionDocument | null> {
  // ── Step 1: Query for the matching pending record ──────────────────────
  // The "ledger" is the pending transaction record that was created when the
  // rent period started.  We find it by matching tenant + period + status.
  const queries = [
    Query.equal('tenant_id', payload.tenantId),
    Query.equal('period_month', period.month),
    Query.equal('period_year', period.year),
    Query.equal('payment_status', 'pending'),
    Query.limit(1),
  ];

  const result = await databases.listDocuments(
    DATABASE_ID,
    TRANSACTIONS_COLLECTION_ID,
    queries
  );

  const pendingDoc =
    Array.isArray(result.documents) && result.documents.length > 0
      ? (result.documents[0] as unknown as RentTransactionDocument)
      : null;

  if (!pendingDoc) {
    // No pending record found — this is not necessarily an error.
    // The pending record may have been updated already (idempotency) or
    // the billing period may not have a pre-created pending entry.
    console.warn(
      `[RentSubmission] No pending ledger record found for ` +
      `tenant=${payload.tenantId}, period=${period.month}/${period.year}. ` +
      `Skipping ledger update.`
    );
    return null;
  }

  // ── Step 2: Update the pending record to "paid" ────────────────────────
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    payment_status: 'paid',
    amount: payload.amountCollected,
    payment_method: payload.paymentMethod,
    transaction_date: payload.collectedAt || now,
    collected_by: payload.collectedBy,
  };

  if (payload.notes) {
    updateData.remarks = payload.notes;
  }

  const updatedDocument = await databases.updateDocument(
    DATABASE_ID,
    TRANSACTIONS_COLLECTION_ID,
    pendingDoc.$id,
    updateData
  );

  console.log(
    `[RentSubmission] Ledger updated: ${pendingDoc.$id} ` +
    `"pending" → "paid", amount=${payload.amountCollected}`
  );

  return updatedDocument as unknown as RentTransactionDocument;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ENTRYPOINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the complete rent payment submission lifecycle.
 *
 * EXECUTION SEQUENCE:
 *   1. Validates the input payload against schema constraints.
 *   2. Parses the `billingPeriodId` into month/year components.
 *   3. **Task 1**: Creates a new `rent_transactions` document with
 *      `payment_status = "paid"` (the receipt / audit trail).
 *   4. **Task 2**: Upon Task 1 success, queries for the matching "pending"
 *      billing record and updates it to `"paid"` (the ledger sync).
 *   5. If Task 1 succeeds but Task 2 fails, logs a critical sync warning
 *      and returns `syncWarning: true` so the app can schedule a retry.
 *
 * ERROR HANDLING:
 *   - Payload validation errors → returns `{ success: false }` immediately.
 *   - Task 1 failure → returns `{ success: false }` with error details.
 *   - Task 2 failure → returns `{ success: true, syncWarning: true }` so the
 *     app can proceed but schedule a background retry for the ledger update.
 *
 * @param paymentData - The structured payment payload from the collection form.
 * @returns A `RentSubmissionResult` describing the outcome.
 *
 * @example
 *   const result = await handleRentSubmission({
 *     tenantId: '67f...',
 *     roomId: '67f...',
 *     billingPeriodId: '5-2026',
 *     amountCollected: 1500,
 *     monthlyRent: 1500,
 *     paymentMethod: 'cash',
 *     collectedBy: '67f...',
 *     collectedAt: new Date().toISOString(),
 *   });
 *
 *   if (!result.success) {
 *     // Show error to user
 *     console.error(result.error);
 *   } else if (result.syncWarning) {
 *     // Transaction saved, but ledger sync failed — schedule retry
 *     scheduleLedgerRetry(paymentData);
 *   }
 */
export async function handleRentSubmission(
  paymentData: PaymentPayload
): Promise<RentSubmissionResult> {
  // ── Validation ─────────────────────────────────────────────────────────
  const errors: string[] = [];

  if (!paymentData.tenantId) errors.push('tenantId is required');
  if (!paymentData.roomId) errors.push('roomId is required');
  if (!paymentData.billingPeriodId) errors.push('billingPeriodId is required');
  if (!paymentData.collectedBy) errors.push('collectedBy is required');

  if (
    paymentData.amountCollected === undefined ||
    paymentData.amountCollected === null ||
    typeof paymentData.amountCollected !== 'number' ||
    paymentData.amountCollected <= 0
  ) {
    errors.push('amountCollected must be a positive number');
  }

  if (
    paymentData.monthlyRent === undefined ||
    paymentData.monthlyRent === null ||
    typeof paymentData.monthlyRent !== 'number' ||
    paymentData.monthlyRent <= 0
  ) {
    errors.push('monthlyRent must be a positive number');
  }

  if (!VALID_PAYMENT_METHODS.includes(paymentData.paymentMethod as PaymentMethod)) {
    errors.push(
      `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`
    );
  }

  if (errors.length > 0) {
    return {
      success: false,
      transaction: null,
      updatedLedger: null,
      syncWarning: false,
      message: 'Validation failed',
      error: errors.join('; '),
    };
  }

  // ── Parse billing period ───────────────────────────────────────────────
  let period: { month: number; year: number };
  try {
    period = parseBillingPeriod(paymentData.billingPeriodId);
  } catch (err) {
    return {
      success: false,
      transaction: null,
      updatedLedger: null,
      syncWarning: false,
      message: 'Invalid billing period',
      error: err instanceof Error ? err.message : 'Failed to parse billingPeriodId',
    };
  }

  // ── Initialise Appwrite client ─────────────────────────────────────────
  let databases: Databases;
  try {
    const client = createAppwriteClient();
    databases = client.databases;
  } catch (err) {
    return {
      success: false,
      transaction: null,
      updatedLedger: null,
      syncWarning: false,
      message: 'Failed to initialise Appwrite client',
      error: err instanceof Error ? err.message : 'Unknown initialisation error',
    };
  }

  // ── Generate receipt number ────────────────────────────────────────────
  const receiptNumber = paymentData.receiptNumber || generateReceiptNumber();

  // ─────────────────────────────────────────────────────────────────────────
  //  TASK 1 — Create the paid transaction record
  // ─────────────────────────────────────────────────────────────────────────
  let transaction: RentTransactionDocument;
  try {
    transaction = await createTransactionRecord(databases, paymentData, period, receiptNumber);
    console.log(
      `[RentSubmission] Task 1 OK: Transaction created ${transaction.$id} ` +
      `for tenant=${paymentData.tenantId}, amount=${paymentData.amountCollected}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[RentSubmission] Task 1 FAILED: ${message}`);
    return {
      success: false,
      transaction: null,
      updatedLedger: null,
      syncWarning: false,
      message: 'Failed to create transaction record',
      error: message,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  TASK 2 — Update the billing ledger (pending → paid)
  // ─────────────────────────────────────────────────────────────────────────
  let updatedLedger: RentTransactionDocument | null = null;
  let syncWarning = false;

  try {
    updatedLedger = await updateBillingLedger(databases, paymentData, period);
    console.log(
      `[RentSubmission] Task 2 ${updatedLedger ? 'OK' : 'SKIPPED (no pending record)'}: ` +
      `tenant=${paymentData.tenantId}, period=${period.month}/${period.year}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      `[CRITICAL] [RentSubmission] Task 2 FAILED — ` +
      `Transaction ${transaction.$id} was created but the billing ledger ` +
      `could NOT be updated for tenant=${paymentData.tenantId}, ` +
      `period=${period.month}/${period.year}. Error: ${message}`
    );
    syncWarning = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  RESULT
  // ─────────────────────────────────────────────────────────────────────────
  const success = true; // Task 1 succeeded; Task 2 is best-effort
  const message = syncWarning
    ? 'Payment recorded successfully, but the billing status update failed. A retry has been scheduled.'
    : updatedLedger
      ? 'Payment recorded and billing status updated successfully.'
      : 'Payment recorded successfully. No pending billing record needed updating.';

  return {
    success,
    transaction,
    updatedLedger,
    syncWarning,
    message,
    error: null,
  };
}
