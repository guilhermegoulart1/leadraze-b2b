-- Migration: Create website agents tables for public chat widget
-- Date: 2025-11-26

-- Table for website chat agents (sales and support)
CREATE TABLE IF NOT EXISTS website_agents (
  id SERIAL PRIMARY KEY,
  agent_key VARCHAR(50) UNIQUE NOT NULL,  -- 'sales' or 'support'
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  welcome_message TEXT NOT NULL,
  personality TEXT NOT NULL,              -- Personality description
  system_prompt TEXT NOT NULL,            -- System instructions for AI
  tone VARCHAR(50) DEFAULT 'professional',
  response_length VARCHAR(20) DEFAULT 'medium',
  language VARCHAR(10) DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default agents
INSERT INTO website_agents (agent_key, name, welcome_message, personality, system_prompt, language) VALUES
(
  'sales',
  'Raze Sales',
  'Hi! I''m Raze''s sales assistant. How can I help you find the best solution for your company?',
  'B2B sales consultant specialized in lead generation automation. Focused on understanding needs and presenting tailored solutions.',
  'You are a sales consultant for Raze, an AI-powered B2B lead generation platform. Your goals are:
1) Understand the visitor''s business needs and pain points
2) Present relevant features that solve their problems
3) Explain pricing plans clearly when asked
4) Guide them toward starting a free trial or booking a demo
5) Be consultative, not pushy - ask questions to understand before selling

Key features to highlight:
- LinkedIn automation with AI agents
- Email campaign automation
- AI-powered personalization
- CRM integrations
- Real-time analytics

Always be helpful, professional, and focus on value. If you don''t know something, offer to connect them with the team.',
  'en'
),
(
  'support',
  'Raze Support',
  'Hi! I''m Raze''s technical support. How can I help you today?',
  'Technical specialist in LinkedIn automation, email campaigns, and AI agents. Patient and didactic.',
  'You are the technical support specialist for Raze. Your goals are:
1) Understand the user''s problem or question clearly
2) Search the knowledge base for relevant information
3) Provide clear, step-by-step solutions
4) If you cannot solve the issue, offer to connect them with the team via contact form

Common topics:
- LinkedIn account setup and connection
- Email campaign configuration
- AI agent setup and training
- Knowledge base management
- Integration with CRMs
- Billing and subscription questions

Always be patient, clear, and thorough. Use simple language and avoid jargon when possible.',
  'en'
)
ON CONFLICT (agent_key) DO NOTHING;

-- Table for website chat sessions
CREATE TABLE IF NOT EXISTS website_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key VARCHAR(50) NOT NULL REFERENCES website_agents(agent_key),
  session_id VARCHAR(255) NOT NULL,
  messages JSONB DEFAULT '[]',
  visitor_info JSONB DEFAULT '{}',
  visitor_ip VARCHAR(45),
  visitor_country VARCHAR(100),
  visitor_referrer TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMP,
  contact_form_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_website_agents_agent_key ON website_agents(agent_key);
CREATE INDEX IF NOT EXISTS idx_website_agents_is_active ON website_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_website_chat_sessions_session ON website_chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_website_chat_sessions_agent ON website_chat_sessions(agent_key);
CREATE INDEX IF NOT EXISTS idx_website_chat_sessions_started ON website_chat_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_website_chat_sessions_escalated ON website_chat_sessions(escalated) WHERE escalated = true;

-- Table for website agent knowledge base
-- Links to website_agents instead of ai_agents
CREATE TABLE IF NOT EXISTS website_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key VARCHAR(50) REFERENCES website_agents(agent_key) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'faq', 'product_info', 'troubleshooting', 'pricing', 'general'
  question TEXT,             -- For FAQ type
  answer TEXT,               -- For FAQ type
  content TEXT,              -- For other types
  category VARCHAR(100),
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),    -- For semantic search with pgvector
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for knowledge base
CREATE INDEX IF NOT EXISTS idx_website_knowledge_agent ON website_agent_knowledge(agent_key);
CREATE INDEX IF NOT EXISTS idx_website_knowledge_type ON website_agent_knowledge(type);
CREATE INDEX IF NOT EXISTS idx_website_knowledge_active ON website_agent_knowledge(is_active);
CREATE INDEX IF NOT EXISTS idx_website_knowledge_embedding ON website_agent_knowledge
  USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

