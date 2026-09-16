import type * as z from 'zod/mini';
import type { ContactMessage } from '#shared/contact/contact-message.schema';
import type { RuntimeKey } from './i18n';

/** Form fields that render an inline error; the honeypot is excluded. */
export type ContactField = Exclude<keyof ContactMessage, 'website'>;

/** The visible fields, in form order; drives error reset and blur re-validation. */
export const CONTACT_FIELDS: readonly ContactField[] = ['name', 'email', 'subject', 'message'];

/** A validation issue resolved to the field it belongs to and the runtime key describing it. */
export interface ContactIssueDescription {
  readonly field: ContactField;
  readonly key: RuntimeKey;
  readonly vars: Readonly<Record<string, string>>;
}

const FALLBACK_KEY: RuntimeKey = 'contact.error.invalid';

const ISSUE_KEYS: Record<ContactField, Partial<Record<z.core.$ZodIssueCode, RuntimeKey>>> = {
  name: { too_small: 'contact.error.name.tooShort', too_big: 'contact.error.name.tooLong' },
  email: { invalid_format: 'contact.error.email.invalid' },
  subject: { too_small: 'contact.error.subject.tooShort', too_big: 'contact.error.subject.tooLong' },
  message: { too_small: 'contact.error.message.tooShort', too_big: 'contact.error.message.tooLong' },
};

const isContactField = (value: unknown): value is ContactField =>
  CONTACT_FIELDS.some((field) => field === value);

const boundsOf = (issue: z.core.$ZodIssue): Readonly<Record<string, string>> => {
  if (issue.code === 'too_small') {
    return { min: String(issue.minimum) };
  }
  if (issue.code === 'too_big') {
    return { max: String(issue.maximum) };
  }
  return {};
};

/**
 * Resolves a locale-neutral schema issue to the field and runtime key the browser
 * should display. Length bounds are exposed as `{min}` / `{max}` variables.
 * @param issue - One issue of the shared contact schema.
 * @returns The description, or `null` for issues outside the visible fields.
 */
export const describeContactIssue = (issue: z.core.$ZodIssue): ContactIssueDescription | null => {
  const field = issue.path[0];
  if (!isContactField(field)) {
    return null;
  }
  return { field, key: ISSUE_KEYS[field][issue.code] ?? FALLBACK_KEY, vars: boundsOf(issue) };
};
