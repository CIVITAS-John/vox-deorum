/**
 * Utility function for exponential retry logic
 */

import { Logger } from "winston";

/**
 * Executes an async function with exponential backoff retry logic
 * @param fn - The async function to execute
 * @param logger - Winston logger instance for logging retry attempts
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 30000)
 * @param backoffFactor - Exponential backoff multiplier (default: 2)
 * @returns The result of the successful function execution
 * @throws The last error if all retries are exhausted
 */
export async function exponentialRetry<T>(
  fn: () => Promise<T>,
  logger: Logger,
  maxRetries: number = 3,
  initialDelay: number = 100,
  maxDelay: number = 10000,
  backoffFactor: number = 1.5
): Promise<T> {
  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Log retry attempt
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after error: ${lastError.message}`, {
        attempt: attempt + 1,
        maxRetries,
        error: lastError.message
      });

      // Calculate next delay with exponential backoff
      const currentDelay = Math.min(delay, maxDelay);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * currentDelay;
      const totalDelay = currentDelay + jitter;

      await new Promise(resolve => setTimeout(resolve, totalDelay));

      // Increase delay for next attempt
      delay *= backoffFactor;
    }
  }

  throw lastError!;
}