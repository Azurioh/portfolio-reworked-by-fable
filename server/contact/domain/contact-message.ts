import type { ContactMessage } from '#shared/contact/contact-message.schema';

/** A contact message that passed validation and the honeypot, enriched with reception metadata. */
export type ReceivedContactMessage = Omit<ContactMessage, 'website'> & {
  receivedAt: Date;
  ip: string | null;
};
