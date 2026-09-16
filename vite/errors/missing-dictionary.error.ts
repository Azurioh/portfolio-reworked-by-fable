/** Thrown when the dictionary of the default locale is absent, so no page could be rendered. */
export class MissingDictionaryError extends Error {
  constructor(params: { code: string; path: string }) {
    super(`i18n: missing dictionary for the default locale "${params.code}" at ${params.path}`);
    this.name = 'MissingDictionaryError';
  }
}
