/**
 * Chat API (Non-streaming)
 *
 * ATOMIC PATTERN:
 * - Single POST /responses call sends message and receives response
 * - No separate "add user message" step
 * - If request fails, nothing is persisted (no orphan messages)
 * - Refresh during request = message not saved (clean state)
 */

import type { Conversation, Message, ResponseOutputMessage } from "@/types/api.types";
import type { ChatApi, ChatConversation } from "@/types/chat.types";
import { Abort_ErrorName } from "@/utils/errors";

export class ChatApiService implements ChatApi {
  protected baseUrl = import.meta.env.VITE_API_URL || "/api";
  protected debug = true;
  protected currentConversationId: string | null = null;
  protected abortController: AbortController | null = null;

  protected log = (...args: unknown[]): void => {
    if (this.debug) {
      console.log("[ChatAPI]", ...args);
    }
  };

  protected generateTitle = (message: string): string => {
    const maxLength = 50;
    const cleaned = message.trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + "..." : cleaned;
  };

  // ---------------------------------------------------------------------------
  // Conversation ID Management
  // ---------------------------------------------------------------------------

  setConversationId = (id: string | null): void => {
    this.log("setConversationId:", id);
    this.currentConversationId = id;
  };

  getConversationId = (): string | null => {
    return this.currentConversationId;
  };

  // ---------------------------------------------------------------------------
  // Conversation CRUD
  // ---------------------------------------------------------------------------

  fetchConversations = async (): Promise<ChatConversation[]> => {
    this.log("fetchConversations");
    try {
      const response = await fetch(`${this.baseUrl}/conversations`);
      if (!response.ok) {
        console.error("[ChatAPI] Failed to fetch conversations:", response.statusText);
        return [];
      }

      const conversations: Conversation[] = await response.json();
      this.log("fetchConversations - raw response:", conversations.length, "conversations");

      const mapped = conversations.map((conv) => {
        const title = (conv.metadata as { title?: string })?.title || "Conversation";
        this.log("fetchConversations - mapping:", conv.id, "title:", title);
        return {
          id: conv.id,
          object: conv.object,
          created_at: conv.created_at,
          metadata: {
            title,
          },
        };
      });

      return mapped;
    } catch (error) {
      console.error("[ChatAPI] Failed to fetch conversations:", error);
      return [];
    }
  };

  fetchConversation = async (id: string): Promise<ChatConversation | null> => {
    this.log("fetchConversation:", id);
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
    this.log("createConversation - title:", conversationTitle);

    const payload = { metadata: { title: conversationTitle } };
    this.log("createConversation - payload:", JSON.stringify(payload));

    const response = await fetch(`${this.baseUrl}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`);
    }

    const conv: Conversation = await response.json();
    this.log("createConversation - response:", JSON.stringify(conv));

    const metadata = (conv.metadata || {}) as { title?: string };
    const finalTitle = metadata.title || conversationTitle;

    this.log("createConversation - finalTitle:", finalTitle);

    this.currentConversationId = conv.id;
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
    this.log("deleteConversation:", id);
    try {
      await fetch(`${this.baseUrl}/conversations/${id}`, { method: "DELETE" });
    } catch (error) {
      console.error("[ChatAPI] Failed to delete conversation:", error);
    }
  };

  renameConversation = async (id: string, newTitle: string): Promise<void> => {
    this.log("renameConversation:", id, newTitle);
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
    this.log("fetchMessages:", conversationId, options);
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

  sendMessage = async (message: string): Promise<Message> => {
    this.log("sendMessage:", message);

    this.abortController = new AbortController();

    try {
      const title = this.generateTitle(message);

      // ATOMIC: Single call to /responses with the user message
      // Server handles: conversation creation (if needed) + user message + AI response
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: message,
          conversationId: this.currentConversationId,
          title: this.currentConversationId ? undefined : title, // Only send title for new conversations
          stream: false,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const responseData = await response.json();
      this.log("Response data:", responseData);

      // Update conversation ID (might be new)
      if (responseData.conversationId) {
        this.currentConversationId = responseData.conversationId;
      }

      // Extract assistant message from response output
      const output = responseData.response?.output || [];
      const assistantMessageOutput = output.find(
        (item: ResponseOutputMessage) => item.type === "message" && item.role === "assistant",
      );

      if (!assistantMessageOutput) {
        throw new Error("No assistant message found in response output");
      }

      // Transform to Message format
      const assistantMessage: Message = {
        id: assistantMessageOutput.id,
        type: "message",
        role: assistantMessageOutput.role,
        content: assistantMessageOutput.content,
        status: assistantMessageOutput.status,
      };

      return assistantMessage;
    } catch (error) {
      if ((error as Error).name === Abort_ErrorName) {
        throw error;
      }
      console.error("[ChatAPI] Failed to send message:", error);
      throw error;
    } finally {
      this.abortController = null;
    }
  };

  stop = (): void => {
    this.log("stop");
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  };
}

export const chatApi = new ChatApiService();
