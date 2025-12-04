import { defineConfig } from 'vitepress'

// Documentation Sidebar
const sidebarDocs = [
  {
    text: 'Introduction',
    items: [
      { text: 'Welcome', link: '/docs/' },
      { text: 'Getting Started', link: '/docs/getting-started' }
    ]
  },
  {
    text: 'AI Agents',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/docs/ai-agents/' },
      { text: 'Conversation Agents', link: '/docs/ai-agents/conversation-agents' },
      { text: 'Activation Agents', link: '/docs/ai-agents/activation-agents' },
      { text: 'Google Maps Agents', link: '/docs/ai-agents/google-maps-agents' },
      { text: 'Website Agents', link: '/docs/ai-agents/website-agents' }
    ]
  },
  {
    text: 'Channels',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/docs/channels/' },
      { text: 'LinkedIn', link: '/docs/channels/linkedin' },
      { text: 'Email', link: '/docs/channels/email' },
      { text: 'WhatsApp', link: '/docs/channels/whatsapp' }
    ]
  },
  {
    text: 'Leads',
    collapsed: false,
    items: [
      { text: 'Managing Leads', link: '/docs/leads/' },
      { text: 'Importing Leads', link: '/docs/leads/importing' },
      { text: 'Contact Lists', link: '/docs/leads/contact-lists' }
    ]
  },
  {
    text: 'Campaigns',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/docs/campaigns/' },
      { text: 'LinkedIn Campaigns', link: '/docs/campaigns/linkedin-campaigns' },
      { text: 'Activation Campaigns', link: '/docs/campaigns/activation-campaigns' }
    ]
  },
  {
    text: 'Conversations',
    collapsed: false,
    items: [
      { text: 'Inbox', link: '/docs/conversations/' }
    ]
  },
  {
    text: 'Analytics',
    collapsed: false,
    items: [
      { text: 'Dashboard', link: '/docs/analytics/' }
    ]
  }
]

// API Reference Sidebar
const sidebarAPI = [
  {
    text: 'Getting Started',
    items: [
      { text: 'Introduction', link: '/api-reference/' },
      { text: 'Authentication', link: '/api-reference/authentication' },
      { text: 'Rate Limits', link: '/api-reference/rate-limits' },
      { text: 'Errors', link: '/api-reference/errors' }
    ]
  },
  {
    text: 'Contacts',
    collapsed: false,
    items: [
      { text: 'List contacts', link: '/api-reference/contacts/list' },
      { text: 'Get contact', link: '/api-reference/contacts/get' },
      { text: 'Create contact', link: '/api-reference/contacts/create' },
      { text: 'Update contact', link: '/api-reference/contacts/update' },
      { text: 'Delete contact', link: '/api-reference/contacts/delete' }
    ]
  },
  {
    text: 'Opportunities',
    collapsed: false,
    items: [
      { text: 'List opportunities', link: '/api-reference/opportunities/list' },
      { text: 'Get opportunity', link: '/api-reference/opportunities/get' },
      { text: 'Create opportunity', link: '/api-reference/opportunities/create' },
      { text: 'Update opportunity', link: '/api-reference/opportunities/update' },
      { text: 'Update stage', link: '/api-reference/opportunities/update-stage' },
      { text: 'Delete opportunity', link: '/api-reference/opportunities/delete' }
    ]
  }
]

// Portuguese Documentation Sidebar
const sidebarDocsPTBR = [
  {
    text: 'Introdução',
    items: [
      { text: 'Bem-vindo', link: '/pt-BR/docs/' },
      { text: 'Primeiros Passos', link: '/pt-BR/docs/getting-started' }
    ]
  },
  {
    text: 'Agentes IA',
    collapsed: false,
    items: [
      { text: 'Visão Geral', link: '/pt-BR/docs/ai-agents/' },
      { text: 'Agentes de Conversa', link: '/pt-BR/docs/ai-agents/conversation-agents' },
      { text: 'Agentes de Ativação', link: '/pt-BR/docs/ai-agents/activation-agents' },
      { text: 'Agentes Google Maps', link: '/pt-BR/docs/ai-agents/google-maps-agents' },
      { text: 'Agentes de Website', link: '/pt-BR/docs/ai-agents/website-agents' }
    ]
  },
  {
    text: 'Canais',
    collapsed: false,
    items: [
      { text: 'Visão Geral', link: '/pt-BR/docs/channels/' },
      { text: 'LinkedIn', link: '/pt-BR/docs/channels/linkedin' },
      { text: 'Email', link: '/pt-BR/docs/channels/email' },
      { text: 'WhatsApp', link: '/pt-BR/docs/channels/whatsapp' }
    ]
  },
  {
    text: 'Leads',
    collapsed: false,
    items: [
      { text: 'Gerenciar Leads', link: '/pt-BR/docs/leads/' },
      { text: 'Importar Leads', link: '/pt-BR/docs/leads/importing' },
      { text: 'Listas de Contatos', link: '/pt-BR/docs/leads/contact-lists' }
    ]
  },
  {
    text: 'Campanhas',
    collapsed: false,
    items: [
      { text: 'Visão Geral', link: '/pt-BR/docs/campaigns/' },
      { text: 'Campanhas LinkedIn', link: '/pt-BR/docs/campaigns/linkedin-campaigns' },
      { text: 'Campanhas de Ativação', link: '/pt-BR/docs/campaigns/activation-campaigns' }
    ]
  },
  {
    text: 'Conversas',
    collapsed: false,
    items: [
      { text: 'Caixa de Entrada', link: '/pt-BR/docs/conversations/' }
    ]
  },
  {
    text: 'Analytics',
    collapsed: false,
    items: [
      { text: 'Dashboard', link: '/pt-BR/docs/analytics/' }
    ]
  }
]

