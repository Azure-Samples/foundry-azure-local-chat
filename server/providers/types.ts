/**
 * Provider Types
 *
 * Shared interfaces for data providers (mock and API).
 * Uses OpenAI SDK types where available.
 */

import type { Response } from "express";
import type { Conversation, Message } from "openai/resources/conversations/conversations";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

// Re-export commonly used OpenAI types
export type { Conversation, Message };

export interface CreateConversationParams {
  sessionId: string;
  title?: string;
}

export interface CreateResponseParams {
  conversationId?: string;
  input: string;
  sessionId: string;
  title?: string;
  stream?: boolean;
  signal?: AbortSignal;
  res?: Response; // For streaming responses
}

export interface CreateResponseResult {
  conversationId: string;
  isNew: boolean;
  response: OpenAIResponse;
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
  deleteConversation(conversationId: string): Promise<boolean>;

  // Items (messages in a conversation)
  listItems(conversationId: string): Promise<Message[]>;
  createItems(conversationId: string, items: Message[]): Promise<Message[]>;

  // Responses (send message and get AI response)
  createResponse(params: CreateResponseParams): Promise<CreateResponseResult | void>;
}
