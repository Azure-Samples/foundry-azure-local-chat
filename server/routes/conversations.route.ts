// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Conversations Routes
 *
 * NOTE: Conversation creation is now handled atomically via POST /responses
 * This route only handles: listing, getting, updating, and deleting conversations
 */

import { Request, Response, Router } from "express";

import { getSessionId, requireSession } from "../middleware";
import { type Conversation, type DeleteConversationResult, getProvider } from "../providers";
import { type ApiErrorResponse, createApiError, extractApiError } from "../utils/createApiError";

const router = Router();
router.use(requireSession);

/**
 * POST /conversations/_seed - Seed test data (mock only)
 * Registered before /:conversationId to avoid param conflict
 */
router.post("/_seed", async (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  const provider = getProvider();
  if (!provider.seed) {
    res.status(404).json(createApiError("not_found", "Seed only available in mock mode"));
    return;
  }
  const conv = await provider.seed(getSessionId(req), req.body?.messageCount || 25);
  console.log(`[Mock] Seeded: ${conv.id}`);
  res.status(201).json(conv);
});

/**
 * DELETE /conversations/_clear - Clear all mock data (mock only)
 * Registered before /:conversationId to avoid param conflict
 */
router.delete("/_clear", async (_req: Request, res: Response<{ cleared: boolean } | ApiErrorResponse>) => {
  const provider = getProvider();
  if (!provider.clear) {
    res.status(404).json(createApiError("not_found", "Clear only available in mock mode"));
    return;
  }
  await provider.clear();
  res.json({ cleared: true });
});

/**
 * GET /conversations - List all conversations for session
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const conversations = await getProvider().listConversations(getSessionId(req));
    console.log(`[GET /conversations]: ${conversations.length} found`);
    res.json(conversations);
  } catch (error: unknown) {
    console.error("[GET /conversations] Error:", error);
    const { status, body } = extractApiError(error);
    res.status(status).json(body);
  }
});

/**
 * POST /conversations - Create conversation (legacy endpoint)
 *
 * @deprecated Use POST /responses which creates conversation atomically with first message
 */
router.post("/", async (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  try {
    const sessionId = getSessionId(req);
    const title = req.body?.metadata?.title;
    const conversation = await getProvider().createConversation({ sessionId, title });
    console.log(`[POST /conversations]: ${conversation.id}`);
    res.status(201).json(conversation);
  } catch (error: unknown) {
    console.error("[POST /conversations] Error:", error);
    const { status, body } = extractApiError(error);
    res.status(status).json(body);
  }
});

/**
 * GET /conversations/{conversationId} - Get conversation
 */
router.get("/:conversationId", async (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  try {
    const conversation = await getProvider().getConversation(req.params.conversationId);
    if (!conversation) {
      res.status(404).json(createApiError("not_found", "Conversation not found"));
      return;
    }
    res.json(conversation);
  } catch (error: unknown) {
    console.error("[GET /conversations/:id] Error:", error);
    const { status, body } = extractApiError(error);
    res.status(status).json(body);
  }
});

/**
 * PATCH /conversations/{conversationId} - Update conversation metadata (e.g., title)
 */
router.patch("/:conversationId", async (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  try {
    const conversation = await getProvider().updateConversation(req.params.conversationId, req.body?.metadata || {});
    if (!conversation) {
      res.status(404).json(createApiError("not_found", "Conversation not found"));
      return;
    }
    console.log(`[PATCH /conversations] Updated: ${req.params.conversationId}`);
    res.json(conversation);
  } catch (error: unknown) {
    console.error("[PATCH /conversations/:id] Error:", error);
    const { status, body } = extractApiError(error);
    res.status(status).json(body);
  }
});

/**
 * DELETE /conversations/{conversationId} - Delete conversation
 */
router.delete("/:conversationId", async (req: Request, res: Response<DeleteConversationResult | ApiErrorResponse>) => {
  try {
    const result = await getProvider().deleteConversation(req.params.conversationId, getSessionId(req));
    res.json(result);
  } catch (error: unknown) {
    console.error("[DELETE /conversations/:id] Error:", error);
    const { status, body } = extractApiError(error);
    res.status(status).json(body);
  }
});

export default router;
