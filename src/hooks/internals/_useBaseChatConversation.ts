import * as React from "react";

import type {
  ChatConversation,
  ChatConversationHandlers,
  ChatConversationState,
  ChatMessage,
  UseChatConversationOptions,
  UseChatConversationReturn,
} from "@/types/chat.types";
import { createConversation, generateTitle } from "@/utils/conversation-helpers";
import { createRequestTracker } from "@/utils/timing";

// =============================================================================
// Types
// =============================================================================

/** Send message handler - injected by streaming/standard hooks */
export type SendMessageHandler = (
  text: string,
  context: {
    conversationId: string;
    title: string;
    userMessage: ChatMessage;
    actions: BaseChatConversationActions;
    isIntentionalAbort: React.MutableRefObject<boolean>;
    onConversationChange?: (id: string | null) => void;
  },
) => Promise<void>;

/** Base options shared by all conversation hooks */
export interface BaseChatConversationOptions extends UseChatConversationOptions {
  /** Handler for sending messages (streaming or standard) */
  sendMessageHandler?: SendMessageHandler;
}

/** State returned by the base hook (same as ChatConversationState but with isInitialized instead of isInitializing) */
export interface BaseChatConversationState extends Omit<ChatConversationState, "isInitializing"> {
  isInitialized: boolean;
}

/** Internal state setters (not exposed to consumers) */
export interface InternalStateSetters {
  setConversations: React.Dispatch<React.SetStateAction<ChatConversation[]>>;
  setActiveConversation: React.Dispatch<React.SetStateAction<ChatConversation | null>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Internal helper actions (not exposed to consumers) */
export interface InternalHelperActions {
  addMessage: (role: "user" | "assistant", content: string, status?: ChatMessage["status"]) => ChatMessage;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeLastMessage: () => void;
  upsertConversation: (conv: ChatConversation) => void;
  updateConversationInList: (id: string, updates: Partial<ChatConversation>) => void;
  removeConversationFromList: (id: string) => void;
}

/** Combined actions for internal hook use - extends public handlers */
export interface BaseChatConversationActions
  extends InternalStateSetters, InternalHelperActions, Omit<ChatConversationHandlers, "onHistoryOpenChange"> {
  // Note: onHistoryOpenChange is handled by setIsHistoryOpen internally
}

// =============================================================================
// Shared Send Message Helpers
// =============================================================================

export interface SendMessageSetup {
  conversationId: string;
  title: string;
  userMessage: ChatMessage;
}

/**
 * Shared logic for preparing to send a message.
 * Returns conversation ID, title, and user message - or null if should skip.
 */
export const prepareSendMessage = async (
  text: string,
  isLoading: boolean,
  activeConversation: ChatConversation | null,
  _createConversation: ((title?: string) => Promise<ChatConversation | null>) | undefined,
  actions: BaseChatConversationActions,
  _onConversationChange?: (id: string | null) => void,
  /** Fallback conversation ID (e.g., from route params) when activeConversation isn't loaded yet */
  fallbackConversationId?: string,
): Promise<SendMessageSetup | null> => {
  if (!text.trim() || isLoading) {
    return null;
  }

  // Use activeConversation ID, or fallback to route param ID if still loading
  const conversationId = activeConversation?.id || fallbackConversationId;
  const title = generateTitle(text);

  // No conversation - the handler will create it
  if (!conversationId) {
    console.log("[Send] No conversation yet, handler will create one with title:", title);
  }

  // Add user message optimistically - this shows immediately
  const userMessage = actions.addMessage("user", text);
  actions.setIsLoading(true);

  return { conversationId: conversationId || "", title, userMessage };
};

// =============================================================================
// Types for Hook Composition
// =============================================================================

/** Return type for the base hook internals */
export interface BaseChatConversationResult {
  state: BaseChatConversationState;
  actions: BaseChatConversationActions;
}

// =============================================================================
// Base Hook
// =============================================================================

/**
 * Base hook with shared conversation management logic.
 * Used by both streaming and non-streaming hooks.
 */
export const useBaseChatConversation = (options: BaseChatConversationOptions): BaseChatConversationResult => {
  const { initialConversationId, onConversationChange, api, sendMessageHandler } = options;

  // Validate api is provided
  if (!api) {
    throw new Error("[useBaseChatConversation] api is required");
  }

  // Destructure API methods
  const {
    stop: onStopRequest,
    fetchConversations,
    fetchConversation,
    fetchMessages,
    deleteConversation: deleteConversationApi,
    renameConversation: renameConversationApi,
  } = api;

  // ==========================================================================
  // State
  // ==========================================================================

  const [conversations, setConversations] = React.useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = React.useState<ChatConversation | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(!initialConversationId);
  const [isLoading, setIsLoading] = React.useState(false);

  // ==========================================================================
  // Refs
  // ==========================================================================

  const isIntentionalAbort = React.useRef(false);
  const selectRequestTracker = React.useRef(createRequestTracker());
  const hasFetchedConversations = React.useRef(false);
  const hasLoadedInitial = React.useRef(false);

  // ==========================================================================
  // Message Helpers
  // ==========================================================================

  const addMessage = React.useCallback(
    (role: "user" | "assistant", content: string, status?: ChatMessage["status"]): ChatMessage => {
      const message: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        type: "message",
        role,
        content: [{ type: "text", text: content }],
        status: status || "completed",
      };
      console.log("[Base] addMessage:", { role, content, messageId: message.id });
      setMessages((prev) => {
        console.log("[Base] setMessages: prev count:", prev.length, "adding:", message.id);
        return [...prev, message];
      });
      return message;
    },
    [],
  );

