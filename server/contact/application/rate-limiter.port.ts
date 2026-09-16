/** Counts requests per key over a window; `consume` returns `false` once the quota is exhausted. */
export interface RateLimiter {
  consume(key: string): boolean;
}
