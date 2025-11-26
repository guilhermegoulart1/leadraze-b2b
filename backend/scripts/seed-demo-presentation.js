// backend/scripts/seed-demo-presentation.js
// Script para criar dados mock realistas para apresentação do produto
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Fotos do Unsplash para perfis profissionais
const UNSPLASH_PHOTOS = {
  men: [
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1480429370612-2f5c8fa1f2c5?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1480455624313-e29b44bbfde1?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1590086783191-a0694c7d1e6e?w=400&h=400&fit=crop&crop=face',
  ],
  women: [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face',
    'https://images.unsplash.com/photo-1558898479-33c0057a5d12?w=400&h=400&fit=crop&crop=face',
  ]
};

// Empresas brasileiras realistas
const COMPANIES = [
  { name: 'Nubank', industry: 'Fintech' },
  { name: 'iFood', industry: 'FoodTech' },
  { name: 'TOTVS', industry: 'Software' },
  { name: 'Stone', industry: 'Payments' },
  { name: 'QuintoAndar', industry: 'PropTech' },
  { name: 'Loft', industry: 'Real Estate' },
  { name: 'Gympass', industry: 'Wellness' },
  { name: 'Creditas', industry: 'Fintech' },
  { name: 'Loggi', industry: 'Logistics' },
  { name: 'Wildlife Studios', industry: 'Gaming' },
  { name: 'Olist', industry: 'E-commerce' },
  { name: 'Hotmart', industry: 'EdTech' },
  { name: 'PagSeguro', industry: 'Payments' },
  { name: 'RD Station', industry: 'MarTech' },
  { name: 'Movile', industry: 'Tech' },
  { name: 'Vtex', industry: 'E-commerce' },
  { name: 'CloudWalk', industry: 'Fintech' },
  { name: 'MadeiraMadeira', industry: 'E-commerce' },
  { name: 'CargoX', industry: 'Logistics' },
  { name: 'Dock', industry: 'Banking' },
  { name: 'Neon', industry: 'Fintech' },
  { name: 'Pipefy', industry: 'Software' },
  { name: 'Zenvia', industry: 'CommTech' },
  { name: 'Involves', industry: 'Software' },
  { name: 'Take Blip', industry: 'ChatTech' },
  { name: 'Mercado Livre', industry: 'E-commerce' },
  { name: 'Americanas S.A.', industry: 'Retail' },
  { name: 'Magazine Luiza', industry: 'Retail' },
  { name: 'B3', industry: 'Finance' },
  { name: 'XP Inc', industry: 'Finance' },
];

// Cargos executivos
const TITLES = [
  { title: 'CEO', level: 'C-Level' },
  { title: 'CTO', level: 'C-Level' },
  { title: 'CFO', level: 'C-Level' },
  { title: 'COO', level: 'C-Level' },
  { title: 'CMO', level: 'C-Level' },
  { title: 'CPO', level: 'C-Level' },
  { title: 'CRO', level: 'C-Level' },
  { title: 'VP de Vendas', level: 'VP' },
  { title: 'VP de Marketing', level: 'VP' },
  { title: 'VP de Produto', level: 'VP' },
  { title: 'VP de Tecnologia', level: 'VP' },
  { title: 'VP de Operações', level: 'VP' },
  { title: 'Diretor Comercial', level: 'Director' },
  { title: 'Diretor de Marketing', level: 'Director' },
  { title: 'Diretor de TI', level: 'Director' },
  { title: 'Diretor de Produto', level: 'Director' },
  { title: 'Diretor de Vendas', level: 'Director' },
  { title: 'Head de Growth', level: 'Head' },
  { title: 'Head de Vendas', level: 'Head' },
  { title: 'Head de Marketing', level: 'Head' },
  { title: 'Head de Produto', level: 'Head' },
  { title: 'Gerente de Vendas', level: 'Manager' },
  { title: 'Gerente de Marketing', level: 'Manager' },
  { title: 'Gerente de Produto', level: 'Manager' },
  { title: 'Gerente Comercial', level: 'Manager' },
];

