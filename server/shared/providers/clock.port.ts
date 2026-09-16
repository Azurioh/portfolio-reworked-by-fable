/** Source of the current time, injected so use cases never call `new Date()` themselves. */
export interface Clock {
  now(): Date;
}
