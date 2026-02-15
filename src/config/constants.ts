import type { TypedConfigOptions } from "./constants.types";

// All config values in a flat structure for typesafe access
const CONFIG: TypedConfigOptions = {
  // Storage keys
  "storage.theme": "app-theme",

  // Query params
  "query.theme": "theme",

  // App info
  "app.name": "Edge AI Chat",
  "app.version": "1.0.0",
  "app.title": "Edge AI Chat",
  "app.favicon": "/favicon.ico",

  // Copilot settings
  "copilot.mode": "canvas",
  "copilot.designVersion": "next",

  // Chat input settings
  "chat.maxLength": 4000,
  "chat.showPromptStarters": true,
  "chat.promptStarterVisibleRows": 1,

  // Chat history settings
  "chat.enableHistory": true,
  "chat.useRoutes": false, // If true, conversations use /chat/:id routes

  // Sidebar icon settings
  "sidebar.showIcon": false,
  "sidebar.icon": "", // Path to icon in /public (e.g., "/copilot-icon.svg")

  // Chat message icon settings
  "chat.showMessageIcon": true,
  "chat.messageIcon": "/copilot-icon.svg", // Path to icon in /public

  // New chat button icon settings
  "newChat.showIcon": true,
  "newChat.icon": "/new-chat-icon.svg", // Path to icon in /public

  // Layout settings
  "layout.maxWidth": "950px",
  "layout.cardColumns": 2,
} as const;

// Extract all keys where the value is boolean
type BooleanConfigKeys = {
  [K in keyof TypedConfigOptions]: TypedConfigOptions[K] extends boolean ? K : never;
}[keyof TypedConfigOptions];

// Extract all keys where the value could be string or array (empty-checkable types)
type EmptyCheckableKeys = {
  [K in keyof TypedConfigOptions]: TypedConfigOptions[K] extends string | unknown[] ? K : never;
}[keyof TypedConfigOptions];

export const config = {
  get<K extends keyof typeof CONFIG>(key: K): (typeof CONFIG)[K] {
    return CONFIG[key];
  },

  isEnabled(key: BooleanConfigKeys): boolean {
    return CONFIG[key] as boolean;
  },

  isNotEmpty(key: EmptyCheckableKeys): boolean {
    const value = CONFIG[key] as string | unknown[];
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return false;
  },

  // Direct access for destructuring
  values: CONFIG,
};
