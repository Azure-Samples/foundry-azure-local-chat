/**
 * Custom hooks for chat-related effects.
 * Extracted from Chat component for reusability.
 */
import * as React from "react";

/**
 * Auto-scrolls a container to bottom when trigger value changes.
 * Useful for chat message lists.
 * @param ref - Ref to the scrollable container
 * @param trigger - Value that triggers scroll when changed (e.g., messages.length)
 */
export const useAutoScroll = (ref: React.RefObject<HTMLElement | null>, trigger: unknown) => {
  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [ref, trigger]);
};

/**
 * Auto-focuses an input element on mount and when trigger changes.
 * @param trigger - Value that triggers focus when changed
 * @param selector - CSS selector to find the input (default: contenteditable)
 */
export const useAutoFocus = (trigger?: unknown, selector = '[contenteditable="true"]') => {
  const focusInput = React.useCallback(() => {
    const element = document.querySelector(selector) as HTMLElement;
    element?.focus();
  }, [selector]);

  React.useEffect(() => {
    focusInput();
  }, [focusInput, trigger]);

  return focusInput;
};
