import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '#server/app';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1/x';
const HTTP_OK = 200;
const HTTP_MOVED_PERMANENTLY = 301;
const HTTP_NOT_FOUND = 404;

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const MONTH_CACHE = 'public, max-age=2592000, stale-while-revalidate=86400';
const HOUR_CACHE = 'public, max-age=3600';

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "font-src 'self'; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'self'; " +
  "form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
const EXPECTED_HSTS = 'max-age=31536000; includeSubDomains';
const EXPECTED_PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';
const EXPECTED_REFERRER_POLICY = 'strict-origin-when-cross-origin';

const STATIC_FILES: Readonly<Record<string, string>> = {
  'index.html': '<!doctype html><html lang="fr"><body>fr</body></html>',
  'en/index.html': '<!doctype html><html lang="en"><body>en</body></html>',
  'assets/app-abc123.js': 'console.log("app");',
  'fonts/x.woff2': 'wOF2',
  'img/og.jpg': 'jpeg',
  'robots.txt': 'User-agent: *\n',
};

let staticDir: string;
let app: Hono;

const writeStaticFiles = (root: string): void => {
  for (const [relativePath, content] of Object.entries(STATIC_FILES)) {
    const target = join(root, relativePath);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  }
};

beforeAll(() => {
  staticDir = mkdtempSync(join(tmpdir(), 'portfolio-static-'));
  writeStaticFiles(staticDir);
  app = createApp({ webhookUrl: WEBHOOK_URL, staticDir });
});

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true });
});

describe('permanent redirects', () => {
  it.each([
    ['/index.html', '/'],
    ['/en', '/en/'],
    ['/en/index.html', '/en/'],
  ])('%s redirects permanently to %s', async (from, to) => {
    const response = await app.request(from);
    expect(response.status).toBe(HTTP_MOVED_PERMANENTLY);
    expect(response.headers.get('location')).toBe(to);
  });
});

describe('static site', () => {
  it('serves the French page at / without caching it', async () => {
    const response = await app.request('/');
    expect(response.status).toBe(HTTP_OK);
    expect(await response.text()).toContain('lang="fr"');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('serves the English page at /en/ without caching it', async () => {
    const response = await app.request('/en/');
    expect(response.status).toBe(HTTP_OK);
    expect(await response.text()).toContain('lang="en"');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('marks hashed assets immutable', async () => {
    const response = await app.request('/assets/app-abc123.js');
    expect(response.status).toBe(HTTP_OK);
    expect(response.headers.get('cache-control')).toBe(IMMUTABLE_CACHE);
  });

  it.each(['/fonts/x.woff2', '/img/og.jpg'])('caches %s for a month with revalidation', async (path) => {
    const response = await app.request(path);
    expect(response.status).toBe(HTTP_OK);
    expect(response.headers.get('cache-control')).toBe(MONTH_CACHE);
  });

  it('caches robots.txt for an hour', async () => {
    const response = await app.request('/robots.txt');
    expect(response.status).toBe(HTTP_OK);
    expect(response.headers.get('cache-control')).toBe(HOUR_CACHE);
  });

  it('answers 404 without Cache-Control for an unknown path', async () => {
    const response = await app.request('/nope');
    expect(response.status).toBe(HTTP_NOT_FOUND);
    expect(response.headers.get('cache-control')).toBeNull();
  });
});

describe('contact API caching', () => {
  it.each(['GET', 'HEAD'])('%s /api/contact is never stored and never 200', async (method) => {
    const response = await app.request('/api/contact', { method });
    expect(response.status).not.toBe(HTTP_OK);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('security headers', () => {
  it('sends HSTS for a year including subdomains', async () => {
    const response = await app.request('/');
    expect(response.headers.get('strict-transport-security')).toBe(EXPECTED_HSTS);
  });

  it('sends the strict content security policy', async () => {
    const response = await app.request('/');
    expect(response.headers.get('content-security-policy')).toBe(EXPECTED_CSP);
  });

  it('disables sensitive browser features', async () => {
    const response = await app.request('/');
    expect(response.headers.get('permissions-policy')).toBe(EXPECTED_PERMISSIONS_POLICY);
  });

  it('sends the referrer policy and keeps the default frame options', async () => {
    const response = await app.request('/');
    expect(response.headers.get('referrer-policy')).toBe(EXPECTED_REFERRER_POLICY);
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('applies the security headers to the API too', async () => {
    const response = await app.request('/api/contact');
    expect(response.headers.get('content-security-policy')).toBe(EXPECTED_CSP);
    expect(response.headers.get('strict-transport-security')).toBe(EXPECTED_HSTS);
  });
});
