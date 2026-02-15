/**
 * Mock Items Routes - Read-only: List conversation messages
 */

import { type Request, type Response, Router } from "express";
import type { Message } from "openai/resources/conversations/conversations";

import { requireSession } from "../../middleware";
import { mockStore } from "../../providers/mock";
import { type ApiErrorResponse, createApiError } from "../../utils/createApiError";

interface ItemsListResponse {
  data: Message[];
  first_id: string;
  last_id: string;
  has_more: boolean;
  object: "list";
}

const router = Router({ mergeParams: true });
router.use(requireSession);

/**
 * GET /conversations/:conversationId/items - List messages
 * Query: limit (1-100), after (cursor), order (asc|desc)
 */
router.get("/", (req: Request, res: Response<ItemsListResponse | ApiErrorResponse>) => {
  const { conversationId } = req.params;
  const { limit = "20", after, order = "desc" } = req.query;

  if (!mockStore.getConversation(conversationId)) {
    res.status(404).json(createApiError("not_found", "Conversation not found"));
    return;
  }

  let items = mockStore.getItems(conversationId);

  // Order: desc = newest first (reverse), asc = oldest first
  if (order === "desc") {
    items = [...items].reverse();
  }

  // Cursor pagination
  if (after) {
    const idx = items.findIndex((i) => i.id === after);
    if (idx !== -1) {
      items = items.slice(idx + 1);
    }
  }

  // Limit
  const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
  const hasMore = items.length > limitNum;
  items = items.slice(0, limitNum);

  console.log(`[Mock] GET /conversations/${conversationId}/items: ${items.length} items`);

  res.json({
    data: items,
    first_id: items[0]?.id || "",
    last_id: items[items.length - 1]?.id || "",
    has_more: hasMore,
    object: "list",
  });
});

export default router;
