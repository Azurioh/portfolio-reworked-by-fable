import { Hono } from 'hono';

const MOVED_PERMANENTLY = 301;

/** Legacy or non-canonical paths of the built site and the canonical URL each one moves to. */
const PERMANENT_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: '/index.html', to: '/' },
  { from: '/en', to: '/en/' },
  { from: '/en/index.html', to: '/en/' },
];

/**
 * Builds the routes answering `301` for the non-canonical page URLs. Mount them before
 * the static middleware so the duplicate URLs are never served with a `200`.
 * @returns A Hono app to mount at `/`.
 */
export const createRedirectRoutes = (): Hono => {
  const routes = new Hono();
  for (const redirect of PERMANENT_REDIRECTS) {
    routes.get(redirect.from, (c) => c.redirect(redirect.to, MOVED_PERMANENTLY));
  }
  return routes;
};
