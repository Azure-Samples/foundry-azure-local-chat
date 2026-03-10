/**
 * Chat Types
 *
 * Types for the chat UI layer. Uses OpenAI types directly where possible
 * since Azure AI Foundry wraps an OpenAI-compatible client.
 *
 * Type strategy:
 * - ChatMessage = OpenAI Message (no wrapper)
 * - ChatConversation = OpenAI Conversation with typed metadata
 */

import type { Conversation, Message } from "@/types/api.types";

// =============================================================================
// Core Types - Direct OpenAI Types
// =============================================================================

/**
 * Use OpenAI Message directly
 */
export type ChatMessage = Message;

/**
 * Conversation with typed metadata for UI
 */
export type ChatConversation = Omit<Conversation, "metadata"> & {
  metadata: { title?: string; [key: string]: unknown };
};

// =============================================================================
// API Interfaces
// =============================================================================

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  message: string;
  conversationId?: string;
  title?: string;
}

/**
 * Result of sending a message (includes conversation ID for new conversations)
 */
export interface SendMessageResult {
  message: Message;
  conversationId: string;
}

/**
 * Base chat API interface - stateless HTTP client
 */
export interface BaseChatApi {
  fetchConversations: () => Promise<ChatConversation[]>;
  createConversation: (title?: string) => Promise<ChatConversation>;
  fetchMessages: (
    conversationId: string,
    options?: { limit?: number; after?: string },
  ) => Promise<{ messages: Message[]; hasMore: boolean; lastId?: string }>;
  fetchConversation: (id: string) => Promise<ChatConversation | null>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  abort: () => void;
}

/**
 * Standard (non-streaming) chat API
 */
export interface ChatApi extends BaseChatApi {
  sendMessage: (options: SendMessageOptions) => Promise<SendMessageResult>;
}

/**
 * Streaming Chat API interface
 */
export interface StreamingChatApi extends BaseChatApi {
  sendMessage: (options: SendMessageOptions) => Promise<SendMessageResult>;
  sendMessageStreaming: (options: SendMessageOptions, callbacks: StreamCallbacks) => Promise<void>;
}

// =============================================================================
// Streaming Callback Types
// =============================================================================

/**
 * Streaming callbacks for real-time response handling
 */
export interface StreamCallbacks {
  onStart?: (data: { conversationId: string }) => void;
  onChunk?: (content: string) => void;
  onDone?: (response: string) => void;
  onError?: (error: { code: string; message: string }) => void;
}

// =============================================================================
// Component Types
// =============================================================================

/**
 * State for the Chat component (current conversation UI)
 */
export interface ChatState {
  activeConversation: ChatConversation | null;
  messages: ChatMessage[];
  isInitializing: boolean;
  isLoading: boolean;
}

/**
 * Handlers for the Chat component (current conversation UI)
 */
export interface ChatHandlers {
  handleSendMessage: (text: string) => Promise<void>;
  handleStop: () => void;
}

/**
 * State for the ChatHistory component (sidebar navigation)
 */
export interface ChatHistoryState {
  conversations: ChatConversation[];
}

/**
 * Handlers for the ChatHistory component (sidebar navigation)
 */
export interface ChatHistoryHandlers {
  handleNewChat: () => void;
  handleSelectConversation: (id: string) => void;
  handleDeleteConversation: (id: string) => Promise<void>;
  handleRenameConversation: (id: string, newTitle: string) => Promise<void>;
}
