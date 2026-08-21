-- ============================================================================
-- RentPro Database Schema
-- Migrated from Appwrite collections (buildings, rooms, tenants, users,
-- rent_transactions, rent_ledger).
--
-- Key design notes:
--   * Primary keys are VARCHAR(36), NOT UUID. Appwrite's ID.unique() produces
--     20-char hex strings (e.g. "66b3f1a2c3d4e5f6a7b8"), and all foreign-key
--     references (room_id, tenant_id, building_id, collected_by, ledger_id)
--     point at those values. Using UUID would break the 1:1 mapping during
--     import. If you want UUIDs for new rows later, add a generated column.
--   * created_at / updated_at (TIMESTAMPTZ) map to Appwrite's system fields
--     $createdAt / $updatedAt for buildings, rooms, tenants, users and
--     rent_transactions.
--   * rent_ledger stores its own app-managed created_at / updated_at /
--     rent_due_date as VARCHAR strings (the Appwrite schema typed these as
--     string(50), and the code writes ISO strings and does string comparison).
--   * Foreign-key CONSTRAINTS are intentionally NOT declared. Appwrite does not
--     enforce referential integrity, and the existing data contains orphan
--     references (e.g. rooms with building_id = 'default_building', and
--     collected_by values like 'admin'/'staff_001'/'' that are not real user
--     IDs). The application resolves relations at the service layer, so we keep
--     the columns + indexes but not FK constraints. Re-add constraints later
--     once the data is cleaned.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS rent_transactions CASCADE;
DROP TABLE IF EXISTS rent_ledger CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ----------------------------------------------------------------------------
-- 1. buildings
-- ----------------------------------------------------------------------------
CREATE TABLE buildings (
    id           VARCHAR(36)   PRIMARY KEY,
    name         VARCHAR(255)  NOT NULL,
    address      VARCHAR(500)  NOT NULL,
    total_floors INTEGER       NOT NULL,
    total_rooms  INTEGER       NOT NULL,
    description  VARCHAR(1000) NOT NULL DEFAULT '',
    status       VARCHAR(50)   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_buildings_status ON buildings (status);

-- ----------------------------------------------------------------------------
-- 2. rooms
-- ----------------------------------------------------------------------------
CREATE TABLE rooms (
    id           VARCHAR(36)   PRIMARY KEY,
    building_id  VARCHAR(36)   NOT NULL,
    room_number  VARCHAR(50)   NOT NULL,
    floor        INTEGER       NOT NULL,
    type         VARCHAR(50)   NOT NULL,
    monthly_rent NUMERIC(12,2) NOT NULL,
    size         VARCHAR(50)   NOT NULL DEFAULT '',
    amenities    VARCHAR(500)  NOT NULL DEFAULT '',
    status       VARCHAR(50)   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_building ON rooms (building_id);
CREATE INDEX idx_rooms_status   ON rooms (status);

-- ----------------------------------------------------------------------------
-- 3. tenants
-- ----------------------------------------------------------------------------
CREATE TABLE tenants (
    id                VARCHAR(36)   PRIMARY KEY,
    room_id           VARCHAR(36)   NOT NULL,
    full_name         VARCHAR(255)  NOT NULL,
    phone_number      VARCHAR(20)   NOT NULL,
    email             VARCHAR(255)  NOT NULL DEFAULT '',
    id_number         VARCHAR(50)   NOT NULL DEFAULT '',
    emergency_contact VARCHAR(255)  NOT NULL DEFAULT '',
    check_in_date     TIMESTAMPTZ   NOT NULL,
    check_out_date    TIMESTAMPTZ,
    monthly_rent      NUMERIC(12,2) NOT NULL,
    security_deposit  NUMERIC(12,2),
    billing_day       INTEGER       NOT NULL,
    status            VARCHAR(50)   NOT NULL,
    notes             VARCHAR(1000) NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_room   ON tenants (room_id);
CREATE INDEX idx_tenants_status ON tenants (status);
CREATE INDEX idx_tenants_phone  ON tenants (phone_number);

-- ----------------------------------------------------------------------------
-- 4. users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id          VARCHAR(36)  PRIMARY KEY,
    username    VARCHAR(100) NOT NULL,
    full_name   VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(20)  NOT NULL DEFAULT '',
    role        VARCHAR(50)  NOT NULL,
    status      VARCHAR(50)  NOT NULL,
    permissions VARCHAR(500) NOT NULL DEFAULT '',
    password    VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email    ON users (email);
CREATE INDEX idx_users_role     ON users (role);

-- ----------------------------------------------------------------------------
-- 5. rent_ledger
--    (note: created_at / updated_at / rent_due_date are VARCHAR to match the
--     Appwrite string attributes and existing string-comparison logic)
-- ----------------------------------------------------------------------------
CREATE TABLE rent_ledger (
    id              VARCHAR(36)   PRIMARY KEY,
    ledger_uid      VARCHAR(100)  NOT NULL,
    room_id         VARCHAR(36)   NOT NULL,
    tenant_id       VARCHAR(36)   NOT NULL,
    rent_period     VARCHAR(7)    NOT NULL,
    tenant_name     VARCHAR(255)  NOT NULL,
    room_number     VARCHAR(50),
    monthly_rent    NUMERIC(12,2) NOT NULL,
    expected_rent   NUMERIC(12,2) NOT NULL,
    amount_due      NUMERIC(12,2) NOT NULL,
    amount_paid     NUMERIC(12,2) NOT NULL,
    pending_balance NUMERIC(12,2) NOT NULL,
    status          VARCHAR(50)   NOT NULL,
    payment_status  VARCHAR(50)   NOT NULL,
    period_month    INTEGER       NOT NULL,
    period_year     INTEGER       NOT NULL,
    rent_due_date   VARCHAR(50),
    overdue_days    INTEGER,
    created_at      VARCHAR(50),
    updated_at      VARCHAR(50)
);

CREATE UNIQUE INDEX idx_unique_ledger ON rent_ledger (ledger_uid);
CREATE INDEX payment_status_idx      ON rent_ledger (payment_status);
CREATE INDEX room_id_idx             ON rent_ledger (room_id);

-- ----------------------------------------------------------------------------
-- 6. rent_transactions
-- ----------------------------------------------------------------------------
CREATE TABLE rent_transactions (
    id                      VARCHAR(36)   PRIMARY KEY,
    tenant_id               VARCHAR(36)   NOT NULL,
    room_id                 VARCHAR(36)   NOT NULL,
    collected_by            VARCHAR(36)   NOT NULL DEFAULT '',
    amount                  NUMERIC(12,2) NOT NULL,
    monthly_rent            NUMERIC(12,2) NOT NULL,
    payment_method          VARCHAR(50)   NOT NULL,
    payment_status          VARCHAR(50)   NOT NULL,
    transaction_date        TIMESTAMPTZ   NOT NULL,
    rent_due_date           TIMESTAMPTZ   NOT NULL,
    period_month            INTEGER       NOT NULL,
    period_year             INTEGER       NOT NULL,
    partial_payment_reason  VARCHAR(500)  NOT NULL DEFAULT '',
    pending_reason          VARCHAR(500)  NOT NULL DEFAULT '',
    remarks                 VARCHAR(1000) NOT NULL DEFAULT '',
    receipt_number          VARCHAR(100)  NOT NULL DEFAULT '',
    ledger_id               VARCHAR(36),
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_period ON rent_transactions (period_year, period_month);
CREATE INDEX idx_transactions_date   ON rent_transactions (transaction_date);
CREATE INDEX idx_transactions_tenant ON rent_transactions (tenant_id);
CREATE INDEX idx_transactions_status ON rent_transactions (payment_status);

COMMIT;
