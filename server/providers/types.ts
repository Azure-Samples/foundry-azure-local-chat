// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Provider Types
 *
 * Shared interfaces for data providers (mock and API).
 * Uses OpenAI SDK types where available.
 */

import type { Conversation, Message } from "openai/resources/conversations/conversations";
import type { ConversationItem, ItemListParams } from "openai/resources/conversations/items";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";

// Re-export commonly used OpenAI types
export type { Conversation, ConversationItem, ItemListParams, Message, ResponseStreamEvent };

export interface CreateConversationParams {
  sessionId: string;
  title?: string;
}

export interface ListConversationItemsParams {
  conversationId: string;
  limit?: number;
  after?: string;
  order?: "asc" | "desc";
}

export interface ListConversationItemsResult {
  data: Message[];
  first_id: string;
  last_id: string;
  has_more: boolean;
  object: "list";
}

export interface CreateResponseParams {
  conversationId?: string;
  input: string;
  sessionId: string;
  title?: string;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface CreateResponseResult {
  conversationId: string;
  isNew: boolean;
  /** Present for non-streaming responses */
  response?: {
    id: string;
    status: string;
    output: unknown[];
  };
  /** Present for streaming responses */
  stream?: AsyncIterable<unknown>;
  /** Called after stream completes (e.g., to persist assistant message in mock) */
  onStreamComplete?: () => void;
}

export interface DeleteConversationResult {
  id: string;
  deleted: boolean;
  object: string;
}

/**
 * Data Provider Interface
 *
 * Both mock and API providers implement this interface.
 * This makes it easy to swap between them and eventually remove mock.
 */
export interface DataProvider {
  // Conversations
  listConversations(sessionId: string): Promise<Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  createConversation(params: CreateConversationParams): Promise<Conversation>;
  updateConversation(conversationId: string, metadata: Record<string, string>): Promise<Conversation | null>;
  deleteConversation(conversationId: string, sessionId: string): Promise<DeleteConversationResult>;

  // Conversation Items (messages in a conversation)
  listConversationItems(params: ListConversationItemsParams): Promise<ListConversationItemsResult>;

  // Responses (send message and get AI response)
  createResponse(params: CreateResponseParams): Promise<CreateResponseResult>;

  // Optional mock-specific operations
  seed?(sessionId: string, messageCount?: number): Promise<Conversation>;
  clear?(): Promise<void>;
}
