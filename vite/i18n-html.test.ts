import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales, SITE_URL, type Locale } from '../src/locales/index.ts';
import { buildMeta, buildPageValues, renderTemplate } from './i18n-html.ts';
import { buildJsonLd } from './json-ld.ts';

const ROOT = resolve(import.meta.dirname, '..');
const EMAIL = 'alancunin@gmail.com';
const GUARDED_EMAIL = `<!--email_off-->${EMAIL}<!--/email_off-->`;
const JSON_LD_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
const HOSTILE_VALUE = 'Say "hi" \\ then </script><script>alert(1)</script>';
const CANONICAL_RE = /<link rel="canonical" href="([^"]*)"/g;
const HREFLANG_RE = /<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g;

const readDictionary = (locale: Locale): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(ROOT, 'src/locales', locale.code, 'page.json'), 'utf8')) as Record<string, unknown>;

/** Renders the real `index.html` with the given dictionary, as the plugin does at build time. */
const renderPageWith = (params: { locale: Locale; dictionary: Record<string, unknown> }): string =>
  renderTemplate(
    readFileSync(resolve(ROOT, 'index.html'), 'utf8'),
    buildPageValues({ locale: params.locale, available: locales, dictionary: params.dictionary }),
  );

const renderPage = (locale: Locale): string => renderPageWith({ locale, dictionary: readDictionary(locale) });

/** Extracts and parses every JSON-LD block of a document. */
const jsonLdBlocksOf = (html: string): readonly unknown[] =>
  [...html.matchAll(JSON_LD_RE)].map(([, text]) => JSON.parse(text) as unknown);

const headOf = (html: string): string => html.slice(0, html.indexOf('</head>'));

const hreflangsOf = (html: string): readonly (readonly [string, string])[] =>
  [...html.matchAll(HREFLANG_RE)].map(([, hreflang, href]) => [hreflang, href] as const);

