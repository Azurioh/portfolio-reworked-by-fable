import type { ReceivedContactMessage } from '#server/contact/domain/contact-message';

/** Delivers a received contact message to its final destination (chat, mail, ticketing…). */
export interface ContactNotifier {
  notify(message: ReceivedContactMessage): Promise<void>;
}
