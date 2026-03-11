// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * LoadingMessage Component
 *
 * Displays a loading state with morse code animation using Fluent AI's CopilotMessage.
 * Used to indicate AI response is being generated.
 */
import * as React from "react";

import { makeStyles, Slot, tokens } from "@fluentui/react-components";
import { CopilotMessage } from "@fluentui-copilot/react-copilot";
import { MorseCode } from "@fluentui-copilot/react-morse-code";

import { getText } from "@/localization/en";

const useStyles = makeStyles({
  morseCode: {
    width: "108px",
    marginBottom: tokens.spacingVerticalS,
  },
  // For LoadingMessage - morse code needs left margin since it's in progress bar
  loadingMorseCode: {
    width: "108px",
    marginLeft: tokens.spacingHorizontalXXXL,
    marginBottom: tokens.spacingVerticalS,
  },
  progressBar: {
    backgroundColor: "unset",
    height: "10px",
    width: "100%",
  },
  streamingProgress: {
    marginTop: tokens.spacingVerticalS,
  },
});

interface LoadingMessageProps {
  /** Avatar element to display */
  avatar: NonNullable<Slot<"div">>;
}

/**
 * Loading message component with morse code animation
 * Encapsulates the CopilotMessage loading state
 */
export const LoadingMessage = ({ avatar }: LoadingMessageProps) => {
  const styles = useStyles();

  const progressConfig = React.useMemo(
    () => ({
      bar: <MorseCode aria-label={getText("chat.loading")} className={styles.loadingMorseCode} />,
      className: styles.progressBar,
      value: 0,
    }),
    [styles.loadingMorseCode, styles.progressBar],
  );

  return (
    <CopilotMessage
      name={getText("chat.name")}
      avatar={avatar}
      defaultFocused
      loadingState="loading"
      progress={progressConfig}
    />
  );
};

/**
 * StreamingProgress component
 * Shows morse code animation beneath streaming message content
 */
export const StreamingProgress = () => {
  const styles = useStyles();

  return (
    <div className={styles.streamingProgress}>
      <MorseCode aria-label={getText("chat.loading")} className={styles.morseCode} />
    </div>
  );
};
