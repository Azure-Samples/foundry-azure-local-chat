import * as React from "react";
import { useNavigate } from "react-router-dom";

import { config } from "@/config/constants";
import type { ChatConversation, ChatMessage } from "@/types/chat.types";
import { createConversation, generateTitle, updateConversationTitle } from "@/utils/conversation-helpers";
import { isAbortError } from "@/utils/errors";
import { generateId } from "@/utils/id";
import { createRequestTracker } from "@/utils/timing";

import { chatReducer, type ChatReducerState } from "./_reducer";
import type {
  ChatConversationOptions,
  ChatConversationReturn,
  SendMessageHandler,
} from "./_types";

// Re-export types that consumers need
export type {
  ChatConversationHook,
  ChatConversationOptions,
  ChatConversationReturn,
  SendMessageHandler,
} from "./_types";

// =============================================================================
// Message factory (needs to return the created message)
// =============================================================================

const createMessage = (role: "user" | "assistant", content: string, status?: ChatMessage["status"]): ChatMessage => ({
  id: generateId("msg"),
  type: "message",
  role,
  content: [{ type: "text", text: content }],
  status: status || "completed",
});

// =============================================================================
// Base Hook
// =============================================================================

/**
 * Base hook with shared conversation management logic.
 * Uses useReducer for centralized state management.
 */
