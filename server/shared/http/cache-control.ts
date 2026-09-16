import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';

const API_PREFIX = '/api/';
const HASHED_ASSETS_PREFIX = '/assets/';
const LONG_LIVED_PREFIXES: readonly string[] = ['/fonts/', '/img/'];
const LONG_LIVED_PATHS: readonly string[] = ['/favicon.ico', '/favicon.svg'];
const LONG_LIVED_EXTENSION = '.png';
const HOURLY_PATHS: readonly string[] = ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/cv.pdf'];
const HTML_EXTENSION = '.html';
const DIRECTORY_SUFFIX = '/';

const NO_STORE = 'no-store';
const NO_CACHE = 'no-cache';
const IMMUTABLE_YEAR = 'public, max-age=31536000, immutable';
const MONTH_WITH_REVALIDATION = 'public, max-age=2592000, stale-while-revalidate=86400';
const ONE_HOUR = 'public, max-age=3600';

const CACHE_CONTROL_HEADER = 'Cache-Control';

const isApiPath = (path: string): boolean => path.startsWith(API_PREFIX);

const isLongLived = (path: string): boolean =>
  LONG_LIVED_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
  LONG_LIVED_PATHS.includes(path) ||
  path.endsWith(LONG_LIVED_EXTENSION);

const isHourly = (path: string): boolean => HOURLY_PATHS.includes(path);

const isHtml = (path: string): boolean => path.endsWith(DIRECTORY_SUFFIX) || path.endsWith(HTML_EXTENSION);

/** Picks the `Cache-Control` value of a successfully served path of the built site, `null` when it has no policy. */
const resolveStaticCacheControl = (path: string): string | null => {
  if (path.startsWith(HASHED_ASSETS_PREFIX)) {
    return IMMUTABLE_YEAR;
  }
  if (isLongLived(path)) {
    return MONTH_WITH_REVALIDATION;
  }
  if (isHourly(path)) {
    return ONE_HOUR;
  }
  if (isHtml(path)) {
    return NO_CACHE;
  }
  return null;
};

/**
 * Sets `Cache-Control` after the downstream handler ran: `/api/*` is never stored (whatever
 * the status), successful responses follow `resolveStaticCacheControl`, and redirects or
 * errors keep no caching header so nothing wrong is cached upstream.
 * @returns The Hono middleware.
 */
export const cacheControl = (): MiddlewareHandler =>
  createMiddleware(async (c, next) => {
    await next();
    if (isApiPath(c.req.path)) {
      c.res.headers.set(CACHE_CONTROL_HEADER, NO_STORE);
      return;
    }
    if (!c.res.ok) {
      return;
    }
    const value = resolveStaticCacheControl(c.req.path);
    if (value !== null) {
      c.res.headers.set(CACHE_CONTROL_HEADER, value);
    }
  });
