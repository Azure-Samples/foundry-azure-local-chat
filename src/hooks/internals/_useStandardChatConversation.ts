// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as React from "react";

import type { ChatApi } from "@/types/chat.types";

import { handleAbortError, setupNewConversation } from "./_send-message-helpers";
import type { ChatConversationOptions, ChatConversationReturn, SendMessageHandler } from "./_types";
import { useBaseChatConversation } from "./_useBaseChatConversation";

// =============================================================================
// Hook
// =============================================================================

/**
 * Standard (non-streaming) chat conversation hook.
 * Uses atomic pattern: single call handles message send + response.
 * No polling needed - server handles everything atomically.
 */
export const useStandardChatConversation = (options: ChatConversationOptions<ChatApi>): ChatConversationReturn => {
  const { api } = options;
  const { sendMessage } = api;

  // ==========================================================================
  // Handlers for base hook
  // ==========================================================================

  /**
   * ATOMIC PATTERN:
   * - Single sendMessage call handles conversation creation + message + response
   * - No separate createConversation step needed
   * - Server creates conversation atomically if conversationId is not provided
   * - On failure, nothing is persisted (no orphan messages)
   */
  const sendMessageHandler = React.useCallback<SendMessageHandler>(
    async (_text, { conversationId, title, userMessage, dispatch, addMessage, onConversationChange }) => {
      if (!sendMessage) {
        throw new Error("sendMessage not provided");
      }

      const isNew = !conversationId;

      try {
        const result = await sendMessage({ message: _text, conversationId: conversationId || undefined, title });

        if (isNew && result.conversationId) {
          setupNewConversation(result.conversationId, title, dispatch, onConversationChange);
        }

        const textContent = result.message.content.find((c) => c.type === "text" || c.type === "output_text");
        if (textContent?.text) {
          dispatch({ type: "UPDATE_MESSAGE", payload: { id: userMessage.id, updates: { status: "completed" } } });
          addMessage("assistant", textContent.text);
        }
      } catch (error) {
        if (handleAbortError(error, userMessage.id, undefined, dispatch)) {
          return;
        }
        // On error, remove local user message (nothing persisted on server)
        dispatch({ type: "REMOVE_MESSAGES", payload: [userMessage.id] });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [sendMessage],
  );

  // ==========================================================================
  // Use base hook with handlers
  // ==========================================================================

  return useBaseChatConversation({ ...options, sendMessageHandler });
};
