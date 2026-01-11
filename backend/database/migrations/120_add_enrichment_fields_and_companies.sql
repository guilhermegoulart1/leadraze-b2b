-- Migration 120: Add enrichment fields to contacts and create companies table
-- For full LinkedIn profile enrichment of 1st degree connections

-- ============================================
-- ADD ENRICHMENT FIELDS TO CONTACTS
-- ============================================

-- Basic profile fields
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS follower_count INTEGER,
ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_influencer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_open_to_work BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_hiring BOOLEAN DEFAULT FALSE;

-- LinkedIn identifiers
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS public_identifier VARCHAR(255),
ADD COLUMN IF NOT EXISTS member_urn VARCHAR(255),
ADD COLUMN IF NOT EXISTS primary_locale JSONB;

-- Enrichment status
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS full_profile_fetched_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS network_distance VARCHAR(50);

-- Additional rich data fields (JSONB)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS publications JSONB,
ADD COLUMN IF NOT EXISTS volunteer_experience JSONB,
ADD COLUMN IF NOT EXISTS honors_awards JSONB,
ADD COLUMN IF NOT EXISTS projects JSONB,
ADD COLUMN IF NOT EXISTS courses JSONB,
ADD COLUMN IF NOT EXISTS patents JSONB,
ADD COLUMN IF NOT EXISTS recommendations JSONB;

-- Company reference
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS current_company_id UUID;

-- ============================================
-- CREATE COMPANIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- LinkedIn identifiers
  linkedin_company_id VARCHAR(255),
  linkedin_url TEXT,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  website TEXT,
  industry VARCHAR(255),

  -- Size and location
  company_size VARCHAR(100),
  employee_count_min INTEGER,
  employee_count_max INTEGER,
  headquarters TEXT,
  locations JSONB,

  -- Description
  description TEXT,
  tagline TEXT,
  specialties JSONB,

  -- Founding
  founded INTEGER,
  company_type VARCHAR(100),

  -- Social
  follower_count INTEGER,

  -- Rich data
  similar_companies JSONB,
  recent_updates JSONB,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enriched_at TIMESTAMP,

  -- Unique constraint
  UNIQUE(account_id, linkedin_company_id)
);

-- ============================================
-- ADD FOREIGN KEY FOR COMPANY REFERENCE
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_contacts_current_company'
  ) THEN
    ALTER TABLE contacts
    ADD CONSTRAINT fk_contacts_current_company
    FOREIGN KEY (current_company_id)
    REFERENCES companies(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Contacts enrichment indexes
CREATE INDEX IF NOT EXISTS idx_contacts_public_identifier ON contacts(public_identifier);
CREATE INDEX IF NOT EXISTS idx_contacts_full_profile_fetched_at ON contacts(full_profile_fetched_at);
CREATE INDEX IF NOT EXISTS idx_contacts_network_distance ON contacts(network_distance);
CREATE INDEX IF NOT EXISTS idx_contacts_current_company_id ON contacts(current_company_id);

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_account_id ON companies(account_id);
CREATE INDEX IF NOT EXISTS idx_companies_linkedin_company_id ON companies(linkedin_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN contacts.public_identifier IS 'LinkedIn public identifier (username slug)';
COMMENT ON COLUMN contacts.member_urn IS 'LinkedIn member URN';
COMMENT ON COLUMN contacts.full_profile_fetched_at IS 'When the full profile was last enriched';
COMMENT ON COLUMN contacts.network_distance IS 'LinkedIn connection degree: SELF, FIRST_DEGREE, SECOND_DEGREE, etc';
COMMENT ON COLUMN contacts.current_company_id IS 'Reference to the current company from LinkedIn';

COMMENT ON TABLE companies IS 'Companies database enriched from LinkedIn';
COMMENT ON COLUMN companies.linkedin_company_id IS 'LinkedIn company ID for API lookups';
COMMENT ON COLUMN companies.company_size IS 'Size range like "51-200 employees"';
COMMENT ON COLUMN companies.specialties IS 'Array of company specialties/services';
