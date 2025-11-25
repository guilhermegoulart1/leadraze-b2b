import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enNavigation from './locales/en/navigation.json';
import enDashboard from './locales/en/dashboard.json';
import enCampaigns from './locales/en/campaigns.json';
import enLeads from './locales/en/leads.json';
import enContacts from './locales/en/contacts.json';

import ptCommon from './locales/pt/common.json';
import ptAuth from './locales/pt/auth.json';
import ptNavigation from './locales/pt/navigation.json';
import ptDashboard from './locales/pt/dashboard.json';
import ptCampaigns from './locales/pt/campaigns.json';
import ptLeads from './locales/pt/leads.json';
import ptContacts from './locales/pt/contacts.json';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esNavigation from './locales/es/navigation.json';
import esDashboard from './locales/es/dashboard.json';
import esCampaigns from './locales/es/campaigns.json';
import esLeads from './locales/es/leads.json';
import esContacts from './locales/es/contacts.json';

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
  },
  pt: {
    common: ptCommon,
    auth: ptAuth,
    navigation: ptNavigation,
    dashboard: ptDashboard,
    campaigns: ptCampaigns,
    leads: ptLeads,
    contacts: ptContacts,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    navigation: esNavigation,
    dashboard: esDashboard,
    campaigns: esCampaigns,
    leads: esLeads,
    contacts: esContacts,
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
    ns: ['common', 'auth', 'navigation', 'dashboard', 'campaigns', 'leads', 'contacts'],

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
