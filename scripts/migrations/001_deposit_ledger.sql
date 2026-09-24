-- ============================================================================
-- Migration 001: Tenant security deposit ledger
--
-- Adds a deposit transaction ledger so the security deposit is tracked as
-- financial transactions instead of a single overwritable amount on the tenant.
--
--   balance = SUM(amount)   where received = +, adjustment = -, refund = -
--
-- Existing tenants keep `tenants.security_deposit` for backward compatibility,
-- but the ledger becomes the source of truth. Their current deposit value is
-- backfilled as the opening `received` entry (only when they have no entries).
--
-- Idempotent: safe to run more than once.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_deposit_transactions (
    id               VARCHAR(36)   PRIMARY KEY,
    tenant_id        VARCHAR(36)   NOT NULL,
    amount           NUMERIC(12,2) NOT NULL,
    transaction_type VARCHAR(20)   NOT NULL,
    reference_type   VARCHAR(50)   NOT NULL DEFAULT '',
    reference_id     VARCHAR(36)   NOT NULL DEFAULT '',
    description      VARCHAR(500)  NOT NULL DEFAULT '',
    created_by       VARCHAR(36)   NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_txn_tenant ON tenant_deposit_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_txn_type   ON tenant_deposit_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_deposit_txn_ref    ON tenant_deposit_transactions (reference_type, reference_id);

-- Lets a rent payment point back at the deposit transaction that funded it.
ALTER TABLE rent_transactions
    ADD COLUMN IF NOT EXISTS deposit_transaction_id VARCHAR(36);

-- Backfill: record each tenant's existing deposit as the opening `received` entry.
INSERT INTO tenant_deposit_transactions
    (id, tenant_id, amount, transaction_type, reference_type, reference_id, description, created_by, created_at, updated_at)
SELECT
    gen_random_uuid()::text,
    t.id,
    t.security_deposit,
    'received',
    'opening_balance',
    '',
    'Opening security deposit (migrated)',
    'system',
    now(),
    now()
FROM tenants t
WHERE COALESCE(t.security_deposit, 0) > 0
  AND NOT EXISTS (
        SELECT 1 FROM tenant_deposit_transactions d WHERE d.tenant_id = t.id
  );

COMMIT;
