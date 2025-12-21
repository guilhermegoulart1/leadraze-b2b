/**
 * Sales Rep Templates (Candidatos)
 *
 * Templates pre-definidos de "vendedores" com personalidades distintas.
 * Cada template mapeia para uma metodologia de vendas e estilo de abordagem.
 */

export const SALES_REP_TEMPLATES = [
  {
    id: 'lucas',
    name: 'Alex',
    title: 'O Consultor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    gender: 'male',
    quote: 'Primeiro eu entendo, depois sugiro',
    description: 'Abordagem consultiva. Faz perguntas estratégicas para entender profundamente as necessidades antes de apresentar soluções.',
    idealFor: 'Vendas complexas, consultoria, serviços de alto valor',
    methodology: 'spin-selling',
    conversationStyle: 'consultivo',
    color: '#3B82F6',
    traits: ['Paciente', 'Analítico', 'Empático'],
    defaultConfig: {
      behavioral_profile: 'consultivo',
      tone: 'professional',
      response_length: 'medium',
      formality: 65,
      friendliness: 70,
      assertiveness: 40
    }
  },
  {
    id: 'marina',
    name: 'Sophia',
    title: 'A Direta',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face',
    gender: 'female',
    quote: 'Vou direto ao ponto, sem rodeios',
    description: 'Comunicação objetiva e eficiente. Não perde tempo com rodeios e foca no que realmente importa.',
    idealFor: 'Decisores ocupados, vendas transacionais, qualificação rápida',
    methodology: 'bant',
    conversationStyle: 'direto',
    color: '#F59E0B',
    traits: ['Objetiva', 'Eficiente', 'Assertiva'],
    defaultConfig: {
      behavioral_profile: 'direto',
      tone: 'professional',
      response_length: 'short',
      formality: 50,
      friendliness: 45,
      assertiveness: 85
    }
  },
  {
    id: 'pedro',
    name: 'James',
    title: 'O Educador',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    gender: 'male',
    quote: 'Compartilho conhecimento antes de vender',
    description: 'Especialista em inbound sales. Educa o prospect com conteúdo de valor antes de falar sobre vendas.',
    idealFor: 'Mercados que precisam de educação, produtos inovadores, SaaS',
    methodology: 'inbound-sales',
    conversationStyle: 'educativo',
    color: '#8B5CF6',
    traits: ['Didático', 'Generoso', 'Especialista'],
    defaultConfig: {
      behavioral_profile: 'educativo',
      tone: 'friendly',
      response_length: 'medium',
      formality: 45,
      friendliness: 85,
      assertiveness: 35
    }
  },
  {
    id: 'carla',
    name: 'Emma',
    title: 'A Conectora',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    gender: 'female',
    quote: 'Construo relacionamento genuíno',
    description: 'Especialista em criar conexões. Valoriza o relacionamento de longo prazo e a confiança.',
    idealFor: 'Networking, parcerias, mercado brasileiro, contas estratégicas',
    methodology: 'consultivo-br',
    conversationStyle: 'amigavel',
    color: '#10B981',
    traits: ['Calorosa', 'Empática', 'Paciente'],
    defaultConfig: {
      behavioral_profile: 'amigavel',
      tone: 'friendly',
      response_length: 'medium',
      formality: 30,
      friendliness: 95,
      assertiveness: 25
    }
  },
  {
    id: 'rafael',
    name: 'Victor',
    title: 'O Closer',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face',
    gender: 'male',
    quote: 'Foco total em fechar negócio',
    description: 'Especialista em conversão. Identifica oportunidades e acelera o processo de decisão.',
    idealFor: 'Leads já qualificados, fim de funil, urgência',
    methodology: 'challenger-sale',
    conversationStyle: 'direto',
    color: '#EF4444',
    traits: ['Determinado', 'Persuasivo', 'Focado'],
    defaultConfig: {
      behavioral_profile: 'direto',
      tone: 'professional',
      response_length: 'medium',
      formality: 70,
      friendliness: 55,
      assertiveness: 75
    }
  }
];

export const CHANNELS = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'Linkedin',
    description: 'Prospecção e conexões B2B',
    color: '#0A66C2',
    features: ['Convites de conexão', 'Mensagens diretas', 'Automação de sequências']
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'MessageCircle',
    description: 'Atendimento e follow-up',
    color: '#25D366',
    features: ['Mensagens instantâneas', 'Respostas rápidas', 'Mídia e documentos']
  },
  {
    id: 'email',
    name: 'Email',
    icon: 'Mail',
    description: 'Campanhas e nutrição',
    color: '#EA4335',
    features: ['Sequências automatizadas', 'Templates', 'Tracking de abertura']
  }
];

