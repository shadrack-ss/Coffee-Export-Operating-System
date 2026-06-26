-- Allow admins to void (soft-delete) a batch without losing audit history.

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS voided_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by   UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT;
