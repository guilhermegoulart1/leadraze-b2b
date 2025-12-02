-- ================================================
-- Migration 014: Add Multi-Tenancy Support
-- ================================================
-- Adds accounts (companies) table and account_id to all relevant tables
-- Ensures data isolation between different companies

BEGIN;

-- ================================
-- 1. CREATE ACCOUNTS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,

  -- Company details
  company_email VARCHAR(255),
  company_phone VARCHAR(50),
  company_website VARCHAR(255),

  -- Billing and plan
  plan VARCHAR(50) DEFAULT 'free', -- free, starter, professional, enterprise
  billing_email VARCHAR(255),
  max_users INTEGER DEFAULT 5,
  max_contacts INTEGER DEFAULT 1000,

  -- Settings (JSONB for flexibility)
  settings JSONB DEFAULT '{}'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active);

-- ================================
-- 2. ADD ACCOUNT_ID TO USERS
-- ================================

-- Add column (allow NULL temporarily for migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID;

-- Create index
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);

-- ================================
-- 3. MIGRATE EXISTING USERS TO ACCOUNTS
-- ================================

-- Create separate accounts for each existing user based on email domain
-- Users with same domain will be grouped into same account

DO $$
DECLARE
  user_record RECORD;
  email_domain TEXT;
  account_uuid UUID;
  account_name TEXT;
  account_slug TEXT;
BEGIN
  FOR user_record IN SELECT id, email, name FROM users WHERE account_id IS NULL
  LOOP
    -- Extract email domain
    email_domain := SPLIT_PART(user_record.email, '@', 2);

    -- Create account name from domain
    account_name := INITCAP(SPLIT_PART(email_domain, '.', 1));
    account_slug := LOWER(SPLIT_PART(email_domain, '.', 1)) || '_' || SUBSTRING(MD5(user_record.email), 1, 6);

    -- Check if account for this domain already exists
    SELECT id INTO account_uuid
    FROM accounts
    WHERE slug LIKE LOWER(SPLIT_PART(email_domain, '.', 1)) || '%'
    LIMIT 1;

    -- If not exists, create new account
    IF account_uuid IS NULL THEN
      INSERT INTO accounts (name, slug, company_email, is_active)
      VALUES (account_name, account_slug, user_record.email, true)
      RETURNING id INTO account_uuid;

      RAISE NOTICE 'Created account: % (%) for user: %', account_name, account_uuid, user_record.email;
    END IF;

    -- Assign user to account
    UPDATE users SET account_id = account_uuid WHERE id = user_record.id;
  END LOOP;
END $$;

-- Now make account_id NOT NULL
ALTER TABLE users ALTER COLUMN account_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE users ADD CONSTRAINT fk_users_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- ================================
-- 4. ADD ACCOUNT_ID TO OTHER TABLES
-- ================================

-- Campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);

-- Update campaigns with account_id from user
UPDATE campaigns c
SET account_id = u.account_id
FROM users u
WHERE c.user_id = u.id AND c.account_id IS NULL;

ALTER TABLE campaigns ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE campaigns ADD CONSTRAINT fk_campaigns_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Leads (get account_id from campaign)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);

UPDATE leads l
SET account_id = c.account_id
FROM campaigns c
WHERE l.campaign_id = c.id AND l.account_id IS NULL AND c.account_id IS NOT NULL;

-- For leads without campaign, try to infer from other data (skip for now)
-- They will be handled after campaign migration is complete

ALTER TABLE leads ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE leads ADD CONSTRAINT fk_leads_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);

UPDATE contacts c
SET account_id = u.account_id
FROM users u
WHERE c.user_id = u.id AND c.account_id IS NULL;

ALTER TABLE contacts ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE contacts ADD CONSTRAINT fk_contacts_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_conversations_account_id ON conversations(account_id);

UPDATE conversations c
SET account_id = u.account_id
FROM users u
WHERE c.user_id = u.id AND c.account_id IS NULL;

ALTER TABLE conversations ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE conversations ADD CONSTRAINT fk_conversations_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- AI Agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_ai_agents_account_id ON ai_agents(account_id);

UPDATE ai_agents a
SET account_id = u.account_id
FROM users u
WHERE a.user_id = u.id AND a.account_id IS NULL;

ALTER TABLE ai_agents ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE ai_agents ADD CONSTRAINT fk_ai_agents_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- LinkedIn Accounts
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_account_id ON linkedin_accounts(account_id);

UPDATE linkedin_accounts la
SET account_id = u.account_id
FROM users u
WHERE la.user_id = u.id AND la.account_id IS NULL;

ALTER TABLE linkedin_accounts ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE linkedin_accounts ADD CONSTRAINT fk_linkedin_accounts_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Tags (global per account)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_tags_account_id ON tags(account_id);