describe('renderTemplate', () => {
  it('renders nested keys, with or without whitespace inside the braces', () => {
    const html = renderTemplate('<title>{{ head.title }}</title><p>{{nav.items.record}}</p>', {
      head: { title: 'Alan' },
      nav: { items: { record: 'Le record' } },
    });

    expect(html).toBe('<title>Alan</title><p>Le record</p>');
  });

  it('indexes arrays through numeric path segments', () => {
    const html = renderTemplate('<li>{{ pieces.items.1.title }}</li>', {
      pieces: { items: [{ title: 'VisiSurg' }, { title: 'ccprofile' }] },
    });

    expect(html).toBe('<li>ccprofile</li>');
  });

  it('renders inline HTML values verbatim', () => {
    const value = 'On se <em>parle</em>&nbsp;? Métal &amp; rock <b>2 min 20</b>';
    const html = renderTemplate('<h2>{{ contact.title }}</h2>', { contact: { title: value } });

    expect(html).toBe(`<h2>${value}</h2>`);
  });

  it('throws an error naming the key when it is missing', () => {
    expect(() => renderTemplate('<p>{{ hero.role }}</p>', { hero: {} })).toThrow(/hero\.role/);
  });

  it('throws when a key resolves to something that is not a string', () => {
    expect(() => renderTemplate('<p>{{ hero }}</p>', { hero: { role: 'x' } })).toThrow(/hero/);
  });

  it('throws when a placeholder survives rendering', () => {
    expect(() => renderTemplate('<p>{{ not a key }}</p>', {})).toThrow(/\{\{/);
  });
});

describe('buildMeta', () => {
  const [fr, en] = locales;

  it('resolves meta.url and meta.lang for the default locale', () => {
    const meta = buildMeta({ locale: fr, available: locales });

    expect(meta.url).toBe(`${SITE_URL}/`);
    expect(meta.lang).toBe('fr');
    expect(meta.ogLocale).toBe('fr_FR');
    expect(meta.path).toBe('/');
  });

  it('resolves meta.url for a prefixed locale', () => {
    const meta = buildMeta({ locale: en, available: locales });

    expect(meta.url).toBe(`${SITE_URL}/en/`);
    expect(meta.lang).toBe('en');
  });

  it('lists the other available locales as alternates, with an upper-case label', () => {
    expect(buildMeta({ locale: fr, available: locales }).alternates).toEqual([
      { code: 'en', htmlLang: 'en', ogLocale: 'en_US', path: '/en/', url: `${SITE_URL}/en/`, label: 'EN' },
    ]);
  });

  it.each(locales)('renders the same fr, en and x-default hreflang links on the $code page', (locale) => {
    const { alternateLinks } = buildMeta({ locale, available: locales });

    expect(hreflangsOf(alternateLinks)).toEqual([
      ['fr', `${SITE_URL}/`],
      ['en', `${SITE_URL}/en/`],
      ['x-default', `${SITE_URL}/`],
    ]);
  });

  it('only links the locales that have a dictionary, x-default staying on the site root', () => {
    const { alternateLinks } = buildMeta({ locale: en, available: [en, fr] });

    expect(hreflangsOf(alternateLinks)).toEqual([
      ['en', `${SITE_URL}/en/`],
      ['fr', `${SITE_URL}/`],
      ['x-default', `${SITE_URL}/`],
    ]);
  });

  it('exposes the absolute social image URL', () => {
    expect(buildMeta({ locale: fr, available: locales }).image).toBe(`${SITE_URL}/img/og.jpg`);
  });

  it('exposes the first alternate as the language switcher target', () => {
    expect(buildMeta({ locale: fr, available: locales }).alternate).toMatchObject({ path: '/en/', label: 'EN' });
    expect(buildMeta({ locale: en, available: locales }).alternate).toMatchObject({ path: '/', label: 'FR' });
  });

  it('throws when the page has no alternate locale to link to', () => {
    expect(() => buildMeta({ locale: fr, available: [fr] })).toThrow(/alternate locale/);
  });

  it('renders meta values through the template', () => {
    const html = renderTemplate('<html lang="{{ meta.lang }}"><a href="{{ meta.url }}">', {
      meta: buildMeta({ locale: en, available: locales }),
    });

    expect(html).toBe(`<html lang="en"><a href="${SITE_URL}/en/">`);
  });
});

describe('index.html head', () => {
  it.each(locales)('has exactly one canonical equal to meta.url on the $code page', (locale) => {
    const head = headOf(renderPage(locale));

    expect([...head.matchAll(CANONICAL_RE)].map(([, href]) => href)).toEqual([
      buildMeta({ locale, available: locales }).url,
    ]);
  });

  it.each(locales)('declares its own og:url and og:locale on the $code page', (locale) => {
    const head = headOf(renderPage(locale));

    expect(head).toContain(`<meta property="og:url" content="${SITE_URL}${locale.path}" />`);
    expect(head).toContain(`<meta property="og:locale" content="${locale.ogLocale}" />`);
    expect(hreflangsOf(head)).toHaveLength(3);
  });

  it.each(locales)('renders valid JSON-LD with the $code strings', (locale) => {
    const blocks = jsonLdBlocksOf(headOf(renderPage(locale)));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      '@graph': [
        { '@type': 'Person', '@id': `${SITE_URL}/#person`, sameAs: expect.arrayContaining(['https://github.com/azurioh']) },
        { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, inLanguage: locale.htmlLang },
        { '@type': 'ProfilePage', url: `${SITE_URL}${locale.path}`, inLanguage: locale.htmlLang },
      ],
    });
  });

  it('keeps the JSON-LD block intact when a dictionary value contains quotes, backslashes and </script>', () => {
    const [fr] = locales;
    const real = readDictionary(fr);
    const dictionary = { ...real, head: { ...(real.head as Record<string, unknown>), jobTitle: HOSTILE_VALUE } };
    const head = headOf(renderPageWith({ locale: fr, dictionary }));
    const blocks = jsonLdBlocksOf(head);

    expect(head.match(/<\/script>/g)).toHaveLength(1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ '@graph': [{ jobTitle: HOSTILE_VALUE }, {}, {}] });
  });

  it.each(locales)('only exposes the email address inside email_off comments on the $code page', (locale) => {
    const html = renderPage(locale);
    const [, body] = html.split('</head>');

    expect(body.split(GUARDED_EMAIL).join('')).not.toContain(EMAIL);
  });
});

describe('buildJsonLd', () => {
  const [fr] = locales;
  const dictionary = { head: { jobTitle: 'Dev', description: 'Desc' } };

  it('never emits a raw "<", so the text cannot close its script tag', () => {
    const text = buildJsonLd({ locale: fr, dictionary: { head: { jobTitle: HOSTILE_VALUE, description: 'x' } } });

    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toMatchObject({ '@graph': [{ jobTitle: HOSTILE_VALUE }, {}, {}] });
  });

  it('throws when the dictionary lacks a localized field', () => {
    expect(() => buildJsonLd({ locale: fr, dictionary: { head: { jobTitle: 'Dev' } } })).toThrow(/description/);
  });

  it('describes the page in its own language and URL', () => {
    expect(JSON.parse(buildJsonLd({ locale: fr, dictionary }))).toMatchObject({
      '@graph': [{ jobTitle: 'Dev', description: 'Desc' }, { inLanguage: 'fr' }, { url: `${SITE_URL}/`, inLanguage: 'fr' }],
    });
  });
});
