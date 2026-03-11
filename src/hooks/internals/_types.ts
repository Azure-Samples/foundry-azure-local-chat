// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Internal types for chat conversation hooks.
 * Shared by _useBaseChatConversation, _useStreamingChatConversation, _useStandardChatConversation.
 */
import type {
  BaseChatApi,
  ChatHandlers,
  ChatHistoryHandlers,
  ChatHistoryState,
  ChatMessage,
  ChatState,
} from "@/types/chat.types";

import type { ChatAction } from "./_reducer";

// =============================================================================
// Public Hook Types
// =============================================================================

/**
 * Options for chat conversation hooks
 */
export interface ChatConversationOptions<TApi extends BaseChatApi = BaseChatApi> {
  /** Initial conversation ID from route */
  initialConversationId?: string;
  /** The API implementation to use */
  api: TApi;
}

/**
 * Combined chat conversation state (read-only)
 * Combines state for both Chat and ChatHistory components
 */
export interface ChatConversationState extends ChatState, ChatHistoryState {}

/**
 * Combined chat conversation handlers (actions)
 * Combines handlers for both Chat and ChatHistory components
 */
export interface ChatConversationHandlers extends ChatHandlers, ChatHistoryHandlers {}

/**
 * Return value from useChatConversation hook
 * Separates state (data) from handlers (functions) for clean prop passing
 */
export interface ChatConversationReturn {
  state: ChatConversationState;
  handlers: ChatConversationHandlers;
}

/**
 * Type for chat conversation hooks
 * Used for dynamic loading in ChatPage
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChatConversationHook = (options: ChatConversationOptions<any>) => ChatConversationReturn;

// =============================================================================
// Internal Hook Types
// =============================================================================

/** Send message handler - injected by streaming/standard hooks */
export type SendMessageHandler = (
  text: string,
  context: {
    conversationId: string;
    title: string;
    userMessage: ChatMessage;
    dispatch: React.Dispatch<ChatAction>;
    addMessage: (role: "user" | "assistant", content: string, status?: ChatMessage["status"]) => ChatMessage;
    onConversationChange: (id: string | null) => void;
  },
) => Promise<void>;
