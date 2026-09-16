import { defineConfig } from 'vite';

const API_PROXY_TARGET = 'http://localhost:8787';

export default defineConfig({
  server: {
    proxy: {
      '/api': API_PROXY_TARGET,
    },
  },
});
