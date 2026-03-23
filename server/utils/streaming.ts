// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Streaming utilities for Microsoft Foundry Responses API
 *
 * Handles Server-Sent Events (SSE) format for streaming responses.
 * Event types follow Microsoft Foundry format:
 * - response.created: Initial response creation
 * - response.in_progress: Response is being generated
 * - response.output_text.delta: Text chunk (contains delta.text)
 * - response.output_item.done: Output item completed
 * - response.done: Full response completed
 */

import type { Response } from "express";

import type { AbortableRequest } from "../middleware";

export interface StreamingContext {
  req: AbortableRequest;
  res: Response;
  conversationId: string;
  isNew: boolean;
}

export interface StreamingResult {
  success: boolean;
  aborted?: boolean;
  error?: string;
}

/**
 * Setup SSE headers for streaming response
 */
export const setupStreamingHeaders = (res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
};

/**
 * Send an SSE event
 */
export const sendSSEEvent = (res: Response, data: unknown): void => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Send conversation info event (custom event for our client)
 */
export const sendConversationEvent = (res: Response, conversationId: string, isNew: boolean): void => {
  sendSSEEvent(res, { type: "conversation", conversationId, isNew });
};

/**
 * Send stream end marker
 */
export const sendStreamEnd = (res: Response): void => {
  res.write(`data: [DONE]\n\n`);
  res.end();
};

/**
 * Send error event
 */
export const sendErrorEvent = (res: Response, error: string): void => {
  sendSSEEvent(res, { type: "error", error });
};

/**
 * Handle streaming response from Azure AI or mock
 * Uses middleware's abort signal for client disconnect detection
 */
export async function handleStreamingResponse(
  ctx: StreamingContext,
  stream: AsyncIterable<unknown>,
): Promise<StreamingResult> {
  const { req, res, conversationId, isNew } = ctx;
  const isClientConnected = () => req.isClientConnected?.() ?? !req.socket?.destroyed;

  setupStreamingHeaders(res);

  try {
    // Send conversation info first
    sendConversationEvent(res, conversationId, isNew);

    for await (const event of stream) {
      if (!isClientConnected()) {
        console.log("[Streaming] Client disconnected, stopping stream");
        return { success: false, aborted: true };
      }
      sendSSEEvent(res, event);
    }

    if (isClientConnected()) {
      sendStreamEnd(res);
    } else {
      res.end();
    }

    return { success: true };
  } catch (error) {
    if (!isClientConnected()) {
      console.log("[Streaming] Stream aborted due to client disconnect");
      return { success: false, aborted: true };
    }

    console.error("[Streaming] Error:", error);
    if (!res.headersSent) {
      sendErrorEvent(res, "Stream failed");
    }
    res.end();

    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
