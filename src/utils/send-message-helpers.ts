/**
 * Shared helpers for send message handlers (streaming and standard)
 */
import type * as React from "react";

import type { BaseChatConversationActions } from "@/hooks/internals/_useBaseChatConversation";
import type { ChatConversation, ChatMessage } from "@/types/chat.types";

// =============================================================================
// Types
// =============================================================================

export interface ConversationSetupParams {
  conversationId: string;
  title: string;
  actions: BaseChatConversationActions;
  onConversationChange?: (id: string | null) => void;
}

// =============================================================================
// Conversation Setup
// =============================================================================

/**
 * Handle setting up a new conversation after getting a response.
 * Shared by both streaming and standard hooks.
 */
export const setupNewConversation = (
  newConversationId: string,
  title: string,
  actions: BaseChatConversationActions,
  onConversationChange?: (id: string | null) => void,
): void => {
  const newConv: ChatConversation = {
    id: newConversationId,
    object: "conversation",
    created_at: Math.floor(Date.now() / 1000),
    metadata: { title },
  };

  actions.upsertConversation(newConv);
  actions.setActiveConversation(newConv);
  onConversationChange?.(newConversationId);
};

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Handle abort error - remove optimistic messages.
 * Returns true if it was an abort error (handled), false otherwise.
 */
export const handleAbortError = (
  error: unknown,
  userMessageId: string,
  streamingMessageId: string | undefined,
  actions: BaseChatConversationActions,
  isIntentionalAbort: React.MutableRefObject<boolean>,
): boolean => {
  if ((error as Error).name === "AbortError") {
    const idsToRemove = streamingMessageId ? [userMessageId, streamingMessageId] : [userMessageId];

    actions.setMessages((prev: ChatMessage[]) => prev.filter((m) => !idsToRemove.includes(m.id)));

    if (!isIntentionalAbort.current) {
      console.log("[Send] Request cancelled - nothing persisted");
    }
    return true;
  }
  return false;
};

/**
 * Handle generic error - log and optionally update message status.
 */
export const handleSendError = (
  error: unknown,
  userMessageId: string,
  actions: BaseChatConversationActions,
  options?: { streamingMessageId?: string; showErrorInMessage?: boolean },
): void => {
  console.error("[Send] Error:", error);

  // Remove user message (nothing persisted)
  actions.setMessages((prev: ChatMessage[]) =>
    prev.filter((m) => m.id !== userMessageId && m.id !== options?.streamingMessageId),
  );

  // Optionally show error in streaming message
  if (options?.showErrorInMessage && options.streamingMessageId) {
    actions.updateMessage(options.streamingMessageId, {
      content: [{ type: "text", text: error instanceof Error ? error.message : "An error occurred" }],
      status: "incomplete",
    });
  }
};
