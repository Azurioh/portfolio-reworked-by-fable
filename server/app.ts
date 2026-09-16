import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { buildContactModule } from '#server/contact/contact.module';
import { createContactRoutes } from '#server/contact/presentation/contact.routes';
import { SystemClock } from '#server/shared/providers/system-clock.provider';

/**
 * Composes the HTTP application: security headers, the contact API, then the
 * built site served from `staticDir` (`index.html` for `/`, 404 for unknown paths).
 * HSTS is left to the reverse proxy that terminates TLS.
 */
export const createApp = (params: { webhookUrl: string; staticDir: string }): Hono => {
  const contact = buildContactModule({ webhookUrl: params.webhookUrl, clock: new SystemClock() });
  const app = new Hono();
  app.use(secureHeaders({ strictTransportSecurity: false }));
  app.route('/api/contact', createContactRoutes({ sendContactMessage: contact.sendContactMessage }));
  app.use('*', serveStatic({ root: params.staticDir }));
  return app;
};
