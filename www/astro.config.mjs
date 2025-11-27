import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://getraze.co',
  integrations: [
    tailwind(),
    react()
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pt-br', 'es'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});
