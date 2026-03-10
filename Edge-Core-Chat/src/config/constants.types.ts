import { CopilotMode, DesignVersion } from "@fluentui-copilot/react-copilot";

export interface TypedConfigOptions {
  /** Application display name */
  "app.name": string;
  /** Application version number */
  "app.version": string;
  /** Page title (shown in browser tab) */
  "app.title": string;
  /** Path to favicon file */
  "app.favicon": string;
  
  // Sidebar icon settings
  /** Show icon in sidebar toggle button */
  "sidebar.showIcon": boolean;
  /** Path to sidebar icon (static asset in /public, e.g., "/copilot-icon.svg") */
  "sidebar.icon": string;
  
  // Chat message icon settings
  /** Show icon in chat message headers */
  "chat.showMessageIcon": boolean;
  /** Path to chat message icon (static asset in /public, e.g., "/copilot-icon.svg") */
  "chat.messageIcon": string;
  
  // New chat button icon settings
  /** Show icon in new chat button */
  "newChat.showIcon": boolean;
  /** Path to new chat icon (static asset in /public, e.g., "/new-chat-icon.svg") */
  "newChat.icon": string;
  
  /** localStorage key for storing theme preference */
  "storage.theme": string;
  /** URL query parameter name for theme override */
  "query.theme": string;
  /** Copilot display mode: "canvas" (larger) or "default" (compact) */
  "copilot.mode": CopilotMode["mode"];
  /** Fluent UI Copilot design version: "next" or "current" */
  "copilot.designVersion": DesignVersion["designVersion"];
  /** Maximum character length for chat input */
  "chat.maxLength": number;
  /** Show prompt starter suggestions on welcome screen */
  "chat.showPromptStarters": boolean;
  /** Number of visible rows for prompt starters before collapse */
  "chat.promptStarterVisibleRows": number;
  /** Enable chat history sidebar */
  "chat.enableHistory": boolean;
  /** Use routes for conversations (e.g., /chat/:id) */
  "chat.useRoutes": boolean;
  /** Maximum width for main content area (CSS value) */
  "layout.maxWidth": string;
  /** Number of columns for card grids */
  "layout.cardColumns": number;
}
