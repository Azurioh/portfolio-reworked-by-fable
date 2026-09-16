/** Thrown while rendering an HTML template when a placeholder cannot be resolved. */
export class I18nTemplateError extends Error {
  constructor(params: { message: string }) {
    super(`i18n: ${params.message}`);
    this.name = 'I18nTemplateError';
  }
}
