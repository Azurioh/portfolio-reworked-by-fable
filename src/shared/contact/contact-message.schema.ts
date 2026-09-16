import * as z from 'zod/mini';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const SUBJECT_MIN_LENGTH = 3;
const SUBJECT_MAX_LENGTH = 120;
const MESSAGE_MIN_LENGTH = 20;
const MESSAGE_MAX_LENGTH = 4000;

/**
 * Contact form payload, shared by the browser (inline validation) and the
 * server (boundary validation). `website` is a honeypot: humans leave it empty.
 * Issues carry no custom message: the browser maps `path` + `code` (and the
 * `minimum` / `maximum` bounds) to localized text, the server logs them as is.
 */
export const contactMessageSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(NAME_MIN_LENGTH), z.maxLength(NAME_MAX_LENGTH)),
  email: z.string().check(z.trim(), z.email()),
  subject: z.string().check(z.trim(), z.minLength(SUBJECT_MIN_LENGTH), z.maxLength(SUBJECT_MAX_LENGTH)),
  message: z.string().check(z.trim(), z.minLength(MESSAGE_MIN_LENGTH), z.maxLength(MESSAGE_MAX_LENGTH)),
  website: z.string(),
});

/** A validated contact form payload. */
export type ContactMessage = z.infer<typeof contactMessageSchema>;
