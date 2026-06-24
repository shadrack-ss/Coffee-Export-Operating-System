-- CE-OS initial schema
-- Monetary values: BIGINT UGX (never floats). Weights: NUMERIC kg. PKs: UUID.
-- To add columns or tables in future, create 002_*.sql, 003_*.sql, etc.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE role_type            AS ENUM ('grader', 'accountant', 'admin', 'auditor');
CREATE TYPE supplier_type        AS ENUM ('farmer', 'agent', 'cooperative', 'washing_station', 'trader');
CREATE TYPE batch_status         AS ENUM ('received', 'graded', 'costed', 'processed', 'approved', 'allocated', 'exported');
CREATE TYPE defect_handling_mode AS ENUM ('weight', 'discount');
CREATE TYPE expense_basis        AS ENUM ('per_kg', 'allocated');
CREATE TYPE process_type         AS ENUM ('hulling', 'cleaning', 'sorting', 'drying', 're-grading', 're-bagging');
CREATE TYPE severity_type        AS ENUM ('info', 'watch', 'critical');
CREATE TYPE fm_base_type         AS ENUM ('after_mc', 'net_physical');

-- ─── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── LOOKUP TABLES ───────────────────────────────────────────────────────────

CREATE TABLE coffee_grades (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  sellable  BOOLEAN NOT NULL DEFAULT true,
  active    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE districts (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  code  TEXT NOT NULL UNIQUE
);

CREATE TABLE expense_categories (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  active  BOOLEAN NOT NULL DEFAULT true
);

-- Seeds reconciled with src/core/settings.ts and recommendGrade() in shared/calc/quality.ts.
-- 'Off-grade / Reject' must exist so quality_metrics.recommended_grade_id FK never breaks.
INSERT INTO coffee_grades (name, sellable) VALUES
  ('Kiboko',             true),
  ('FAQ',                true),
  ('Screen 18 (AA)',     true),
  ('Screen 15 (AB)',     true),
  ('Commercial',         true),
  ('Bugisu AA',          true),
  ('Robusta Screen 18',  true),
  ('Off-grade / Reject', false);

INSERT INTO districts (name, code) VALUES
  ('Mbale',           'MBL'),
  ('Sipi / Kapchorwa','SIP'),
  ('Kasese',          'KSE'),
  ('Bushenyi',        'BSH'),
  ('Luwero',          'LUW'),
  ('Masaka',          'MSK'),
  ('Mityana',         'MTY'),
  ('Kween',           'KWN');

INSERT INTO expense_categories (name) VALUES
  ('URA tax'),
  ('Handling'),
  ('Gunny bags'),
  ('Paperwork'),
  ('Transport (A4T Kampala)'),
  ('Transport (A4B Mombasa)'),
  ('Port fees'),
  ('Inspection'),
  ('Storage'),
  ('Insurance');

-- ─── USERS ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  role           role_type NOT NULL,
  password_hash  TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES users(id),
  updated_at     TIMESTAMPTZ
);

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── SUPPLIERS ───────────────────────────────────────────────────────────────

CREATE TABLE suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        supplier_type NOT NULL,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  contact     TEXT NOT NULL,
  gps_lat     NUMERIC CHECK (gps_lat  IS NULL OR gps_lat  BETWEEN -90  AND 90),
  gps_lng     NUMERIC CHECK (gps_lng  IS NULL OR gps_lng  BETWEEN -180 AND 180),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID NOT NULL REFERENCES users(id),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX suppliers_district_idx ON suppliers(district_id);

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── CLIENTS (buyers) ────────────────────────────────────────────────────────

CREATE TABLE clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  country    TEXT NOT NULL,
  email      TEXT NOT NULL,
  segment    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ
);

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── BATCHES ─────────────────────────────────────────────────────────────────

CREATE TABLE batches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code            TEXT NOT NULL UNIQUE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id),
  district_id           INTEGER NOT NULL REFERENCES districts(id),
  grade_id              INTEGER NOT NULL REFERENCES coffee_grades(id),
  parent_batch_id       UUID REFERENCES batches(id),
  status                batch_status NOT NULL DEFAULT 'received',
  gross_weight_kg       NUMERIC NOT NULL,
  tare_weight_kg        NUMERIC NOT NULL DEFAULT 0,
  net_payable_weight_kg NUMERIC,
  clean_output_kg       NUMERIC,
  buyer_id              UUID REFERENCES clients(id),
  market_price_per_kg   BIGINT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID NOT NULL REFERENCES users(id),
  updated_at            TIMESTAMPTZ,
  CONSTRAINT batches_gross_nonneg    CHECK (gross_weight_kg >= 0),
  CONSTRAINT batches_tare_range      CHECK (tare_weight_kg >= 0 AND tare_weight_kg <= gross_weight_kg),
  CONSTRAINT batches_net_nonneg      CHECK (net_payable_weight_kg IS NULL OR net_payable_weight_kg >= 0),
  CONSTRAINT batches_clean_nonneg    CHECK (clean_output_kg IS NULL OR clean_output_kg >= 0),
  CONSTRAINT batches_price_nonneg    CHECK (market_price_per_kg >= 0),
  CONSTRAINT batches_not_self_parent CHECK (parent_batch_id IS NULL OR parent_batch_id <> id)
);

