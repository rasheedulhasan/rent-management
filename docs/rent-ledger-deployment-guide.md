# Rent Ledger System — Deployment Guide

## Overview

This document provides step-by-step instructions for deploying the three-part solution:

1. **`rent_ledger` collection** — A time-based ledger table that tracks monthly rent cycles
2. **Cloud Function** — Automatically flips ledger rows from `pending` → `paid` when a transaction is created
3. **Mobile App Query** — How the client fetches only unpaid items

---

## PART 1: Push the `rent_ledger` Collection to Appwrite Cloud

### Step 1: Verify the JSON Block in `appwrite.config.json`

Open [`appwrite.config.json`](../appwrite.config.json) and confirm the `rent_ledger` collection block exists inside the `"tables"` array (after `rent_transactions`).

The collection has these attributes:

| Attribute | Type | Required | Default | Purpose |
|-----------|------|----------|---------|---------|
| `room_id` | string(36) | Yes | — | Links to the room being rented |
| `tenant_id` | string(36) | Yes | — | Links to the tenant responsible |
| `rent_period` | string(7) | Yes | — | Canonical period string `"YYYY-MM"` (e.g. `"2026-05"`) |
| `status` | string(20) | Yes | `"pending"` | Current state: `pending` or `paid` |
| `amount_due` | double | Yes | — | The full monthly rent amount for this period |
| `amount_paid` | double | No | `0` | How much was actually paid |
| `paid_at` | datetime | No | — | Timestamp when payment was recorded |
| `payment_method` | string(50) | No | — | How the payment was made |
| `transaction_id` | string(36) | No | — | Links back to the source `rent_transactions` document |
| `notes` | string(500) | No | `""` | Collector info, receipt number, etc. |

**Indexes:**

| Key | Type | Columns | Purpose |
|-----|------|---------|---------|
| `idx_ledger_status` | key | `status` | Fast query: `Query.equal("status", "pending")` |
| `idx_ledger_tenant_period` | key | `tenant_id`, `rent_period` | Fast lookup for the update query |
| `idx_ledger_room_period` | key | `room_id`, `rent_period` | Room-based period lookups |

### Step 2: Push to Appwrite Cloud

Run the Appwrite CLI command to push the new collection definition:

```bash
appwrite push collection --database-id 69e5580f00087e980ef3 --collection-id rent_ledger
```

Or, to push all local definitions (collections + functions) at once:

```bash
appwrite push
```

> **Note:** If you use `appwrite push` without flags, it reads the entire `appwrite.config.json` and applies all changes. This is the recommended approach for CI/CD.

### Step 3: Verify in Appwrite Console

