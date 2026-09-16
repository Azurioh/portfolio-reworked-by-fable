import { AppError } from '#server/shared/errors/app-error';

/** Thrown when a client exceeded the number of contact messages allowed in the current window. */
export class RateLimitedError extends AppError {
  readonly code = 'contact_rate_limited';
  readonly httpStatus = 429;

  constructor(params: { key: string }) {
    super({
      message: 'Trop de messages envoyés récemment. Réessayez dans une heure.',
      context: { key: params.key },
    });
  }
}
