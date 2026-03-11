// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Global Styles Module
 *
 * This module provides application-wide styles using Fluent UI's Griffel styling system.
 * Uses makeStaticStyles for truly global CSS and makeStyles for reusable component styles.
 *
 * Usage:
 *   const styles = useGlobalStyles('layout');
 *   <div className={styles.root}>...</div>
 *
 * Note: This replaces index.css - all global styles are managed here in JavaScript.
 */
import { makeStaticStyles, makeStyles, tokens } from "@fluentui/react-components";

import { config } from "@/config/constants";

// ============================================
// Static Global Styles (CSS Reset & Overrides)
// ============================================

/**
 * Static global styles that apply to the entire application.
 * These are injected once and apply globally (like traditional CSS).
 */
export const useGlobalStaticStyles = makeStaticStyles({
  // CSS Reset
  "*, *::before, *::after": {
    boxSizing: "border-box",
    margin: 0,
    padding: 0,
  },
  // Base HTML/Body styles
  "html, body, #root": {
    height: "100%",
    width: "100%",
    overflow: "hidden",
  },
  // Bring Fluent Provider to full size to prevent issue with content not filling the entire screen height
  "#root > .fui-FluentProvider": {
    display: "flex",
    height: "100%",
    width: "100%",
  },
  body: {
    fontFamily: tokens.fontFamilyBase,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },

  // Global scrollbar styles - elegant and semi-transparent
  "*": {
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(128, 128, 128, 0.3) transparent",
  },
  "*::-webkit-scrollbar": {
    width: "6px",
    height: "6px",
  },
  "*::-webkit-scrollbar-track": {
    background: "transparent",
  },
  "*::-webkit-scrollbar-thumb": {
    background: "rgba(128, 128, 128, 0.3)",
    borderRadius: "3px",
    transition: "background 0.2s ease",
  },
  "*::-webkit-scrollbar-thumb:hover": {
    background: "rgba(128, 128, 128, 0.5)",
  },
  // Hide scrollbar when not scrolling (shows on hover/scroll)
  "*::-webkit-scrollbar-thumb:vertical": {
    minHeight: "30px",
  },

  // ============================================
  // Fluent Copilot Component Overrides
  // ============================================
  // These overrides fix the ChatInput layout when content exceeds max height.
  // The inputWrapper uses flex layout with the editor taking most space,
  // while actions and status stay at their natural height at the bottom.

  // Make the entire ChatInput container clickable to focus the editor
  ".fai-ChatInput__inputWrapper": {
    display: "flex",
    flexDirection: "column",
  },
});

// ============================================
// Style Definitions
// ============================================

const layoutStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100%",
    overflowY: "hidden",
  },
  mainContent: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  centeredContent: {
    flex: 1,
    maxWidth: config.get("layout.maxWidth"),
    width: "100%",
    margin: "0 auto",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    boxSizing: "border-box",
  },
  pageWrapper: {
    display: "flex",
    height: "100vh",
    width: "100%",
  },
  contentArea: {
    position: "relative",
    flex: 1,
  },
});

const chatStyles = makeStyles({
  container: {
    flex: 1,
    maxWidth: config.get("layout.maxWidth"),
    width: "100%",
    margin: "0 auto",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    paddingBottom: tokens.spacingVerticalXXL,
    boxSizing: "border-box",
  },
  welcomeContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
  },
  welcomeTitle: {
    marginBottom: tokens.spacingVerticalXXL,
    textAlign: "center",
  },
  sidebarToggle: {
    position: "absolute",
    top: tokens.spacingVerticalL,
    left: tokens.spacingHorizontalL,
    zIndex: 1,
  },
});

const textStyles = makeStyles({
  preserveWhitespace: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  centered: {
    textAlign: "center",
  },
});

// ============================================
// Style Registry & Hook
// ============================================

const styleRegistry = {
  layout: layoutStyles,
  chat: chatStyles,
  text: textStyles,
} as const;

type StyleRegistry = typeof styleRegistry;

/**
 * Typed style hook with autocomplete support.
 *
 * @example
 * const layoutStyles = useGlobalStyles('layout');
 * <div className={layoutStyles.root}>...</div>
 *
 * const chatStyles = useGlobalStyles('chat');
 * <div className={chatStyles.container}>...</div>
 */
export function useGlobalStyles<T extends keyof StyleRegistry>(category: T): ReturnType<StyleRegistry[T]> {
  return styleRegistry[category]() as ReturnType<StyleRegistry[T]>;
}
