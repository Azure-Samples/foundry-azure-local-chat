import React from "react";

import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import type { ImperativeControlPluginRef } from "@fluentui-copilot/react-copilot";
import { ChatInput, ImperativeControlPlugin } from "@fluentui-copilot/react-copilot";

import { config } from "@/config/constants";
import { useAutoFocus } from "@/hooks/useChatEffects";
import { getText, getTextFn } from "@/localization/en";

const useStyles = makeStyles({
  container: {
    flexShrink: 0,
    padding: `0 ${tokens.spacingHorizontalL}`,
    paddingBottom: tokens.spacingVerticalXXS,
    maxWidth: config.get("layout.maxWidth"),
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
    overflow: "hidden",
    cursor: "text",
  },
  welcome: {
    marginBottom: tokens.spacingVerticalXL,
  },
  chatInput: {
    marginBottom: tokens.spacingVerticalS,
  },
});

export interface InputAreaRef {
  focus: () => void;
}

interface ChatInputAreaProps {
  isLoading: boolean;
  isWelcome?: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
}

/**
 * Reusable ChatInput wrapper component.
 * Manages its own input state and exposes text only on submit.
 * Used in both welcome screen and chat conversation view.
 */
export const InputArea = React.forwardRef<InputAreaRef, ChatInputAreaProps>(({
  isLoading,
  isWelcome = false,
  onSubmit,
  onStop,
}, ref) => {
  const styles = useStyles();
  const inputRef = React.useRef<ImperativeControlPluginRef>(null!);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = React.useState("");

  // Expose focus method to parent with retry logic
  React.useImperativeHandle(ref, () => ({
    focus: () => {
      // Retry finding textarea until it exists (max 5 attempts)
      let attempts = 0;
      const tryFocus = () => {
        const textarea = containerRef.current?.querySelector("textarea");
        if (textarea) {
          textarea.focus();
        } else if (attempts < 5) {
          attempts++;
          requestAnimationFrame(tryFocus);
        }
      };
      tryFocus();
    },
  }), []);

  // Auto-focus on mount
  useAutoFocus();

  const handleSubmit = React.useCallback(() => {
    const text = inputText.trim();
    if (!text || isLoading) {
      return;
    }
    
    onSubmit(text);
    inputRef.current?.setInputText("");
    setInputText("");
  }, [inputText, isLoading, onSubmit]);

  const handleChange = React.useCallback(
    (_: React.ChangeEvent<HTMLTextAreaElement>, data: { value: string }) => {
      setInputText(data.value);
    },
    [],
  );

  return (
    <div ref={containerRef} className={mergeClasses(styles.container, isWelcome && styles.welcome)}>
      <ChatInput
        aria-label={getText("chat.ariaLabel")}
        placeholderValue={getText("chat.placeholder")}
        maxLength={config.get("chat.maxLength")}
        charactersRemainingMessage={getTextFn("chat.charactersRemaining")}
        onSubmit={handleSubmit}
        onChange={handleChange}
        onStop={onStop}
        disableSend={!isLoading && inputText.trim() === ""}
        isSending={isLoading}
        className={styles.chatInput}
      >
        <ImperativeControlPlugin ref={inputRef} />
      </ChatInput>
    </div>
  );
});

InputArea.displayName = "InputArea";
