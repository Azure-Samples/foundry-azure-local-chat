// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * ID generation utilities
 */

/**
 * Generate a unique ID with the given prefix.
 * Format: `{prefix}-{timestamp}-{random}`
 *
 * @example generateId("msg") => "msg-1708764000000-k3m9x2a"
 */
export const generateId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
