/** Thrown at boot when the process environment does not satisfy the server schema. */
export class InvalidServerEnvError extends Error {
  constructor(params: { details: string }) {
    super(`Invalid server environment:\n${params.details}`);
    this.name = 'InvalidServerEnvError';
  }
}
