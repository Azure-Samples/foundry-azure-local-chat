// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Shared helpers for send message handlers (streaming and standard)
 */
import type { ChatConversation } from "@/types/chat.types";
import { isAbortError } from "@/utils/errors";

import type { ChatAction } from "./_reducer";

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
  dispatch: React.Dispatch<ChatAction>,
  onConversationChange: (id: string | null) => void,
): void => {
  const newConv: ChatConversation = {
    id: newConversationId,
    object: "conversation",
    created_at: Math.floor(Date.now() / 1000),
    metadata: { title },
  };

  dispatch({ type: "UPSERT_CONVERSATION", payload: newConv });
  dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: newConv });
  onConversationChange(newConversationId);
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
  dispatch: React.Dispatch<ChatAction>,
): boolean => {
  if (isAbortError(error)) {
    const idsToRemove = streamingMessageId ? [userMessageId, streamingMessageId] : [userMessageId];

    dispatch({ type: "REMOVE_MESSAGES", payload: idsToRemove });
    return true;
  }
  return false;
};
