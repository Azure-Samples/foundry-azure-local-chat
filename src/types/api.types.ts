/**
 * API Types
 *
 * Azure AI Foundry uses an OpenAI-compatible client for conversations/responses.
 * We re-export the types we need from the OpenAI SDK.
 *
 * Architecture:
 * - Azure AI Foundry's `AIProjectClient.getOpenAIClient()` returns an OpenAI client
 * - Therefore, conversation/response types come from OpenAI SDK
 * - This is the SINGLE source of truth for API types (used by both client and server)
 */

// =============================================================================
// Conversation Types (from OpenAI - Azure AI wraps OpenAI client)
// =============================================================================
export type { Conversation, ConversationDeletedResource, Message } from "openai/resources/conversations/conversations";

// =============================================================================
// Items Types
// =============================================================================
export type { ConversationItem, ConversationItemList } from "openai/resources/conversations/items";

// =============================================================================
// Response Types
// =============================================================================
export type { Response, ResponseOutputMessage } from "openai/resources/responses/responses";

// =============================================================================
// Standard API Types
// =============================================================================

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    type?: string;
  };
}
