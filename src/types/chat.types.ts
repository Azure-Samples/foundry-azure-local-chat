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

import type { Conversation, Message } from "openai/resources/conversations/conversations";

// =============================================================================
// Core Types - Direct OpenAI Types
// =============================================================================

/**
 * Use OpenAI Message directly
 */
export type ChatMessage = Message;

/**
 * Extended metadata for conversations
 * OpenAI Conversation.metadata is `unknown`, we type it for our use case
 */
export interface ConversationMetadata {
  title?: string;
  [key: string]: unknown;
}

/**
 * Conversation with typed metadata for UI
 */
export type ChatConversation = Omit<Conversation, "metadata"> & {
  metadata: ConversationMetadata;
};

// =============================================================================
// API Interfaces
// =============================================================================

/**
 * Pagination options for fetching messages
 */
export interface FetchMessagesOptions {
  limit?: number;
  after?: string;
}

/**
 * Pagination result for fetching messages
 */
export interface FetchMessagesResult {
  messages: Message[];
  hasMore: boolean;
  lastId: string;
}

/**
 * Base chat API interface - common methods for all implementations
 */
export interface BaseChatApi {
  // Core methods
  fetchConversations: () => Promise<ChatConversation[]>;
  getConversationId: () => string | null;
  setConversationId: (id: string | null) => void;
  createConversation: (title?: string) => Promise<ChatConversation>;
  fetchMessages: (conversationId: string, options?: FetchMessagesOptions) => Promise<FetchMessagesResult>;
  fetchConversation: (id: string) => Promise<ChatConversation | null>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  stop: () => void;
}

/**
 * Standard (non-streaming) chat API
 */
export interface ChatApi extends BaseChatApi {
  sendMessage: (message: string) => Promise<Message>;
}

/**
 * Streaming Chat API interface
 * Extends BaseChatApi with streaming-specific methods
 */
export interface StreamingChatApi extends BaseChatApi {
  /** Send message with non-streaming response */
  sendMessage: (message: string) => Promise<Message>;
  /** Send message with streaming response */
  sendMessageStreaming: (message: string, callbacks: StreamCallbacks, title?: string) => Promise<void>;
}

// =============================================================================
// Streaming Callback Types
// =============================================================================

/**
 * Streaming callbacks for real-time response handling
 */
export interface StreamCallbacks {
  onStart?: (data: { conversationId: string; isNew: boolean }) => void;
  onChunk?: (content: string) => void;
  onDone?: (response: string) => void;
  onError?: (error: { code: string; message: string }) => void;
}

// =============================================================================
// Hook Types (useChatConversation)
// =============================================================================

/**
 * Options for chat conversation hooks
 * Accepts a ChatApi instance plus routing configuration
 */
export interface UseChatConversationOptions {
  /** Initial conversation ID from route */
  initialConversationId?: string;
  /** Callback when conversation changes (for route updates) */
  onConversationChange?: (conversationId: string | null) => void;
  /** The API implementation to use */
  api: BaseChatApi;
}

/**
 * Chat conversation state (read-only)
 */
export interface ChatConversationState {
  conversations: ChatConversation[];
  activeConversation: ChatConversation | null;
  messages: ChatMessage[];
  isHistoryOpen: boolean;
  isInitializing: boolean;
  isLoading: boolean;
}

/**
 * Chat conversation handlers (actions)
 */
export interface ChatConversationHandlers {
  onHistoryOpenChange: (open: boolean) => void;
  handleNewChat: () => void;
  handleSelectConversation: (id: string) => void;
  handleDeleteConversation: (id: string) => Promise<void>;
  handleRenameConversation: (id: string, newTitle: string) => Promise<void>;
  handleSendMessage: (text: string) => Promise<void>;
  handleStop: () => void;
}

/**
 * Return value from useChatConversation hook
 * This is also the props interface for the Chat component
 */
export type UseChatConversationReturn = ChatConversationState & ChatConversationHandlers;

/**
 * Type for chat conversation hooks
 * Used for dynamic loading in ChatPage
 */
export type UseChatConversationHook = (options: UseChatConversationOptions) => UseChatConversationReturn;
