import { SendContactMessageUseCase } from '#server/contact/application/send-contact-message.use-case';
import { DiscordWebhookNotifier } from '#server/contact/infrastructure/discord-webhook.notifier';
import { MemoryRateLimiter } from '#server/contact/infrastructure/memory-rate-limiter';
import type { Clock } from '#server/shared/providers/clock.port';

const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Wires the contact feature: Discord notifier, in-memory quota and the use case. */
export const buildContactModule = (params: { webhookUrl: string; clock: Clock }): { sendContactMessage: SendContactMessageUseCase } => {
  const sendContactMessage = new SendContactMessageUseCase({
    notifier: new DiscordWebhookNotifier({ webhookUrl: params.webhookUrl }),
    rateLimiter: new MemoryRateLimiter({ clock: params.clock, limit: RATE_LIMIT_MAX_REQUESTS, windowMs: RATE_LIMIT_WINDOW_MS }),
    clock: params.clock,
  });
  return { sendContactMessage };
};
