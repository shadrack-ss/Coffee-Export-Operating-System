-- usd_ugx_rate was BIGINT which silently truncates decimals (e.g. URA rate 3743.1071 → 3743).
-- Change to NUMERIC(12,4) to preserve up to 4 decimal places.
ALTER TABLE forex_snapshots
  ALTER COLUMN usd_ugx_rate TYPE NUMERIC(12,4) USING usd_ugx_rate::NUMERIC(12,4);

ALTER TABLE forex_snapshots
  DROP CONSTRAINT IF EXISTS forex_rate_positive,
  ADD CONSTRAINT forex_rate_positive CHECK (usd_ugx_rate > 0);