-- Function for semantic search in website knowledge base
CREATE OR REPLACE FUNCTION search_website_knowledge(
  p_agent_key VARCHAR(50),
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 5,
  p_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type VARCHAR(50),
  question TEXT,
  answer TEXT,
  content TEXT,
  category VARCHAR(100),
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wk.id,
    wk.type,
    wk.question,
    wk.answer,
    wk.content,
    wk.category,
    1 - (wk.embedding <=> p_query_embedding) as similarity
  FROM website_agent_knowledge wk
  WHERE wk.is_active = true
    AND wk.embedding IS NOT NULL
    AND (p_agent_key IS NULL OR wk.agent_key = p_agent_key OR wk.agent_key IS NULL)
    AND (p_type IS NULL OR wk.type = p_type)
  ORDER BY wk.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Insert some initial knowledge base items (shared between both agents)
INSERT INTO website_agent_knowledge (agent_key, type, question, answer, category) VALUES
(NULL, 'faq', 'What is Raze?', 'Raze is an AI-powered B2B lead generation platform that automates LinkedIn outreach, email campaigns, and provides intelligent AI agents to handle conversations with prospects. It helps sales teams generate more qualified leads with less manual effort.', 'general'),
(NULL, 'faq', 'How much does Raze cost?', 'Raze starts at $97/month for the base plan which includes 1 LinkedIn channel and 2 team members. You can add extra channels for $47/month each and extra users for $17/month each. We offer a 70% discount on your first month and a 14-day free trial.', 'pricing'),
(NULL, 'faq', 'Is there a free trial?', 'Yes! We offer a 14-day free trial with full access to all features. No credit card required to start. You can test LinkedIn automation, email campaigns, and AI agents before committing.', 'pricing'),
(NULL, 'faq', 'How does LinkedIn automation work?', 'Raze connects to your LinkedIn account and automates connection requests, messages, and follow-ups. Our AI agents can handle conversations, qualify leads, and book meetings on your behalf. We use smart rate limiting to keep your account safe.', 'features'),
(NULL, 'faq', 'Is my LinkedIn account safe?', 'Safety is our top priority. Raze uses intelligent rate limiting, human-like behavior patterns, and respects LinkedIn''s guidelines. We mimic natural user behavior to protect your account while maximizing results.', 'features'),
(NULL, 'faq', 'What CRM integrations do you support?', 'We integrate with HubSpot, Salesforce, Pipedrive, and many more through native integrations and Zapier. Your leads sync automatically so you never lose track of opportunities.', 'features'),
(NULL, 'faq', 'Can I cancel anytime?', 'Yes, absolutely. You can cancel your subscription at any time from your billing settings. Your access continues until the end of your current billing period.', 'pricing'),
(NULL, 'troubleshooting', 'LinkedIn connection issues', 'If you''re having trouble connecting your LinkedIn account: 1) Make sure you''re logged into LinkedIn in your browser 2) Disable any VPN or proxy 3) Try using an incognito window 4) Clear your browser cache and cookies 5) If issues persist, contact our support team.', 'linkedin'),
(NULL, 'troubleshooting', 'Email not sending', 'If your emails aren''t sending: 1) Check your email provider connection in settings 2) Verify your sending limits haven''t been exceeded 3) Check if your domain has proper SPF/DKIM records 4) Review the email content for spam triggers 5) Contact support if the issue continues.', 'email')
ON CONFLICT DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_website_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS website_agents_updated_at ON website_agents;
CREATE TRIGGER website_agents_updated_at
  BEFORE UPDATE ON website_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_website_agents_updated_at();

DROP TRIGGER IF EXISTS website_knowledge_updated_at ON website_agent_knowledge;
CREATE TRIGGER website_knowledge_updated_at
  BEFORE UPDATE ON website_agent_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_website_agents_updated_at();
