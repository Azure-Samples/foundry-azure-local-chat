/**
 * Chat Component
 *
 * Pure chat UI component for displaying the current conversation.
 * Displays a welcome screen with prompt starters, handles message sending,
 * and shows the conversation messages.
 *
 * Features:
 * - Welcome screen with customizable prompt starters
 * - Real-time loading states with morse code animation
 * - Stop/cancel functionality for in-flight requests
 * - Message display with streaming support
 * - Accessible with ARIA labels and keyboard support
 */
import * as React from "react";

import { mergeClasses, Title2 } from "@fluentui/react-components";
import { CopilotChat, useCopilotMode } from "@fluentui-copilot/react-copilot";

import { AppIcon } from "@/components/AppIcon/AppIcon";
import { ChatMessageItem } from "@/components/ChatMessage/ChatMessage";
import { Disclaimer } from "@/components/Disclaimer/Disclaimer";
import { InputArea, type InputAreaRef } from "@/components/InputArea/InputArea";
import { LoadingMessage } from "@/components/Progress/Progress";
import { PromptStarters } from "@/components/PromptStarters/PromptStarters";
import { config } from "@/config/constants";
import { useAutoScroll } from "@/hooks/useChatEffects";
import { getText } from "@/localization/en";
import { useGlobalStaticStyles, useGlobalStyles } from "@/styles/globalStyles";
import type { ChatHandlers, ChatMessage, ChatState } from "@/types/chat.types";

// ============================================================================
// Main Component
// ============================================================================

/**
 * Main Chat component that handles the current conversation UI.
 * Displays messages, input area, and handles message sending.
 */
export const Chat = ({
  activeConversation,
  messages,
  isInitializing,
  isLoading,
  handleSendMessage,
  handleStop,
}: ChatState & ChatHandlers) => {
  useGlobalStaticStyles();

  // -- Styles --
  const mode = useCopilotMode();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<InputAreaRef>(null);
  const layoutStyles = useGlobalStyles("layout");
  const chatStyles = useGlobalStyles("chat");
  const textStyles = useGlobalStyles("text");

  // -- Derived State --
  const isFirstLoad = !activeConversation && !isInitializing && messages.length === 0;
  const avatarIcon = React.useMemo(
    () => <AppIcon showKey="chat.showMessageIcon" iconKey="chat.messageIcon" size={mode === "canvas" ? 24 : 20} />,
    [mode],
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // Auto-scroll to bottom when messages change
  useAutoScroll(scrollRef, messages);

  // ============================================================================
  // Render
  // ============================================================================

  // Welcome screen (no messages yet)
  if (isFirstLoad && !isLoading) {
    return (
      <div className={mergeClasses(layoutStyles.root, layoutStyles.contentArea)}>
        <div className={chatStyles.welcomeContainer}>
          <Title2 className={mergeClasses(chatStyles.welcomeTitle, textStyles.centered)}>{getText("chat.welcomeTitle")}</Title2>

          <InputArea ref={inputRef} isLoading={isLoading} onSubmit={handleSendMessage} onStop={handleStop} isWelcome />

          {config.isEnabled("chat.showPromptStarters") && <PromptStarters onPromptClick={handleSendMessage} />}
        </div>

        <Disclaimer />
      </div>
    );
  }

  // Chat conversation view
  return (
    <div className={mergeClasses(layoutStyles.root, layoutStyles.contentArea)}>
      <div
        className={layoutStyles.mainContent}
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={getText("chat.ariaLabel")}
      >
        <CopilotChat className={mergeClasses(layoutStyles.centeredContent, chatStyles.container)}>
          {messages.map((msg: ChatMessage) => (
            <ChatMessageItem key={msg.id} message={msg} avatar={avatarIcon} />
          ))}
          {/* Show loading message only when loading AND no streaming message exists */}
          {isLoading && !messages.some((m: ChatMessage) => m.status === "in_progress") && (
            <LoadingMessage avatar={avatarIcon} />
          )}
          {/* Show loading when conversation is active but no messages loaded yet (refresh case) */}
          {!isLoading && activeConversation && messages.length === 0 && <LoadingMessage avatar={avatarIcon} />}
        </CopilotChat>
      </div>

      <InputArea ref={inputRef} isLoading={isLoading} onSubmit={handleSendMessage} onStop={handleStop} />

      <Disclaimer />
    </div>
  );
};
