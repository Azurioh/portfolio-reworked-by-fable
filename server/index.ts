import { serve } from '@hono/node-server';
import { createApp } from '#server/app';
import { loadServerEnv } from '#server/env';

const env = loadServerEnv();
const app = createApp({ webhookUrl: env.DISCORD_WEBHOOK_URL, staticDir: env.STATIC_DIR });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Portfolio server listening on http://localhost:${info.port} (static: ${env.STATIC_DIR})`);
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
