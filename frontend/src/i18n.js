import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations - English
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enNavigation from './locales/en/navigation.json';
import enDashboard from './locales/en/dashboard.json';
import enCampaigns from './locales/en/campaigns.json';
import enLeads from './locales/en/leads.json';
import enContacts from './locales/en/contacts.json';
import enAgents from './locales/en/agents.json';
import enAiagents from './locales/en/aiagents.json';
import enUsers from './locales/en/users.json';
import enLinkedinaccounts from './locales/en/linkedinaccounts.json';
import enAnalytics from './locales/en/analytics.json';
import enConversations from './locales/en/conversations.json';
import enActivationagents from './locales/en/activationagents.json';
import enActivationcampaigns from './locales/en/activationcampaigns.json';
import enSearch from './locales/en/search.json';
import enGooglemaps from './locales/en/googlemaps.json';
import enSettings from './locales/en/settings.json';
import enLinkedin from './locales/en/linkedin.json';
import enModals from './locales/en/modals.json';
import enBilling from './locales/en/billing.json';
import enEmailSettings from './locales/en/emailSettings.json';
import enWebsiteAgents from './locales/en/websiteAgents.json';
import enTasks from './locales/en/tasks.json';
import enHire from './locales/en/hire.json';
import enKnowledge from './locales/en/knowledge.json';
import enSecretAgent from './locales/en/secretAgent.json';
import enProducts from './locales/en/products.json';
import enSecretAgentCoaching from './locales/en/secretAgentCoaching.json';
import enPipelines from './locales/en/pipelines.json';
import enInsights from './locales/en/insights.json';
import enNext from './locales/en/next.json';
import enPartner from './locales/en/partner.json';
import enOnboarding from './locales/en/onboarding.json';
import enNotifications from './locales/en/notifications.json';
import enInstagram from './locales/en/instagram.json';

// Import translations - Portuguese
import ptCommon from './locales/pt/common.json';
import ptAuth from './locales/pt/auth.json';
import ptNavigation from './locales/pt/navigation.json';
import ptDashboard from './locales/pt/dashboard.json';
import ptCampaigns from './locales/pt/campaigns.json';
import ptLeads from './locales/pt/leads.json';
import ptContacts from './locales/pt/contacts.json';
import ptAgents from './locales/pt/agents.json';
import ptAiagents from './locales/pt/aiagents.json';
import ptUsers from './locales/pt/users.json';
import ptLinkedinaccounts from './locales/pt/linkedinaccounts.json';
import ptAnalytics from './locales/pt/analytics.json';
import ptConversations from './locales/pt/conversations.json';
import ptActivationagents from './locales/pt/activationagents.json';
import ptActivationcampaigns from './locales/pt/activationcampaigns.json';
import ptSearch from './locales/pt/search.json';
import ptGooglemaps from './locales/pt/googlemaps.json';
import ptSettings from './locales/pt/settings.json';
import ptLinkedin from './locales/pt/linkedin.json';
import ptModals from './locales/pt/modals.json';
import ptBilling from './locales/pt/billing.json';
import ptEmailSettings from './locales/pt/emailSettings.json';
import ptWebsiteAgents from './locales/pt/websiteAgents.json';
import ptTasks from './locales/pt/tasks.json';
import ptHire from './locales/pt/hire.json';
import ptKnowledge from './locales/pt/knowledge.json';
import ptSecretAgent from './locales/pt/secretAgent.json';
import ptProducts from './locales/pt/products.json';
import ptSecretAgentCoaching from './locales/pt/secretAgentCoaching.json';
import ptPipelines from './locales/pt/pipelines.json';
import ptInsights from './locales/pt/insights.json';
import ptNext from './locales/pt/next.json';
import ptPartner from './locales/pt/partner.json';
import ptOnboarding from './locales/pt/onboarding.json';
import ptNotifications from './locales/pt/notifications.json';
import ptInstagram from './locales/pt/instagram.json';

// Import translations - Spanish
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esNavigation from './locales/es/navigation.json';
import esDashboard from './locales/es/dashboard.json';
import esCampaigns from './locales/es/campaigns.json';
import esLeads from './locales/es/leads.json';
import esContacts from './locales/es/contacts.json';
import esAgents from './locales/es/agents.json';
import esAiagents from './locales/es/aiagents.json';
import esUsers from './locales/es/users.json';
import esLinkedinaccounts from './locales/es/linkedinaccounts.json';
import esAnalytics from './locales/es/analytics.json';
import esConversations from './locales/es/conversations.json';
import esActivationagents from './locales/es/activationagents.json';
import esActivationcampaigns from './locales/es/activationcampaigns.json';
import esSearch from './locales/es/search.json';
import esGooglemaps from './locales/es/googlemaps.json';
import esSettings from './locales/es/settings.json';
import esLinkedin from './locales/es/linkedin.json';
import esModals from './locales/es/modals.json';
import esBilling from './locales/es/billing.json';
import esEmailSettings from './locales/es/emailSettings.json';
import esWebsiteAgents from './locales/es/websiteAgents.json';
import esTasks from './locales/es/tasks.json';
import esHire from './locales/es/hire.json';
import esKnowledge from './locales/es/knowledge.json';
import esSecretAgent from './locales/es/secretAgent.json';
import esProducts from './locales/es/products.json';
import esSecretAgentCoaching from './locales/es/secretAgentCoaching.json';
import esPipelines from './locales/es/pipelines.json';
import esInsights from './locales/es/insights.json';
import esNext from './locales/es/next.json';
import esPartner from './locales/es/partner.json';
import esOnboarding from './locales/es/onboarding.json';
import esNotifications from './locales/es/notifications.json';
import esInstagram from './locales/es/instagram.json';

