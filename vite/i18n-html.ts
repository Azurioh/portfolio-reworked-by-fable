import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { z } from 'zod';
import { defaultLocale, locales, SITE_URL, type Locale } from '../src/locales/index.ts';
import { I18nTemplateError } from './errors/i18n-template.error.ts';
import { MissingAlternateLocaleError } from './errors/missing-alternate-locale.error.ts';
import { MissingDictionaryError } from './errors/missing-dictionary.error.ts';

/**
 * `{{ path.to.key }}` — whitespace inside the braces is optional, numeric
 * segments index arrays. Vite's HTML pipeline (parse5 + MagicString) rewrites
 * the document by offsets, so the braces survive in text and attributes alike.
 */
const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;
const PLACEHOLDER_OPEN = '{{';
const LEFTOVER_EXCERPT_LENGTH = 40;

const LOCALES_DIR = 'src/locales';
const DICTIONARY_FILE = 'page.json';
const TEMPLATE_URL = '/index.html';
const URL_PARSE_BASE = 'http://localhost';

const DICTIONARY_SCHEMA = z.record(z.string(), z.unknown());

/** Social preview image (1200×630), served from `public/img/`. */
const OG_IMAGE_PATH = '/img/og.jpg';
/** `hreflang` value of the language-neutral fallback link, pointing at the default locale. */
const X_DEFAULT_HREFLANG = 'x-default';
const SITE_ROOT_PATH = '/';

interface AlternateLocale {
  readonly code: string;
  readonly htmlLang: string;
  readonly ogLocale: string;
  readonly path: string;
  readonly url: string;
  /** Text of the language switcher link, e.g. `EN`. */
  readonly label: string;
}

interface PageMeta {
  readonly lang: string;
  readonly ogLocale: string;
  readonly path: string;
  readonly url: string;
  readonly alternates: readonly AlternateLocale[];
  /** Target of the language switcher: the first alternate. */
  readonly alternate: AlternateLocale;
  /** `<link rel="alternate" hreflang>` tags for every available locale plus `x-default`. */
  readonly alternateLinks: string;
  /** Absolute URL of the social preview image. */
  readonly image: string;
}

const absoluteUrl = (path: string): string => `${SITE_URL}${path}`;

const toAlternate = (locale: Locale): AlternateLocale => ({
  code: locale.code,
  htmlLang: locale.htmlLang,
  ogLocale: locale.ogLocale,
  path: locale.path,
  url: absoluteUrl(locale.path),
  label: locale.code.toUpperCase(),
});

const alternateLink = (params: { hreflang: string; url: string }): string =>
  `<link rel="alternate" hreflang="${params.hreflang}" href="${params.url}" />`;

/**
 * Renders the `hreflang` link set shared by every page: one link per
 * available locale, the current one included, and `x-default` on the site
 * root, where the default locale lives (`src/locales/locales.test.ts` enforces it).
 */
const buildAlternateLinks = (available: readonly Locale[]): string =>
  [
    ...available.map((locale) => alternateLink({ hreflang: locale.htmlLang, url: absoluteUrl(locale.path) })),
    alternateLink({ hreflang: X_DEFAULT_HREFLANG, url: absoluteUrl(SITE_ROOT_PATH) }),
  ].join('\n    ');

/**
 * Builds the locale-derived values exposed to the template under `meta.*`.
 * @param params.locale - Locale of the page being rendered.
 * @param params.available - Locales that have a dictionary; the others become `alternates`.
 * @returns The `meta` object merged next to the dictionary before rendering.
 * @throws {MissingAlternateLocaleError} When no other locale is available, since the template links to one.
 */
export const buildMeta = (params: { locale: Locale; available: readonly Locale[] }): PageMeta => {
  const alternates = params.available.filter((other) => other.code !== params.locale.code).map(toAlternate);
  const [alternate] = alternates;
  if (alternate === undefined) {
    throw new MissingAlternateLocaleError({ code: params.locale.code });
  }
  return {
    lang: params.locale.htmlLang,
    ogLocale: params.locale.ogLocale,
    path: params.locale.path,
    url: absoluteUrl(params.locale.path),
    alternates,
    alternate,
    alternateLinks: buildAlternateLinks(params.available),
    image: absoluteUrl(OG_IMAGE_PATH),
  };
};

