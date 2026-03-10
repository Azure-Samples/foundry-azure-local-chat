/**
 * ChatHistoryItem Component
 *
 * Individual item in the chat history list.
 * Shows conversation title, timestamp, and actions.
 */
import * as React from "react";

import { Button, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { Delete24Regular } from "@fluentui/react-icons";

import type { ChatConversation } from "@/types/chat.types";
import { getConversationTitle } from "@/utils/conversation-helpers";
import { formatTimestamp } from "@/utils/date-helpers";

// ============================================================================
// Styles
// ============================================================================

const useStyles = makeStyles({
  item: {
    display: "flex",
    alignItems: "center",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    gap: tokens.spacingHorizontalS,
    cursor: "pointer",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ":active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
  },
  active: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Selected,
    },
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  title: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  timestamp: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    gap: tokens.spacingHorizontalXS,
    opacity: 0,
    ":hover &": {
      opacity: 1,
    },
  },
  deleteButton: {
    minWidth: "auto",
    padding: tokens.spacingVerticalXS,
  },
});

// ============================================================================
// Types
// ============================================================================

export type ChatHistoryItemProps = {
  /** The conversation to display */
  conversation: ChatConversation;
  /** Whether this conversation is currently active */
  isActive: boolean;
  /** Callback when conversation is selected */
  onSelect: () => void;
  /** Optional callback when conversation is deleted */
  onDelete?: () => void;
};

// ============================================================================
// Main Component
// ============================================================================

export const ChatHistoryItem = ({ conversation, isActive, onSelect, onDelete }: ChatHistoryItemProps) => {
  const styles = useStyles();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      className={mergeClasses(styles.item, isActive && styles.active)}
      onClick={onSelect}
      onKeyUp={handleKeyUp}
      role="button"
      tabIndex={0}
      aria-label={`${getConversationTitle(conversation)}, ${formatTimestamp(conversation.created_at * 1000)}`}
    >
      <div className={styles.content}>
        <div className={styles.title}>{getConversationTitle(conversation)}</div>
        <div className={styles.timestamp}>{formatTimestamp(conversation.created_at * 1000)}</div>
      </div>
      {onDelete && (
        <div className={styles.actions}>
          <Button
            appearance="subtle"
            icon={<Delete24Regular />}
            onClick={handleDelete}
            className={styles.deleteButton}
            aria-label="Delete conversation"
          />
        </div>
      )}
    </div>
  );
};
