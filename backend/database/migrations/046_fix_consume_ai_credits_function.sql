-- Migration: Fix consume_ai_credits function
-- Description: Adds credit_type to credit_usage insert
-- Date: 2024-12-03

-- Recreate the function with fixed INSERT statement
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

        -- Log usage (now including credit_type!)
        INSERT INTO credit_usage (
            account_id, credit_package_id, credit_type, credits_used,
            resource_type, resource_id, user_id, description
        ) VALUES (
            p_account_id, v_package.id, v_package.credit_type, v_to_consume,
            p_resource_type, p_resource_id, p_user_id, p_description
        );

        v_remaining := v_remaining - v_to_consume;
    END LOOP;

    RETURN v_remaining = 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION consume_ai_credits IS 'Consumes AI credits using FIFO (monthly first, then permanent) - now includes credit_type in usage log';
