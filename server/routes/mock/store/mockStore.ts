/**
 * Mock Store - Simple in-memory storage abstraction
 *
 * This is a thin layer that stores data in OpenAI-compatible format.
 * The mock routes act as interceptors that use this store instead of Azure AI.
 */

import type { Conversation, Message } from "openai/resources/conversations/conversations";

// Simple in-memory maps
const conversations = new Map<string, Conversation>();
const items = new Map<string, Message[]>();

/**
 * Generate Azure AI-like IDs
 * Azure format: prefix_<16 hex chars><32 alphanumeric chars>
 * Example: conv_0ae5cd13efc5f9b100C79EwNxrxIDqaA5PPF5Gq6xsS1TncJMA
 */
const generateId = (prefix: string): string => {
  const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const alphanumeric = Array.from({ length: 32 }, () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return chars[Math.floor(Math.random() * chars.length)];
  }).join("");
  return `${prefix}_${hex}${alphanumeric}`;
};

/**
 * Mock Store API - matches the operations needed by routes
 */
export const mockStore = {
  // ============================================
  // Conversations
  // ============================================

  createConversation(sessionId: string, title: string): Conversation {
    const conv: Conversation = {
      id: generateId("conv"),
      object: "conversation",
      created_at: Math.floor(Date.now() / 1000),
      metadata: { sessionId, title },
    };
    conversations.set(conv.id, conv);
    return conv;
  },

  getConversation(id: string): Conversation | undefined {
    return conversations.get(id);
  },

  listConversations(sessionId: string): Conversation[] {
    return [...conversations.values()]
      .filter((c) => (c.metadata as Record<string, unknown>)?.sessionId === sessionId)
      .sort((a, b) => b.created_at - a.created_at);
  },

  updateConversation(id: string, metadata: Record<string, unknown>): Conversation | undefined {
    const conv = conversations.get(id);
    if (!conv) {
      return undefined;
    }
    conv.metadata = { ...(conv.metadata as Record<string, unknown>), ...metadata };
    return conv;
  },

  deleteConversation(id: string): void {
    conversations.delete(id);
    items.delete(id);
  },

  // ============================================
  // Items (Messages)
  // ============================================

  addMessage(conversationId: string, role: "user" | "assistant", text: string): Message {
    const msg: Message = {
      id: generateId("msg"),
      type: "message",
      role,
      content: [{ type: role === "user" ? "input_text" : "output_text", text }],
      status: "completed",
    } as Message;

    const existing = items.get(conversationId) || [];
    items.set(conversationId, [...existing, msg]);
    return msg;
  },

  getItems(conversationId: string): Message[] {
    return items.get(conversationId) || [];
  },

  // ============================================
  // Utilities
  // ============================================

  clear(): void {
    conversations.clear();
    items.clear();
  },

  /** Seed test data for pagination testing */
  seed(sessionId: string, messageCount = 25): Conversation {
    const conv = this.createConversation(sessionId, `Test (${messageCount} msgs)`);

    for (let i = 0; i < messageCount; i++) {
      const isUser = i % 2 === 0;
      const num = Math.floor(i / 2) + 1;
      this.addMessage(conv.id, isUser ? "user" : "assistant", isUser ? `User message #${num}` : `Assistant response #${num}`);
    }

    return conv;
  },

  generateId,
};
