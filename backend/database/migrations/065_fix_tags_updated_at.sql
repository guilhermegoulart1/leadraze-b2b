-- Migration: Fix tags updated_at column
-- Description: Add updated_at column to tags table (required by existing trigger)

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tags' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tags ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_tags_updated_at_trigger ON tags;

-- Drop existing function if it exists (with CASCADE)
DROP FUNCTION IF EXISTS update_tags_updated_at() CASCADE;

-- Recreate the function properly
CREATE OR REPLACE FUNCTION update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_tags_updated_at_trigger
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_updated_at();
