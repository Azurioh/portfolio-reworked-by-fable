/** HTTP statuses an application error may map to. Kept as literals so the transport can type its response. */
export type AppErrorHttpStatus = 400 | 429 | 502;

/**
 * Base class for every expected, typed error raised by the application layer.
 * The transport maps it to an HTTP response using `code`, `httpStatus` and `message`;
 * `context` is for logs only and is never sent to the client.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: AppErrorHttpStatus;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(params: { message: string; context?: Record<string, unknown>; cause?: unknown }) {
    super(params.message, { cause: params.cause });
    this.name = new.target.name;
    this.context = params.context ?? {};
  }
}