// Translation resources
const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    navigation: enNavigation,
    dashboard: enDashboard,
    campaigns: enCampaigns,
    leads: enLeads,
    contacts: enContacts,
    agents: enAgents,
    aiagents: enAiagents,
    users: enUsers,
    linkedinaccounts: enLinkedinaccounts,
    analytics: enAnalytics,
    conversations: enConversations,
    activationagents: enActivationagents,
    activationcampaigns: enActivationcampaigns,
    search: enSearch,
    googlemaps: enGooglemaps,
    settings: enSettings,
    linkedin: enLinkedin,
    modals: enModals,
    billing: enBilling,
    emailSettings: enEmailSettings,
    websiteAgents: enWebsiteAgents,
    tasks: enTasks,
    hire: enHire,
    knowledge: enKnowledge,
    secretAgent: enSecretAgent,
    products: enProducts,
    secretAgentCoaching: enSecretAgentCoaching,
    pipelines: enPipelines,
    insights: enInsights,
    next: enNext,
    partner: enPartner,
    onboarding: enOnboarding,
    notifications: enNotifications,
    instagram: enInstagram,
  },
  pt: {
    common: ptCommon,
    auth: ptAuth,
    navigation: ptNavigation,
    dashboard: ptDashboard,
    campaigns: ptCampaigns,
    leads: ptLeads,
    contacts: ptContacts,
    agents: ptAgents,
    aiagents: ptAiagents,
    users: ptUsers,
    linkedinaccounts: ptLinkedinaccounts,
    analytics: ptAnalytics,
    conversations: ptConversations,
    activationagents: ptActivationagents,
    activationcampaigns: ptActivationcampaigns,
    search: ptSearch,
    googlemaps: ptGooglemaps,
    settings: ptSettings,
    linkedin: ptLinkedin,
    modals: ptModals,
    billing: ptBilling,
    emailSettings: ptEmailSettings,
    websiteAgents: ptWebsiteAgents,
    tasks: ptTasks,
    hire: ptHire,
    knowledge: ptKnowledge,
    secretAgent: ptSecretAgent,
    products: ptProducts,
    secretAgentCoaching: ptSecretAgentCoaching,
    pipelines: ptPipelines,
    insights: ptInsights,
    next: ptNext,
    partner: ptPartner,
    onboarding: ptOnboarding,
    notifications: ptNotifications,
    instagram: ptInstagram,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    navigation: esNavigation,
    dashboard: esDashboard,
    campaigns: esCampaigns,
    leads: esLeads,
    contacts: esContacts,
    agents: esAgents,
    aiagents: esAiagents,
    users: esUsers,
    linkedinaccounts: esLinkedinaccounts,
    analytics: esAnalytics,
    conversations: esConversations,
    activationagents: esActivationagents,
    activationcampaigns: esActivationcampaigns,
    search: esSearch,
    googlemaps: esGooglemaps,
    settings: esSettings,
    linkedin: esLinkedin,
    modals: esModals,
    billing: esBilling,
    emailSettings: esEmailSettings,
    websiteAgents: esWebsiteAgents,
    tasks: esTasks,
    hire: esHire,
    knowledge: esKnowledge,
    secretAgent: esSecretAgent,
    products: esProducts,
    secretAgentCoaching: esSecretAgentCoaching,
    pipelines: esPipelines,
    insights: esInsights,
    next: esNext,
    partner: esPartner,
    onboarding: esOnboarding,
    notifications: esNotifications,
    instagram: esInstagram,
  },
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en', // English as default
    defaultNS: 'common',
    ns: [
      'common', 'auth', 'navigation', 'dashboard', 'campaigns', 'leads', 'contacts',
      'agents', 'aiagents', 'users', 'linkedinaccounts', 'analytics', 'conversations',
      'activationagents', 'activationcampaigns', 'search', 'googlemaps', 'settings', 'linkedin', 'modals', 'billing', 'emailSettings', 'websiteAgents', 'tasks', 'hire', 'knowledge', 'secretAgent', 'products', 'secretAgentCoaching', 'pipelines', 'insights', 'next', 'partner', 'onboarding', 'notifications', 'instagram'
    ],

    // Language detection configuration
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator', 'htmlTag'],

      // Keys to use in localStorage
      lookupLocalStorage: 'i18nextLng',

      // Cache user language
      caches: ['localStorage'],

      // Don't check for cookies (not needed for SPA)
      excludeCacheFor: ['cimode'],
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Debug mode (disable in production)
    debug: import.meta.env.DEV,

    // React specific options
    react: {
      useSuspense: true,
    },
  });

export default i18n;
