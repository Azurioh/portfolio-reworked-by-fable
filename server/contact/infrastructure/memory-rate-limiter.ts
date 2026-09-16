import type { RateLimiter } from '#server/contact/application/rate-limiter.port';
import type { Clock } from '#server/shared/providers/clock.port';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Sliding-window rate limiter kept in process memory. Suited to a single
 * instance; swap the port implementation for a shared store when scaling out.
 * Stale entries are swept periodically during `consume`, so no timer is needed
 * and the class stays runtime-agnostic.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly clock: Clock;
  private readonly limit: number;
  private readonly windowMs: number;
  private lastCleanupAt: number;

  constructor(params: { clock: Clock; limit: number; windowMs: number }) {
    this.clock = params.clock;
    this.limit = params.limit;
    this.windowMs = params.windowMs;
    this.lastCleanupAt = params.clock.now().getTime();
  }

  consume(key: string): boolean {
    const now = this.clock.now().getTime();
    this.cleanupIfDue(now);
    const recent = this.recentHits({ key, now });
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  private recentHits(params: { key: string; now: number }): number[] {
    const threshold = params.now - this.windowMs;
    return (this.hits.get(params.key) ?? []).filter((at) => at > threshold);
  }

  private cleanupIfDue(now: number): void {
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }
    this.lastCleanupAt = now;
    for (const key of [...this.hits.keys()]) {
      const recent = this.recentHits({ key, now });
      if (recent.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, recent);
      }
    }
  }
}
