import type { Clock } from './clock.port.js';

/** `Clock` adapter backed by the system time. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
