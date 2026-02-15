/**
 * ChatHistory Component
 *
 * Sidebar navigation showing list of past chat conversations.
 * Uses fluentui-copilot CopilotNav components for consistent Fluent design.
 */
import * as React from "react";

import { Button, makeStyles, tokens, useId } from "@fluentui/react-components";
import { PanelLeftContract20Regular } from "@fluentui/react-icons";
import {
  CopilotNavCategory,
  CopilotNavCategoryItem,
  CopilotNavDrawer,
  CopilotNavDrawerBody,
  CopilotNavDrawerHeader,
  CopilotNavItem,
  CopilotNavSubItem,
  CopilotNavSubItemGroup,
} from "@fluentui-copilot/react-copilot-nav";

import { AppIcon } from "@/components/AppIcon/AppIcon";
import { ChatSubItem } from "@/components/ChatHistory/ChatSubItem";
import { config } from "@/config/constants";
import type { ChatConversation } from "@/types/chat.types";

// ============================================================================
// Styles
// ============================================================================

const useStyles = makeStyles({
  drawer: {
    minWidth: "284px",
    overflowX: "hidden",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr max-content",
    alignItems: "center",
    paddingInline: tokens.spacingHorizontalXS,
    gap: tokens.spacingHorizontalS,
    fontWeight: tokens.fontWeightSemibold,
  },
  headerButton: {
    cursor: "pointer",
    backgroundColor: "transparent",
    border: "none",
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS} ${tokens.spacingVerticalXS} 0`,
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  emptyState: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
  },
  drawerBody: {
    overflowX: "hidden",
  },
});

// ============================================================================
// Types
// ============================================================================

export type ChatHistoryProps = {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when drawer open state changes */
  onOpenChange: (open: boolean) => void;
  /** List of chat conversations */
  conversations: ChatConversation[];
  /** Currently active conversation ID */
  activeConversationId?: string;
  /** Callback when creating a new chat */
  onNewChat: () => void;
  /** Callback when selecting a conversation */
  onSelectConversation: (conversationId: string) => void;
  /** Callback when deleting a conversation */
  onDeleteConversation?: (conversationId: string) => void;
  /** Callback when renaming a conversation */
  onRenameConversation?: (conversationId: string, newTitle: string) => void;
};

// ============================================================================
// Main Component
// ============================================================================

export const ChatHistory = ({
  open,
  onOpenChange,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: ChatHistoryProps) => {
  const styles = useStyles();
  const appName = config.get("app.name");
  const id = useId("copilot-nav");

  // State to show all conversations or just recent
  const [showAllConversations, setShowAllConversations] = React.useState(false);

  const handleAppHeaderClick = () => {
    onNewChat();
    // Don't close drawer - user explicitly closes it via collapse button
  };

  const handleCollapseClick = () => {
    onOpenChange(false);
  };

  const handleValueChange = (_: unknown, data: { value: string }) => {
    if (data.value === "new-chat") {
      onNewChat();
      // Don't close drawer - user explicitly closes it
    } else if (data.value === "all-conversations") {
      setShowAllConversations(true);
    } else if (data.value && !data.value.startsWith("all-")) {
      onSelectConversation(data.value);
      // Don't close drawer - user explicitly closes it
    }
  };

  // Show recent or all conversations based on state
  const displayedConversations = showAllConversations ? conversations : conversations.slice(0, 5);

  return (
    <CopilotNavDrawer
      className={styles.drawer}
      open={open}
      onOpenChange={(_, { open: isOpen }) => onOpenChange(isOpen)}
      type="inline"
      selectedValue={activeConversationId || ""}
      selectedCategoryValue="chats"
      defaultOpenCategories={["chats"]}
      onNavItemSelect={handleValueChange}
    >
      <CopilotNavDrawerHeader>
        <div className={styles.header}>
          <button className={styles.headerButton} onClick={handleAppHeaderClick} type="button">
            <AppIcon showKey="sidebar.showIcon" iconKey="sidebar.icon" size={20} />
            {appName}
          </button>
          <div style={{ flex: 1 }} />
          <Button
            appearance="transparent"
            aria-label="Collapse"
            icon={<PanelLeftContract20Regular />}
            onClick={handleCollapseClick}
          />
        </div>
      </CopilotNavDrawerHeader>

      <CopilotNavDrawerBody className={styles.drawerBody}>
        {/* New Chat */}
        <CopilotNavItem icon={<AppIcon showKey="newChat.showIcon" iconKey="newChat.icon" />} value="new-chat">
          New chat
        </CopilotNavItem>

        {/* Chats Category */}
        <CopilotNavCategory value="chats">
          <CopilotNavCategoryItem id={`${id}-chats`}>Chats</CopilotNavCategoryItem>
          <CopilotNavSubItemGroup aria-labelledby={`${id}-chats`}>
            {conversations.length > 0 ? (
              <>
                {displayedConversations
                  .filter((c) => c.id) // Filter out conversations without valid IDs
                  .map((conversation) => (
                    <ChatSubItem
                      key={conversation.id}
                      conversation={conversation}
                      onDelete={onDeleteConversation ? () => onDeleteConversation(conversation.id) : undefined}
                      onRename={
                        onRenameConversation ? (newTitle) => onRenameConversation(conversation.id, newTitle) : undefined
                      }
                    />
                  ))}
                {conversations.length > 5 && !showAllConversations && (
                  <CopilotNavSubItem value="all-conversations" appearance="all">
                    All conversations
                  </CopilotNavSubItem>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                No chat history yet.
                <br />
                Start a new conversation!
              </div>
            )}
          </CopilotNavSubItemGroup>
        </CopilotNavCategory>
      </CopilotNavDrawerBody>
    </CopilotNavDrawer>
  );
};
