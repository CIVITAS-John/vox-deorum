/**
 * @module utils/retry
 *
 * Utility function for exponential retry logic with jitter.
 * Implements retry strategies to handle transient failures in async operations.
 */

import { Logger } from "winston";

/**
 * Executes an async function with exponential backoff retry logic
 * @param fn - The async function to execute, receives a progress callback to prevent timeout
 * @param logger - Winston logger instance for logging retry attempts
 * @param maxRetries - Maximum number of retry attempts (default: 20)
 * @param initialDelay - Initial delay in milliseconds (default: 2000)
 * @param maxDelay - Maximum delay in milliseconds (default: 15000)
 * @param backoffFactor - Exponential backoff multiplier (default: 1.5)
 * @param executionTimeout - Maximum time to wait after each progress update (default: 2 minutes)
 * @returns The result of the successful function execution
 * @throws The last error if all retries are exhausted
 */
export async function exponentialRetry<T>(
  fn: (updateProgress: (completed?: boolean) => void) => Promise<T>,
  logger: Logger,
  maxRetries: number = 100,
  initialDelay: number = 3000,
  maxDelay: number = 60000,
  backoffFactor: number = 1.5,
  executionTimeout: number = 180000 // 3 minutes
): Promise<T> {
  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Timeout support
      let timeoutHandle: NodeJS.Timeout | null = null;
      let isTimedOut = false;
      let timeoutReject: (reason: Error) => void;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutReject = reject;
      });

      const resetTimeout = (completed?: boolean, initial?: boolean) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (!isTimedOut && completed !== true) {
          timeoutHandle = setTimeout(() => {
            isTimedOut = true;
            timeoutReject(new Error(`Function execution timed out after ${executionTimeout}ms (${executionTimeout / 60000} minutes) of inactivity`));
          }, executionTimeout * (initial === true ? 1 : 2)); // Shorter timeout on initial call
        }
      };
      
      // Start initial timeout
      resetTimeout(false, true);

      // Race between the function execution and timeout
      const result = await Promise.race([
        fn(resetTimeout),
        timeoutPromise
      ]);

      // Clear the timeout if execution completed successfully
      if (timeoutHandle) clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      lastError = error as Error;

      // Check if error is explicitly marked as non-retryable
      const isNonRetryable = error && typeof error === 'object' && 'isRetryable' in error && error.isRetryable === false;

      if (attempt === maxRetries) {
        logger.warn(`Non-retryable error`, lastError);
        throw lastError;
      }

      if (attempt === maxRetries || isNonRetryable) {
        throw lastError;
      }

      // Calculate next delay with exponential backoff
      const currentDelay = Math.min(delay, maxDelay);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * currentDelay;
      const totalDelay = currentDelay + jitter;

      // Log retry attempt
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after error, delaying ${Math.round(totalDelay)}ms`, lastError);
      await new Promise(resolve => setTimeout(resolve, totalDelay));

      // Increase delay for next attempt
      delay *= backoffFactor;
    }
  }

  throw lastError!;
}