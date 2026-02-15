/**
 * Streaming Chat API
 *
 * ATOMIC PATTERN:
 * - Single POST /responses call with stream=true
 * - Server streams response chunks via SSE
 * - No separate "add user message" step
 * - If aborted, nothing is persisted
 */

import type { StreamCallbacks } from "@/types/chat.types";
import type { StreamingChatApi } from "@/types/chat.types";
import { Abort_ErrorName } from "@/utils/errors";

import { ChatApiService } from "./chatApi";

class StreamingChatApiService extends ChatApiService implements StreamingChatApi {
  protected override log = (...args: unknown[]): void => {
    if (this.debug) {
      console.log("[StreamingAPI]", ...args);
    }
  };

  sendMessageStreaming = async (message: string, callbacks: StreamCallbacks, title?: string): Promise<void> => {
    this.log("sendMessageStreaming:", message.substring(0, 30));

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const conversationTitle = title || (message.length > 50 ? message.substring(0, 47) + "..." : message);

      // ATOMIC: Single call to /responses with stream=true
      // Server handles: conversation creation (if needed) + user message + streaming response
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: message,
          conversationId: this.currentConversationId,
          title: this.currentConversationId ? undefined : conversationTitle,
          stream: true,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.statusText}`);
      }

      await this.handleStreamResponse(response, callbacks);
    } catch (error) {
      if ((error as Error).name === Abort_ErrorName) {
        this.log("Stream aborted by user");
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
          if (!line.trim() || !line.startsWith("data: ")) {
            continue;
          }

          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            callbacks.onDone?.(fullResponse);
            return;
          }

          try {
            const event = JSON.parse(data);

            // Handle conversation info (sent first by server)
            if (event.type === "conversation") {
              this.currentConversationId = event.conversationId;
              callbacks.onStart?.({
                conversationId: event.conversationId,
                isNew: event.isNew,
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

              // Log unhandled events in debug
              default:
                this.log("Unhandled event type:", event.type);
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
