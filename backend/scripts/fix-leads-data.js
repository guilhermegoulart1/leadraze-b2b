// backend/scripts/fix-leads-data.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const EXAMPLE_LEADS = [
  {
    name: 'João Silva',
    title: 'CEO',
    company: 'Tech Solutions Brasil',
    location: 'São Paulo, SP',
    status: 'lead',
    score: 85,
    headline: 'CEO & Founder at Tech Solutions Brasil | Transformação Digital'
  },
  {
    name: 'Maria Santos',
    title: 'CTO',
    company: 'Digital Ventures',
    location: 'Rio de Janeiro, RJ',
    status: 'invite_sent',
    score: 92,
    headline: 'Chief Technology Officer | AI & Cloud Computing'
  },
  {
    name: 'Pedro Oliveira',
    title: 'Diretor de Marketing',
    company: 'Growth Lab',
    location: 'Belo Horizonte, MG',
    status: 'invite_sent',
    score: 78,
    headline: 'Marketing Director | Growth Hacking & Performance'
  },
  {
    name: 'Ana Costa',
    title: 'VP de Vendas',
    company: 'SalesForce Pro',
    location: 'Curitiba, PR',
    status: 'qualifying',
    score: 88,
    headline: 'VP Sales | B2B SaaS | Enterprise Solutions'
  },
  {
    name: 'Carlos Mendes',
    title: 'Gerente de TI',
    company: 'Sistemas Integrados SA',
    location: 'Porto Alegre, RS',
    status: 'qualifying',
    score: 75,
    headline: 'IT Manager | Infrastructure & Security'
  },
  {
    name: 'Juliana Lima',
    title: 'Head de Produto',
    company: 'ProductLab',
    location: 'São Paulo, SP',
    status: 'scheduled',
    score: 95,
    headline: 'Head of Product | SaaS & Product Strategy'
  },
  {
    name: 'Roberto Alves',
    title: 'COO',
    company: 'Operations Hub',
    location: 'Brasília, DF',
    status: 'scheduled',
    score: 90,
    headline: 'Chief Operating Officer | Process Optimization'
  },
  {
    name: 'Fernanda Rodrigues',
    title: 'Diretora Comercial',
    company: 'Commerce Plus',
    location: 'Salvador, BA',
    status: 'won',
    score: 98,
    headline: 'Diretora Comercial | E-commerce & Digital Sales'
  },
  {
    name: 'Lucas Pereira',
    title: 'Founder & CEO',
    company: 'StartupLab',
    location: 'Florianópolis, SC',
    status: 'won',
    score: 96,
    headline: 'Entrepreneur | Tech Startup Founder'
  },
  {
    name: 'Beatriz Gomes',
    title: 'CFO',
    company: 'Finance Corp',
    location: 'São Paulo, SP',
    status: 'lost',
    score: 65,
    headline: 'Chief Financial Officer | Corporate Finance'
  },
  {
    name: 'Ricardo Souza',
    title: 'Diretor de Operações',
    company: 'Logistics Now',
    location: 'Recife, PE',
    status: 'lost',
    score: 70,
    headline: 'Operations Director | Supply Chain & Logistics'
  },
  {
    name: 'Patricia Martins',
    title: 'CMO',
    company: 'Marketing Pro',
    location: 'Fortaleza, CE',
    status: 'lead',
    score: 82,
    headline: 'Chief Marketing Officer | Digital Marketing & Branding'
  },
  {
    name: 'Gabriel Fernandes',
    title: 'Tech Lead',
    company: 'DevOps Solutions',
    location: 'São Paulo, SP',
    status: 'lead',
    score: 87,
    headline: 'Tech Lead | DevOps & Cloud Architecture'
  },
  {
    name: 'Amanda Carvalho',
    title: 'Product Manager',
    company: 'SaaS Innovations',
    location: 'Rio de Janeiro, RJ',
    status: 'invite_sent',
    score: 91,
    headline: 'Product Manager | SaaS & User Experience'
  },
  {
    name: 'Thiago Ribeiro',
    title: 'Sales Director',
    company: 'B2B Sales Hub',
    location: 'Campinas, SP',
    status: 'qualifying',
    score: 84,
    headline: 'Sales Director | Enterprise B2B Solutions'
  }
];

async function fixLeadsData() {
  const client = await pool.connect();

  try {
    console.log('\n🔧 Corrigindo dados de leads...\n');

    // 1. Buscar usuário "Usuário Teste"
    const userResult = await client.query(
      `SELECT id FROM users WHERE name = $1 OR email = $2 LIMIT 1`,
      ['Usuário Teste', 'teste@getraze.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Usuário "Usuário Teste" não encontrado');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ Usuário encontrado: ${userId}`);

    // 2. Verificar se já existe campanha para este usuário
    let campaignResult = await client.query(
      `SELECT id FROM campaigns WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    let campaignId;

    if (campaignResult.rows.length === 0) {
      // Criar nova campanha
      console.log('\n📊 Criando campanha...');
      campaignResult = await client.query(
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
      campaignId = campaignResult.rows[0].id;
      console.log(`✅ Campanha criada: ${campaignId}`);
    } else {
      campaignId = campaignResult.rows[0].id;
      console.log(`\n📊 Usando campanha existente: ${campaignId}`);

      // Deletar leads antigos desta campanha
      await client.query('DELETE FROM leads WHERE campaign_id = $1', [campaignId]);
      console.log('🗑️ Leads antigos removidos');
    }

    // 3. Inserir leads
    console.log('\n👥 Inserindo leads...');
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
          linkedin_profile_id,
          provider_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          campaignId,
          lead.name,
          lead.title,
          lead.company,
          lead.location,
          lead.status,
          lead.score,
          lead.headline,
          `profile_${leadsCreated}`,
          `provider_${leadsCreated}`
        ]
      );

      leadsCreated++;
      console.log(`  ✓ ${lead.name} - ${lead.status}`);
    }

    // 4. Atualizar contadores da campanha
    console.log('\n📈 Atualizando contadores...');
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

    console.log('✅ Contadores atualizados:');
    console.log(`   - Total: ${counts.total_leads}`);
    console.log(`   - Leads: ${counts.leads_pending}`);
    console.log(`   - Convite Enviado: ${counts.leads_sent}`);
    console.log(`   - Qualificação: ${counts.leads_qualifying}`);
    console.log(`   - Agendamento: ${counts.leads_scheduled}`);
    console.log(`   - Ganho: ${counts.leads_won}`);
    console.log(`   - Perdido: ${counts.leads_lost}`);

    console.log('\n✅ Dados corrigidos com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  fixLeadsData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { fixLeadsData };
