// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Chat API (Non-streaming)
 *
 * ATOMIC PATTERN:
 * - Single POST /responses call sends message and receives response
 * - No separate "add user message" step
 * - If request fails, nothing is persisted (no orphan messages)
 * - Refresh during request = message not saved (clean state)
 */

import { env } from "@/config/runtime";
import type { Conversation, Message, ResponseOutputMessage } from "@/types/api.types";
import type { ChatApi, ChatConversation, SendMessageOptions, SendMessageResult } from "@/types/chat.types";
import { generateTitle } from "@/utils/conversation-helpers";
import { isAbortError } from "@/utils/errors";

export class ChatApiService implements ChatApi {
  protected baseUrl = env("VITE_API_URL", "/api");
  protected abortController: AbortController | null = null;

  // ---------------------------------------------------------------------------
  // Conversation CRUD
  // ---------------------------------------------------------------------------

  fetchConversations = async (): Promise<ChatConversation[]> => {
    try {
      const response = await fetch(`${this.baseUrl}/conversations`);
      if (!response.ok) {
        console.error("[ChatAPI] Failed to fetch conversations:", response.statusText);
        return [];
      }

      const conversations: Conversation[] = await response.json();

      return conversations.map((conv) => ({
        id: conv.id,
        object: conv.object,
        created_at: conv.created_at,
        metadata: {
          title: (conv.metadata as { title?: string })?.title || "Conversation",
        },
      }));
    } catch (error) {
      console.error("[ChatAPI] Failed to fetch conversations:", error);
      return [];
    }
  };

  fetchConversation = async (id: string): Promise<ChatConversation | null> => {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${id}`);
      if (!response.ok) {
        return null;
      }

      const conv: Conversation = await response.json();
      const metadata = (conv.metadata || {}) as { title?: string };

      return {
        id: conv.id,
        object: conv.object,
        created_at: conv.created_at,
        metadata: {
          title: metadata.title || "Conversation",
        },
      };
    } catch (error) {
      console.error("[ChatAPI] Failed to fetch conversation:", error);
      return null;
    }
  };

  createConversation = async (title?: string): Promise<ChatConversation> => {
    const conversationTitle = title || "New Conversation";

    const response = await fetch(`${this.baseUrl}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { title: conversationTitle } }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`);
    }

    const conv: Conversation = await response.json();
    const metadata = (conv.metadata || {}) as { title?: string };
    const finalTitle = metadata.title || conversationTitle;

    return {
      id: conv.id,
      object: conv.object,
      created_at: conv.created_at,
      metadata: {
        title: finalTitle,
      },
    };
  };

  deleteConversation = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Failed to delete conversation: ${response.statusText}`);
      }
    } catch (error) {
      console.error("[ChatAPI] Failed to delete conversation:", error);
    }
  };

  renameConversation = async (id: string, newTitle: string): Promise<void> => {
    try {
      await fetch(`${this.baseUrl}/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { title: newTitle },
        }),
      });
    } catch (error) {
      console.error("[ChatAPI] Failed to rename conversation:", error);
    }
  };

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  /**
   * Fetch messages with pagination support
   * @param conversationId - The conversation to fetch messages from
   * @param options - Pagination options
   * @returns Messages and pagination info
   */
  fetchMessages = async (
    conversationId: string,
    options?: { limit?: number; after?: string },
  ): Promise<{ messages: Message[]; hasMore: boolean; lastId: string }> => {
    try {
      const params = new URLSearchParams();
      if (options?.limit) {
        params.set("limit", options.limit.toString());
      }
      if (options?.after) {
        params.set("after", options.after);
      }
      // Always get in desc order (newest first) from API
      params.set("order", "desc");

      const url = `${this.baseUrl}/conversations/${conversationId}/items?${params}`;
      const response = await fetch(url);
      if (!response.ok) {
        return { messages: [], hasMore: false, lastId: "" };
      }

      const data = await response.json();

      // Azure AI returns items in reverse chronological order (newest first)
      // We need to reverse to show oldest first (correct chat order)
      const messages = (data.data as Message[]).reverse();

      return {
        messages,
        hasMore: data.has_more || false,
        lastId: data.last_id || "",
      };
    } catch (error) {
      console.error("[ChatAPI] Failed to fetch messages:", error);
      return { messages: [], hasMore: false, lastId: "" };
    }
  };

  // ---------------------------------------------------------------------------
  // Send Message (ATOMIC)
  // ---------------------------------------------------------------------------

  sendMessage = async ({ message, conversationId, title }: SendMessageOptions): Promise<SendMessageResult> => {
    this.abortController = new AbortController();

    try {
      const conversationTitle = title || generateTitle(message);

      const response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: message,
          conversationId: conversationId || undefined,
          title: conversationId ? undefined : conversationTitle,
          stream: false,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const responseData = await response.json();
      const newConversationId = responseData.conversationId || conversationId || "";

      // Extract assistant message from response output
      const output = responseData.response?.output || [];
      const assistantMessageOutput = output.find(
        (item: ResponseOutputMessage) => item.type === "message" && item.role === "assistant",
      );

      if (!assistantMessageOutput) {
        throw new Error("No assistant message found in response output");
      }

      // Validate required properties
      if (!assistantMessageOutput.id || !assistantMessageOutput.content || !assistantMessageOutput.status) {
        throw new Error("Incomplete assistant message data in response output");
      }

      // Transform to Message format
      const assistantMessage: Message = {
        id: assistantMessageOutput.id,
        type: "message",
        role: assistantMessageOutput.role,
        content: assistantMessageOutput.content,
        status: assistantMessageOutput.status,
      };

      return { message: assistantMessage, conversationId: newConversationId };
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      console.error("[ChatAPI] Failed to send message:", error);
      throw error;
    } finally {
      this.abortController = null;
    }
  };

  abort = (): void => {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  };
}

export const chatApi = new ChatApiService();
