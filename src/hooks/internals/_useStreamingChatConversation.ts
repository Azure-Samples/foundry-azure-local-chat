import * as React from "react";

import type { ChatMessage, UseChatConversationOptions, UseChatConversationReturn } from "@/types/chat.types";
import type { StreamingChatApi } from "@/types/chat.types";
import { handleAbortError, setupNewConversation } from "@/utils/send-message-helpers";

import { buildHookReturn, type SendMessageHandler, useBaseChatConversation } from "./_useBaseChatConversation";

// =============================================================================
// Hook
// =============================================================================

/**
 * Streaming chat conversation hook.
 * Uses SSE for real-time response streaming.
 * With atomic pattern: if page refreshes mid-stream, nothing is persisted (clean slate).
 */
export const useStreamingChatConversation = (options: UseChatConversationOptions): UseChatConversationReturn => {
  const { api } = options;

  // Get streaming method - cast to StreamingChatApi to access streaming-specific methods
  const streamingApi = api as StreamingChatApi;
  const sendMessageStreaming = streamingApi.sendMessageStreaming;

  // ==========================================================================
  // Handlers for base hook
  // ==========================================================================

  const sendMessageHandler = React.useCallback<SendMessageHandler>(
    async (text, { conversationId, title, userMessage, actions, isIntentionalAbort, onConversationChange }) => {
      if (!sendMessageStreaming) {
        throw new Error("Streaming not supported by this API");
      }

      // Create streaming message placeholder
      const streamingMessageId = `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const streamingMessage: ChatMessage = {
        id: streamingMessageId,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "" }],
        status: "in_progress",
      };
      actions.setMessages((prev: ChatMessage[]) => [...prev, streamingMessage]);

      let accumulatedContent = "";
      let localConversationId = conversationId;

      try {
        await sendMessageStreaming(
          text,
          {
            onStart: (data: { conversationId: string; isNew: boolean }) => {
              if (data.conversationId && data.conversationId !== localConversationId) {
                setupNewConversation(data.conversationId, title, actions, onConversationChange);
                localConversationId = data.conversationId;
              }
            },
            onChunk: (content: string) => {
              accumulatedContent += content;
              actions.updateMessage(streamingMessageId, { content: [{ type: "text", text: accumulatedContent }] });
            },
            onDone: async (response: string) => {
              actions.updateMessage(streamingMessageId, {
                content: [{ type: "text", text: response || accumulatedContent }],
                status: "completed",
              });

              // Refresh from backend to get persisted message
              if (localConversationId) {
                try {
                  const result = await api.fetchMessages(localConversationId);
                  actions.setMessages(result.messages);
                } catch {
                  // Ignore refresh errors - we have the content already
                }
              }
            },
            onError: (error: { code: string; message: string }) => {
              actions.updateMessage(streamingMessageId, {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                status: "incomplete",
              });
            },
          },
          title,
        );
      } catch (error) {
        if (handleAbortError(error, userMessage.id, streamingMessageId, actions, isIntentionalAbort)) {
          return;
        }
        actions.updateMessage(streamingMessageId, {
          content: [{ type: "text", text: error instanceof Error ? error.message : "An error occurred" }],
          status: "incomplete",
        });
      } finally {
        actions.setIsLoading(false);
      }
    },
    [api, sendMessageStreaming],
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
