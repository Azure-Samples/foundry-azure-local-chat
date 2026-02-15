/**
 * Constants and utilities for error handling
 */

/**
 * Name of the AbortError thrown by fetch when a request is cancelled
 */
export const Abort_ErrorName = "AbortError";

/**
 * Type guard to check if an error is an AbortError from a cancelled fetch request
 */
export function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === Abort_ErrorName;
}
