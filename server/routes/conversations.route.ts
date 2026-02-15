/**
 * Conversations Routes - Pure proxy to Azure SDK
 *
 * NOTE: Conversation creation is now handled atomically via POST /responses
 * This route only handles: listing, getting, updating, and deleting conversations
 */

import { Request, Response, Router } from "express";
import type { Conversation, ConversationDeletedResource } from "openai/resources/conversations/conversations";

import { getSessionId, requireSession } from "../middleware";
import { getOpenAIClient, getSessionConversations, trackConversation, untrackConversation } from "../services";
import { type ApiErrorResponse, createApiError } from "../utils/createApiError";

const router = Router();
router.use(requireSession);

/**
 * GET /conversations - List all conversations for session
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req);
    const client = await getOpenAIClient();

    const conversationIds = getSessionConversations(sessionId);
    const conversations: Conversation[] = [];

    for (const id of conversationIds) {
      try {
        const conv = await client.conversations.retrieve(id);
        conversations.push(conv);
      } catch {
        // Conversation may have been deleted, remove from tracking
        untrackConversation(sessionId, id);
      }
    }

    // Sort by created_at descending (newest first)
    conversations.sort((a, b) => b.created_at - a.created_at);

    res.json(conversations);
  } catch (error: unknown) {
    console.error("[GET /conversations] Error:", error);
    res.status(500).json(createApiError("server_error", "Failed to list conversations"));
  }
});

/**
 * POST /conversations - Create conversation (legacy endpoint)
 *
 * @deprecated Use POST /responses which creates conversation atomically with first message
 * This endpoint is kept for backward compatibility but conversation creation
 * should be done via the responses endpoint for atomic message handling.
 */
router.post("/", async (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  try {
    const sessionId = getSessionId(req);
    const client = await getOpenAIClient();

    console.log("[POST /conversations] (deprecated) Request body:", JSON.stringify(req.body));

    const createParams = {
      ...req.body,
      metadata: { ...req.body?.metadata, sessionId },
    };

    console.log("[POST /conversations] Creating with params:", JSON.stringify(createParams));

    const conversation = await client.conversations.create(createParams);

    console.log("[POST /conversations] Created conversation:", JSON.stringify(conversation));

    // Track conversation for this session
    trackConversation(sessionId, conversation.id);

    res.status(201).json(conversation);
  } catch (error: unknown) {
    console.error("[POST /conversations] Error:", error);
    res.status(500).json(createApiError("server_error", "Failed to create conversation"));
  }
});

/**
 * GET /conversations/{conversationId} - Get conversation
 */
router.get("/:conversationId", async (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  try {
    const { conversationId } = req.params;
    const client = await getOpenAIClient();

    const conversation = await client.conversations.retrieve(conversationId);
    res.json(conversation);
  } catch (error: unknown) {
    console.error("[GET /conversations/:id] Error:", error);
    res.status(404).json(createApiError("not_found", "Conversation not found"));
  }
});

/**
 * PATCH /conversations/{conversationId} - Update conversation metadata (e.g., title)
 */
router.patch("/:conversationId", async (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  try {
    const { conversationId } = req.params;
    const client = await getOpenAIClient();

    const conversation = await client.conversations.update(conversationId, {
      metadata: req.body?.metadata,
    });

    console.log(`[PATCH /conversations] Updated: ${conversationId}`);
    res.json(conversation);
  } catch (error: unknown) {
    console.error("[PATCH /conversations/:id] Error:", error);
    res.status(500).json(createApiError("server_error", "Failed to update conversation"));
  }
});

/**
 * DELETE /conversations/{conversationId} - Delete conversation
 */
router.delete("/:conversationId", async (req: Request, res: Response<ConversationDeletedResource | ApiErrorResponse>) => {
  try {
    const { conversationId } = req.params;
    const sessionId = getSessionId(req);
    const client = await getOpenAIClient();

    const result = await client.conversations.delete(conversationId);

    // Remove from tracking
    untrackConversation(sessionId, conversationId);

    console.log(`[DELETE /conversations] Deleted: ${conversationId}`);
    res.json(result);
  } catch (error: unknown) {
    console.error("[DELETE /conversations/:id] Error:", error);
    res.status(500).json(createApiError("server_error", "Failed to delete conversation"));
  }
});

export default router;