  const updateMessage = React.useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  const removeLastMessage = React.useCallback(() => {
    setMessages((prev) => prev.slice(0, -1));
  }, []);

  // ==========================================================================
  // Conversation List Helpers
  // ==========================================================================

  const upsertConversation = React.useCallback((conv: ChatConversation) => {
    if (!conv.id) {
      console.warn("[upsertConversation] Skipping conversation without ID:", conv);
      console.trace("[upsertConversation] Stack trace:");
      return;
    }
    setConversations((prev) => {
      // Remove any duplicates and empty IDs, then add/update
      const filtered = prev.filter((c) => c.id && c.id !== conv.id);
      return [conv, ...filtered];
    });
  }, []);

  const updateConversationInList = React.useCallback((id: string, updates: Partial<ChatConversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const removeConversationFromList = React.useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ==========================================================================
  // Initialization Effects
  // ==========================================================================

  // Load conversations on mount (once only)
  React.useEffect(() => {
    if (hasFetchedConversations.current) {
      return;
    }
    hasFetchedConversations.current = true;

    fetchConversations()
      .then(setConversations)
      .catch((error) => console.error("[Init] Failed to load conversations:", error));
  }, [fetchConversations]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  /** Start a new chat - clears active conversation and messages */
  const handleNewChat = React.useCallback(() => {
    console.log("[NewChat] Starting fresh");
    isIntentionalAbort.current = true;

    selectRequestTracker.current.cancel();

    if (isLoading && onStopRequest) {
      onStopRequest();
    }

    setActiveConversation(null);
    setMessages([]);
    setIsLoading(false);

    onConversationChange?.(null);

    queueMicrotask(() => {
      isIntentionalAbort.current = false;
    });
  }, [isLoading, onStopRequest, onConversationChange]);

  /** Select and load a conversation */
  const handleSelectConversation = React.useCallback(
    async (id: string) => {
      console.log("[Select] Conversation:", id);

      const { id: requestId } = selectRequestTracker.current.start();

      setMessages([]);
      setIsLoading(true);

      // IMPORTANT: Sync API conversation ID immediately when selecting
      // This ensures sendMessage will use the correct conversation
      onConversationChange?.(id);

      // Set a temporary active conversation immediately to show selection in sidebar
      // This prevents the "not selected" state while loading
      const tempConversation: ChatConversation = {
        id,
        object: "conversation",
        created_at: Math.floor(Date.now() / 1000),
        metadata: { title: "Loading..." },
      };
      setActiveConversation(tempConversation);

      // Find or fetch conversation
      let conv = conversations.find((c) => c.id === id);
      if (!conv) {
        try {
          const fetched = await fetchConversation?.(id);
          if (!selectRequestTracker.current.isCurrent(requestId)) {
            return;
          }
          if (fetched) {
            conv = fetched;
            upsertConversation(fetched);
          }
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            return;
          }
          console.error("[Select] Fetch failed:", error);
          if (selectRequestTracker.current.isCurrent(requestId)) {
            setIsLoading(false);
            setActiveConversation(null);
          }
          return;
        }
      }

      if (!selectRequestTracker.current.isCurrent(requestId)) {
        return;
      }
      // Update with real conversation data if found
      // Ensure we always have a conversation with an ID
      const conversationToSet = conv?.id ? conv : createConversation(id, conv?.metadata.title || "Loading...");
      console.log("[Select] Setting active conversation:", conversationToSet);
      setActiveConversation(conversationToSet);

      // Fetch messages
      try {
        const result = await fetchMessages(id);

        if (!selectRequestTracker.current.isCurrent(requestId)) {
          return;
        }
        setMessages(result.messages);

        // With atomic pattern, messages are always complete (no in-progress state)
        setIsInitialized(true);
        setIsLoading(false);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("[Select] Messages fetch failed:", error);
        if (selectRequestTracker.current.isCurrent(requestId)) {
          setIsInitialized(true);
          setIsLoading(false);
        }
      }
    },
    [conversations, fetchConversation, fetchMessages, onConversationChange, upsertConversation],
  );

  // ==========================================================================
  // Initial Load (shared by all hooks)
  // ==========================================================================

  // Load initial conversation from route params
  React.useEffect(() => {
    // Skip if we're in the middle of sending a message (streaming will handle the conversation setup)
    if (initialConversationId && !hasLoadedInitial.current) {
      // Don't load if there's already an activeConversation being set up
      if (activeConversation?.id === initialConversationId) {
        hasLoadedInitial.current = true;
        return;
      }

      // Don't load if we already have messages (e.g., from optimistic updates during streaming)
      if (messages.length > 0 && activeConversation?.id === initialConversationId) {
        hasLoadedInitial.current = true;
        return;
      }

      hasLoadedInitial.current = true;
      console.log("[Base] Initial load for:", initialConversationId);

      // Set API conversation ID immediately
      api?.setConversationId?.(initialConversationId);

      // Load the conversation
      handleSelectConversation(initialConversationId);
    }
  }, [initialConversationId, handleSelectConversation, api, activeConversation, messages.length]);

  /** Delete a conversation */
  const handleDeleteConversation = React.useCallback(
    async (id: string) => {
      try {
        await deleteConversationApi?.(id);
        removeConversationFromList(id);
        if (activeConversation?.id === id) {
          handleNewChat();
        }
      } catch (error) {
        console.error("[Delete] Failed:", error);
        throw error;
      }
    },
    [deleteConversationApi, activeConversation, handleNewChat, removeConversationFromList],
  );

  /** Rename a conversation */
  const handleRenameConversation = React.useCallback(
    async (id: string, newTitle: string) => {
      // Optimistic update
      updateConversationInList(id, { metadata: { title: newTitle } });
      if (activeConversation?.id === id) {
        setActiveConversation((prev) => (prev ? { ...prev, title: newTitle, updatedAt: Date.now() } : null));
      }

      if (renameConversationApi) {
        try {
          await renameConversationApi(id, newTitle);
        } catch (error) {
          console.error("[Rename] Failed:", error);
          const convs = await fetchConversations();
          setConversations(convs);
          throw error;
        }
      }
    },
    [renameConversationApi, activeConversation, fetchConversations, updateConversationInList],
  );

  /** Stop current request */
  const handleStop = React.useCallback(() => {
    onStopRequest?.();
    removeLastMessage();
    setIsLoading(false);
  }, [onStopRequest, removeLastMessage]);

  // ==========================================================================
  // Send Message (delegates to injected handler)
  // ==========================================================================

  const handleSendMessage = React.useCallback(
    async (text: string) => {
      const setup = await prepareSendMessage(
        text,
        isLoading,
        activeConversation,
        api?.createConversation,
        // Pass a temporary actions object since the real one isn't built yet
        {
          upsertConversation,
          setActiveConversation,
          addMessage,
          setIsLoading,
        } as BaseChatConversationActions,
        onConversationChange,
        initialConversationId,
      );

      if (!setup) {
        return;
      }

      if (!sendMessageHandler) {
        console.error("[Base] No sendMessageHandler provided");
        setIsLoading(false);
        return;
      }

      await sendMessageHandler(text, {
        conversationId: setup.conversationId,
        title: setup.title,
        userMessage: setup.userMessage,
        actions,
        isIntentionalAbort,
        onConversationChange,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- actions is stable via useMemo
    [
      isLoading,
      activeConversation,
      api?.createConversation,
      upsertConversation,
      addMessage,
      onConversationChange,
      initialConversationId,
      sendMessageHandler,
    ],
  );

  // ==========================================================================
  // Build actions object and keep ref updated
  // ==========================================================================

  const actions: BaseChatConversationActions = React.useMemo(
    () => ({
      setConversations,
      setActiveConversation,
      setMessages,
      setIsHistoryOpen,
      setIsLoading,
      addMessage,
      updateMessage,
      removeLastMessage,
      upsertConversation,
      updateConversationInList,
      removeConversationFromList,
      handleNewChat,
      handleSelectConversation,
      handleDeleteConversation,
      handleRenameConversation,
      handleStop,
      handleSendMessage,
    }),
    [
      addMessage,
      updateMessage,
      removeLastMessage,
      upsertConversation,
      updateConversationInList,
      removeConversationFromList,
      handleNewChat,
      handleSelectConversation,
      handleDeleteConversation,
      handleRenameConversation,
      handleStop,
      handleSendMessage,
    ],
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  const state: BaseChatConversationState = {
    conversations,
    activeConversation,
    messages,
    isHistoryOpen,
    isInitialized,
    isLoading,
  };

  return {
    state,
    actions,
  };
};

/**
 * Helper to build the final hook return from base hook output
 * Child hooks call this to avoid duplication
 */
export const buildHookReturn = (
  state: BaseChatConversationState,
  actions: BaseChatConversationActions,
): UseChatConversationReturn => ({
  // State
  conversations: state.conversations,
  activeConversation: state.activeConversation,
  messages: state.messages,
  isHistoryOpen: state.isHistoryOpen,
  isInitializing: !state.isInitialized,
  isLoading: state.isLoading,
  // Actions
  onHistoryOpenChange: actions.setIsHistoryOpen,
  handleNewChat: actions.handleNewChat,
  handleSelectConversation: actions.handleSelectConversation,
  handleDeleteConversation: actions.handleDeleteConversation,
  handleRenameConversation: actions.handleRenameConversation,
  handleSendMessage: actions.handleSendMessage,
  handleStop: actions.handleStop,
});
