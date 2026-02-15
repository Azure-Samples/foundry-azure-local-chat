/**
 * Chat Component
 *
 * A complete chat interface using Fluent AI Copilot components.
 * Displays a welcome screen with prompt starters, handles message sending,
 * and shows conversation history.
 *
 * Features:
 * - Welcome screen with customizable prompt starters
 * - Real-time loading states with morse code animation
 * - Stop/cancel functionality for in-flight requests
 * - Conversation history management
 * - Accessible with ARIA labels and keyboard support
 */
import * as React from "react";

import { Button, mergeClasses, Title2 } from "@fluentui/react-components";
import { PanelLeftContract20Regular } from "@fluentui/react-icons";
import { CopilotChat, useCopilotMode } from "@fluentui-copilot/react-copilot";

import { AppIcon } from "@/components/AppIcon/AppIcon";
import { ChatHistory } from "@/components/ChatHistory/ChatHistory";
import { ChatMessageItem } from "@/components/ChatMessage/ChatMessage";
import { Disclaimer } from "@/components/Disclaimer/Disclaimer";
import { InputArea, type InputAreaRef } from "@/components/InputArea/InputArea";
import { LoadingMessage } from "@/components/Progress/Progress";
import { PromptStarters } from "@/components/PromptStarters/PromptStarters";
import { config } from "@/config/constants";
import { useAutoScroll } from "@/hooks/useChatEffects";
import { getText } from "@/localization/en";
import { useGlobalStaticStyles, useGlobalStyles } from "@/styles/globalStyles";
import type { UseChatConversationReturn } from "@/types/chat.types";
import type { ChatConversation, ChatMessage } from "@/types/chat.types";

// Sidebar animation duration (matches fluentui drawer animation)
const SIDEBAR_ANIMATION_DURATION = 250;

// ============================================================================
// Main Component
// ============================================================================

/**
 * Main Chat component that handles the complete chat experience.
 */
export const Chat = ({
  conversations,
  activeConversation,
  messages,
  isHistoryOpen,
  isInitializing,
  isLoading,
  onHistoryOpenChange,
  handleNewChat,
  handleSelectConversation,
  handleDeleteConversation,
  handleRenameConversation,
  handleSendMessage,
  handleStop,
}: UseChatConversationReturn) => {
  useGlobalStaticStyles();

  // -- Styles --
  const mode = useCopilotMode();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<InputAreaRef>(null);
  const layoutStyles = useGlobalStyles("layout");
  const chatStyles = useGlobalStyles("chat");
  const textStyles = useGlobalStyles("text");

  // State to delay showing toggle button until sidebar animation completes
  const [showToggleButton, setShowToggleButton] = React.useState(!isHistoryOpen);

  // Handle sidebar open/close with animation delay for toggle button
  React.useEffect(() => {
    if (isHistoryOpen) {
      // Hide toggle immediately when opening
      setShowToggleButton(false);
    } else {
      // Delay showing toggle until close animation finishes
      const timer = setTimeout(() => {
        setShowToggleButton(true);
      }, SIDEBAR_ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isHistoryOpen]);

  // -- Derived State --
  const isFirstLoad = !activeConversation && !isInitializing && messages.length === 0;
  const avatarIcon = React.useMemo(
    () => <AppIcon showKey="chat.showMessageIcon" iconKey="chat.messageIcon" size={mode === "canvas" ? 24 : 20} />,
    [mode],
  );

  // Wrap handleNewChat to focus input after clearing
  const handleNewChatWithFocus = React.useCallback(() => {
    handleNewChat();
    // Focus input after React re-renders the welcome screen
    // Use requestAnimationFrame for more reliable timing
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [handleNewChat]);

  console.log("[Chat] Render decision:", {
    isFirstLoad,
    hasActiveConv: !!activeConversation,
    isInitializing,
    messageCount: messages.length,
    isLoading,
  });

  // ============================================================================
  // Effects
  // ============================================================================

  // Auto-scroll to bottom when messages change
  useAutoScroll(scrollRef, messages);

  // ============================================================================
  // Render
  // ============================================================================

  // Shared sidebar component
  const sidebar = (
    <ChatHistory
      open={isHistoryOpen}
      onOpenChange={onHistoryOpenChange}
      conversations={conversations}
      activeConversationId={(activeConversation as ChatConversation | null)?.id ?? undefined}
      onNewChat={handleNewChatWithFocus}
      onSelectConversation={handleSelectConversation}
      onDeleteConversation={handleDeleteConversation}
      onRenameConversation={handleRenameConversation}
    />
  );

  // Sidebar toggle button (shown when sidebar is closed, after animation)
  const sidebarToggle = showToggleButton && !isHistoryOpen && (
    <div className={chatStyles.sidebarToggle}>
      <Button
        appearance="transparent"
        icon={<PanelLeftContract20Regular />}
        onClick={() => onHistoryOpenChange(true)}
        aria-label="Open chat history"
      />
    </div>
  );

  // Welcome screen (no messages yet)
  if (isFirstLoad && !isLoading) {
    return (
      <div className={layoutStyles.pageWrapper}>
        {sidebar}
        <div className={mergeClasses(layoutStyles.root, layoutStyles.contentArea)}>
          {sidebarToggle}
          <div className={chatStyles.welcomeContainer}>
            <Title2 className={mergeClasses(chatStyles.welcomeTitle, textStyles.centered)}>
              {getText("chat.welcomeTitle")}
            </Title2>

            <InputArea ref={inputRef} isLoading={isLoading} onSubmit={handleSendMessage} onStop={handleStop} isWelcome />

            {config.isEnabled("chat.showPromptStarters") && <PromptStarters onPromptClick={handleSendMessage} />}
          </div>

          <Disclaimer />
        </div>
      </div>
    );
  }

  // Chat conversation view
  return (
    <div className={layoutStyles.pageWrapper}>
      {sidebar}
      <div className={mergeClasses(layoutStyles.root, layoutStyles.contentArea)}>
        {sidebarToggle}
        <div
          className={layoutStyles.mainContent}
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={getText("chat.ariaLabel")}
        >
          <CopilotChat className={mergeClasses(layoutStyles.centeredContent, chatStyles.container)}>
            {messages.map((msg: ChatMessage) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                avatar={avatarIcon}
              />
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
    </div>
  );
};
