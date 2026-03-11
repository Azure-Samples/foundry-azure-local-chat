// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Helper functions for creating and manipulating ChatConversation objects
 */
import type { ChatConversation } from "@/types/chat.types";

/**
 * Create a new conversation object
 */
export const createConversation = (id: string, title: string = "New Chat", created_at?: number): ChatConversation => ({
  id,
  object: "conversation",
  created_at: created_at || Math.floor(Date.now() / 1000),
  metadata: { title },
});

/**
 * Get the title from a conversation (with fallback)
 */
export const getConversationTitle = (conversation: ChatConversation): string => {
  return conversation.metadata.title || "Untitled Conversation";
};

/**
 * Update conversation title
 */
export const updateConversationTitle = (conversation: ChatConversation, newTitle: string): ChatConversation => ({
  ...conversation,
  metadata: {
    ...conversation.metadata,
    title: newTitle,
  },
});

/**
 * Generate title from message text (first 50 chars)
 */
export const generateTitle = (text: string): string => text.substring(0, 50) + (text.length > 50 ? "..." : "");
