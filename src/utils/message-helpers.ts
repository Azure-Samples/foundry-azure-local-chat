/**
 * Helper functions for creating and manipulating ChatMessage objects
 */
import type { ChatMessage } from "@/types/chat.types";

/**
 * Create a user message with text content
 */
export const createUserMessage = (text: string): ChatMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  role: "user",
  content: [{ type: "text", text }],
  type: "message",
  status: "completed",
});

/**
 * Create an assistant message with text content
 */
export const createAssistantMessage = (text: string, status: ChatMessage["status"] = "completed"): ChatMessage => ({
  id: `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
  role: "assistant",
  content: [{ type: "text", text }],
  type: "message",
  status,
});

/**
 * Create a message (user or assistant)
 */
export const createMessage = (
  role: "user" | "assistant",
  content: string,
  status: ChatMessage["status"] = "completed",
): ChatMessage => {
  return role === "user" ? createUserMessage(content) : createAssistantMessage(content, status);
};

/**
 * Extract text content from a ChatMessage
 * Handles multiple content types: "text", "input_text", "output_text"
 */
export const getMessageText = (message: ChatMessage): string => {
  const textContent = message.content.find(
    (c) => c.type === "text" || c.type === "input_text" || c.type === "output_text",
  );
  return textContent && "text" in textContent ? textContent.text : "";
};

/**
 * Check if a message is from the user
 */
export const isUserMessage = (message: ChatMessage): boolean => message.role === "user";

/**
 * Check if a message is from the assistant
 */
export const isAssistantMessage = (message: ChatMessage): boolean => message.role === "assistant";

/**
 * Normalize fetchMessages response to array
 * Supports both old array format and new pagination result format
 */
export const normalizeMessages = (
  response: ChatMessage[] | { messages: ChatMessage[]; hasMore: boolean; lastId: string },
): ChatMessage[] => {
  if (Array.isArray(response)) {
    return response;
  }
  return response.messages || [];
};
