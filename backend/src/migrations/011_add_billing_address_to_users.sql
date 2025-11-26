-- Migration: Add billing_address column to users table
-- For storing address data collected during Stripe checkout

ALTER TABLE users
ADD COLUMN IF NOT EXISTS billing_address JSONB;

-- Add comment
COMMENT ON COLUMN users.billing_address IS 'Billing address from Stripe checkout (line1, line2, city, state, postal_code, country)';
