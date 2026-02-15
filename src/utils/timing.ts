/**
 * Timing utilities -
 * - Request tracker for managing async operations with cancellation support
 * - Ensures only the latest request's result is processed
 */

/**
 * Creates a cancellable async operation tracker with AbortController support
 * Ensures only the latest request's result is used, cancelling any pending fetches
 */
export function createRequestTracker() {
  let currentRequestId = 0;
  let currentAbortController: AbortController | null = null;

  return {
    /** Start a new request, cancels previous, returns { id, signal } */
    start: () => {
      // Abort any pending request
      if (currentAbortController) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();
      return {
        id: ++currentRequestId,
        signal: currentAbortController.signal,
      };
    },
    /** Check if a request ID is still the current one */
    isCurrent: (id: number) => id === currentRequestId,
    /** Cancel all pending requests */
    cancel: () => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      currentRequestId++;
    },
    /** Get current abort signal (if any) */
    getSignal: () => currentAbortController?.signal,
  };
}
