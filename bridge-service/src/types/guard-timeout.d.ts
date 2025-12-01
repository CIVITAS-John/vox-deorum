/**
 * Type definitions for guard-timeout
 */

declare module 'guard-timeout' {
  interface GuardTimeoutOptions {
    /** Allowed lag in milliseconds before rescheduling (default: 1000) */
    lagMs?: number;
  }

  interface GuardTimeoutFunction {
    (callback: () => void, delay: number): NodeJS.Timeout;
    create(options: GuardTimeoutOptions): GuardTimeoutFunction;
  }

  const guardTimeout: GuardTimeoutFunction;
  export = guardTimeout;
}