export const useBaseChatConversation = (options: ChatConversationOptions & { sendMessageHandler: SendMessageHandler }): ChatConversationReturn => {
  const { initialConversationId, api, sendMessageHandler } = options;
  const navigate = useNavigate();

  if (!api) {
    throw new Error("[useBaseChatConversation] api is required");
  }

  const {
    abort: onAbortRequest,
    fetchConversations,
    fetchConversation,
    fetchMessages,
    deleteConversation: deleteConversationApi,
    renameConversation: renameConversationApi,
  } = api;

  // ==========================================================================
  // State (single useReducer replaces 6 useState + helper callbacks)
  // ==========================================================================

  const initialState: ChatReducerState = {
    conversations: [],
    activeConversation: null,
    messages: [],
    isInitializing: !!initialConversationId,
    isLoading: false,
  };

  const [state, dispatch] = React.useReducer(chatReducer, initialState);
  const { conversations, activeConversation, messages, isLoading } = state;

  // ==========================================================================
  // Internal routing callback
  // ==========================================================================

  const onConversationChange = React.useCallback(
    (id: string | null) => {
      if (config.isEnabled("chat.useRoutes")) {
        navigate(id ? `/chat/${id}` : "/");
      }
    },
    [navigate],
  );

  // ==========================================================================
  // Refs
  // ==========================================================================

  const isIntentionalAbort = React.useRef(false);
  const selectRequestTracker = React.useRef(createRequestTracker());
  const hasFetchedConversations = React.useRef(false);
  const hasLoadedInitial = React.useRef(false);

  // ==========================================================================
  // Message helper (returns created message — can't be pure dispatch)
  // ==========================================================================

  const addMessage = React.useCallback(
    (role: "user" | "assistant", content: string, status?: ChatMessage["status"]): ChatMessage => {
      const message = createMessage(role, content, status);
      dispatch({ type: "ADD_MESSAGE", payload: message });
      return message;
    },
    [],
  );

  // ==========================================================================
  // Initialization
  // ==========================================================================

  React.useEffect(() => {
    if (hasFetchedConversations.current) {
      return;
    }
    hasFetchedConversations.current = true;

    fetchConversations()
      .then((convs) => dispatch({ type: "SET_CONVERSATIONS", payload: convs }))
      .catch((error) => console.error("[Init] Failed to load conversations:", error));
  }, [fetchConversations]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleNewChat = React.useCallback(() => {
    isIntentionalAbort.current = true;
    selectRequestTracker.current.cancel();

    if (isLoading && onAbortRequest) {
      onAbortRequest();
    }

    dispatch({ type: "NEW_CHAT" });
    onConversationChange(null);

    queueMicrotask(() => {
      isIntentionalAbort.current = false;
    });
  }, [isLoading, onAbortRequest, onConversationChange]);

  const handleSelectConversation = React.useCallback(
    async (id: string) => {
      const { id: requestId } = selectRequestTracker.current.start();

      onConversationChange(id);

      const tempConversation: ChatConversation = {
        id,
        object: "conversation",
        created_at: Math.floor(Date.now() / 1000),
        metadata: { title: "Loading..." },
      };
      dispatch({ type: "SELECT_CONVERSATION_START", payload: { id, tempConversation } });

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
            dispatch({ type: "UPSERT_CONVERSATION", payload: fetched });
          }
        } catch (error) {
          if (isAbortError(error)) {
            return;
          }
          console.error("[Select] Fetch failed:", error);
          if (selectRequestTracker.current.isCurrent(requestId)) {
            dispatch({ type: "SET_LOADING", payload: false });
            dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: null });
          }
          return;
        }
      }

      if (!selectRequestTracker.current.isCurrent(requestId)) {
        return;
      }

      const conversationToSet = conv?.id ? conv : createConversation(id, conv?.metadata.title || "Loading...");

      try {
        const result = await fetchMessages(id);
        if (!selectRequestTracker.current.isCurrent(requestId)) {
          return;
        }

        dispatch({
          type: "SELECT_CONVERSATION_LOADED",
          payload: { conversation: conversationToSet, messages: result.messages },
        });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        console.error("[Select] Messages fetch failed:", error);
        if (selectRequestTracker.current.isCurrent(requestId)) {
          dispatch({ type: "SELECT_CONVERSATION_FAILED" });
        }
      }
    },
    [conversations, fetchConversation, fetchMessages, onConversationChange],
  );

  // ==========================================================================
  // Initial Load
  // ==========================================================================

  React.useEffect(() => {
    if (initialConversationId && !hasLoadedInitial.current) {
      if (activeConversation?.id === initialConversationId) {
        hasLoadedInitial.current = true;
        return;
      }
      if (messages.length > 0 && activeConversation?.id === initialConversationId) {
        hasLoadedInitial.current = true;
        return;
      }

      hasLoadedInitial.current = true;
      handleSelectConversation(initialConversationId);
    }
  }, [initialConversationId, handleSelectConversation, api, activeConversation, messages.length]);

  // ==========================================================================
  // CRUD Handlers
  // ==========================================================================

  const handleDeleteConversation = React.useCallback(
    async (id: string) => {
      try {
        await deleteConversationApi?.(id);
        dispatch({ type: "REMOVE_CONVERSATION", payload: id });
        if (activeConversation?.id === id) {
          handleNewChat();
        }
      } catch (error) {
        console.error("[Delete] Failed:", error);
        throw error;
      }
    },
    [deleteConversationApi, activeConversation, handleNewChat],
  );

  const handleRenameConversation = React.useCallback(
    async (id: string, newTitle: string) => {
      dispatch({ type: "UPDATE_CONVERSATION", payload: { id, updates: { metadata: { title: newTitle } } } });
      if (activeConversation?.id === id) {
        dispatch({
          type: "SET_ACTIVE_CONVERSATION",
          payload: activeConversation ? updateConversationTitle(activeConversation, newTitle) : null,
        });
      }

      if (renameConversationApi) {
        try {
          await renameConversationApi(id, newTitle);
        } catch (error) {
          console.error("[Rename] Failed:", error);
          const convs = await fetchConversations();
          dispatch({ type: "SET_CONVERSATIONS", payload: convs });
          throw error;
        }
      }
    },
    [renameConversationApi, activeConversation, fetchConversations],
  );

  const handleStop = React.useCallback(() => {
    onAbortRequest?.();
    dispatch({ type: "REMOVE_LAST_MESSAGE" });
    dispatch({ type: "SET_LOADING", payload: false });
  }, [onAbortRequest]);

  // ==========================================================================
  // Send Message
  // ==========================================================================

  const handleSendMessage = React.useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) {
        return;
      }

      const conversationId = activeConversation?.id || initialConversationId || "";
      const title = generateTitle(text);
      const userMessage = addMessage("user", text);
      dispatch({ type: "SET_LOADING", payload: true });

      await sendMessageHandler(text, {
        conversationId,
        title,
        userMessage,
        dispatch,
        addMessage,
        onConversationChange,
      });
    },
    [isLoading, activeConversation, addMessage, onConversationChange, initialConversationId, sendMessageHandler],
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  const hookResult: ChatConversationReturn = {
    state: {
      conversations: state.conversations,
      activeConversation: state.activeConversation,
      messages: state.messages,
      isInitializing: state.isInitializing,
      isLoading: state.isLoading,
    },
    handlers: {
      handleNewChat,
      handleSelectConversation,
      handleDeleteConversation,
      handleRenameConversation,
      handleSendMessage,
      handleStop,
    },
  };

  return hookResult;
};