CREATE INDEX batches_supplier_idx     ON batches(supplier_id);
CREATE INDEX batches_parent_batch_idx ON batches(parent_batch_id);
CREATE INDEX batches_status_idx       ON batches(status);
CREATE INDEX batches_buyer_idx        ON batches(buyer_id);
CREATE INDEX batches_district_idx     ON batches(district_id);
CREATE INDEX batches_grade_idx        ON batches(grade_id);

CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── QUALITY METRICS ─────────────────────────────────────────────────────────

CREATE TABLE quality_metrics (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id             UUID NOT NULL UNIQUE REFERENCES batches(id),
  moisture_pct         NUMERIC NOT NULL,
  fallen_matter_pct    NUMERIC NOT NULL,
  defect_pct           NUMERIC NOT NULL,
  black_beans_pct      NUMERIC NOT NULL DEFAULT 0,
  broken_pct           NUMERIC NOT NULL DEFAULT 0,
  husks_pct            NUMERIC NOT NULL DEFAULT 0,
  insect_damage_pct    NUMERIC NOT NULL DEFAULT 0,
  foreign_matter_pct   NUMERIC NOT NULL DEFAULT 0,
  defect_handling_mode defect_handling_mode NOT NULL,
  recommended_grade_id INTEGER NOT NULL REFERENCES coffee_grades(id),
  graded_by            UUID NOT NULL REFERENCES users(id),
  graded_at            TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID NOT NULL REFERENCES users(id),
  updated_at           TIMESTAMPTZ,
  CONSTRAINT qm_pct_nonneg   CHECK (
    moisture_pct >= 0 AND fallen_matter_pct >= 0 AND defect_pct >= 0 AND
    black_beans_pct >= 0 AND broken_pct >= 0 AND husks_pct >= 0 AND
    insect_damage_pct >= 0 AND foreign_matter_pct >= 0
  ),
  CONSTRAINT qm_moisture_max CHECK (moisture_pct <= 100)
);

CREATE TRIGGER trg_quality_metrics_updated BEFORE UPDATE ON quality_metrics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ALLOCATION GROUPS ───────────────────────────────────────────────────────

CREATE TABLE allocation_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- ─── EXPENSE LINES ───────────────────────────────────────────────────────────

CREATE TABLE expense_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            UUID REFERENCES batches(id),
  category_id         INTEGER NOT NULL REFERENCES expense_categories(id),
  amount_ugx          BIGINT NOT NULL,
  basis               expense_basis NOT NULL,
  allocation_group_id UUID REFERENCES allocation_groups(id),
  note                TEXT,
  added_by            UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NOT NULL REFERENCES users(id),
  updated_at          TIMESTAMPTZ,
  CONSTRAINT expense_amount_nonneg CHECK (amount_ugx >= 0),
  CONSTRAINT expense_basis_group   CHECK (
    (basis = 'allocated' AND allocation_group_id IS NOT NULL) OR
    (basis = 'per_kg'    AND allocation_group_id IS NULL)
  )
);

CREATE INDEX expense_lines_batch_idx            ON expense_lines(batch_id);
CREATE INDEX expense_lines_allocation_group_idx ON expense_lines(allocation_group_id);

CREATE TRIGGER trg_expense_lines_updated BEFORE UPDATE ON expense_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── PROCESSING RECORDS ──────────────────────────────────────────────────────

CREATE TABLE processing_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_batch_id  UUID NOT NULL REFERENCES batches(id),
  output_batch_id UUID NOT NULL REFERENCES batches(id),
  input_kg        NUMERIC NOT NULL,
  output_kg       NUMERIC NOT NULL,
  yield_pct       NUMERIC NOT NULL,
  loss_kg         NUMERIC NOT NULL,
  process_type    process_type NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NOT NULL REFERENCES users(id),
  CONSTRAINT proc_kg_valid          CHECK (
    input_kg >= 0 AND output_kg >= 0 AND output_kg <= input_kg AND
    yield_pct >= 0 AND loss_kg >= 0
  ),
  CONSTRAINT proc_distinct_batches  CHECK (input_batch_id <> output_batch_id)
);

