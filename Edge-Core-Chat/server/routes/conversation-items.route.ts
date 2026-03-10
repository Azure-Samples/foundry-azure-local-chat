/**
 * Conversation Items Routes - List conversation items (messages)
 *
 * With the ATOMIC PATTERN:
 * - Messages are only persisted after response completes
 * - No orphan messages possible
 * - Items are always in pairs (user + assistant)
 */

import { Request, Response, Router } from "express";

import { requireSession } from "../middleware";
import { getProvider } from "../providers";
import { extractApiError } from "../utils/createApiError";

const router = Router({ mergeParams: true });
router.use(requireSession);

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
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
    const after = typeof req.query.after === "string" ? req.query.after : undefined;
    const order = req.query.order === "asc" ? "asc" : "desc";

    const result = await getProvider().listConversationItems({ conversationId, limit, after, order });

    res.json(result);
  } catch (error: unknown) {
    console.error("[ConversationItems GET] Error:", error);
    const { status, body } = extractApiError(error);
    res.status(status).json(body);
  }
});

export default router;
