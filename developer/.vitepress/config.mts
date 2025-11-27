import { defineConfig } from 'vitepress'

// Shared sidebar configuration
const sidebarEN = [
  {
    text: 'Introduction',
    items: [
      { text: 'Welcome', link: '/' },
      { text: 'Getting Started', link: '/getting-started' }
    ]
  },
  {
    text: 'AI Agents',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/features/ai-agents/' },
      { text: 'Conversation Agents', link: '/features/ai-agents/conversation-agents' },
      { text: 'Activation Agents', link: '/features/ai-agents/activation-agents' },
      { text: 'Google Maps Agents', link: '/features/ai-agents/google-maps-agents' },
      { text: 'Website Agents', link: '/features/ai-agents/website-agents' }
    ]
  },
  {
    text: 'Channels',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/features/channels/' },
      { text: 'LinkedIn', link: '/features/channels/linkedin' },
      { text: 'Email', link: '/features/channels/email' },
      { text: 'WhatsApp', link: '/features/channels/whatsapp' }
    ]
  },
  {
    text: 'Leads',
    collapsed: false,
    items: [
      { text: 'Managing Leads', link: '/features/leads/' },
      { text: 'Importing Leads', link: '/features/leads/importing' },
      { text: 'Contact Lists', link: '/features/leads/contact-lists' }
    ]
  },
  {
    text: 'Campaigns',
    collapsed: false,
    items: [
      { text: 'Overview', link: '/features/campaigns/' },
      { text: 'LinkedIn Campaigns', link: '/features/campaigns/linkedin-campaigns' },
      { text: 'Activation Campaigns', link: '/features/campaigns/activation-campaigns' }
    ]
  },
  {
    text: 'Conversations',
    collapsed: false,
    items: [
      { text: 'Inbox', link: '/features/conversations/' }
    ]
  },
  {
    text: 'Analytics',
    collapsed: false,
    items: [
      { text: 'Dashboard', link: '/features/analytics/' }
    ]
  }
]

const sidebarPTBR = [
  {
    text: 'Introdução',
    items: [
      { text: 'Bem-vindo', link: '/pt-BR/' },
      { text: 'Primeiros Passos', link: '/pt-BR/getting-started' }
    ]
  },
  {
    text: 'Agentes IA',
    collapsed: false,
    items: [
      { text: 'Visão Geral', link: '/pt-BR/features/ai-agents/' },
      { text: 'Agentes de Conversa', link: '/pt-BR/features/ai-agents/conversation-agents' },
      { text: 'Agentes de Ativação', link: '/pt-BR/features/ai-agents/activation-agents' },
      { text: 'Agentes Google Maps', link: '/pt-BR/features/ai-agents/google-maps-agents' },
      { text: 'Agentes de Website', link: '/pt-BR/features/ai-agents/website-agents' }
    ]
  },
  {
    text: 'Canais',
    collapsed: false,
    items: [
      { text: 'Visão Geral', link: '/pt-BR/features/channels/' },
      { text: 'LinkedIn', link: '/pt-BR/features/channels/linkedin' },
      { text: 'Email', link: '/pt-BR/features/channels/email' },
      { text: 'WhatsApp', link: '/pt-BR/features/channels/whatsapp' }
    ]
  },
  {
    text: 'Leads',
    collapsed: false,
    items: [
      { text: 'Gerenciar Leads', link: '/pt-BR/features/leads/' },
      { text: 'Importar Leads', link: '/pt-BR/features/leads/importing' },
      { text: 'Listas de Contatos', link: '/pt-BR/features/leads/contact-lists' }
    ]
  },
  {
    text: 'Campanhas',
    collapsed: false,
    items: [
      { text: 'Visão Geral', link: '/pt-BR/features/campaigns/' },
      { text: 'Campanhas LinkedIn', link: '/pt-BR/features/campaigns/linkedin-campaigns' },
      { text: 'Campanhas de Ativação', link: '/pt-BR/features/campaigns/activation-campaigns' }
    ]
  },
  {
    text: 'Conversas',
    collapsed: false,
    items: [
      { text: 'Caixa de Entrada', link: '/pt-BR/features/conversations/' }
    ]
  },
  {
    text: 'Analytics',
    collapsed: false,
    items: [
      { text: 'Dashboard', link: '/pt-BR/features/analytics/' }
    ]
  }
]

