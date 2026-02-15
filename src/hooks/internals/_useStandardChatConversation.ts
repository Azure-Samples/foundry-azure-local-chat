import * as React from "react";

import type {
  ChatApi,
  ChatMessage,
  UseChatConversationOptions,
  UseChatConversationReturn,
} from "@/types/chat.types";
import { handleAbortError, setupNewConversation } from "@/utils/send-message-helpers";

import {
  buildHookReturn,
  type SendMessageHandler,
  useBaseChatConversation,
} from "./_useBaseChatConversation";

// =============================================================================
// Hook
// =============================================================================

/**
 * Standard (non-streaming) chat conversation hook.
 * Uses atomic pattern: single call handles message send + response.
 * No polling needed - server handles everything atomically.
 */
export const useStandardChatConversation = (options: UseChatConversationOptions): UseChatConversationReturn => {
  const { api } = options;
  // Cast to ChatApi to access sendMessage method
  const chatApi = api as ChatApi;
  const { sendMessage } = chatApi || {};

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
    async (_text, { conversationId, title, userMessage, actions, isIntentionalAbort, onConversationChange }) => {
      if (!sendMessage) {
        throw new Error("sendMessage not provided");
      }

      const isNew = !conversationId;
      api?.setConversationId(conversationId || null);

      try {
        // ATOMIC: Single call handles everything
        const assistantMessage = await sendMessage(_text);

        // Get the new conversation ID from the API
        const newConversationId = api?.getConversationId();

        // If new conversation, update state
        if (isNew && newConversationId) {
          setupNewConversation(newConversationId, title, actions, onConversationChange);
        }

        // Update messages with the actual response
        const textContent = assistantMessage.content.find((c) => c.type === "text" || c.type === "output_text");
        if (textContent?.text) {
          actions.updateMessage(userMessage.id, { status: "completed" });
          actions.addMessage("assistant", textContent.text);
        }
      } catch (error) {
        if (handleAbortError(error, userMessage.id, undefined, actions, isIntentionalAbort)) {
          return;
        }
        // On error, remove local user message (nothing persisted on server)
        actions.setMessages((prev: ChatMessage[]) => prev.filter((m) => m.id !== userMessage.id));
      } finally {
        actions.setIsLoading(false);
      }
    },
    [sendMessage, api],
  );

  // ==========================================================================
  // Use base hook with handlers
  // ==========================================================================

  const { state, actions } = useBaseChatConversation({
    ...options,
    sendMessageHandler,
  });

  return buildHookReturn(state, actions);
};
