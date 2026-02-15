/**
 * API Error utilities
 */

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    type: string;
  };
}

export const createApiError = (code: string, message: string, type: string = "server_error"): ApiErrorResponse => ({
  error: { code, message, type },
});

/**
 * Check if error is due to client aborting the request
 * This is expected behavior, not an error to log
 */
export const isAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === "AbortError" ||
    error.name === "APIUserAbortError" ||
    error.message?.includes("aborted") ||
    error.message?.includes("ECONNRESET")
  );
};
