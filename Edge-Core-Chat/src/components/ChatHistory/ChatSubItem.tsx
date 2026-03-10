/**
 * ChatSubItem Component
 *
 * Individual chat conversation item in the sidebar with context menu support.
 */
import * as React from "react";

import type { MenuButtonProps, MenuProps } from "@fluentui/react-components";
import { makeStyles, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, tokens } from "@fluentui/react-components";
import { SplitCopilotNavItem } from "@fluentui-copilot/react-copilot-nav";

import type { ChatConversation } from "@/types/chat.types";
import { getConversationTitle } from "@/utils/conversation-helpers";

// ============================================================================
// Styles
// ============================================================================

const useStyles = makeStyles({
  conversationTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "180px",
    paddingLeft: tokens.spacingHorizontalS,
  },
  renameContainer: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
  },
  renameInput: {
    width: "100%",
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase300,
    ":focus": {
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: "-1px",
    },
  },
});

// ============================================================================
// Types
// ============================================================================

export type ChatSubItemProps = {
  /** Conversation data */
  conversation: ChatConversation;
  /** Callback when delete is clicked */
  onDelete?: () => void;
  /** Callback when rename is submitted */
  onRename?: (newTitle: string) => void;
};

// ============================================================================
// Component
// ============================================================================

export const ChatSubItem = ({ conversation, onDelete, onRename }: ChatSubItemProps) => {
  const styles = useStyles();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(getConversationTitle(conversation));
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onMenuOpenChange: MenuProps["onOpenChange"] = (_, data) => {
    setMenuOpen(data.open);
  };

  const handleRenameClick = () => {
    setMenuOpen(false);
    setRenameValue(getConversationTitle(conversation));
    setIsRenaming(true);
    // Focus input after render
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== getConversationTitle(conversation) && onRename) {
      onRename(renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setRenameValue(getConversationTitle(conversation));
    }
  };

  // If renaming, show input field
  if (isRenaming) {
    return (
      <div className={styles.renameContainer}>
        <input
          ref={inputRef}
          type="text"
          className={styles.renameInput}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyUp={handleRenameKeyUp}
        />
      </div>
    );
  }

  return (
    <Menu open={menuOpen} onOpenChange={onMenuOpenChange}>
      <MenuTrigger>
        {(triggerProps: MenuButtonProps) => (
          <SplitCopilotNavItem
            navItem={{
              value: conversation.id,
              children: (
                <span className={styles.conversationTitle} title={getConversationTitle(conversation)}>
                  {getConversationTitle(conversation)}
                </span>
              ),
              onContextMenu: (e: React.MouseEvent) => {
                setMenuOpen(true);
                e.preventDefault();
              },
            }}
            menuButton={{ ...triggerProps, "aria-label": `More options, ${getConversationTitle(conversation)}` }}
            menuButtonTooltip={{
              content: "More options",
              relationship: "label",
            }}
          />
        )}
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {onRename && <MenuItem onClick={handleRenameClick}>Rename</MenuItem>}
          {onDelete && <MenuItem onClick={onDelete}>Delete</MenuItem>}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
};