const resolveKey = (params: { values: Record<string, unknown>; path: string }): unknown => {
  let current: unknown = params.values;
  for (const segment of params.path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

/**
 * Substitutes every `{{ path.to.key }}` of `template` with the string found at
 * that dotted path in `values`. Values are trusted authored HTML, inserted verbatim.
 * @param template - HTML containing placeholders.
 * @param values - Dictionary merged with `meta`, resolved by dotted path.
 * @returns The rendered HTML.
 * @throws {I18nTemplateError} When a key is missing, not a string, or a `{{` survives rendering.
 */
export const renderTemplate = (template: string, values: Record<string, unknown>): string => {
  const rendered = template.replace(PLACEHOLDER_RE, (_match, path: string) => {
    const value = resolveKey({ values, path });
    if (typeof value !== 'string') {
      throw new I18nTemplateError({ message: `missing or non-string value for "{{ ${path} }}"` });
    }
    return value;
  });
  const leftover = rendered.indexOf(PLACEHOLDER_OPEN);
  if (leftover !== -1) {
    const excerpt = rendered.slice(leftover, leftover + LEFTOVER_EXCERPT_LENGTH);
    throw new I18nTemplateError({ message: `unresolved placeholder near "${excerpt}"` });
  }
  return rendered;
};

const pathnameOf = (url: string): string => new URL(url, URL_PARSE_BASE).pathname;

const isLocaleRoot = (params: { pathname: string; locale: Locale }): boolean =>
  params.pathname === params.locale.path || `${params.pathname}/` === params.locale.path;

/** Matches `/en/` and `/en` to the `en` locale and `/` to the default locale. */
const findLocaleForPathname = (pathname: string): Locale | null =>
  locales.find((locale) => isLocaleRoot({ pathname, locale })) ?? null;

const dictionaryPath = (params: { root: string; code: string }): string =>
  resolve(params.root, LOCALES_DIR, params.code, DICTIONARY_FILE);

const hasDictionary = (params: { root: string; code: string }): boolean => existsSync(dictionaryPath(params));

const loadLocales = (root: string): { available: readonly Locale[]; fallback: Locale } => {
  const available = locales.filter((locale) => hasDictionary({ root, code: locale.code }));
  const fallback = available.find((locale) => locale.code === defaultLocale);
  if (fallback === undefined) {
    throw new MissingDictionaryError({ code: defaultLocale, path: dictionaryPath({ root, code: defaultLocale }) });
  }
  return { available, fallback };
};

const renderPage = (params: {
  root: string;
  template: string;
  locale: Locale;
  available: readonly Locale[];
}): string => {
  const file = dictionaryPath({ root: params.root, code: params.locale.code });
  const dictionary = DICTIONARY_SCHEMA.parse(JSON.parse(readFileSync(file, 'utf8')));
  const meta = buildMeta({ locale: params.locale, available: params.available });
  return renderTemplate(params.template, { ...dictionary, meta });
};

/**
 * Renders `index.html` once per locale. `/` (default locale) becomes
 * `dist/index.html`; every other locale with a dictionary at
 * `src/locales/<code>/page.json` becomes `dist/<code>/index.html`. All pages
 * share the same hashed assets. In dev, `/` and `/<code>/` render on the fly
 * and `/<code>/` answers 404 while its dictionary does not exist.
 * @returns The Vite plugin.
 */
export const i18nHtml = (): Plugin => {
  let root = '';

  return {
    name: 'i18n-html',
    // `vite:build-html` emits the HTML asset from its own `generateBundle`;
    // only a post plugin runs after it and sees the asset in the bundle.
    enforce: 'post',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const locale = findLocaleForPathname(pathnameOf(req.url ?? TEMPLATE_URL));
        if (locale === null || locale.code === defaultLocale) {
          next();
          return;
        }
        if (!hasDictionary({ root, code: locale.code })) {
          res.statusCode = 404;
          res.end(`No dictionary for locale "${locale.code}"`);
          return;
        }
        // `req.originalUrl` keeps `/<code>/`, which `transformIndexHtml` reads below.
        req.url = TEMPLATE_URL;
        next();
      });
    },
    transformIndexHtml(html, ctx) {
      if (ctx.server === undefined) {
        return undefined;
      }
      const { available, fallback } = loadLocales(root);
      const requested = findLocaleForPathname(pathnameOf(ctx.originalUrl ?? ctx.path));
      const locale = available.find((candidate) => candidate.code === requested?.code) ?? fallback;
      return renderPage({ root, template: html, locale, available });
    },
    generateBundle(_options, bundle) {
      const { available, fallback } = loadLocales(root);
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== 'asset' || !fileName.endsWith('.html') || typeof output.source !== 'string') {
          continue;
        }
        const template = output.source;
        for (const locale of available) {
          const page = renderPage({ root, template, locale, available });
          if (locale === fallback) {
            output.source = page;
          } else {
            this.emitFile({ type: 'asset', fileName: `${locale.path.slice(1)}${fileName}`, source: page });
          }
        }
      }
    },
  };
};
