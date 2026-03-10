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
 * Extract error details from OpenAI/Azure AI SDK errors and return appropriate HTTP status + error response.
 * Falls back to 500 "server_error" for unknown errors.
 */
export const extractApiError = (error: unknown): { status: number; body: ApiErrorResponse } => {
  if (error instanceof Error) {
    const err = error as Error & { status?: number; code?: string; type?: string };

    // OpenAI SDK errors include a status property
    if (err.status && err.status >= 400 && err.status < 600) {
      return {
        status: err.status,
        body: createApiError(
          err.code || "api_error",
          err.status >= 500 ? "Internal server error" : err.message,
          err.type || "api_error"
        ),
      };
    }
  }

  return {
    status: 500,
    body: createApiError("server_error", "Internal server error"),
  };
};

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
