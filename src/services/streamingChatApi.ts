// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Streaming Chat API
 *
 * ATOMIC PATTERN:
 * - Single POST /responses call with stream=true
 * - Server streams response chunks via SSE
 * - No separate "add user message" step
 * - If aborted, nothing is persisted
 */

import type { SendMessageOptions, StreamCallbacks } from "@/types/chat.types";
import type { StreamingChatApi } from "@/types/chat.types";
import { generateTitle } from "@/utils/conversation-helpers";
import { isAbortError } from "@/utils/errors";

import { ChatApiService } from "./chatApi";

class StreamingChatApiService extends ChatApiService implements StreamingChatApi {
  sendMessageStreaming = async (
    { message, conversationId, title }: SendMessageOptions,
    callbacks: StreamCallbacks,
  ): Promise<void> => {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const conversationTitle = title || generateTitle(message);

      const response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: message,
          conversationId: conversationId || undefined,
          title: conversationId ? undefined : conversationTitle,
          stream: true,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.statusText}`);
      }

      await this.handleStreamResponse(response, callbacks);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      console.error("[StreamingAPI] Error:", error);
      callbacks.onError?.({
        code: "stream_error",
        message: (error as Error).message,
      });
    } finally {
      this.abortController = null;
    }
  };

  protected handleStreamResponse = async (response: Response, callbacks: StreamCallbacks): Promise<void> => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data:")) {
            continue;
          }

          const data = trimmedLine.slice(5).trim();
          if (data === "[DONE]") {
            callbacks.onDone?.(fullResponse);
            return;
          }

          try {
            const event = JSON.parse(data);

            // Handle conversation info (sent first by server)
            if (event.type === "conversation") {
              callbacks?.onStart?.({
                conversationId: event.conversationId,
              });
              continue;
            }

            // Handle Azure AI Foundry response stream events
            switch (event.type) {
              // Text content delta - the actual streaming text chunks
              case "response.output_text.delta":
                if (event.delta) {
                  fullResponse += event.delta;
                  callbacks.onChunk?.(event.delta);
                }
                break;

              // Output item delta (alternative format)
              case "response.output_item.delta":
                if (event.delta?.type === "output_text" && event.delta.text) {
                  fullResponse += event.delta.text;
                  callbacks.onChunk?.(event.delta.text);
                }
                break;

              // Content part delta (another format)
              case "response.content_part.delta":
                if (event.delta?.type === "text_delta" && event.delta.text) {
                  fullResponse += event.delta.text;
                  callbacks.onChunk?.(event.delta.text);
                }
                break;

              // Output item completed
              case "response.output_item.done":
                if (event.item?.type === "message" && event.item.content) {
                  for (const content of event.item.content) {
                    if (content.type === "output_text" && content.text) {
                      fullResponse = content.text;
                    }
                  }
                }
                break;

              // Response completed
              case "response.done":
              case "response.completed":
                callbacks.onDone?.(fullResponse);
                return;

              // Error
              case "error":
                callbacks.onError?.({
                  code: "stream_error",
                  message: event.error?.message || "Stream error",
                });
                return;

              default:
                break;
            }
          } catch {
            console.warn("[StreamingAPI] Failed to parse SSE event:", data);
          }
        }
      }

      callbacks.onDone?.(fullResponse);
    } finally {
      reader.releaseLock();
    }
  };
}

export const streamingChatApi = new StreamingChatApiService();
