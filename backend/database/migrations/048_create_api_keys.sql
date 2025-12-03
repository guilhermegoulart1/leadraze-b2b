-- ================================================
-- Migration 048: Create API Keys System
-- ================================================
-- Allows customers to generate API keys for external integrations
-- Keys are stored hashed (SHA-256) for security

BEGIN;

-- ================================
-- 1. CREATE API_KEYS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Key identification
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash of the API key
  key_prefix VARCHAR(12) NOT NULL, -- First chars for visual identification (e.g., "lr_live_xxxx")

  -- Permissions and limits
  permissions JSONB DEFAULT '["contacts:read","contacts:write","opportunities:read","opportunities:write"]'::jsonb,
  rate_limit INTEGER DEFAULT 1000,  -- requests per hour

  -- Usage tracking
  last_used_at TIMESTAMP,
  request_count INTEGER DEFAULT 0,

  -- Lifecycle
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- ================================
-- 2. CREATE API KEY USAGE LOGS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS api_key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request details
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,

  -- Client info
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Request/Response metadata
  request_body_size INTEGER,
  response_body_size INTEGER,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics and rate limiting
CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key_id ON api_key_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_time ON api_key_usage_logs(api_key_id, created_at);

-- ================================
-- 3. CREATE RATE LIMIT TRACKING TABLE
-- ================================
-- For persistent rate limiting (in addition to Redis)

CREATE TABLE IF NOT EXISTS api_key_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMP NOT NULL,
  request_count INTEGER DEFAULT 0,

  UNIQUE(api_key_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_key_window ON api_key_rate_limits(api_key_id, window_start);

-- ================================
-- 4. ADD COMMENTS
-- ================================

COMMENT ON TABLE api_keys IS 'API keys for external integrations - keys are stored hashed';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key - never store plain text';
COMMENT ON COLUMN api_keys.key_prefix IS 'First characters of the key for visual identification';
COMMENT ON COLUMN api_keys.permissions IS 'JSON array of permission scopes (e.g., contacts:read)';
COMMENT ON COLUMN api_keys.rate_limit IS 'Maximum requests per hour';

COMMENT ON TABLE api_key_usage_logs IS 'Logs all API key requests for analytics and debugging';
COMMENT ON TABLE api_key_rate_limits IS 'Tracks request counts per time window for rate limiting';

COMMIT;

-- ================================
-- SUCCESS MESSAGE
-- ================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '======================================';
  RAISE NOTICE ' Migration 048 completed successfully!';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - api_keys: Store API keys (hashed)';
  RAISE NOTICE '  - api_key_usage_logs: Request logs';
  RAISE NOTICE '  - api_key_rate_limits: Rate limiting';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Create apiKeyAuth.js middleware';
  RAISE NOTICE '  2. Create apiKeyService.js';
  RAISE NOTICE '  3. Create apiKeyController.js';
  RAISE NOTICE '  4. Create routes/apiKeys.js';
  RAISE NOTICE '';
END $$;