export const CONNECTION_STRATEGIES = [
  {
    id: 'silent',
    name: 'Conexão Silenciosa',
    icon: 'UserPlus',
    description: 'Envio convite SEM mensagem. Quando aceitarem, eu começo a conversa.',
    pros: ['Mais natural, parece conexão genuína', 'Maior taxa de aceitação'],
    behavior: {
      inviteMessage: null,
      waitAfterAccept: 5 * 60 * 1000, // 5 minutos
      startConversationIf: 'always'
    }
  },
  {
    id: 'with-intro',
    name: 'Convite com Apresentação',
    icon: 'MessageSquarePlus',
    description: 'Envio convite COM mensagem elaborada. Quando aceitarem, aguardo 1 hora.',
    pros: ['Já cria contexto desde o início', 'Pessoa já sabe do que se trata'],
    behavior: {
      inviteMessage: 'custom',
      waitAfterAccept: 60 * 60 * 1000, // 1 hora
      startConversationIf: 'no_reply'
    }
  },
  {
    id: 'icebreaker',
    name: 'Quebra-Gelo Simples',
    icon: 'HandWaving',
    description: 'Envio convite com mensagem simples de rapport. Só continuo SE a pessoa responder.',
    pros: ['Só conversa com quem demonstrou interesse', 'Evita parecer spam'],
    behavior: {
      inviteMessage: 'Oi {{first_name}}, tudo bem?',
      waitAfterAccept: null, // Aguarda resposta
      startConversationIf: 'lead_replied'
    }
  }
];

export const CONVERSATION_STYLES = [
  {
    id: 'direto',
    name: 'Direto ao Ponto',
    icon: 'Target',
    example: 'Vi que você é dono da Clínica X. Ajudamos clínicas a reduzir 40% do tempo em gestão. Podemos conversar?',
    description: 'Vai direto ao assunto sem rodeios'
  },
  {
    id: 'consultivo',
    name: 'Consultivo',
    icon: 'HelpCircle',
    example: 'Oi! Tenho estudado os desafios de clínicas médicas. Qual seu maior problema com gestão hoje?',
    description: 'Faz perguntas para entender antes de propor'
  },
  {
    id: 'educativo',
    name: 'Educativo',
    icon: 'GraduationCap',
    example: 'Preparei um material sobre como clínicas estão automatizando agendamentos. Quer que envie?',
    description: 'Oferece valor antes de vender'
  },
  {
    id: 'amigavel',
    name: 'Amigável',
    icon: 'Smile',
    example: 'E aí! Vi que você trabalha com gestão de clínicas. Como tá sendo o ano pra vocês?',
    description: 'Cria conexão pessoal primeiro'
  }
];

export const OBJECTIVES = [
  {
    id: 'connect_only',
    name: 'Só Conectar',
    icon: 'UserPlus',
    description: 'Quando a pessoa aceitar o convite, te aviso imediatamente. Você assume a conversa.',
    idealFor: 'Quem quer controle total',
    behavior: {
      transferOn: 'accept',
      aiMessages: 0
    }
  },
  {
    id: 'qualify_transfer',
    name: 'Qualificar e Transferir',
    icon: 'Filter',
    description: 'Converso até identificar interesse. Quando demonstrar que quer saber mais, te transfiro.',
    idealFor: 'Equilibrio entre automação e controle',
    behavior: {
      transferOn: 'keywords',
      transferKeywords: ['preço', 'quanto custa', 'demo', 'reunião', 'proposta'],
      maxMessages: 3
    }
  },
  {
    id: 'schedule_meeting',
    name: 'Agendar Reunião',
    icon: 'Calendar',
    description: 'Converso até conseguir agendar uma reunião. Uso seu link de agendamento.',
    idealFor: 'Foco em agenda cheia',
    behavior: {
      transferOn: 'scheduled',
      requiresSchedulingLink: true
    }
  },
  {
    id: 'sell_direct',
    name: 'Vender Direto',
    icon: 'ShoppingCart',
    description: 'Converso e envio link de compra/cadastro quando a pessoa estiver pronta.',
    idealFor: 'Produtos de ticket baixo, self-service',
    behavior: {
      transferOn: 'converted',
      requiresConversionLink: true
    }
  }
];

// Gatilhos de transferência para o humano
export const TRANSFER_TRIGGERS = [
  {
    id: 'doubt',
    label: 'Transferir em caso de dúvidas',
    description: 'Quando o lead tiver dúvidas que o agente não consegue responder',
    keywords: ['dúvida', 'não entendi', 'como funciona', 'não sei', 'explica'],
    sentiment: 'confusion'
  },
  {
    id: 'qualified',
    label: 'Transferir quando cliente qualificado',
    description: 'Quando o lead demonstrar que está pronto para avançar',
    keywords: ['quero', 'preciso', 'interesse', 'vamos', 'fechar'],
    sentiment: 'high_interest'
  },
  {
    id: 'price',
    label: 'Transferir quando pedir preço',
    description: 'Quando o lead perguntar sobre valores ou preços',
    keywords: ['preço', 'quanto custa', 'valor', 'orçamento', 'investimento', 'quanto é']
  },
  {
    id: 'demo',
    label: 'Transferir quando solicitar demo',
    description: 'Quando o lead quiser ver uma demonstração',
    keywords: ['demo', 'demonstração', 'apresentação', 'mostrar', 'ver funcionando']
  },
  {
    id: 'competitor',
    label: 'Transferir quando mencionar concorrente',
    description: 'Quando o lead mencionar produtos ou empresas concorrentes',
    keywords: [] // Configurável pelo usuário
  },
  {
    id: 'urgency',
    label: 'Transferir quando detectar urgência',
    description: 'Quando o lead demonstrar pressa ou urgência',
    keywords: ['urgente', 'agora', 'hoje', 'rápido', 'imediato', 'prazo'],
    sentiment: 'urgency'
  },
  {
    id: 'frustration',
    label: 'Transferir quando detectar frustração',
    description: 'Quando o lead parecer frustrado ou irritado',
    keywords: ['problema', 'não funciona', 'ruim', 'péssimo', 'insatisfeito'],
    sentiment: 'frustration'
  }
];