// Cidades brasileiras
const LOCATIONS = [
  'São Paulo, SP',
  'Rio de Janeiro, RJ',
  'Belo Horizonte, MG',
  'Curitiba, PR',
  'Porto Alegre, RS',
  'Brasília, DF',
  'Salvador, BA',
  'Recife, PE',
  'Fortaleza, CE',
  'Florianópolis, SC',
  'Campinas, SP',
  'Goiânia, GO',
  'Vitória, ES',
  'Natal, RN',
  'João Pessoa, PB',
];

// Nomes brasileiros
const FIRST_NAMES_MALE = [
  'João', 'Pedro', 'Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Bruno', 'Felipe',
  'Gustavo', 'Leonardo', 'Ricardo', 'Fernando', 'Carlos', 'André', 'Thiago',
  'Daniel', 'Marcelo', 'Eduardo', 'Rodrigo', 'Vinícius', 'Henrique', 'Diego',
  'Caio', 'Leandro', 'Alexandre', 'Fábio', 'Paulo', 'Renato', 'Marcos', 'Sergio'
];

const FIRST_NAMES_FEMALE = [
  'Maria', 'Ana', 'Juliana', 'Fernanda', 'Patricia', 'Camila', 'Amanda', 'Bruna',
  'Carolina', 'Beatriz', 'Larissa', 'Letícia', 'Mariana', 'Gabriela', 'Isabela',
  'Natália', 'Vanessa', 'Priscila', 'Renata', 'Tatiana', 'Luciana', 'Daniela',
  'Aline', 'Paula', 'Cristina', 'Roberta', 'Viviane', 'Carla', 'Sandra', 'Adriana'
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha',
  'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado',
  'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira'
];

