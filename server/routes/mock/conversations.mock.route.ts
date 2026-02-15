/**
 * Mock Conversations Routes - Thin interceptor using mockStore
 */

import { type Request, type Response, Router } from "express";
import type { Conversation, ConversationDeletedResource } from "openai/resources/conversations/conversations";

import { getSessionId, requireSession } from "../../middleware";
import { mockStore } from "../../providers/mock";
import { type ApiErrorResponse, createApiError } from "../../utils/createApiError";

const router = Router();
router.use(requireSession);

// GET /conversations - List all
router.get("/", (req: Request, res: Response<Conversation[] | ApiErrorResponse>) => {
  const conversations = mockStore.listConversations(getSessionId(req));
  console.log(`[Mock] GET /conversations: ${conversations.length} found`);
  res.json(conversations);
});

// POST /conversations - Create
router.post("/", (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  const title = req.body?.metadata?.title || "New Conversation";
  const conv = mockStore.createConversation(getSessionId(req), title);
  console.log(`[Mock] POST /conversations: ${conv.id}`);
  res.status(201).json(conv);
});

// GET /conversations/:id - Get one
router.get("/:conversationId", (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  const conv = mockStore.getConversation(req.params.conversationId);
  if (!conv) {
    res.status(404).json(createApiError("not_found", "Conversation not found"));
    return;
  }
  res.json(conv);
});

// PATCH /conversations/:id - Update
router.patch("/:conversationId", (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  const conv = mockStore.updateConversation(req.params.conversationId, req.body?.metadata || {});
  if (!conv) {
    res.status(404).json(createApiError("not_found", "Conversation not found"));
    return;
  }
  res.json(conv);
});

// DELETE /conversations/:id - Delete
router.delete("/:conversationId", (req: Request, res: Response<ConversationDeletedResource | ApiErrorResponse>) => {
  mockStore.deleteConversation(req.params.conversationId);
  res.json({ id: req.params.conversationId, deleted: true, object: "conversation.deleted" });
});

// POST /conversations/_seed - Test data
router.post("/_seed", (req: Request, res: Response<Conversation | ApiErrorResponse>) => {
  const conv = mockStore.seed(getSessionId(req), req.body?.messageCount || 25);
  console.log(`[Mock] Seeded: ${conv.id}`);
  res.status(201).json(conv);
});

// DELETE /conversations/_clear - Clear all
router.delete("/_clear", (_req: Request, res: Response<{ cleared: boolean }>) => {
  mockStore.clear();
  res.json({ cleared: true });
});

export default router;
