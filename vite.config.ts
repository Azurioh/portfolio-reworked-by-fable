import { defineConfig } from 'vite';
import { i18nHtml } from './vite/i18n-html.ts';

const API_PROXY_TARGET = 'http://localhost:8787';

export default defineConfig({
  plugins: [i18nHtml()],
  server: {
    proxy: {
      '/api': API_PROXY_TARGET,
    },
  },
});