// Mensagens de conversa realistas
const CONVERSATION_TEMPLATES = [
  {
    type: 'interested',
    messages: [
      { sender: 'user', content: 'Olá {name}! Vi seu perfil e achei muito interessante sua experiência na {company}. Estamos desenvolvendo uma solução de automação para prospecção B2B que pode ser muito útil para vocês.' },
      { sender: 'lead', content: 'Oi! Obrigado pelo contato. Realmente estamos buscando formas de otimizar nosso processo de vendas. Pode me contar mais?' },
      { sender: 'ai', content: 'Claro! O LeadRaze é uma plataforma que utiliza IA para automatizar a prospecção no LinkedIn, qualificando leads automaticamente e agendando reuniões. Já temos cases de empresas que aumentaram em 3x suas conversões.' },
      { sender: 'lead', content: 'Interessante! Vocês têm algum material que eu possa ver? E quanto tempo leva para implementar?' },
      { sender: 'ai', content: 'A implementação é bem rápida, em média 2 semanas. Vou te enviar nosso case study por aqui mesmo. Podemos agendar uma demo de 30 min para você ver a plataforma funcionando?' },
      { sender: 'lead', content: 'Pode ser sim! Tenho disponibilidade na quinta-feira às 14h ou sexta às 10h.' },
    ]
  },
  {
    type: 'qualifying',
    messages: [
      { sender: 'user', content: 'Olá {name}! Notei que você lidera a área de {title} na {company}. Gostaria de apresentar uma solução que pode ajudar a escalar seus resultados de prospecção.' },
      { sender: 'lead', content: 'Olá! Interessante, mas já usamos algumas ferramentas aqui. O que vocês fazem de diferente?' },
      { sender: 'ai', content: 'Entendo! O diferencial do LeadRaze é a combinação de IA avançada com automação inteligente. Diferente de ferramentas tradicionais, nós qualificamos leads automaticamente e personalizamos cada abordagem. Posso perguntar quais ferramentas vocês usam atualmente?' },
      { sender: 'lead', content: 'Usamos o LinkedIn Sales Navigator e o HubSpot. O processo ainda é muito manual...' },
      { sender: 'ai', content: 'Faz total sentido! O LeadRaze se integra tanto com o Sales Navigator quanto com o HubSpot. A grande diferença é que automatizamos a parte manual, mantendo a personalização. Quantas pessoas no seu time fazem prospecção ativa hoje?' },
    ]
  },
  {
    type: 'objection',
    messages: [
      { sender: 'user', content: 'Oi {name}! Vi que você trabalha na {company} como {title}. Temos uma ferramenta de automação de vendas que pode ser interessante para vocês.' },
      { sender: 'lead', content: 'Olá. Agradeço o contato, mas no momento não estamos buscando novas ferramentas.' },
      { sender: 'ai', content: 'Entendo perfeitamente! Posso perguntar se é uma questão de momento ou se já têm uma solução que está funcionando bem?' },
      { sender: 'lead', content: 'É mais uma questão de budget mesmo. Estamos focados em outras prioridades agora.' },
      { sender: 'ai', content: 'Faz sentido. Muitas empresas nos procuram justamente porque o LeadRaze tem um ROI muito rápido - em média 3 meses. Temos planos flexíveis também. Posso te enviar um material sobre isso para avaliar quando fizer sentido?' },
      { sender: 'lead', content: 'Pode enviar sim, vou dar uma olhada quando tiver mais tempo.' },
    ]
  },
  {
    type: 'scheduled',
    messages: [
      { sender: 'user', content: 'Olá {name}! Sou da LeadRaze e vi seu perfil na {company}. Desenvolvemos uma plataforma de prospecção com IA que está ajudando empresas a triplicar seus resultados de vendas.' },
      { sender: 'lead', content: 'Oi! Que legal, já ouvi falar de vocês. Conta mais!' },
      { sender: 'ai', content: 'Que bom que já nos conhece! Basicamente, o LeadRaze automatiza todo o processo de prospecção no LinkedIn usando IA para qualificar leads e personalizar mensagens. Já ajudamos mais de 500 empresas a aumentar suas conversões.' },
      { sender: 'lead', content: 'Interessante! Aqui na {company} a gente está exatamente buscando escalar nossa operação de vendas. Quanto custa?' },
      { sender: 'ai', content: 'O investimento varia de acordo com o tamanho do time, mas começa em R$497/mês por usuário. O mais legal é que oferecemos um trial de 14 dias. Que tal agendarmos uma demo para você ver funcionando na prática?' },
      { sender: 'lead', content: 'Perfeito! Pode ser amanhã às 15h?' },
      { sender: 'ai', content: 'Confirmado! Amanhã às 15h. Vou te enviar o link da reunião por aqui. Você pode chamar mais alguém do time se quiser!' },
      { sender: 'lead', content: 'Ótimo, vou ver se o nosso Head de Vendas pode participar também. Até amanhã!' },
    ]
  },
  {
    type: 'won',
    messages: [
      { sender: 'user', content: 'Olá {name}! Gostaria de apresentar o LeadRaze para você. Somos uma plataforma de automação de vendas B2B com IA.' },
      { sender: 'lead', content: 'Oi! Interessante, pode me contar mais?' },
      { sender: 'ai', content: 'Claro! O LeadRaze automatiza a prospecção no LinkedIn, qualifica leads com IA e agenda reuniões automaticamente. Empresas como a sua estão aumentando em média 3x suas conversões.' },
      { sender: 'lead', content: 'Isso é exatamente o que precisamos! Como funciona o pricing?' },
      { sender: 'ai', content: 'Temos planos a partir de R$497/mês. Mas antes de falar de preço, que tal uma demo para você ver o valor na prática? Tenho horários essa semana.' },
      { sender: 'lead', content: 'Pode ser quarta às 14h!' },
      { sender: 'ai', content: 'Perfeito! Confirmado para quarta às 14h. Te envio o link!' },
      { sender: 'lead', content: 'Ótimo! Fizemos a demo e adoramos! Quero contratar o plano Pro para 5 usuários.' },
      { sender: 'ai', content: 'Excelente escolha! Vou passar para nosso time de CS finalizar os detalhes com você. Seja bem-vindo ao LeadRaze! 🚀' },
      { sender: 'lead', content: 'Obrigado! Ansiosos para começar a usar!' },
    ]
  },
  {
    type: 'cold',
    messages: [
      { sender: 'user', content: 'Olá {name}! Vi que você é {title} na {company}. Gostaria de apresentar uma solução que pode ajudar vocês a escalar a prospecção de clientes.' },
    ]
  },
  {
    type: 'follow_up',
    messages: [
      { sender: 'user', content: 'Oi {name}! Tudo bem? Notei que você é {title} na {company}. Temos uma plataforma de automação de vendas que pode ser interessante.' },
      { sender: 'lead', content: 'Olá! Interessante, mas estou bem ocupado agora. Podemos conversar em outro momento?' },
      { sender: 'ai', content: 'Sem problemas! Posso te enviar um material rápido para você dar uma olhada quando tiver tempo? E se fizer sentido, a gente marca uma conversa.' },
    ]
  },
];

