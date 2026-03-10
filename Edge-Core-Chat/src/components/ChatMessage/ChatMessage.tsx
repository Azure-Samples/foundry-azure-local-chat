import React from "react";

import type { Slot } from "@fluentui/react-components";
import { CopilotMessage, UserMessage } from "@fluentui-copilot/react-copilot";

import { MarkdownRenderer } from "@/components/MarkdownRenderer/MarkdownRenderer";
import { StreamingProgress } from "@/components/Progress/Progress";
import { getText } from "@/localization/en";
import { useGlobalStyles } from "@/styles/globalStyles";
import type { Message } from "@/types/api.types";

interface ChatMessageProps {
  message: Message;
  avatar: NonNullable<Slot<"div">>;
  assistantName?: string;
}

/**
 * ChatMessage component
 * Renders a single chat message (user or assistant) with markdown support for assistant messages
 */
export const ChatMessageItem: React.FC<ChatMessageProps> = ({
  message,
  avatar,
  assistantName = getText("chat.name"),
}) => {
  const styles = useGlobalStyles("text");
  
  // Extract text content from message (handles "text", "input_text", "output_text")
  const textContent = message.content.find(c => 
    (c.type === "text" || c.type === "input_text" || c.type === "output_text") && "text" in c
  );
  const content = textContent && "text" in textContent ? textContent.text : "";

  if (message.role === "user") {
    return (
      <UserMessage key={message.id}>
        <span className={styles.preserveWhitespace}>{content}</span>
      </UserMessage>
    );
  }

  // Assistant message with optional streaming progress
  const isStreaming = message.status === "in_progress";

  return (
    <CopilotMessage key={message.id} name={assistantName} avatar={avatar}>
      {content && <MarkdownRenderer content={content} isStreaming={isStreaming} />}
      {isStreaming && <StreamingProgress />}
    </CopilotMessage>
  );
};
