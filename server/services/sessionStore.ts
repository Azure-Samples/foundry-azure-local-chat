// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Session Store - Track conversations per session
 *
 * In-memory store for mapping sessions to their conversation IDs.
 * This allows us to filter conversations by session when listing.
 */

// In-memory store: sessionId -> Set of conversation IDs
const sessionConversations = new Map<string, Set<string>>();

/**
 * Track a conversation for a session
 */
export const trackConversation = (sessionId: string, conversationId: string): void => {
  if (!sessionConversations.has(sessionId)) {
    sessionConversations.set(sessionId, new Set());
  }
  sessionConversations.get(sessionId)!.add(conversationId);
};

/**
 * Get all conversation IDs for a session
 */
export const getSessionConversations = (sessionId: string): Set<string> => {
  return sessionConversations.get(sessionId) || new Set();
};

/**
 * Remove a conversation from a session's tracking
 */
export const untrackConversation = (sessionId: string, conversationId: string): void => {
  sessionConversations.get(sessionId)?.delete(conversationId);
};

/**
 * Clear all conversations for a session
 */
export const clearSession = (sessionId: string): void => {
  sessionConversations.delete(sessionId);
};
