/** Thrown by the font build when a source file, subset or metric cannot be produced as expected. */
export class FontBuildError extends Error {
  constructor(params: { message: string }) {
    super(`fonts: ${params.message}`);
    this.name = 'FontBuildError';
  }
}
