/**
 * Responses Routes - Atomic message handling
 *
 * ATOMIC PATTERN:
 * - Client sends user message to POST /responses
 * - Server creates conversation (if needed), adds user message, generates response
 * - Both user message AND assistant response are persisted atomically
 * - If request fails/aborts, nothing is persisted (no orphan messages)
 */

import { Response, Router } from "express";

import { type AbortableRequest, abortableRequest, getSessionId, requireSession } from "../middleware";
import { getProvider } from "../providers";
import { createApiError, extractApiError, isAbortError } from "../utils/createApiError";
import { config } from "../utils/datasources";
import { handleStreamingResponse } from "../utils/streaming";

const router = Router();
router.use(requireSession);

/**
 * POST /responses - Send message and get response (ATOMIC)
 *
 * Request body:
 * - input: string (required) - The user message
 * - conversationId?: string - Existing conversation ID (creates new if not provided)
 * - stream?: boolean - Enable streaming response (can be overridden by server config)
 */
router.post("/", abortableRequest, async (req: AbortableRequest, res: Response) => {
  try {
    const { input, conversationId, stream: requestStream = false } = req.body;

    if (!input || typeof input !== "string") {
      res.status(400).json(createApiError("invalid_request", "Input message required"));
      return;
    }

    // Use server config for streaming (overrides client request)
    const stream = config.isStreamingEnabled() && requestStream;
    const sessionId = getSessionId(req);

    const result = await getProvider().createResponse({
      input,
      conversationId,
      sessionId,
      stream,
      signal: req.abortSignal,
    });

    if (result.stream) {
      await handleStreamingResponse(
        { req, res, conversationId: result.conversationId, isNew: result.isNew },
        result.stream,
      );
      result.onStreamComplete?.();
    } else {
      res.json({
        conversationId: result.conversationId,
        isNew: result.isNew,
        response: result.response,
      });
    }
  } catch (error: unknown) {
    if (isAbortError(error)) {
      console.log("[POST /responses] Request aborted");
      return;
    }
    console.error("[POST /responses] Error:", error);
    if (!res.headersSent) {
      const { status, body } = extractApiError(error);
      res.status(status).json(body);
    }
  }
});

export default router;