-- Remove old unique constraint on name (will be replaced with account+name)
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;

-- Assign tags to accounts based on first user that might use them
-- For now, create a copy of each tag for each account
DO $$
DECLARE
  tag_record RECORD;
  account_record RECORD;
  new_tag_id UUID;
BEGIN
  -- For each tag without account_id
  FOR tag_record IN SELECT * FROM tags WHERE account_id IS NULL
  LOOP
    -- For each account, create a copy of the tag
    FOR account_record IN SELECT id FROM accounts
    LOOP
      -- Check if this tag already exists for this account
      IF NOT EXISTS (
        SELECT 1 FROM tags
        WHERE name = tag_record.name
        AND account_id = account_record.id
      ) THEN
        -- Create tag for this account
        INSERT INTO tags (account_id, name, color, description, created_at)
        VALUES (
          account_record.id,
          tag_record.name,
          tag_record.color,
          tag_record.description,
          tag_record.created_at
        );
      END IF;
    END LOOP;

    -- Delete original tag without account_id
    DELETE FROM tags WHERE id = tag_record.id;
  END LOOP;
END $$;

ALTER TABLE tags ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE tags ADD CONSTRAINT fk_tags_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Make tag names unique per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_account_name ON tags(account_id, name);

-- ================================
-- 5. UPDATE PERMISSIONS TABLE
-- ================================

-- Permissions are global (not per account), but role_permissions can be customized per account
-- Add account_id to role_permissions for account-specific customization

ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS account_id UUID;
CREATE INDEX IF NOT EXISTS idx_role_permissions_account ON role_permissions(account_id);

-- Remove old unique constraint (will be replaced with account+role+permission)
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_permission_id_key;

-- Migrate existing role_permissions to all accounts
DO $$
DECLARE
  perm_record RECORD;
  account_record RECORD;
BEGIN
  FOR perm_record IN SELECT * FROM role_permissions WHERE account_id IS NULL
  LOOP
    FOR account_record IN SELECT id FROM accounts
    LOOP
      -- Create permission for this account
      IF NOT EXISTS (
        SELECT 1 FROM role_permissions
        WHERE role = perm_record.role
        AND permission_id = perm_record.permission_id
        AND account_id = account_record.id
      ) THEN
        INSERT INTO role_permissions (account_id, role, permission_id, created_at)
        VALUES (
          account_record.id,
          perm_record.role,
          perm_record.permission_id,
          perm_record.created_at
        );
      END IF;
    END LOOP;

    -- Delete original without account_id
    DELETE FROM role_permissions WHERE id = perm_record.id;
  END LOOP;
END $$;

ALTER TABLE role_permissions ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_account
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Make role+permission unique per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_account_role_permission
  ON role_permissions(account_id, role, permission_id);

-- ================================
-- 6. CREATE VIEWS FOR REPORTING
-- ================================

CREATE OR REPLACE VIEW account_stats AS
SELECT
  a.id as account_id,
  a.name as account_name,
  a.slug,
  a.plan,
  a.is_active,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT c.id) as total_campaigns,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT ct.id) as total_contacts,
  COUNT(DISTINCT cn.id) as total_conversations,
  a.created_at
FROM accounts a
LEFT JOIN users u ON u.account_id = a.id
LEFT JOIN campaigns c ON c.account_id = a.id
LEFT JOIN leads l ON l.account_id = a.id
LEFT JOIN contacts ct ON ct.account_id = a.id
LEFT JOIN conversations cn ON cn.account_id = a.id
GROUP BY a.id, a.name, a.slug, a.plan, a.is_active, a.created_at;

-- ================================
-- 7. ADD COMMENTS
-- ================================

COMMENT ON TABLE accounts IS 'Companies/Organizations - each account has isolated data';
COMMENT ON COLUMN accounts.slug IS 'Unique identifier for account URLs and references';
COMMENT ON COLUMN accounts.plan IS 'Subscription plan: free, starter, professional, enterprise';
COMMENT ON COLUMN accounts.max_users IS 'Maximum users allowed for this account';
COMMENT ON COLUMN accounts.max_contacts IS 'Maximum contacts allowed for this account';

COMMIT;

-- ================================
-- SUCCESS MESSAGE
-- ================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 014 completed successfully!';
  RAISE NOTICE '📊 Multi-tenancy enabled:';
  RAISE NOTICE '   - Created accounts table';
  RAISE NOTICE '   - Added account_id to all relevant tables';
  RAISE NOTICE '   - Migrated existing data to separate accounts';
  RAISE NOTICE '   - Created data isolation indexes';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. Update middleware to filter by account_id';
  RAISE NOTICE '   2. Update all controllers to include account_id';
  RAISE NOTICE '   3. Test data isolation between accounts';
  RAISE NOTICE '';
END $$;
