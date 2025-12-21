-- Migration 096: Create template ratings table
-- Purpose: Store user ratings and reviews for community templates

-- Create template_ratings table
CREATE TABLE IF NOT EXISTS template_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES agent_templates(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Rating
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one rating per account per template
  UNIQUE(template_id, account_id)
);

-- Create indexes
CREATE INDEX idx_template_ratings_template ON template_ratings(template_id);
CREATE INDEX idx_template_ratings_account ON template_ratings(account_id);
CREATE INDEX idx_template_ratings_rating ON template_ratings(rating);

-- Add comments
COMMENT ON TABLE template_ratings IS 'User ratings and reviews for community templates';
COMMENT ON COLUMN template_ratings.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN template_ratings.review IS 'Optional text review';

-- Function to update template rating stats
CREATE OR REPLACE FUNCTION update_template_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agent_templates
    SET
      rating_count = rating_count + 1,
      rating_sum = rating_sum + NEW.rating,
      updated_at = NOW()
    WHERE id = NEW.template_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE agent_templates
    SET
      rating_sum = rating_sum - OLD.rating + NEW.rating,
      updated_at = NOW()
    WHERE id = NEW.template_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE agent_templates
    SET
      rating_count = rating_count - 1,
      rating_sum = rating_sum - OLD.rating,
      updated_at = NOW()
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update rating stats
CREATE TRIGGER trigger_update_template_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON template_ratings
FOR EACH ROW
EXECUTE FUNCTION update_template_rating_stats();

-- =====================================================
-- Create template_usage table to track usage
-- =====================================================

CREATE TABLE IF NOT EXISTS template_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES agent_templates(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,

  -- Usage tracking
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_template_usage_template ON template_usage(template_id);
CREATE INDEX idx_template_usage_account ON template_usage(account_id);
CREATE INDEX idx_template_usage_date ON template_usage(used_at);

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_templates
  SET
    usage_count = usage_count + 1,
    updated_at = NOW()
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment usage
CREATE TRIGGER trigger_increment_template_usage
AFTER INSERT ON template_usage
FOR EACH ROW
EXECUTE FUNCTION increment_template_usage();

-- Add comments
COMMENT ON TABLE template_usage IS 'Tracks when templates are used to create agents';
