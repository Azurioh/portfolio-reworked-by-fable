import { AppError } from '#server/shared/errors/app-error';

/** Thrown when the downstream notifier rejected the message or could not be reached. */
export class NotifierUnavailableError extends AppError {
  readonly code = 'contact_notifier_unavailable';
  readonly httpStatus = 502;

  constructor(params: { status: number | null; cause?: unknown }) {
    super({
      message: 'Le message n’a pas pu être transmis. Réessayez dans quelques minutes.',
      context: { status: params.status },
      cause: params.cause,
    });
  }
}