CREATE INDEX processing_records_input_idx  ON processing_records(input_batch_id);
CREATE INDEX processing_records_output_idx ON processing_records(output_batch_id);

-- ─── FOREX SNAPSHOTS ─────────────────────────────────────────────────────────

CREATE TABLE forex_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID REFERENCES batches(id),
  usd_ugx_rate BIGINT NOT NULL,
  source       TEXT NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES users(id),
  CONSTRAINT forex_rate_positive CHECK (usd_ugx_rate > 0)
);

CREATE INDEX forex_snapshots_batch_idx       ON forex_snapshots(batch_id);
CREATE INDEX forex_snapshots_captured_at_idx ON forex_snapshots(captured_at DESC);

-- ─── SHIPMENTS ───────────────────────────────────────────────────────────────

CREATE TABLE shipments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_no        TEXT NOT NULL,
  seal_no             TEXT NOT NULL,
  buyer_id            UUID NOT NULL REFERENCES clients(id),
  destination_country TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NOT NULL REFERENCES users(id),
  updated_at          TIMESTAMPTZ
);

CREATE INDEX shipments_buyer_idx ON shipments(buyer_id);

CREATE TRIGGER trg_shipments_updated BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── CONTAINER ALLOCATIONS ───────────────────────────────────────────────────

CREATE TABLE container_allocations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  batch_id    UUID NOT NULL REFERENCES batches(id),
  qty_kg      NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID NOT NULL REFERENCES users(id),
  CONSTRAINT alloc_qty_positive CHECK (qty_kg > 0)
);

CREATE INDEX container_allocations_shipment_idx ON container_allocations(shipment_id);
CREATE INDEX container_allocations_batch_idx    ON container_allocations(batch_id);

-- ─── DOCUMENTS ───────────────────────────────────────────────────────────────

CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID REFERENCES batches(id),
  shipment_id  UUID REFERENCES shipments(id),
  type         TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES users(id),
  CONSTRAINT documents_one_ref CHECK (batch_id IS NOT NULL OR shipment_id IS NOT NULL)
);

CREATE INDEX documents_batch_idx    ON documents(batch_id);
CREATE INDEX documents_shipment_idx ON documents(shipment_id);

-- ─── APPROVALS ───────────────────────────────────────────────────────────────

CREATE TABLE approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES batches(id),
  approved_by UUID NOT NULL REFERENCES users(id),
  approved_at TIMESTAMPTZ NOT NULL,
  amount_ugx  BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID NOT NULL REFERENCES users(id),
  CONSTRAINT approval_amount_nonneg CHECK (amount_ugx >= 0)
);

CREATE INDEX approvals_batch_idx ON approvals(batch_id);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  severity    severity_type NOT NULL,
  message     TEXT NOT NULL,
  target_role role_type,
  target_user UUID REFERENCES users(id),
  entity_type TEXT,
  entity_id   UUID,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID NOT NULL REFERENCES users(id),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX notifications_target_role_idx ON notifications(target_role);
CREATE INDEX notifications_target_user_idx ON notifications(target_user);
CREATE INDEX notifications_read_idx        ON notifications(read);

CREATE TRIGGER trg_notifications_updated BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── AUDIT LOG (append-only) ─────────────────────────────────────────────────

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor       UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  at          TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX audit_log_actor_idx  ON audit_log(actor);
CREATE INDEX audit_log_at_idx     ON audit_log(at DESC);

-- ─── SETTINGS (single row enforced by PK constraint) ─────────────────────────

CREATE TABLE settings (
  id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mc_standard_pct         NUMERIC NOT NULL DEFAULT 14,
  fm_standard_pct         NUMERIC NOT NULL DEFAULT 0.5,
  defect_standard_pct     NUMERIC NOT NULL DEFAULT 4,
  default_defect_handling defect_handling_mode NOT NULL DEFAULT 'weight',
  fm_base                 fm_base_type NOT NULL DEFAULT 'after_mc',
  ura_tax_pct             NUMERIC NOT NULL DEFAULT 2,
  handling_per_kg         BIGINT NOT NULL DEFAULT 100,
  gunny_bags_per_kg       BIGINT NOT NULL DEFAULT 109,
  gunny_bags_usd_ref_rate BIGINT NOT NULL DEFAULT 3800,
  paperwork_per_kg        BIGINT NOT NULL DEFAULT 50,
  target_margin_pct       NUMERIC NOT NULL DEFAULT 12,
  updated_at              TIMESTAMPTZ
);

INSERT INTO settings DEFAULT VALUES;

CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── MIGRATION TRACKING ──────────────────────────────────────────────────────
-- schema_migrations is managed by scripts/migrate.ts — listed here for reference.
-- CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
