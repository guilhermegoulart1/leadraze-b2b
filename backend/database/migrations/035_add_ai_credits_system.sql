-- Migration: Add AI Credits System
-- Description: Adds support for AI agent message credits
-- Date: 2024-11-28

-- Add credit_type column to credit_packages if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'credit_packages'
        AND column_name = 'credit_type'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN credit_type VARCHAR(50) DEFAULT 'gmaps';
    END IF;
END $$;

-- Update existing credit packages to have gmaps credit_type
UPDATE credit_packages
SET credit_type = 'gmaps'
WHERE credit_type IS NULL;

-- Add monthly_ai_credits to subscriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions'
        AND column_name = 'monthly_ai_credits'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN monthly_ai_credits INTEGER DEFAULT 5000;
    END IF;
END $$;

-- Update existing subscriptions to have 5000 monthly AI credits
UPDATE subscriptions
SET monthly_ai_credits = 5000
WHERE monthly_ai_credits IS NULL;

-- Create function to get available AI credits
CREATE OR REPLACE FUNCTION get_available_ai_credits(p_account_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_credits INTEGER;
BEGIN
    SELECT COALESCE(SUM(remaining_credits), 0) INTO total_credits
    FROM credit_packages
    WHERE account_id = p_account_id
      AND credit_type IN ('ai', 'ai_monthly')
      AND status = 'active'
      AND remaining_credits > 0
      AND (expires_at IS NULL OR expires_at > NOW() OR never_expires = true);

    RETURN total_credits;
END;
$$ LANGUAGE plpgsql;

-- Create function to consume AI credits (FIFO - monthly credits first, then permanent)
CREATE OR REPLACE FUNCTION consume_ai_credits(
    p_account_id UUID,
    p_amount INTEGER,
    p_resource_type VARCHAR(100),
    p_resource_id UUID,
    p_user_id UUID,
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_package RECORD;
    v_remaining INTEGER;
    v_to_consume INTEGER;
BEGIN
    v_remaining := p_amount;

    -- Loop through available packages (monthly credits first - FIFO by expiration)
    FOR v_package IN
        SELECT id, remaining_credits, credit_type
        FROM credit_packages
        WHERE account_id = p_account_id
          AND credit_type IN ('ai', 'ai_monthly')
          AND status = 'active'
          AND remaining_credits > 0
          AND (expires_at IS NULL OR expires_at > NOW() OR never_expires = true)
        ORDER BY
            CASE WHEN credit_type = 'ai_monthly' THEN 0 ELSE 1 END,  -- Monthly first
            expires_at NULLS LAST,
            created_at ASC
    LOOP
        IF v_remaining <= 0 THEN
            EXIT;
        END IF;

        v_to_consume := LEAST(v_package.remaining_credits, v_remaining);

        -- Update package
        UPDATE credit_packages
        SET remaining_credits = remaining_credits - v_to_consume,
            status = CASE WHEN remaining_credits - v_to_consume <= 0 THEN 'exhausted' ELSE 'active' END,
            updated_at = NOW()
        WHERE id = v_package.id;

        -- Log usage
        INSERT INTO credit_usage (
            account_id, credit_package_id, credits_used,
            resource_type, resource_id, user_id, description
        ) VALUES (
            p_account_id, v_package.id, v_to_consume,
            p_resource_type, p_resource_id, p_user_id, p_description
        );

        v_remaining := v_remaining - v_to_consume;
    END LOOP;

    RETURN v_remaining = 0;
END;
$$ LANGUAGE plpgsql;

-- Create view for AI credits summary
CREATE OR REPLACE VIEW account_ai_credits_summary AS
SELECT
    a.id as account_id,
    COALESCE(monthly.remaining, 0) as monthly_remaining,
    COALESCE(monthly.total, 0) as monthly_total,
    COALESCE(permanent.remaining, 0) as permanent_remaining,
    COALESCE(permanent.total, 0) as permanent_total,
    COALESCE(monthly.remaining, 0) + COALESCE(permanent.remaining, 0) as total_available,
    monthly.expires_at as monthly_expires_at
FROM accounts a
LEFT JOIN LATERAL (
    SELECT
        SUM(remaining_credits) as remaining,
        SUM(initial_credits) as total,
        MIN(expires_at) as expires_at
    FROM credit_packages
    WHERE account_id = a.id
      AND credit_type = 'ai_monthly'
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
) monthly ON true
LEFT JOIN LATERAL (
    SELECT
        SUM(remaining_credits) as remaining,
        SUM(initial_credits) as total
    FROM credit_packages
    WHERE account_id = a.id
      AND credit_type = 'ai'
      AND status = 'active'
      AND never_expires = true
) permanent ON true;

-- Add index for faster credit lookups
CREATE INDEX IF NOT EXISTS idx_credit_packages_ai_lookup
ON credit_packages(account_id, credit_type, status, remaining_credits)
WHERE credit_type IN ('ai', 'ai_monthly');

COMMENT ON FUNCTION get_available_ai_credits IS 'Returns total available AI credits for an account';
COMMENT ON FUNCTION consume_ai_credits IS 'Consumes AI credits using FIFO (monthly first, then permanent)';
COMMENT ON VIEW account_ai_credits_summary IS 'Summary of AI credits for each account';
