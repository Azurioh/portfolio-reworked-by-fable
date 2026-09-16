import { describe, expect, it } from 'vitest';
import { defaultLocale, locales, type LocaleCode } from './index';

type Dictionary = Record<string, unknown>;

const PAGE_FILES = import.meta.glob<Dictionary>('./*/page.json', { eager: true, import: 'default' });
const RUNTIME_FILES = import.meta.glob<Record<string, string>>('./*/runtime.json', { eager: true, import: 'default' });

const isRecord = (value: unknown): value is Dictionary => value !== null && typeof value === 'object';

/** Flattens a dictionary into its dotted leaf paths, arrays included, so two locales can be compared. */
const leafPaths = (params: { value: unknown; prefix: string }): readonly string[] => {
  if (!isRecord(params.value)) {
    return [params.prefix];
  }
  const paths: string[] = [];
  for (const [key, child] of Object.entries(params.value)) {
    const prefix = params.prefix === '' ? key : `${params.prefix}.${key}`;
    paths.push(...leafPaths({ value: child, prefix }));
  }
  return paths;
};

const sortedLeafPaths = (value: unknown): readonly string[] => [...leafPaths({ value, prefix: '' })].sort();

const leafAt = (params: { value: unknown; path: string }): unknown =>
  params.path.split('.').reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), params.value);

const variablesOf = (text: string): readonly string[] => [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();

const pageOf = (code: LocaleCode): Dictionary => PAGE_FILES[`./${code}/page.json`];
const runtimeOf = (code: LocaleCode): Record<string, string> => RUNTIME_FILES[`./${code}/runtime.json`];

const otherLocales = locales.filter((locale) => locale.code !== defaultLocale);

describe('locale config', () => {
  it('declares the default locale at the site root', () => {
    expect(locales.find((locale) => locale.code === defaultLocale)?.path).toBe('/');
  });

  it('gives every locale a distinct code, path and html lang', () => {
    const unique = (values: readonly string[]): number => new Set(values).size;
    expect(unique(locales.map((locale) => locale.code))).toBe(locales.length);
    expect(unique(locales.map((locale) => locale.path))).toBe(locales.length);
    expect(unique(locales.map((locale) => locale.htmlLang))).toBe(locales.length);
  });

  it('has a page and a runtime dictionary for every locale', () => {
    for (const locale of locales) {
      expect(pageOf(locale.code), locale.code).toBeDefined();
      expect(runtimeOf(locale.code), locale.code).toBeDefined();
    }
  });
});

describe('page dictionaries', () => {
  it('share the key set of the default locale, arrays included', () => {
    const reference = sortedLeafPaths(pageOf(defaultLocale));
    for (const locale of otherLocales) {
      expect(sortedLeafPaths(pageOf(locale.code)), locale.code).toEqual(reference);
    }
  });

  it('only hold strings at the leaves', () => {
    for (const locale of locales) {
      const page = pageOf(locale.code);
      for (const path of leafPaths({ value: page, prefix: '' })) {
        expect(typeof leafAt({ value: page, path }), `${locale.code}: ${path}`).toBe('string');
      }
    }
  });
});

describe('runtime dictionaries', () => {
  it('share the key set of the default locale', () => {
    const reference = Object.keys(runtimeOf(defaultLocale)).sort();
    for (const locale of otherLocales) {
      expect(Object.keys(runtimeOf(locale.code)).sort(), locale.code).toEqual(reference);
    }
  });

  it('keep the same {variables} in every translated string', () => {
    for (const locale of otherLocales) {
      const translated = runtimeOf(locale.code);
      for (const [key, text] of Object.entries(runtimeOf(defaultLocale))) {
        expect(variablesOf(translated[key]), `${locale.code}: ${key}`).toEqual(variablesOf(text));
      }
    }
  });
});
