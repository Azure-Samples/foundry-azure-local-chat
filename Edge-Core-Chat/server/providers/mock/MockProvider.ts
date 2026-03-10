/**
 * Mock Provider - In-memory implementation of DataProvider
 *
 * Wraps mockStore with the DataProvider interface.
 * Easily removable: delete this folder and update providers/index.ts
 */

import type {
  Conversation,
  CreateConversationParams,
  CreateResponseParams,
  CreateResponseResult,
  DataProvider,
  DeleteConversationResult,
  ListConversationItemsParams,
  ListConversationItemsResult,
} from "../types";
import { mockStore } from "./store";
import { generateMockStreamEvents } from "./utils/mockStreaming";

export class MockProvider implements DataProvider {
  public async listConversations(sessionId: string): Promise<Conversation[]> {
    return mockStore.listConversations(sessionId);
  }

  public async getConversation(conversationId: string): Promise<Conversation | null> {
    return mockStore.getConversation(conversationId) ?? null;
  }

  public async createConversation(params: CreateConversationParams): Promise<Conversation> {
    return mockStore.createConversation(params.sessionId, params.title || "New Conversation");
  }

  public async updateConversation(conversationId: string, metadata: Record<string, string>): Promise<Conversation | null> {
    return mockStore.updateConversation(conversationId, metadata) ?? null;
  }

  public async deleteConversation(conversationId: string): Promise<DeleteConversationResult> {
    mockStore.deleteConversation(conversationId);
    return { id: conversationId, deleted: true, object: "conversation.deleted" };
  }

  public async listConversationItems(params: ListConversationItemsParams): Promise<ListConversationItemsResult> {
    const { conversationId, limit = 20, after, order = "desc" } = params;

    let conversationItems = mockStore.getConversationItems(conversationId);

    if (order === "desc") {
      conversationItems = [...conversationItems].reverse();
    }

    // Cursor pagination
    if (after) {
      const idx = conversationItems.findIndex((i) => i.id === after);
      if (idx !== -1) {
        conversationItems = conversationItems.slice(idx + 1);
      }
    }

    const limitNum = Math.min(Math.max(limit, 1), 100);
    const hasMore = conversationItems.length > limitNum;
    conversationItems = conversationItems.slice(0, limitNum);

    return {
      data: conversationItems,
      first_id: conversationItems[0]?.id || "",
      last_id: conversationItems[conversationItems.length - 1]?.id || "",
      has_more: hasMore,
      object: "list",
    };
  }

  public async createResponse(params: CreateResponseParams): Promise<CreateResponseResult> {
    const { input, conversationId: providedId, sessionId, title, stream } = params;

    let conv = providedId ? mockStore.getConversation(providedId) : undefined;
    const isNew = !conv;

    if (!conv) {
      conv = mockStore.createConversation(sessionId, title || input.substring(0, 50));
    }

    mockStore.addMessage(conv.id, "user", input);

    const responseId = mockStore.generateResponseId();
    const mockText = `Mock AI response to: "${input.substring(0, 50)}${input.length > 50 ? "..." : ""}"`;

    if (stream) {
      const streamEvents = generateMockStreamEvents(responseId, conv.id, mockText);
      return {
        conversationId: conv.id,
        isNew,
        stream: streamEvents,
        onStreamComplete: () => {
          mockStore.addMessage(conv!.id, "assistant", mockText);
        },
      };
    }

    // Non-streaming: simulate delay
    await new Promise((r) => setTimeout(r, 300));
    const assistantMsg = mockStore.addMessage(conv.id, "assistant", mockText);

    return {
      conversationId: conv.id,
      isNew,
      response: {
        id: responseId,
        status: "completed",
        output: [assistantMsg],
      },
    };
  }

  public async seed(sessionId: string, messageCount = 25): Promise<Conversation> {
    return mockStore.seed(sessionId, messageCount);
  }

  public async clear(): Promise<void> {
    mockStore.clear();
  }
}
