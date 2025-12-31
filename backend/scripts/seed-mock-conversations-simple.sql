-- Script para criar conversas mock para visualização do layout
-- Execute direto no banco: psql -U seu_usuario -d getraze_db -f backend/scripts/seed-mock-conversations-simple.sql
-- Ou copie e cole no seu cliente PostgreSQL

BEGIN;

-- Pegar o primeiro user_id e linkedin_account_id disponível
DO $$
DECLARE
    v_user_id UUID;
    v_campaign_id UUID;
    v_linkedin_account_id UUID;
    v_ai_agent_id UUID;
    v_lead_id UUID;
BEGIN
    -- Pegar primeiro usuário
    SELECT id INTO v_user_id FROM users LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum usuário encontrado. Crie um usuário primeiro.';
    END IF;

    -- Pegar primeira conta LinkedIn
    SELECT id INTO v_linkedin_account_id FROM linkedin_accounts WHERE user_id = v_user_id LIMIT 1;

    IF v_linkedin_account_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma conta LinkedIn encontrada. Conecte uma conta primeiro.';
    END IF;

    -- Pegar primeiro AI agent (opcional)
    SELECT id INTO v_ai_agent_id FROM ai_agents WHERE user_id = v_user_id LIMIT 1;

    -- Criar campanha mock
    INSERT INTO campaigns (
        id, user_id, name, description, status,
        total_leads, leads_pending, created_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        'Campanha Mock - Visualização',
        'Campanha temporária para visualizar layout de conversas',
        'active',
        10, 0,
        NOW() - INTERVAL '7 days'
    ) RETURNING id INTO v_campaign_id;

    RAISE NOTICE 'Campanha criada: %', v_campaign_id;

    -- LEAD 1: João Silva - CEO - UNREAD (3)
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'João Silva',
        'CEO & Founder',
        'TechCorp Innovations',
        'https://linkedin.com/in/joao-silva-mock',
        'https://i.pravatar.cc/150?img=12',
        'mock_joao_silva',
        'qualifying',
        85,
        NOW() - INTERVAL '5 days'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_001',
        'ai_active',
        'Perfeito! Vamos agendar uma call para semana que vem?',
        NOW() - INTERVAL '15 minutes',
        3,
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '15 minutes'
    );

    -- LEAD 2: Maria Santos - CTO - Manual Mode
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Maria Santos',
        'CTO',
        'DataFlow Solutions',
        'https://linkedin.com/in/maria-santos-mock',
        'https://i.pravatar.cc/150?img=5',
        'mock_maria_santos',
        'qualifying',
        92,
        NOW() - INTERVAL '4 days'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, ai_paused_at, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_002',
        'manual',
        'Obrigada pelo interesse! Podemos marcar para amanhã às 14h?',
        NOW() - INTERVAL '1 hour',
        0,
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '4 days',
        NOW() - INTERVAL '1 hour'
    );

    -- LEAD 3: Pedro Oliveira - Diretor - UNREAD (1)
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Pedro Oliveira',
        'Diretor de Marketing',
        'Marketing Pro Agency',
        'https://linkedin.com/in/pedro-oliveira-mock',
        'https://i.pravatar.cc/150?img=33',
        'mock_pedro_oliveira',
        'invite_sent',
        68,
        NOW() - INTERVAL '3 days'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_003',
        'ai_active',
        'Interessante! Me conta mais sobre os benefícios.',
        NOW() - INTERVAL '2 hours',
        1,
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '2 hours'
    );

    -- LEAD 4: Ana Costa - Gerente - AI Active
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Ana Costa',
        'Gerente de Vendas',
        'SalesForce Brasil',
        'https://linkedin.com/in/ana-costa-mock',
        'mock_ana_costa',
        'qualifying',
        75,
        NOW() - INTERVAL '6 days'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_004',
        'ai_active',
        'Estou avaliando algumas opções no mercado atualmente.',
        NOW() - INTERVAL '4 hours',
        0,
        NOW() - INTERVAL '6 days',
        NOW() - INTERVAL '4 hours'
    );

    -- LEAD 5: Carlos Mendes - VP - UNREAD (5)
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Carlos Mendes',
        'VP de Tecnologia',
        'CloudTech Enterprise',
        'https://linkedin.com/in/carlos-mendes-mock',
        'https://i.pravatar.cc/150?img=56',
        'mock_carlos_mendes',
        'qualifying',
        95,
        NOW() - INTERVAL '2 days'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_005',
        'ai_active',
        'Sim! Tenho interesse. Pode me enviar mais informações?',
        NOW() - INTERVAL '30 minutes',
        5,
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '30 minutes'
    );

    -- LEAD 6: Juliana Ferreira - Coordenadora
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Juliana Ferreira',
        'Coordenadora de Projetos',
        'ProjectHub Consulting',
        'https://linkedin.com/in/juliana-ferreira-mock',
        'https://i.pravatar.cc/150?img=20',
        'mock_juliana_ferreira',
        'qualifying',
        72,
        NOW() - INTERVAL '1 day'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_006',
        'manual',
        'Vou discutir com a equipe e te retorno em breve.',
        NOW() - INTERVAL '8 hours',
        0,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '8 hours'
    );

    -- LEAD 7: Ricardo Alves - Fundador - UNREAD (2)
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Ricardo Alves',
        'Fundador & CEO',
        'StartupHub Aceleradora',
        'https://linkedin.com/in/ricardo-alves-mock',
        'https://i.pravatar.cc/150?img=68',
        'mock_ricardo_alves',
        'qualifying',
        88,
        NOW() - INTERVAL '3 hours'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_007',
        'ai_active',
        'Muito interessante! Vocês trabalham com startups?',
        NOW() - INTERVAL '45 minutes',
        2,
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '45 minutes'
    );

    -- LEAD 8: Fernanda Lima - Diretora
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Fernanda Lima',
        'Diretora de Operações',
        'Operations Excellence Corp',
        'https://linkedin.com/in/fernanda-lima-mock',
        'mock_fernanda_lima',
        'invite_sent',
        65,
        NOW() - INTERVAL '12 hours'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_008',
        'ai_active',
        'Olá! Vi sua mensagem, vamos conversar.',
        NOW() - INTERVAL '6 hours',
        0,
        NOW() - INTERVAL '12 hours',
        NOW() - INTERVAL '6 hours'
    );

    -- LEAD 9: Lucas Rodrigues - Analista
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Lucas Rodrigues',
        'Analista Sênior de Negócios',
        'Business Analytics Inc',
        'https://linkedin.com/in/lucas-rodrigues-mock',
        'https://i.pravatar.cc/150?img=51',
        'mock_lucas_rodrigues',
        'qualifying',
        80,
        NOW() - INTERVAL '8 hours'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_009',
        'manual',
        'Posso te passar o contato do meu gestor, ele que toma decisões.',
        NOW() - INTERVAL '1 day',
        0,
        NOW() - INTERVAL '8 hours',
        NOW() - INTERVAL '1 day'
    );

    -- LEAD 10: Patrícia Souza - Gerente - UNREAD (1)
    INSERT INTO leads (
        campaign_id, name, title, company, profile_url, profile_picture,
        linkedin_profile_id, status, score, created_at
    ) VALUES (
        v_campaign_id,
        'Patrícia Souza',
        'Gerente de Produto',
        'ProductHub Digital',
        'https://linkedin.com/in/patricia-souza-mock',
        'https://i.pravatar.cc/150?img=47',
        'mock_patricia_souza',
        'qualifying',
        78,
        NOW() - INTERVAL '5 hours'
    ) RETURNING id INTO v_lead_id;

    INSERT INTO conversations (
        lead_id, campaign_id, linkedin_account_id, ai_agent_id,
        unipile_chat_id, status, last_message_preview, last_message_at,
        unread_count, created_at, updated_at
    ) VALUES (
        v_lead_id, v_campaign_id, v_linkedin_account_id, v_ai_agent_id,
        'chat_mock_010',
        'ai_active',
        'Legal! Qual o investimento inicial necessário?',
        NOW() - INTERVAL '10 minutes',
        1,
        NOW() - INTERVAL '5 hours',
        NOW() - INTERVAL '10 minutes'
    );

    RAISE NOTICE '✅ 10 conversas mock criadas com sucesso!';
    RAISE NOTICE 'Campanha ID: %', v_campaign_id;
    RAISE NOTICE '';
    RAISE NOTICE '📊 Distribuição:';
    RAISE NOTICE '   - AI Active: 7 conversas';
    RAISE NOTICE '   - Manual: 3 conversas';
    RAISE NOTICE '   - Não lidas: 6 conversas (total: 12 mensagens)';
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  Para remover: DELETE FROM campaigns WHERE name = ''Campanha Mock - Visualização'';';

END $$;

COMMIT;
