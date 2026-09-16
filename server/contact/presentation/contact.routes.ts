import { Hono } from 'hono';
import type { SendContactMessageUseCase } from '#server/contact/application/send-contact-message.use-case';
import { AppError } from '#server/shared/errors/app-error';
import { resolveClientIp } from './client-ip.js';

const JSON_MEDIA_TYPE = 'application/json';

type ErrorBody = { ok: false; code: string; message: string };

const errorBody = (params: { code: string; message: string }): ErrorBody => ({
  ok: false,
  code: params.code,
  message: params.message,
});

const isJsonRequest = (contentType: string | undefined): boolean =>
  contentType?.split(';')[0]?.trim().toLowerCase() === JSON_MEDIA_TYPE;

/**
 * Builds the `POST /` contact route. Mount it under `/api/contact`.
 * Expected errors (`AppError`) become `{ ok: false, code, message }` with their status;
 * anything else is logged and answered with a generic 500.
 */
export const createContactRoutes = (params: { sendContactMessage: SendContactMessageUseCase }): Hono => {
  const routes = new Hono();

  routes.post('/', async (c) => {
    if (!isJsonRequest(c.req.header('content-type'))) {
      return c.json(
        errorBody({ code: 'unsupported_media_type', message: 'Le corps de la requête doit être du JSON.' }),
        415,
      );
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errorBody({ code: 'invalid_json', message: 'Le corps de la requête est illisible.' }), 400);
    }
    const ip = resolveClientIp({ forwardedFor: c.req.header('x-forwarded-for'), realIp: c.req.header('x-real-ip') });
    await params.sendContactMessage.execute({ body, ip });
    return c.json({ ok: true }, 200);
  });

  routes.onError((error, c) => {
    if (error instanceof AppError) {
      console.warn(`[contact] ${error.code}`, error.context);
      return c.json(errorBody({ code: error.code, message: error.message }), error.httpStatus);
    }
    console.error('[contact] unexpected error', error);
    return c.json(errorBody({ code: 'internal_error', message: 'Une erreur interne est survenue.' }), 500);
  });

  return routes;
};
