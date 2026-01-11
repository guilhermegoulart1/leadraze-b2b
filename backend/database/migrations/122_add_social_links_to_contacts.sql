-- Migration 122: Add social media links to contacts
-- Instagram and Facebook URLs for contact profiles

-- Add Instagram URL
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Add Facebook URL
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS facebook_url TEXT;

-- Comments
COMMENT ON COLUMN contacts.instagram_url IS 'Instagram profile URL';
COMMENT ON COLUMN contacts.facebook_url IS 'Facebook profile URL';