// Portuguese API Reference Sidebar
const sidebarAPIPTBR = [
  {
    text: 'Começando',
    items: [
      { text: 'Introdução', link: '/pt-BR/api-reference/' },
      { text: 'Autenticação', link: '/pt-BR/api-reference/authentication' },
      { text: 'Rate Limits', link: '/pt-BR/api-reference/rate-limits' },
      { text: 'Erros', link: '/pt-BR/api-reference/errors' }
    ]
  },
  {
    text: 'Contatos',
    collapsed: false,
    items: [
      { text: 'Listar contatos', link: '/pt-BR/api-reference/contacts/list' },
      { text: 'Buscar contato', link: '/pt-BR/api-reference/contacts/get' },
      { text: 'Criar contato', link: '/pt-BR/api-reference/contacts/create' },
      { text: 'Atualizar contato', link: '/pt-BR/api-reference/contacts/update' },
      { text: 'Excluir contato', link: '/pt-BR/api-reference/contacts/delete' }
    ]
  },
  {
    text: 'Oportunidades',
    collapsed: false,
    items: [
      { text: 'Listar oportunidades', link: '/pt-BR/api-reference/opportunities/list' },
      { text: 'Buscar oportunidade', link: '/pt-BR/api-reference/opportunities/get' },
      { text: 'Criar oportunidade', link: '/pt-BR/api-reference/opportunities/create' },
      { text: 'Atualizar oportunidade', link: '/pt-BR/api-reference/opportunities/update' },
      { text: 'Atualizar estágio', link: '/pt-BR/api-reference/opportunities/update-stage' },
      { text: 'Excluir oportunidade', link: '/pt-BR/api-reference/opportunities/delete' }
    ]
  }
]

export default defineConfig({
  title: 'GetRaze',
  description: 'Documentation for GetRaze - AI-Powered Lead Generation Platform',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo/getraze-square-purple.svg' }]
  ],

  // Clean URLs
  cleanUrls: true,

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Documentation', link: '/docs/', activeMatch: '/docs/' },
          { text: 'API Reference', link: '/api-reference/', activeMatch: '/api-reference/' },
          { text: 'Changelog', link: '/changelog' }
        ],
        sidebar: {
          '/docs/': sidebarDocs,
          '/api-reference/': sidebarAPI
        }
      }
    },
    'pt-BR': {
      label: 'Português',
      lang: 'pt-BR',
      themeConfig: {
        nav: [
          { text: 'Documentação', link: '/pt-BR/docs/', activeMatch: '/pt-BR/docs/' },
          { text: 'API Reference', link: '/pt-BR/api-reference/', activeMatch: '/pt-BR/api-reference/' },
          { text: 'Changelog', link: '/pt-BR/changelog' }
        ],
        sidebar: {
          '/pt-BR/docs/': sidebarDocsPTBR,
          '/pt-BR/api-reference/': sidebarAPIPTBR
        }
      }
    }
  },

  themeConfig: {
    logo: {
      light: '/logo/getraze-purple.svg',
      dark: '/logo/getraze-white.svg'
    },
    siteTitle: false,

    search: {
      provider: 'local'
    },

    footer: {
      message: 'GetRaze - AI-Powered Lead Generation',
      copyright: 'Copyright © 2024 GetRaze'
    },

    // Enable dark mode toggle (appears automatically)
    appearance: true,

    // Outline configuration
    outline: {
      level: [2, 3]
    }
  }
})
