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
import { getAgentRequestOptions, getOpenAIClient, trackConversation } from "../services";
import { createApiError, isAbortError } from "../utils/createApiError";
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
    const { input, conversationId: providedConversationId, stream: requestStream = false } = req.body;

    if (!input || typeof input !== "string") {
      res.status(400).json(createApiError("invalid_request", "Input message required"));
      return;
    }

    // Use server config for streaming (overrides client request)
    const stream = config.isStreamingEnabled() && requestStream;

    const client = await getOpenAIClient();
    const sessionId = getSessionId(req);
    const isNew = !providedConversationId;
    const signal = req.abortSignal;
    const requestOptions = getAgentRequestOptions(signal);

    // Create conversation first if needed
    let conversationId = providedConversationId;
    if (isNew) {
      const title = input.slice(0, 50);
      const conversation = await client.conversations.create({ metadata: { title, sessionId } }, { signal });
      conversationId = conversation.id;
      trackConversation(sessionId, conversationId);
      console.log(`[POST /responses] Created new conversation: ${conversationId}`);
    }

    console.log(`[POST /responses] Sending to conversation: ${conversationId}, stream: ${stream}`);

    // Stream vs non-stream requires separate calls for TypeScript type narrowing
    if (stream) {
      const streamResponse = await client.responses.create(
        { input, conversation: conversationId, stream: true },
        requestOptions,
      );
      await handleStreamingResponse({ req, res, conversationId: conversationId!, isNew }, streamResponse);
    } else {
      const response = await client.responses.create({ input, conversation: conversationId }, requestOptions);
      console.log(`[POST /responses] Response generated, status: ${response.status}`);
      res.json({
        conversationId,
        isNew,
        response: {
          id: response.id,
          status: response.status,
          output: response.output?.filter((item) => item.type === "message") || [],
        },
      });
    }
  } catch (error: unknown) {
    // Client abort is expected - handle silently
    if (isAbortError(error)) {
      console.log("[POST /responses] Request aborted");
      return;
    }
    console.error("[POST /responses] Error:", error);
    if (!res.headersSent) {
      res.status(500).json(createApiError("server_error", "Failed to generate response"));
    }
  }
});

export default router;
