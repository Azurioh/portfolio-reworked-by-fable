/** Thrown when a page has no other locale to link to, so the language switcher cannot be rendered. */
export class MissingAlternateLocaleError extends Error {
  constructor(params: { code: string }) {
    super(`i18n: locale "${params.code}" has no alternate locale with a dictionary; the language switcher needs at least two`);
    this.name = 'MissingAlternateLocaleError';
  }
}