// Templates de etapas da conversa por objetivo
export const CONVERSATION_STEP_TEMPLATES = {
  qualify_transfer: [
    { order: 1, text: 'Quebrar gelo e criar rapport', is_escalation: false },
    { order: 2, text: 'Entender a dor/problema do lead', is_escalation: false },
    { order: 3, text: 'Apresentar solução brevemente', is_escalation: false },
    { order: 4, text: 'Qualificar interesse e fit', is_escalation: false },
    { order: 5, text: 'Propor próximo passo e transferir', is_escalation: true }
  ],
  schedule_meeting: [
    { order: 1, text: 'Criar rapport e conexão inicial', is_escalation: false },
    { order: 2, text: 'Despertar interesse com insight relevante', is_escalation: false },
    { order: 3, text: 'Demonstrar valor da solução', is_escalation: false },
    { order: 4, text: 'Propor reunião/demonstração', is_escalation: false },
    { order: 5, text: 'Confirmar agendamento', is_escalation: true }
  ],
  sell_direct: [
    { order: 1, text: 'Criar rapport e identificar necessidade', is_escalation: false },
    { order: 2, text: 'Apresentar produto/serviço', is_escalation: false },
    { order: 3, text: 'Lidar com objeções', is_escalation: false },
    { order: 4, text: 'Enviar link de compra/conversão', is_escalation: false },
    { order: 5, text: 'Confirmar conversão', is_escalation: true }
  ],
  connect_only: [] // Sem etapas - transfere imediatamente
};

// Templates de mensagem de transferência
export const TRANSFER_MESSAGE_TEMPLATES = [
  {
    id: 'specialist',
    label: 'Conectar com especialista',
    template: 'Que ótimo seu interesse! Vou te conectar com nosso especialista que pode te ajudar melhor com isso.'
  },
  {
    id: 'team',
    label: 'Passar para equipe',
    template: 'Perfeito! Vou passar sua conversa para nossa equipe comercial que vai entrar em contato em breve.'
  },
  {
    id: 'manager',
    label: 'Passar para gerente',
    template: 'Entendo! Vou te conectar com nosso gerente de contas que pode discutir os detalhes com você.'
  },
  {
    id: 'custom',
    label: 'Mensagem personalizada',
    template: ''
  }
];

export const SALES_METHODOLOGIES = [
  {
    id: 'spin-selling',
    name: 'SPIN Selling',
    icon: 'Target',
    shortDescription: 'Perguntas estratégicas',
    color: '#3B82F6'
  },
  {
    id: 'challenger-sale',
    name: 'Challenger Sale',
    icon: 'Lightbulb',
    shortDescription: 'Desafie o status quo',
    color: '#F59E0B'
  },
  {
    id: 'sandler',
    name: 'Sandler System',
    icon: 'Shield',
    shortDescription: 'Qualifique sem medo',
    color: '#10B981'
  },
  {
    id: 'meddpicc',
    name: 'MEDDPICC',
    icon: 'ClipboardList',
    shortDescription: 'Enterprise complexo',
    color: '#6366F1'
  },
  {
    id: 'gap-selling',
    name: 'Gap Selling',
    icon: 'TrendingUp',
    shortDescription: 'Identifique o gap',
    color: '#EC4899'
  },
  {
    id: 'bant',
    name: 'BANT',
    icon: 'Zap',
    shortDescription: 'Qualificação rápida',
    color: '#EF4444'
  },
  {
    id: 'inbound-sales',
    name: 'Inbound Sales',
    icon: 'Magnet',
    shortDescription: 'Ajude antes de vender',
    color: '#FF7A59'
  },
  {
    id: 'consultivo-br',
    name: 'Consultivo Brasileiro',
    icon: 'Heart',
    shortDescription: 'Relacionamento primeiro',
    color: '#22C55E'
  }
];

export default {
  SALES_REP_TEMPLATES,
  CHANNELS,
  CONNECTION_STRATEGIES,
  CONVERSATION_STYLES,
  OBJECTIVES,
  SALES_METHODOLOGIES
};
