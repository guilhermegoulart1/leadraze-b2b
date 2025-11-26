const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

// Initialize i18next for backend
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Fallback language
    fallbackLng: 'en',

    // Supported languages
    supportedLngs: ['en', 'pt', 'es'],

    // Namespaces
    ns: ['errors', 'messages', 'emails'],
    defaultNS: 'messages',

    // Backend configuration
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },

    // Language detection
    detection: {
      // Order of detection
      order: ['querystring', 'cookie', 'header'],

      // Keys to use in query string or cookies
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupHeader: 'accept-language',

      // Cache user language on
      caches: ['cookie'],
    },

    // Interpolation
    interpolation: {
      escapeValue: false, // Not needed for server-side
    },

    // Debug mode
    debug: process.env.NODE_ENV === 'development',
  });

module.exports = i18next;
