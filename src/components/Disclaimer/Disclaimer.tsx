// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import React from "react";

import { makeStyles, tokens } from "@fluentui/react-components";

import { getText } from "@/localization/en";

const useStyles = makeStyles({
  disclaimer: {
    textAlign: "center",
    padding: `${tokens.spacingVerticalS} 0`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

interface DisclaimerProps {
  text?: string;
}

/**
 * AI Disclaimer component
 * Displays a disclaimer message about AI-generated content
 */
export const Disclaimer: React.FC<DisclaimerProps> = ({ text = getText("chat.aiDisclaimer") }) => {
  const styles = useStyles();

  return (
    <div className={styles.disclaimer} role="note">
      {text}
    </div>
  );
};
