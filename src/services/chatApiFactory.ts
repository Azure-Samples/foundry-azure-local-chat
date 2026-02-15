/**
 * Chat Module Factory
 *
 * Provides the correct Chat API based on server settings.
 * - Standard mode: Uses chatApi (REST)
 * - Streaming mode: Uses streamingChatApi (SSE)
 *
 * Settings are fetched from server via /api/settings endpoint.
 * Uses dynamic imports for code splitting.
 */

import type { BaseChatApi, UseChatConversationHook } from "@/types/chat.types";

/** Server settings response */
export interface ServerSettings {
  streaming: boolean;
  datasource: "api" | "mock";
}

/** Chat module containing API and hook for the current mode */
export interface ChatModule {
  api: BaseChatApi;
  useChatConversation: UseChatConversationHook;
  settings: ServerSettings;
}

// Cache settings to avoid refetching
let cachedSettings: ServerSettings | null = null;

/**
 * Fetch server settings (cached)
 */
export const fetchServerSettings = async (): Promise<ServerSettings> => {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const baseUrl = import.meta.env.VITE_API_URL || "/api";
    const response = await fetch(`${baseUrl}/settings`);
    if (response.ok) {
      cachedSettings = await response.json();
      return cachedSettings!;
    }
  } catch (error) {
    console.warn("[ChatFactory] Failed to fetch server settings, using defaults:", error);
  }

  // Default settings if server unavailable
  return { streaming: false, datasource: "api" };
};

/**
 * Clear cached settings (useful when server settings change)
 */
export const clearSettingsCache = (): void => {
  cachedSettings = null;
};

/**
 * Load the appropriate API and hook based on server settings.
 * Enables code splitting - only the needed modules are loaded.
 */
export const loadChatModule = async (): Promise<ChatModule> => {
  const settings = await fetchServerSettings();

  if (settings.streaming) {
    const [{ streamingChatApi }, { useStreamingChatConversation }] = await Promise.all([
      import("./streamingChatApi"),
      import("@/hooks/internals/_useStreamingChatConversation"),
    ]);
    return { api: streamingChatApi, useChatConversation: useStreamingChatConversation, settings };
  }

  const [{ chatApi }, { useStandardChatConversation }] = await Promise.all([
    import("./chatApi"),
    import("@/hooks/internals/_useStandardChatConversation"),
  ]);
  return { api: chatApi, useChatConversation: useStandardChatConversation, settings };
};
