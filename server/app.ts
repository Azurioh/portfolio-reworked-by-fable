import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { buildContactModule } from '#server/contact/contact.module';
import { createContactRoutes } from '#server/contact/presentation/contact.routes';
import { cacheControl } from '#server/shared/http/cache-control';
import { createRedirectRoutes } from '#server/shared/http/redirects';
import { securityHeaders } from '#server/shared/http/security-headers';
import { SystemClock } from '#server/shared/providers/system-clock.provider';

/**
 * Composes the HTTP application: security headers (HSTS, CSP, Permissions-Policy…) and
 * `Cache-Control` on every response, the contact API, the permanent redirects of the
 * non-canonical page URLs, then the built site served from `staticDir` (`index.html` for `/`,
 * `en/index.html` for `/en/`, 404 for unknown paths). Compression is left to the proxy.
 * @param params.webhookUrl Discord webhook receiving the contact messages.
 * @param params.staticDir Directory of the built site.
 * @returns The Hono app, ready for any Web-standard runtime.
 */
export const createApp = (params: { webhookUrl: string; staticDir: string }): Hono => {
  const contact = buildContactModule({ webhookUrl: params.webhookUrl, clock: new SystemClock() });
  const app = new Hono();
  app.use(securityHeaders());
  app.use(cacheControl());
  app.route('/api/contact', createContactRoutes({ sendContactMessage: contact.sendContactMessage }));
  app.route('/', createRedirectRoutes());
  app.use('*', serveStatic({ root: params.staticDir }));
  return app;
};
