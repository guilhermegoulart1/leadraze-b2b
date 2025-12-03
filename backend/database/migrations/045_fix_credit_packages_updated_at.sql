-- Migration: Fix credit_packages updated_at column
-- Description: Adds missing updated_at column to credit_packages table
-- Date: 2024-12-03

-- Add updated_at column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_packages'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Update existing rows to have updated_at = created_at
UPDATE credit_packages
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_credit_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_credit_packages_updated_at ON credit_packages;

CREATE TRIGGER trigger_credit_packages_updated_at
    BEFORE UPDATE ON credit_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_packages_updated_at();

COMMENT ON COLUMN credit_packages.updated_at IS 'Timestamp of last update';
