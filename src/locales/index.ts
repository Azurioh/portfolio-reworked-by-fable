/** Absolute origin of the published site, without a trailing slash. */
export const SITE_URL = 'https://alancunin.fr';

export interface Locale {
  /** Dictionary folder name under `src/locales/` and switcher identifier. */
  readonly code: string;
  /** Public path of the locale root, always starting and ending with `/`. */
  readonly path: string;
  /** Value of the `<html lang>` attribute. */
  readonly htmlLang: string;
  /** Value of the `og:locale` meta tag. */
  readonly ogLocale: string;
}

export const locales: readonly Locale[] = [
  { code: 'fr', path: '/', htmlLang: 'fr', ogLocale: 'fr_FR' },
  { code: 'en', path: '/en/', htmlLang: 'en', ogLocale: 'en_US' },
];

export const defaultLocale = 'fr';
