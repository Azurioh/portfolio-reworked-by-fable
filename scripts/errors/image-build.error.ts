/** Thrown by the image build when a source file cannot be found or produced as expected. */
export class ImageBuildError extends Error {
  constructor(params: { message: string }) {
    super(`images: ${params.message}`);
    this.name = 'ImageBuildError';
  }
}
