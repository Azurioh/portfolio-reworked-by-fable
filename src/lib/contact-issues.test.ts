import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { contactMessageSchema } from '#shared/contact/contact-message.schema';
import { describeContactIssue } from './contact-issues';

const issuesOf = (payload: Record<string, string>): readonly z.core.$ZodIssue[] => {
  const result = z.safeParse(contactMessageSchema, payload);
  return result.success ? [] : result.error.issues;
};

describe('describeContactIssue', () => {
  it('maps a too-short field to its localized key with its minimum', () => {
    const [issue] = issuesOf({ name: '', email: 'a@b.co', subject: 'Hello', message: 'x'.repeat(20), website: '' });

    expect(describeContactIssue(issue)).toEqual({ field: 'name', key: 'contact.error.name.tooShort', vars: { min: '2' } });
  });

  it('exposes the bound of a length issue as an interpolation variable', () => {
    const [issue] = issuesOf({ name: 'x'.repeat(81), email: 'a@b.co', subject: 'Hello', message: 'x'.repeat(20), website: '' });
    const [short] = issuesOf({ name: 'Al', email: 'a@b.co', subject: 'Hello', message: 'short', website: '' });

    expect(describeContactIssue(issue)).toEqual({ field: 'name', key: 'contact.error.name.tooLong', vars: { max: '80' } });
    expect(describeContactIssue(short)).toEqual({
      field: 'message',
      key: 'contact.error.message.tooShort',
      vars: { min: '20' },
    });
  });

  it('maps an invalid email to its dedicated key', () => {
    const [issue] = issuesOf({ name: 'Al', email: 'nope', subject: 'Hello', message: 'x'.repeat(20), website: '' });

    expect(describeContactIssue(issue)).toEqual({ field: 'email', key: 'contact.error.email.invalid', vars: {} });
  });

  it('falls back to the generic key for an unexpected code on a known field', () => {
    const [issue] = issuesOf({ name: 'Al', subject: 'Hello', message: 'x'.repeat(20), website: '' });

    expect(issue.code).toBe('invalid_type');
    expect(describeContactIssue(issue)).toEqual({ field: 'email', key: 'contact.error.invalid', vars: {} });
  });

  it('ignores issues outside the visible fields', () => {
    const [issue] = issuesOf({ name: 'Al', email: 'a@b.co', subject: 'Hello', message: 'x'.repeat(20) });

    expect(issue.path).toEqual(['website']);
    expect(describeContactIssue(issue)).toBeNull();
  });
});
