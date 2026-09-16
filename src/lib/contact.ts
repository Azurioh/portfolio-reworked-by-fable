import * as z from 'zod/mini';
import { contactMessageSchema, type ContactMessage } from '#shared/contact/contact-message.schema';

const FALLBACK_MAILTO = 'alancunin@gmail.com';
const DEFAULT_ENDPOINT = '/api/contact';
const SUBMIT_TIMEOUT_MS = 12_000;

type FieldName = Exclude<keyof ContactMessage, 'website'>;

const FIELDS: readonly FieldName[] = ['name', 'email', 'subject', 'message'];

class ContactDeliveryError extends Error {
  readonly httpStatus: number | null;

  constructor(params: { message: string; httpStatus: number | null; cause?: unknown }) {
    super(params.message, { cause: params.cause });
    this.name = 'ContactDeliveryError';
    this.httpStatus = params.httpStatus;
  }
}

/** Same-origin `/api/contact` unless `VITE_CONTACT_ENDPOINT` overrides it with an absolute URL. */
const readEndpoint = (): string => {
  const raw: unknown = import.meta.env.VITE_CONTACT_ENDPOINT;
  const parsed = z.safeParse(z.url(), raw);
  return parsed.success ? parsed.data : DEFAULT_ENDPOINT;
};

const buildMailto = (data: ContactMessage): string => {
  const body = `${data.message}\n\n— ${data.name} · ${data.email}`;
  return `mailto:${FALLBACK_MAILTO}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(body)}`;
};

const deliver = async (params: { endpoint: string; data: ContactMessage }): Promise<void> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
  try {
    const res = await fetch(params.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params.data),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ContactDeliveryError({ message: `Form endpoint responded with ${res.status}`, httpStatus: res.status });
    }
  } catch (error) {
    if (error instanceof ContactDeliveryError) {
      throw error;
    }
    throw new ContactDeliveryError({ message: 'Form endpoint unreachable', httpStatus: null, cause: error });
  } finally {
    window.clearTimeout(timer);
  }
};

/**
 * Wires the contact form: Zod validation with inline errors, honeypot,
 * POST to the contact API, and a prefilled mailto fallback when delivery fails.
 */
export function setupContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contact]');
  if (!form) {
    return;
  }
  const status = form.querySelector<HTMLElement>('[data-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!status || !submit) {
    return;
  }
  const endpoint = readEndpoint();

  const fieldWrap = (name: FieldName): HTMLElement | null =>
    form.querySelector<HTMLElement>(`[name="${name}"]`)?.closest<HTMLElement>('.cform__field') ?? null;

  const setError = (params: { name: FieldName; message: string | null }): void => {
    const wrap = fieldWrap(params.name);
    const out = form.querySelector<HTMLElement>(`[data-error-for="${params.name}"]`);
    const input = form.querySelector<HTMLElement>(`[name="${params.name}"]`);
    if (!wrap || !out || !input) {
      return;
    }
    wrap.classList.toggle('is-invalid', params.message !== null);
    out.textContent = params.message ?? '';
    input.setAttribute('aria-invalid', String(params.message !== null));
  };

  const setStatus = (params: { text: string; tone: 'ok' | 'err' | 'neutral' }): void => {
    status.textContent = params.text;
    status.classList.toggle('is-ok', params.tone === 'ok');
    status.classList.toggle('is-err', params.tone === 'err');
  };

  const readForm = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, value] of new FormData(form).entries()) {
      out[key] = typeof value === 'string' ? value : '';
    }
    return out;
  };

  const validate = (): ContactMessage | null => {
    const result = z.safeParse(contactMessageSchema, readForm());
    for (const name of FIELDS) {
      setError({ name, message: null });
    }
    if (result.success) {
      return result.data;
    }
    let firstInvalid: FieldName | null = null;
    for (const issue of result.error.issues) {
      const name = issue.path[0];
      if (typeof name === 'string' && FIELDS.includes(name as FieldName)) {
        setError({ name: name as FieldName, message: issue.message });
        firstInvalid ??= name as FieldName;
      }
    }
    if (firstInvalid) {
      form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
    }
    return null;
  };

  for (const name of FIELDS) {
    const input = form.querySelector<HTMLElement>(`[name="${name}"]`);
    input?.addEventListener('blur', () => {
      const wrap = fieldWrap(name);
      if (wrap?.classList.contains('is-invalid')) {
        validate();
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = validate();
    if (!data) {
      return;
    }
    if (data.website.trim() !== '') {
      setStatus({ text: 'Message envoyé.', tone: 'ok' });
      form.reset();
      return;
    }

    form.classList.add('is-busy');
    submit.disabled = true;
    setStatus({ text: 'Envoi en cours…', tone: 'neutral' });
    try {
      await deliver({ endpoint, data });
      form.reset();
      setStatus({ text: 'Message envoyé. Je vous réponds vite.', tone: 'ok' });
    } catch {
      window.location.href = buildMailto(data);
      setStatus({
        text: `Envoi impossible pour le moment : votre client mail s’ouvre avec le message prérempli. Sinon, écrivez à ${FALLBACK_MAILTO}.`,
        tone: 'err',
      });
    } finally {
      form.classList.remove('is-busy');
      submit.disabled = false;
    }
  });
}
