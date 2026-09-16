import * as z from 'zod/mini';
import { contactMessageSchema } from '#shared/contact/contact-message.schema';
import type { Clock } from '#server/shared/providers/clock.port';
import { ContactValidationError, type ContactValidationIssue } from '#server/contact/domain/errors/contact-validation.error';
import { RateLimitedError } from '#server/contact/domain/errors/rate-limited.error';
import type { ContactNotifier } from './notifier.port.js';
import type { RateLimiter } from './rate-limiter.port.js';

const UNKNOWN_CLIENT_KEY = 'unknown';

/**
 * Validates an incoming contact payload, silently drops honeypot hits,
 * enforces the per-client quota and forwards the message to the notifier.
 */
export class SendContactMessageUseCase {
  private readonly notifier: ContactNotifier;
  private readonly rateLimiter: RateLimiter;
  private readonly clock: Clock;

  constructor(params: { notifier: ContactNotifier; rateLimiter: RateLimiter; clock: Clock }) {
    this.notifier = params.notifier;
    this.rateLimiter = params.rateLimiter;
    this.clock = params.clock;
  }

  /** Resolves once the message is delivered (or dropped as spam); throws a typed `AppError` otherwise. */
  async execute(params: { body: unknown; ip: string | null }): Promise<void> {
    const parsed = z.safeParse(contactMessageSchema, params.body);
    if (!parsed.success) {
      const issues: ContactValidationIssue[] = parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      }));
      throw new ContactValidationError({ issues });
    }
    const { website, ...message } = parsed.data;
    if (website.trim() !== '') {
      return;
    }
    const key = params.ip ?? UNKNOWN_CLIENT_KEY;
    if (!this.rateLimiter.consume(key)) {
      throw new RateLimitedError({ key });
    }
    await this.notifier.notify({ ...message, receivedAt: this.clock.now(), ip: params.ip });
  }
}
