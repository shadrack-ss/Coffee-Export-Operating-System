-- Add optional phone number to users for phone-based login.
-- Unique when non-null; stored in E.164 format or any consistent local format.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
