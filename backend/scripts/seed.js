// backend/scripts/seed.js
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Dados de exemplo
const EXAMPLE_LEADS = [
  {
    name: 'João Silva',
    title: 'CEO',
    company: 'Tech Solutions Brasil',
    location: 'São Paulo, SP',
    status: 'lead',
    score: 85,
    headline: 'CEO & Founder at Tech Solutions Brasil | Transformação Digital',
    profile_picture: null
  },
  {
    name: 'Maria Santos',
    title: 'CTO',
    company: 'Digital Ventures',
    location: 'Rio de Janeiro, RJ',
    status: 'invite_sent',
    score: 92,
    headline: 'Chief Technology Officer | AI & Cloud Computing',
    profile_picture: null
  },
  {
    name: 'Pedro Oliveira',
    title: 'Diretor de Marketing',
    company: 'Growth Lab',
    location: 'Belo Horizonte, MG',
    status: 'invite_sent',
    score: 78,
    headline: 'Marketing Director | Growth Hacking & Performance',
    profile_picture: null
  },
  {
    name: 'Ana Costa',
    title: 'VP de Vendas',
    company: 'SalesForce Pro',
    location: 'Curitiba, PR',
    status: 'qualifying',
    score: 88,
    headline: 'VP Sales | B2B SaaS | Enterprise Solutions',
    profile_picture: null
  },
  {
    name: 'Carlos Mendes',
    title: 'Gerente de TI',
    company: 'Sistemas Integrados SA',
    location: 'Porto Alegre, RS',
    status: 'qualifying',
    score: 75,
    headline: 'IT Manager | Infrastructure & Security',
    profile_picture: null
  },
  {
    name: 'Juliana Lima',
    title: 'Head de Produto',
    company: 'ProductLab',
    location: 'São Paulo, SP',
    status: 'scheduled',
    score: 95,
    headline: 'Head of Product | SaaS & Product Strategy',
    profile_picture: null
  },
  {
    name: 'Roberto Alves',
    title: 'COO',
    company: 'Operations Hub',
    location: 'Brasília, DF',
    status: 'scheduled',
    score: 90,
    headline: 'Chief Operating Officer | Process Optimization',
    profile_picture: null
  },
  {
    name: 'Fernanda Rodrigues',
    title: 'Diretora Comercial',
    company: 'Commerce Plus',
    location: 'Salvador, BA',
    status: 'won',
    score: 98,
    headline: 'Diretora Comercial | E-commerce & Digital Sales',
    profile_picture: null
  },
  {
    name: 'Lucas Pereira',
    title: 'Founder & CEO',
    company: 'StartupLab',
    location: 'Florianópolis, SC',
    status: 'won',
    score: 96,
    headline: 'Entrepreneur | Tech Startup Founder',
    profile_picture: null
  },
  {
    name: 'Beatriz Gomes',
    title: 'CFO',
    company: 'Finance Corp',
    location: 'São Paulo, SP',
    status: 'lost',
    score: 65,
    headline: 'Chief Financial Officer | Corporate Finance',
    profile_picture: null
  },
  {
    name: 'Ricardo Souza',
    title: 'Diretor de Operações',
    company: 'Logistics Now',
    location: 'Recife, PE',
    status: 'lost',
    score: 70,
    headline: 'Operations Director | Supply Chain & Logistics',
    profile_picture: null
  },
  {
    name: 'Patricia Martins',
    title: 'CMO',
    company: 'Marketing Pro',
    location: 'Fortaleza, CE',
    status: 'lead',
    score: 82,
    headline: 'Chief Marketing Officer | Digital Marketing & Branding',
    profile_picture: null
  },
  {
    name: 'Gabriel Fernandes',
    title: 'Tech Lead',
    company: 'DevOps Solutions',
    location: 'São Paulo, SP',
    status: 'lead',
    score: 87,
    headline: 'Tech Lead | DevOps & Cloud Architecture',
    profile_picture: null
  },
  {
    name: 'Amanda Carvalho',
    title: 'Product Manager',
    company: 'SaaS Innovations',
    location: 'Rio de Janeiro, RJ',
    status: 'invite_sent',
    score: 91,
    headline: 'Product Manager | SaaS & User Experience',
    profile_picture: null
  },
  {
    name: 'Thiago Ribeiro',
    title: 'Sales Director',
    company: 'B2B Sales Hub',
    location: 'Campinas, SP',
    status: 'qualifying',
    score: 84,
    headline: 'Sales Director | Enterprise B2B Solutions',
    profile_picture: null
  }
];

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('\n🌱 Iniciando seed do banco de dados...\n');

    // Iniciar transação
    await client.query('BEGIN');

    // 1. Criar usuário de exemplo
    console.log('👤 Criando usuário de exemplo...');
    const passwordHash = await bcrypt.hash('demo123', 10);

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name, company)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = $3
       RETURNING id`,
      ['demo@getraze.com', passwordHash, 'Usuário Demo', 'GetRaze Demo']
    );

    const userId = userResult.rows[0].id;
    console.log(`✅ Usuário criado: demo@getraze.com (senha: demo123)`);

    // 2. Criar campanha de exemplo
    console.log('\n📊 Criando campanha de exemplo...');
    const campaignResult = await client.query(
      `INSERT INTO campaigns (user_id, name, description, status)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        userId,
        'Prospecção Q4 2024',
        'Campanha de prospecção de leads qualificados para o último trimestre de 2024',
        'active'
      ]
    );

    const campaignId = campaignResult.rows[0].id;
    console.log(`✅ Campanha criada: Prospecção Q4 2024`);

    // 3. Inserir leads de exemplo
    console.log('\n👥 Inserindo leads de exemplo...');

    let leadsCreated = 0;
    for (const lead of EXAMPLE_LEADS) {
      await client.query(
        `INSERT INTO leads (
          campaign_id,
          name,
          title,
          company,
          location,
          status,
          score,
          headline,
          profile_picture,
          linkedin_profile_id,
          provider_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          campaignId,
          lead.name,
          lead.title,
          lead.company,
          lead.location,
          lead.status,
          lead.score,
          lead.headline,
          lead.profile_picture,
          `demo_${leadsCreated}`,
          `demo_provider_${leadsCreated}`
        ]
      );

      leadsCreated++;
      console.log(`  ✓ ${lead.name} - ${lead.status}`);
    }

    // 4. Atualizar contadores da campanha
    console.log('\n📈 Atualizando contadores da campanha...');

    const counts = {
      total_leads: EXAMPLE_LEADS.length,
      leads_pending: EXAMPLE_LEADS.filter(l => l.status === 'lead').length,
      leads_sent: EXAMPLE_LEADS.filter(l => l.status === 'invite_sent').length,
      leads_qualifying: EXAMPLE_LEADS.filter(l => l.status === 'qualifying').length,
      leads_scheduled: EXAMPLE_LEADS.filter(l => l.status === 'scheduled').length,
      leads_won: EXAMPLE_LEADS.filter(l => l.status === 'won').length,
      leads_lost: EXAMPLE_LEADS.filter(l => l.status === 'lost').length
    };

    await client.query(
      `UPDATE campaigns
       SET total_leads = $1,
           leads_pending = $2,
           leads_sent = $3,
           leads_qualifying = $4,
           leads_scheduled = $5,
           leads_won = $6,
           leads_lost = $7
       WHERE id = $8`,
      [
        counts.total_leads,
        counts.leads_pending,
        counts.leads_sent,
        counts.leads_qualifying,
        counts.leads_scheduled,
        counts.leads_won,
        counts.leads_lost,
        campaignId
      ]
    );

    console.log(`✅ Contadores atualizados:`);
    console.log(`   - Total: ${counts.total_leads}`);
    console.log(`   - Leads: ${counts.leads_pending}`);
    console.log(`   - Convite Enviado: ${counts.leads_sent}`);
    console.log(`   - Qualificação: ${counts.leads_qualifying}`);
    console.log(`   - Agendamento: ${counts.leads_scheduled}`);
    console.log(`   - Ganho: ${counts.leads_won}`);
    console.log(`   - Perdido: ${counts.leads_lost}`);

    // 5. Criar AI Agent de exemplo (se a tabela tiver todas as colunas necessárias)
    try {
      console.log('\n🤖 Criando AI Agent de exemplo...');
      await client.query(
        `INSERT INTO ai_agents (user_id, name, description, language, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'Assistente Virtual GetRaze',
          'Assistente virtual para qualificação e engajamento de leads',
          'pt-BR',
          true
        ]
      );
      console.log(`✅ AI Agent criado`);
    } catch (error) {
      console.log(`⚠️ AI Agent não criado (tabela pode não existir ou estar incompleta)`);
    }

    // Commit da transação
    await client.query('COMMIT');

    console.log('\n✅ Seed concluído com sucesso!\n');
    console.log('📋 Resumo:');
    console.log(`   - 1 usuário criado`);
    console.log(`   - 1 campanha criada`);
    console.log(`   - ${leadsCreated} leads inseridos`);
    console.log(`   - 1 AI agent criado\n`);
    console.log('🔐 Credenciais de acesso:');
    console.log('   Email: demo@getraze.com');
    console.log('   Senha: demo123\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro no seed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar seed
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
