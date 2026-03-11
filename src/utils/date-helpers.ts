// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Date formatting utilities
 */

/**
 * Format a timestamp into a human-readable relative time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted string like "Just now", "2h ago", "3d ago", or date string
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    return "Just now";
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
