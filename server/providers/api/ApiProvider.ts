// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * API Provider - Azure AI Foundry implementation of DataProvider
 *
 * Wraps the OpenAI SDK client and session tracking.
 */

import {
  getAgentRequestOptions,
  getOpenAIClient,
  getSessionConversations,
  trackConversation,
  untrackConversation,
} from "../../services";
import type {
  Conversation,
  ConversationItem,
  CreateConversationParams,
  CreateResponseParams,
  CreateResponseResult,
  DataProvider,
  DeleteConversationResult,
  ItemListParams,
  ListConversationItemsParams,
  ListConversationItemsResult,
  Message,
} from "../types";

const isMessage = (item: ConversationItem): item is Message => item.type === "message" && "role" in item && "content" in item;

export class ApiProvider implements DataProvider {
  public async listConversations(sessionId: string): Promise<Conversation[]> {
    const client = await getOpenAIClient();
    const conversationIds = getSessionConversations(sessionId);
    const conversations: Conversation[] = [];

    for (const id of conversationIds) {
      try {
        const conv = await client.conversations.retrieve(id);
        conversations.push(conv);
      } catch {
        untrackConversation(sessionId, id);
      }
    }

    conversations.sort((a, b) => b.created_at - a.created_at);
    return conversations;
  }

  public async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const client = await getOpenAIClient();
      return await client.conversations.retrieve(conversationId);
    } catch {
      return null;
    }
  }

  public async createConversation(params: CreateConversationParams): Promise<Conversation> {
    const client = await getOpenAIClient();
    const conversation = await client.conversations.create({
      metadata: { title: params.title ?? "", sessionId: params.sessionId },
    });
    trackConversation(params.sessionId, conversation.id);
    return conversation;
  }

  public async updateConversation(conversationId: string, metadata: Record<string, string>): Promise<Conversation | null> {
    try {
      const client = await getOpenAIClient();
      return await client.conversations.update(conversationId, { metadata });
    } catch {
      return null;
    }
  }

  public async deleteConversation(conversationId: string, sessionId: string): Promise<DeleteConversationResult> {
    const client = await getOpenAIClient();
    const result = await client.conversations.delete(conversationId);
    untrackConversation(sessionId, conversationId);
    console.log(`[DELETE /conversations] Deleted: ${conversationId}`);
    return result;
  }

  public async listConversationItems(params: ListConversationItemsParams): Promise<ListConversationItemsResult> {
    const { conversationId, limit, after, order = "desc" } = params;
    const client = await getOpenAIClient();

    const listParams: ItemListParams = { order };
    if (limit) {
      listParams.limit = Math.min(limit, 100);
    }
    if (after) {
      listParams.after = after;
    }

    const response = await client.conversations.items.list(conversationId, listParams);
    console.log(`[ConversationItems GET] ${conversationId}: ${response.data.length} items`);

    const messages = response.data.filter(isMessage);

    return {
      data: messages,
      first_id: messages[0]?.id || "",
      last_id: response.last_id,
      has_more: response.has_more,
      object: "list",
    };
  }

  public async createResponse(params: CreateResponseParams): Promise<CreateResponseResult> {
    const { input, conversationId: providedId, sessionId, stream, signal } = params;
    const client = await getOpenAIClient();
    const isNew = !providedId;
    const requestOptions = getAgentRequestOptions(signal);

    let conversationId: string;
    if (providedId) {
      conversationId = providedId;
    } else {
      const title = input.slice(0, 50);
      const conversation = await client.conversations.create({ metadata: { title, sessionId } }, { signal });
      conversationId = conversation.id;
      trackConversation(sessionId, conversationId);
      console.log(`[POST /responses] Created new conversation: ${conversationId}`);
    }

    console.log(`[POST /responses] Sending to conversation: ${conversationId}, stream: ${stream}`);

    if (stream) {
      const streamResponse = await client.responses.create(
        { input, conversation: conversationId, stream: true },
        requestOptions,
      );
      return { conversationId, isNew, stream: streamResponse };
    }

    const response = await client.responses.create({ input, conversation: conversationId }, requestOptions);
    console.log(`[POST /responses] Response generated, status: ${response.status}`);

    return {
      conversationId,
      isNew,
      response: {
        id: response.id,
        status: response.status ?? "completed",
        output: response.output?.filter((item) => item.type === "message") || [],
      },
    };
  }
}
