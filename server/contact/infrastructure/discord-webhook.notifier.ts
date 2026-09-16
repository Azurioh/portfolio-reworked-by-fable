import type { ContactNotifier } from '#server/contact/application/notifier.port';
import type { ReceivedContactMessage } from '#server/contact/domain/contact-message';
import { NotifierUnavailableError } from '#server/contact/domain/errors/notifier-unavailable.error';

const REQUEST_TIMEOUT_MS = 8_000;
const EMBED_DESCRIPTION_MAX_LENGTH = 4096;
const EMBED_COLOR = 0x8b7cff;
const UNKNOWN_IP_LABEL = 'inconnue';
const ELLIPSIS = '…';
const MENTION_EVERYONE = '@everyone';
const MENTION_CONTENT = `${MENTION_EVERYONE} nouveau message depuis le portfolio`;

const truncate = (params: { text: string; max: number }): string => {
  if (params.text.length <= params.max) {
    return params.text;
  }
  return `${params.text.slice(0, params.max - ELLIPSIS.length)}${ELLIPSIS}`;
};

/** `ContactNotifier` adapter posting one embed per message to a Discord webhook. */
export class DiscordWebhookNotifier implements ContactNotifier {
  private readonly webhookUrl: string;

  constructor(params: { webhookUrl: string }) {
    this.webhookUrl = params.webhookUrl;
  }

  async notify(message: ReceivedContactMessage): Promise<void> {
    const payload = {
      content: MENTION_CONTENT,
      allowed_mentions: { parse: ['everyone'] },
      embeds: [
        {
          title: message.subject,
          description: truncate({ text: message.message, max: EMBED_DESCRIPTION_MAX_LENGTH }),
          color: EMBED_COLOR,
          timestamp: message.receivedAt.toISOString(),
          fields: [
            { name: 'Name', value: message.name, inline: true },
            { name: 'Email', value: message.email, inline: true },
            { name: 'IP', value: message.ip ?? UNKNOWN_IP_LABEL, inline: true },
          ],
        },
      ],
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new NotifierUnavailableError({ status: response.status });
      }
    } catch (error) {
      if (error instanceof NotifierUnavailableError) {
        throw error;
      }
      throw new NotifierUnavailableError({ status: null, cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}
