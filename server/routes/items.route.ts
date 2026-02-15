/**
 * Items Routes - List conversation items (messages)
 * Pure read-only proxy to Azure AI SDK
 *
 * With the ATOMIC PATTERN:
 * - Messages are only persisted after response completes
 * - No orphan messages possible
 * - No need for `has_in_progress` tracking
 * - Items are always in pairs (user + assistant)
 */

import { Request, Response, Router } from "express";
import type { Message } from "openai/resources/conversations/conversations";
import type { ConversationItem, ItemListParams } from "openai/resources/conversations/items";

import { requireSession } from "../middleware";
import { getOpenAIClient } from "../services";
import { createApiError } from "../utils/createApiError";

const router = Router({ mergeParams: true });
router.use(requireSession);

/**
 * Type guard for message items (excludes tool calls, file_search, etc.)
 */
const isMessage = (item: ConversationItem): item is Message => item.type === "message" && "role" in item && "content" in item;

/**
 * GET /conversations/{conversationId}/items - List conversation items
 *
 * Query params (following OpenAI pagination):
 * - limit: Max items to return (1-100, default 20)
 * - after: Cursor for pagination (get items after this ID)
 * - order: 'asc' or 'desc' (default 'desc' - newest first)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { limit, after, order } = req.query;

    const client = await getOpenAIClient();

    // Build pagination params
    const listParams: ItemListParams = {
      order: (order as "asc" | "desc") || "desc",
    };
    if (limit) {
      listParams.limit = Math.min(parseInt(limit as string, 10), 100);
    }
    if (after) {
      listParams.after = after as string;
    }

    const response = await client.conversations.items.list(conversationId, listParams);
    console.log(`[Items GET] ${conversationId}: ${response.data.length} items`);

    // Filter to only messages for the response
    const messages = response.data.filter(isMessage);

    res.json({
      data: messages,
      last_id: response.last_id,
      has_more: response.has_more,
      object: "list",
    });
  } catch (error: unknown) {
    console.error("[Items GET] Error:", error);
    res.status(500).json(createApiError("server_error", "Failed to list items"));
  }
});

export default router;
