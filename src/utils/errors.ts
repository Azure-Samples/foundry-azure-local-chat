// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Error handling utilities
 */

const ABORT_ERROR_NAME = "AbortError";

/**
 * Type guard to check if an error is an AbortError from a cancelled fetch request
 */
export function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === ABORT_ERROR_NAME;
}
