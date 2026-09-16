import { AppError } from '#server/shared/errors/app-error';

/** One field-level validation problem, as reported to logs. */
export type ContactValidationIssue = { path: string; message: string };

/** Thrown when the submitted payload does not match the contact message schema. */
export class ContactValidationError extends AppError {
  readonly code = 'contact_validation_failed';
  readonly httpStatus = 400;

  constructor(params: { issues: readonly ContactValidationIssue[] }) {
    super({
      message: params.issues[0]?.message ?? 'Le formulaire contient des erreurs.',
      context: { issues: params.issues },
    });
  }
}