1. Log in to the [Appwrite Console](https://fra.cloud.appwrite.io/console)
2. Navigate to your project → **Databases** → `rentManagement` (`69e5580f00087e980ef3`)
3. Confirm the `rent_ledger` collection appears with all columns and indexes listed above

---

## PART 2: Deploy the Cloud Function

### Step 1: Verify the Function Code

The function lives at [`functions/rent-payment-state-update/src/main.js`](../functions/rent-payment-state-update/src/main.js).

Key changes from the previous version:

- **Target collection changed** from `rent_transactions` to `rent_ledger`
- **Uses `rent_period` string** (`"YYYY-MM"`) instead of separate `period_month`/`period_year` integers
- **Links back** to the source transaction via `transaction_id` for full audit trail
- **Records `paid_at` timestamp** and `payment_method` on the ledger row

### Step 2: Verify Environment Variables

Open [`functions/rent-payment-state-update/.env`](../functions/rent-payment-state-update/.env) and confirm:

```env
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_DATABASE_ID=69e5580f00087e980ef3
RENT_LEDGER_COLLECTION_ID=rent_ledger
```

### Step 3: Deploy the Function

```bash
appwrite push functions --function-id rent-payment-state-update --with-variables
```

This command:
1. Packages the function code from `functions/rent-payment-state-update/`
2. Runs `npm install` on the Appwrite build server
3. Deploys the function with the environment variables from `.env`
4. Sets the event trigger (already configured in `appwrite.config.json`)

### Step 4: Verify the Event Trigger

In the Appwrite Console, navigate to **Functions** → `rent-payment-state-update` → **Settings**.

Confirm the **Events** field contains exactly this string:

```
databases.69e5580f00087e980ef3.collections.rent_transactions.documents.create
```

> **Why this event?** We want the function to fire when a **transaction** is created (the collector records a payment), not when the ledger itself changes. The function then reads the transaction payload and updates the corresponding ledger row.

### Step 5: Verify Function Scopes

In the same **Settings** page, confirm the function has these permissions:

- `documents.read` — To query the `rent_ledger` collection
- `documents.write` — To update the `rent_ledger` row
- `databases.read` — To access the database
- `databases.write` — To perform the update

These are already configured in [`appwrite.config.json`](../appwrite.config.json) under `functions[0].scopes`.

---

## PART 3: How the Mobile App Queries Pending Rent

### The Old Way (Broken)

The mobile app queried `rent_transactions` with `payment_status = "pending"`. This was unreliable because:
- Transactions are an **audit log** — they record what happened, not what's owed
- When a payment was recorded, the transaction's own status changed, but there was no clean separation between "this is what was paid" and "this is what is still owed"

### The New Way (Ledger-Based)

The mobile app now queries the `rent_ledger` collection:

```javascript
// In your mobile app's API service
import { Query } from 'appwrite';

const pendingRents = await databases.listDocuments(
    '69e5580f00087e980ef3',  // databaseId
    'rent_ledger',            // collectionId
    [
        Query.equal('status', 'pending'),
        Query.orderDesc('rent_period'),
        Query.limit(100),
    ]
);
```

**What happens:**

1. Each tenant has one `rent_ledger` row per month with `status = "pending"`
2. When a collector records a payment → the Cloud Function fires → flips that row to `status = "paid"`
3. The next time the mobile app queries `status = "pending"`, paid items **automatically disappear**
4. No client-side filtering, no stale data, no manual status management

### Seeding Initial Ledger Data

To populate the `rent_ledger` with pending rows for existing tenants, you can run a one-time seed script:

```javascript
// Example: Create pending ledger rows for all active tenants
const tenants = await databases.listDocuments(
    '69e5580f00087e980ef3',
    'tenants',
    [Query.equal('status', 'active')]
);

for (const tenant of tenants.documents) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await databases.createDocument(
        '69e5580f00087e980ef3',
        'rent_ledger',
        ID.unique(),
        {
            room_id: tenant.room_id,
            tenant_id: tenant.$id,
            rent_period: period,
            status: 'pending',
            amount_due: tenant.monthly_rent,
        }
    );
}
```

---

## Architecture Diagram (Data Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (Client)                         │
│                                                                 │
│  Query: rent_ledger WHERE status = "pending"                    │
│    ↓                                                            │
│  Returns: Only unpaid items (paid items auto-drop)              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │  Collector records payment
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  rent_transactions (Audit Log)                   │
│                                                                 │
│  Document created with payment_status = "paid"                  │
│  Contains: tenant_id, room_id, period_month, period_year,       │
│            amount, payment_method                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │  Webhook Event Fires
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloud Function (rent-payment-state-update)          │
│                                                                 │
│  1. Parse webhook payload                                       │
│  2. Build rent_period = "2026-05"                               │
│  3. Query rent_ledger WHERE tenant_id=X AND rent_period="..."   │
│     AND status="pending"                                        │
│  4. Update: status="paid", amount_paid=..., paid_at=now()       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │  Atomic update
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    rent_ledger (State Machine)                   │
│                                                                 │
│  Before: { status: "pending", amount_paid: 0 }                  │
│  After:  { status: "paid",    amount_paid: 1500 }               │
│                                                                 │
│  → Next mobile query for "pending" excludes this row            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Ledger row not being updated

1. **Check the Event string** in Appwrite Console → Functions → Settings → Events. It must be:
   ```
   databases.69e5580f00087e980ef3.collections.rent_transactions.documents.create
   ```

2. **Check function logs** in Appwrite Console → Functions → `rent-payment-state-update` → Logs. Look for:
   - `[SKIP]` — The transaction's `payment_status` was not `"paid"`
   - `[WARN] No pending ledger row found` — The ledger row doesn't exist yet (run the seed script)
   - `[SEVERE]` — A database error occurred (check permissions)

3. **Verify the `rent_period` format** — The function builds it as `"YYYY-MM"` (e.g. `"2026-05"`). Ensure your seed data uses the same format.

### Function not triggering

1. Confirm the function is **enabled** in the Appwrite Console
2. Confirm the event trigger is set correctly (see Step 4 above)
3. Confirm the function has the correct **scopes** (documents.read, documents.write)

---

## Summary

| Component | File | Purpose |
|-----------|------|---------|
| Collection Schema | [`appwrite.config.json`](../appwrite.config.json) (lines 712+) | Defines the `rent_ledger` collection |
| Cloud Function | [`functions/rent-payment-state-update/src/main.js`](../functions/rent-payment-state-update/src/main.js) | Flips ledger `pending` → `paid` on transaction create |
| Function Env | [`functions/rent-payment-state-update/.env`](../functions/rent-payment-state-update/.env) | Database & collection IDs |
| Deployment Guide | This file | Step-by-step instructions |