const sidebarES = [
  {
    text: 'Introducción',
    items: [
      { text: 'Bienvenido', link: '/es/' },
      { text: 'Primeros Pasos', link: '/es/getting-started' }
    ]
  },
  {
    text: 'Agentes IA',
    collapsed: false,
    items: [
      { text: 'Resumen', link: '/es/features/ai-agents/' },
      { text: 'Agentes de Conversación', link: '/es/features/ai-agents/conversation-agents' },
      { text: 'Agentes de Activación', link: '/es/features/ai-agents/activation-agents' },
      { text: 'Agentes Google Maps', link: '/es/features/ai-agents/google-maps-agents' },
      { text: 'Agentes de Sitio Web', link: '/es/features/ai-agents/website-agents' }
    ]
  },
  {
    text: 'Canales',
    collapsed: false,
    items: [
      { text: 'Resumen', link: '/es/features/channels/' },
      { text: 'LinkedIn', link: '/es/features/channels/linkedin' },
      { text: 'Email', link: '/es/features/channels/email' },
      { text: 'WhatsApp', link: '/es/features/channels/whatsapp' }
    ]
  },
  {
    text: 'Leads',
    collapsed: false,
    items: [
      { text: 'Gestionar Leads', link: '/es/features/leads/' },
      { text: 'Importar Leads', link: '/es/features/leads/importing' },
      { text: 'Listas de Contactos', link: '/es/features/leads/contact-lists' }
    ]
  },
  {
    text: 'Campañas',
    collapsed: false,
    items: [
      { text: 'Resumen', link: '/es/features/campaigns/' },
      { text: 'Campañas LinkedIn', link: '/es/features/campaigns/linkedin-campaigns' },
      { text: 'Campañas de Activación', link: '/es/features/campaigns/activation-campaigns' }
    ]
  },
  {
    text: 'Conversaciones',
    collapsed: false,
    items: [
      { text: 'Bandeja de Entrada', link: '/es/features/conversations/' }
    ]
  },
  {
    text: 'Analytics',
    collapsed: false,
    items: [
      { text: 'Dashboard', link: '/es/features/analytics/' }
    ]
  }
]

export default defineConfig({
  title: 'GetRaze Docs',
  description: 'Documentation for GetRaze - AI-Powered Lead Generation Platform',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Features', link: '/features/ai-agents/' }
        ],
        sidebar: sidebarEN
      }
    },
    'pt-BR': {
      label: 'Português',
      lang: 'pt-BR',
      themeConfig: {
        nav: [
          { text: 'Início', link: '/pt-BR/' },
          { text: 'Primeiros Passos', link: '/pt-BR/getting-started' },
          { text: 'Funcionalidades', link: '/pt-BR/features/ai-agents/' }
        ],
        sidebar: sidebarPTBR
      }
    },
    es: {
      label: 'Español',
      lang: 'es',
      themeConfig: {
        nav: [
          { text: 'Inicio', link: '/es/' },
          { text: 'Primeros Pasos', link: '/es/getting-started' },
          { text: 'Funcionalidades', link: '/es/features/ai-agents/' }
        ],
        sidebar: sidebarES
      }
    }
  },

  themeConfig: {
    logo: '/logo.svg',

    search: {
      provider: 'local'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/getraze' }
    ],

    footer: {
      message: 'GetRaze - AI-Powered Lead Generation',
      copyright: 'Copyright © 2024 GetRaze'
    }
  }
})
