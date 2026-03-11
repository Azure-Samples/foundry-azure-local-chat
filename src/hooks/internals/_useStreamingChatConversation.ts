// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as React from "react";

import type { ChatMessage, StreamingChatApi } from "@/types/chat.types";
import { generateId } from "@/utils/id";

import { handleAbortError, setupNewConversation } from "./_send-message-helpers";
import type { ChatConversationOptions, ChatConversationReturn, SendMessageHandler } from "./_types";
import { useBaseChatConversation } from "./_useBaseChatConversation";

// =============================================================================
// Hook
// =============================================================================

/**
 * Streaming chat conversation hook.
 * Uses SSE for real-time response streaming.
 * With atomic pattern: if page refreshes mid-stream, nothing is persisted (clean slate).
 */
export const useStreamingChatConversation = (options: ChatConversationOptions<StreamingChatApi>): ChatConversationReturn => {
  const { api } = options;
  const { sendMessageStreaming } = api;

  // ==========================================================================
  // Handlers for base hook
  // ==========================================================================

  const sendMessageHandler = React.useCallback<SendMessageHandler>(
    async (text, { conversationId, title, userMessage, dispatch, onConversationChange }) => {
      if (!sendMessageStreaming) {
        throw new Error("Streaming not supported by this API");
      }

      // Create streaming message placeholder
      const streamingMessageId = generateId("assistant");
      const streamingMessage: ChatMessage = {
        id: streamingMessageId,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "" }],
        status: "in_progress",
      };
      dispatch({ type: "APPEND_MESSAGE", payload: streamingMessage });

      let accumulatedContent = "";
      let localConversationId = conversationId;

      try {
        await sendMessageStreaming(
          { message: text, conversationId: conversationId || undefined, title },
          {
            onStart: (data: { conversationId: string }) => {
              if (data.conversationId && data.conversationId !== localConversationId) {
                setupNewConversation(data.conversationId, title, dispatch, onConversationChange);
                localConversationId = data.conversationId;
              }
            },
            onChunk: (content: string) => {
              accumulatedContent += content;
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: { id: streamingMessageId, updates: { content: [{ type: "text", text: accumulatedContent }] } },
              });
            },
            onDone: async (response: string) => {
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  id: streamingMessageId,
                  updates: { content: [{ type: "text", text: response || accumulatedContent }], status: "completed" },
                },
              });

              // Refresh from backend to get persisted message
              if (localConversationId) {
                try {
                  const result = await api.fetchMessages(localConversationId);
                  dispatch({ type: "SET_MESSAGES", payload: result.messages });
                } catch {
                  // Ignore refresh errors - we have the content already
                }
              }
            },
            onError: (error: { code: string; message: string }) => {
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  id: streamingMessageId,
                  updates: { content: [{ type: "text", text: `Error: ${error.message}` }], status: "incomplete" },
                },
              });
            },
          },
        );
      } catch (error) {
        if (handleAbortError(error, userMessage.id, streamingMessageId, dispatch)) {
          return;
        }
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: streamingMessageId,
            updates: {
              content: [{ type: "text", text: error instanceof Error ? error.message : "An error occurred" }],
              status: "incomplete",
            },
          },
        });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [api, sendMessageStreaming],
  );

  // ==========================================================================
  // Use base hook with handlers
  // ==========================================================================

  return useBaseChatConversation({
    ...options,
    sendMessageHandler,
  });
};
