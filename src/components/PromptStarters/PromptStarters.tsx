// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import React from "react";

import { makeStyles, tokens } from "@fluentui/react-components";
import { PromptStarterList, PromptStarterV2 } from "@fluentui-copilot/react-prompt-starter";

import { config } from "@/config/constants";
import { getText, PROMPT_STARTERS } from "@/localization/en";

const useStyles = makeStyles({
  list: {
    // Constrain max-width with padding offset for 64px gap on each side
    maxWidth: `calc(${config.get("layout.maxWidth")} - 64px)`,
    width: "100%",
    marginBottom: tokens.spacingVerticalL,
    boxSizing: "border-box",
  },
  item: {
    width: "100%",
  },
});

interface PromptStarter {
  readonly id: string;
  readonly prompt: string;
  readonly category: string;
}

interface PromptStartersProps {
  onPromptClick: (prompt: string) => void;
  starters?: PromptStarter[];
  visibleRows?: number;
  expandLabel?: string;
  collapseLabel?: string;
  ariaLabel?: string;
  getAriaLabel?: (prompt: string) => string;
}

/**
 * Prompt Starters component
 * Displays a list of suggested prompts for the user to start a conversation
 */
export const PromptStarters: React.FC<PromptStartersProps> = ({
  onPromptClick,
  starters = PROMPT_STARTERS,
  visibleRows = config.get("chat.promptStarterVisibleRows"),
  expandLabel = getText("chat.promptStartersShowMore"),
  collapseLabel = getText("chat.promptStartersShowLess"),
  ariaLabel = getText("chat.promptStartersLabel"),
  getAriaLabel = (prompt: string) => getText("chat.sendPrompt", prompt),
}) => {
  const styles = useStyles();

  return (
    <PromptStarterList
      className={styles.list}
      aria-label={ariaLabel}
      role="list"
      visibleRows={visibleRows}
      expandButtonLabel={expandLabel}
      collapseButtonLabel={collapseLabel}
    >
      {starters.map((starter) => (
        <PromptStarterV2
          key={starter.id}
          className={styles.item}
          prompt={starter.prompt}
          reasonMarker={starter.category}
          primaryAction={{
            onMouseUp: () => onPromptClick(starter.prompt),
            "aria-label": getAriaLabel(starter.prompt),
          }}
        />
      ))}
    </PromptStarterList>
  );
};
