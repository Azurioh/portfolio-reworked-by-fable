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
 */
export const contactMessageSchema = z.object({
  name: z
    .string()
    .check(
      z.trim(),
      z.minLength(NAME_MIN_LENGTH, 'Indiquez votre nom.'),
      z.maxLength(NAME_MAX_LENGTH, `Le nom est trop long (${NAME_MAX_LENGTH} caractères maximum).`),
    ),
  email: z.string().check(z.trim(), z.email('Cette adresse ne semble pas valide.')),
  subject: z
    .string()
    .check(
      z.trim(),
      z.minLength(SUBJECT_MIN_LENGTH, 'Donnez un sujet.'),
      z.maxLength(SUBJECT_MAX_LENGTH, `Le sujet est trop long (${SUBJECT_MAX_LENGTH} caractères maximum).`),
    ),
  message: z
    .string()
    .check(
      z.trim(),
      z.minLength(MESSAGE_MIN_LENGTH, `Quelques mots de plus (${MESSAGE_MIN_LENGTH} caractères minimum).`),
      z.maxLength(MESSAGE_MAX_LENGTH, `Le message est trop long (${MESSAGE_MAX_LENGTH} caractères maximum).`),
    ),
  website: z.string(),
});

/** A validated contact form payload. */
export type ContactMessage = z.infer<typeof contactMessageSchema>;
