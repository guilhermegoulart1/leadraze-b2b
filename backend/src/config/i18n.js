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
      // Order of detection (removed 'header' to avoid conflicts)
      order: ['querystring', 'cookie'],

      // Keys to use in query string or cookies
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',

      // Cache user language on
      caches: ['cookie'],
    },

    // Interpolation
    interpolation: {
      escapeValue: false, // Not needed for server-side
    },

    // Debug mode (disabled to reduce log noise)
    debug: false,
  });

module.exports = i18next;
