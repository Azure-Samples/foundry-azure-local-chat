/**
 * Mock Responses Routes - Atomic pattern interceptor
 *
 * Intercepts POST /responses and returns mock AI responses.
 * Uses the same store as other mock routes.
 */

import { type Request, type Response, Router } from "express";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

import { getSessionId, requireSession } from "../../middleware";
import { generateMockStreamEvents, mockStore } from "../../providers/mock";
import { type ApiErrorResponse, createApiError } from "../../utils/createApiError";
import { handleStreamingResponse } from "../../utils/streaming";

const router = Router();
router.use(requireSession);

/**
 * POST /responses - Atomic: conversation + user message + AI response
 */
router.post("/", async (req: Request, res: Response<OpenAIResponse | ApiErrorResponse>) => {
  const { input, conversationId, title, stream = false } = req.body;

  if (!input || typeof input !== "string") {
    res.status(400).json(createApiError("invalid_request", "Input message required"));
    return;
  }

  // Get or create conversation
  let conv = conversationId ? mockStore.getConversation(conversationId) : undefined;
  const isNew = !conv;

  if (!conv) {
    conv = mockStore.createConversation(getSessionId(req), title || input.substring(0, 50));
  }

  // Add user message
  mockStore.addMessage(conv.id, "user", input);

  // Generate mock response
  const responseId = mockStore.generateId("resp");
  const mockText = `Mock AI response to: "${input.substring(0, 50)}${input.length > 50 ? "..." : ""}"`;

  if (stream) {
    console.log(`[Mock] POST /responses (stream): ${conv.id}`);
    const streamEvents = generateMockStreamEvents(responseId, conv.id, mockText);

    await handleStreamingResponse({ req, res, conversationId: conv.id, isNew }, streamEvents);

    // Add assistant message after stream completes
    mockStore.addMessage(conv.id, "assistant", mockText);
  } else {
    // Simulate delay
    await new Promise((r) => setTimeout(r, 300));

    // Add assistant message
    const assistantMsg = mockStore.addMessage(conv.id, "assistant", mockText);

    console.log(`[Mock] POST /responses: ${conv.id}, isNew: ${isNew}`);

    res.json({
      conversationId: conv.id,
      isNew,
      response: {
        id: responseId,
        status: "completed",
        output: [assistantMsg],
      },
    } as unknown as OpenAIResponse);
  }
});

export default router;