// Helpers
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateLeads(count) {
  const leads = [];
  const usedNames = new Set();

  // Distribuição dos status (válidos: leads, invite_sent, accepted, qualifying, qualified, discarded)
  const statusDistribution = [
    { status: 'leads', weight: 15 },
    { status: 'invite_sent', weight: 25 },
    { status: 'accepted', weight: 15 },
    { status: 'qualifying', weight: 20 },
    { status: 'qualified', weight: 15 },
    { status: 'discarded', weight: 10 },
  ];

  const statusPool = [];
  statusDistribution.forEach(s => {
    for (let i = 0; i < s.weight; i++) {
      statusPool.push(s.status);
    }
  });

  for (let i = 0; i < count; i++) {
    const isFemale = Math.random() > 0.45;
    const firstName = getRandomItem(isFemale ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE);
    const lastName = getRandomItem(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;

    // Evitar nomes duplicados
    if (usedNames.has(fullName)) {
      i--;
      continue;
    }
    usedNames.add(fullName);

    const company = getRandomItem(COMPANIES);
    const titleObj = getRandomItem(TITLES);
    const location = getRandomItem(LOCATIONS);
    const status = getRandomItem(statusPool);
    const photos = isFemale ? UNSPLASH_PHOTOS.women : UNSPLASH_PHOTOS.men;
    const photo = photos[i % photos.length];

    // Score baseado no status
    let score;
    switch (status) {
      case 'qualified': score = getRandomNumber(85, 100); break;
      case 'qualifying': score = getRandomNumber(70, 90); break;
      case 'accepted': score = getRandomNumber(60, 80); break;
      case 'invite_sent': score = getRandomNumber(50, 75); break;
      case 'leads': score = getRandomNumber(40, 70); break;
      case 'discarded': score = getRandomNumber(20, 50); break;
      default: score = getRandomNumber(40, 80);
    }

    leads.push({
      name: fullName,
      title: titleObj.title,
      level: titleObj.level,
      company: company.name,
      industry: company.industry,
      location,
      status,
      score,
      headline: `${titleObj.title} at ${company.name} | ${company.industry}`,
      profile_picture: photo,
      isFemale
    });
  }

  return leads;
}

function getConversationForStatus(status) {
  switch (status) {
    case 'qualified':
      return getRandomItem([CONVERSATION_TEMPLATES[0], CONVERSATION_TEMPLATES[3], CONVERSATION_TEMPLATES[4]]);
    case 'qualifying':
      return getRandomItem([CONVERSATION_TEMPLATES[1], CONVERSATION_TEMPLATES[2]]);
    case 'accepted':
      return getRandomItem([CONVERSATION_TEMPLATES[6], CONVERSATION_TEMPLATES[1]]);
    case 'invite_sent':
      return getRandomItem([CONVERSATION_TEMPLATES[5], CONVERSATION_TEMPLATES[6]]);
    default:
      return CONVERSATION_TEMPLATES[5];
  }
}

async function seedDemoData() {
  const client = await pool.connect();

  try {
    console.log('\n🚀 Iniciando seed de dados para apresentação...\n');

    await client.query('BEGIN');

    // 1. Buscar usuário existente (usar primeiro usuário ativo)
    console.log('👤 Buscando usuário existente...');

    const userResult = await client.query(
      `SELECT id, email, name, account_id FROM users WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      throw new Error('Nenhum usuário ativo encontrado. Crie um usuário primeiro.');
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    const userName = userResult.rows[0].name;
    console.log(`✅ Usuário: ${userEmail} (${userName})\n`);

    // 2. Buscar AI Agent existente ou criar um novo
    console.log('🤖 Configurando AI Agent...');
    const accountId = userResult.rows[0].account_id;

    let agentId;
    const existingAgent = await client.query('SELECT id FROM ai_agents WHERE account_id = $1 LIMIT 1', [accountId]);

    if (existingAgent.rows.length > 0) {
      agentId = existingAgent.rows[0].id;
      console.log('✅ AI Agent existente encontrado\n');
    } else {
      const agentResult = await client.query(
        `INSERT INTO ai_agents (account_id, user_id, name, description, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [accountId, userId, 'LeadRaze AI Assistant', 'Assistente de vendas inteligente para qualificação de leads', true]
      );
      agentId = agentResult.rows[0].id;
      console.log('✅ AI Agent criado\n');
    }

    // 2.5 Buscar LinkedIn Account (necessário para conversas)
    console.log('🔗 Buscando conta LinkedIn...');
    const linkedinAccountResult = await client.query(
      'SELECT id FROM linkedin_accounts WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    let linkedinAccountId = null;
    if (linkedinAccountResult.rows.length > 0) {
      linkedinAccountId = linkedinAccountResult.rows[0].id;
      console.log('✅ Conta LinkedIn encontrada\n');
    } else {
      console.log('⚠️ Nenhuma conta LinkedIn encontrada - conversas serão criadas sem linkedin_account_id\n');
    }

    // 3. Criar campanhas
    console.log('📊 Criando campanhas...');
    const campaigns = [
      { name: 'Enterprise Tech Q4 2024', description: 'Prospecção de empresas de tecnologia enterprise', status: 'active', leadCount: 45 },
      { name: 'Scale-ups SaaS', description: 'Foco em scale-ups de software SaaS', status: 'active', leadCount: 35 },
      { name: 'Fintechs Brasil', description: 'Prospecção no setor financeiro', status: 'active', leadCount: 25 },
      { name: 'E-commerce Growth', description: 'Empresas de e-commerce em crescimento', status: 'paused', leadCount: 20 },
    ];

    const campaignIds = [];
    for (const campaign of campaigns) {
      const result = await client.query(
        `INSERT INTO campaigns (account_id, user_id, ai_agent_id, name, description, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [accountId, userId, agentId, campaign.name, campaign.description, campaign.status]
      );
      campaignIds.push({ id: result.rows[0].id, ...campaign });
      console.log(`  ✓ ${campaign.name}`);
    }
    console.log('');

    // 4. Gerar e inserir leads
    console.log('👥 Gerando leads com fotos do Unsplash...');
    let totalLeads = 0;
    let totalConversations = 0;
    let totalMessages = 0;

    for (const campaign of campaignIds) {
      const leads = generateLeads(campaign.leadCount);
      const statusCounts = {
        leads: 0,
        invite_sent: 0,
        accepted: 0,
        qualifying: 0,
        qualified: 0,
        discarded: 0
      };

      console.log(`\n  📁 ${campaign.name} (${leads.length} leads)`);

      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        statusCounts[lead.status]++;

        // Timestamps baseados no status
        const now = new Date();
        const daysAgo = getRandomNumber(1, 30);
        const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

        let sentAt = null, acceptedAt = null, qualifyingStartedAt = null,
            qualifiedAt = null, discardedAt = null;

        if (['invite_sent', 'accepted', 'qualifying', 'qualified', 'discarded'].includes(lead.status)) {
          sentAt = new Date(createdAt.getTime() + getRandomNumber(1, 24) * 60 * 60 * 1000);
        }
        if (['accepted', 'qualifying', 'qualified', 'discarded'].includes(lead.status)) {
          acceptedAt = new Date(sentAt.getTime() + getRandomNumber(12, 72) * 60 * 60 * 1000);
        }
        if (['qualifying', 'qualified'].includes(lead.status)) {
          qualifyingStartedAt = new Date(acceptedAt.getTime() + getRandomNumber(1, 24) * 60 * 60 * 1000);
        }
        if (lead.status === 'qualified') {
          qualifiedAt = new Date(qualifyingStartedAt.getTime() + getRandomNumber(24, 96) * 60 * 60 * 1000);
        }
        if (lead.status === 'discarded') {
          discardedAt = new Date((acceptedAt || sentAt).getTime() + getRandomNumber(48, 240) * 60 * 60 * 1000);
        }

        const leadResult = await client.query(
          `INSERT INTO leads (
            account_id, campaign_id, name, title, company, location, status, score,
            headline, profile_picture, industry, linkedin_profile_id, provider_id,
            sent_at, accepted_at, qualifying_started_at, qualified_at, discarded_at,
            discard_reason, connections, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          RETURNING id`,
          [
            accountId, campaign.id, lead.name, lead.title, lead.company, lead.location, lead.status, lead.score,
            lead.headline, lead.profile_picture, lead.industry,
            `linkedin_${totalLeads}_${Date.now()}`, `provider_${totalLeads}_${Date.now()}`,
            sentAt, acceptedAt, qualifyingStartedAt, qualifiedAt, discardedAt,
            lead.status === 'discarded' ? getRandomItem(['Sem budget', 'Timing ruim', 'Escolheu concorrente', 'Sem resposta']) : null,
            getRandomNumber(200, 5000),
            createdAt
          ]
        );

        const leadId = leadResult.rows[0].id;
        totalLeads++;

        // Criar conversa para leads que aceitaram convite (status: ai_active, manual, closed)
        if (['accepted', 'qualifying', 'qualified'].includes(lead.status) && linkedinAccountId) {
          const convStatus = lead.status === 'qualified' ? 'closed' : (Math.random() > 0.3 ? 'ai_active' : 'manual');
          const convResult = await client.query(
            `INSERT INTO conversations (account_id, lead_id, ai_agent_id, campaign_id, linkedin_account_id, unipile_chat_id, status, ai_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [accountId, leadId, agentId, campaign.id, linkedinAccountId, `mock_chat_${leadId}`, convStatus, convStatus === 'ai_active', acceptedAt]
          );

          const conversationId = convResult.rows[0].id;
          totalConversations++;

          // Adicionar mensagens
          const template = getConversationForStatus(lead.status);
          let messageTime = new Date(acceptedAt);

          for (const msg of template.messages) {
            messageTime = new Date(messageTime.getTime() + getRandomNumber(5, 120) * 60 * 1000);

            const content = msg.content
              .replace('{name}', lead.name.split(' ')[0])
              .replace('{company}', lead.company)
              .replace('{title}', lead.title);

            await client.query(
              `INSERT INTO messages (conversation_id, sender_type, content, sent_at, created_at)
               VALUES ($1, $2, $3, $4, $4)`,
              [conversationId, msg.sender, content, messageTime]
            );
            totalMessages++;
          }

          // Atualizar last_message_at
          await client.query(
            `UPDATE conversations SET last_message_at = $1 WHERE id = $2`,
            [messageTime, conversationId]
          );
        }

        // Log de progresso
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`     ${i + 1}/${leads.length} leads\r`);
        }
      }

      // Atualizar contadores da campanha
      await client.query(
        `UPDATE campaigns
         SET total_leads = $1,
             leads_pending = $2,
             leads_sent = $3,
             leads_accepted = $4,
             leads_qualifying = $5,
             leads_qualified = $6,
             leads_discarded = $7
         WHERE id = $8`,
        [
          leads.length,
          statusCounts.leads,
          statusCounts.invite_sent,
          statusCounts.accepted,
          statusCounts.qualifying,
          statusCounts.qualified,
          statusCounts.discarded,
          campaign.id
        ]
      );

      console.log(`     ✓ ${leads.length} leads inseridos`);
    }

    // 5. Gerar analytics diários
    console.log('\n📈 Gerando analytics dos últimos 30 dias...');

    // Primeiro, limpar analytics antigos deste usuário
    await client.query('DELETE FROM daily_analytics WHERE user_id = $1', [userId]);

    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      await client.query(
        `INSERT INTO daily_analytics (
          user_id, date, invites_sent, invites_accepted, invites_discarded,
          messages_sent, messages_received, conversations_active, leads_qualified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId, dateStr,
          getRandomNumber(15, 50),  // invites_sent
          getRandomNumber(5, 20),   // invites_accepted
          getRandomNumber(1, 5),    // invites_discarded
          getRandomNumber(20, 80),  // messages_sent
          getRandomNumber(10, 40),  // messages_received
          getRandomNumber(5, 25),   // conversations_active
          getRandomNumber(3, 12),   // leads_qualified
        ]
      );
    }
    console.log('✅ Analytics gerados\n');

    await client.query('COMMIT');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ SEED DE APRESENTAÇÃO CONCLUÍDO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📊 Resumo:`);
    console.log(`   • ${campaignIds.length} campanhas`);
    console.log(`   • ${totalLeads} leads com fotos Unsplash`);
    console.log(`   • ${totalConversations} conversas`);
    console.log(`   • ${totalMessages} mensagens`);
    console.log(`   • 30 dias de analytics\n`);
    console.log(`🔐 Dados adicionados ao usuário: ${userEmail}\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
if (require.main === module) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { seedDemoData };
