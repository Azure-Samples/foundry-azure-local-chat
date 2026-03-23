// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Mock streaming event generator for Microsoft Foundry format
 * Matches the ResponseStreamEvent format from OpenAI SDK
 */
import { generateId } from "../../../utils/id";
import type { ResponseStreamEvent } from "../../types";

// Helper to create mock Response object with required fields
const createMockResponse = (
  id: string,
  conversationId: string,
  status: "in_progress" | "completed",
  output: unknown[] = [],
) => ({
  id,
  object: "response" as const,
  created_at: Math.floor(Date.now() / 1000),
  status,
  background: false,
  error: undefined,
  incomplete_details: undefined,
  instructions: undefined,
  max_output_tokens: undefined,
  model: "gpt-4",
  output,
  output_text: status === "completed" ? ((output[0] as { content?: { text?: string }[] })?.content?.[0]?.text ?? "") : "",
  parallel_tool_calls: true,
  previous_response_id: undefined,
  reasoning: undefined,
  service_tier: "default" as const,
  store: true,
  temperature: 1,
  text: { format: { type: "text" as const } },
  tool_choice: "auto" as const,
  tools: [],
  top_p: 1,
  truncation: "disabled" as const,
  usage: undefined,
  user: undefined,
  metadata: {},
  conversation: { id: conversationId },
});

/**
 * Generate mock streaming events that match Microsoft Foundry/OpenAI format
 */
export async function* generateMockStreamEvents(
  responseId: string,
  conversationId: string,
  text: string,
  delayMs = 50,
): AsyncGenerator<ResponseStreamEvent> {
  const messageId = generateId("msg");

  // response.created
  yield {
    type: "response.created",
    sequence_number: 0,
    response: createMockResponse(responseId, conversationId, "in_progress"),
  } as unknown as ResponseStreamEvent;

  // response.in_progress
  yield {
    type: "response.in_progress",
    sequence_number: 1,
    response: createMockResponse(responseId, conversationId, "in_progress"),
  } as unknown as ResponseStreamEvent;

  // response.output_item.added (message item)
  yield {
    type: "response.output_item.added",
    sequence_number: 2,
    output_index: 0,
    item: {
      type: "message",
      id: messageId,
      role: "assistant",
      status: "in_progress",
      content: [],
    },
  } as ResponseStreamEvent;

  // Stream text in chunks using response.output_text.delta
  const words = text.split(" ");
  let sequenceNumber = 3;

  for (const word of words) {
    yield {
      type: "response.output_text.delta",
      sequence_number: sequenceNumber++,
      output_index: 0,
      content_index: 0,
      item_id: messageId,
      delta: word + " ",
    } as ResponseStreamEvent;

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // response.output_text.done
  yield {
    type: "response.output_text.done",
    sequence_number: sequenceNumber++,
    output_index: 0,
    content_index: 0,
    item_id: messageId,
    text,
    logprobs: [],
  } as ResponseStreamEvent;

  // response.output_item.done
  const completedMessage = {
    type: "message" as const,
    id: messageId,
    role: "assistant" as const,
    status: "completed" as const,
    content: [{ type: "output_text" as const, text, annotations: [], logprobs: [] }],
  };

  yield {
    type: "response.output_item.done",
    sequence_number: sequenceNumber++,
    output_index: 0,
    item: completedMessage,
  } as ResponseStreamEvent;

  // response.completed (not response.done)
  yield {
    type: "response.completed",
    sequence_number: sequenceNumber,
    response: createMockResponse(responseId, conversationId, "completed", [completedMessage]),
  } as unknown as ResponseStreamEvent;
}
