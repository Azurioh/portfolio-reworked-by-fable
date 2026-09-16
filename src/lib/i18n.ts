import en from '../locales/en/runtime.json';
import fr from '../locales/fr/runtime.json';
import { defaultLocale, locales, type LocaleCode } from '../locales';

/** A key of the runtime dictionaries; the French file is the reference key set. */
export type RuntimeKey = keyof typeof fr;

const VARIABLE_RE = /\{(\w+)\}/g;

const dictionaries: Record<LocaleCode, Record<RuntimeKey, string>> = { fr, en };

/**
 * Resolves the locale of the current page from `<html lang>`, as rendered by the
 * i18n Vite plugin. Unknown or missing values fall back to the default locale.
 * @returns The locale code of the page.
 */
export const getLocale = (): LocaleCode => {
  const htmlLang = document.documentElement.lang;
  return locales.find((locale) => locale.htmlLang === htmlLang)?.code ?? defaultLocale;
};

/**
 * Translates a runtime string into the language of the current page and fills its variables.
 * @param params.key - Dotted key of the runtime dictionary.
 * @param params.vars - Values substituted for `{name}` placeholders; unknown placeholders stay verbatim.
 * @returns The localized string.
 */
export const translate = (params: { key: RuntimeKey; vars: Readonly<Record<string, string>> }): string =>
  dictionaries[getLocale()][params.key].replace(VARIABLE_RE, (match, name: string) => params.vars[name] ?? match);

/**
 * Translates a runtime string without variables into the language of the current page.
 * @param key - Dotted key of the runtime dictionary.
 * @returns The localized string.
 */
export const t = (key: RuntimeKey): string => translate({ key, vars: {} });
