import * as z from 'zod/mini';
import { InvalidServerEnvError } from '#server/shared/errors/invalid-server-env.error';

const DEFAULT_PORT = 8787;
const DEFAULT_STATIC_DIR = 'dist';
const MIN_PORT = 1;
const MAX_PORT = 65535;

const serverEnvSchema = z.object({
  DISCORD_WEBHOOK_URL: z.url('DISCORD_WEBHOOK_URL must be a valid URL (Discord → Server settings → Integrations → Webhooks).'),
  PORT: z._default(z.coerce.number().check(z.gte(MIN_PORT), z.lte(MAX_PORT)), DEFAULT_PORT),
  STATIC_DIR: z._default(z.string().check(z.minLength(1)), DEFAULT_STATIC_DIR),
});

/** Validated server configuration. */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Parses `process.env` once. This is the only module allowed to read it;
 * throws `InvalidServerEnvError` with every problem listed when the environment is incomplete.
 */
export const loadServerEnv = (): ServerEnv => {
  const parsed = z.safeParse(serverEnvSchema, process.env);
  if (!parsed.success) {
    throw new InvalidServerEnvError({ details: z.prettifyError(parsed.error) });
  }
  return parsed.data;
};
