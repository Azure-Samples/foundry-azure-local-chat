// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Chat state reducer.
 * Centralizes all state mutations for the chat conversation hooks.
 */
import type { ChatConversation, ChatMessage } from "@/types/chat.types";

// =============================================================================
// State
// =============================================================================

export interface ChatReducerState {
  conversations: ChatConversation[];
  activeConversation: ChatConversation | null;
  messages: ChatMessage[];
  isInitializing: boolean;
  isLoading: boolean;
}

// =============================================================================
// Action Payloads — add a line here, get a fully-typed action for free
// =============================================================================

interface ChatActionPayloads {
  SET_CONVERSATIONS: ChatConversation[];
  SET_ACTIVE_CONVERSATION: ChatConversation | null;
  SET_MESSAGES: ChatMessage[];
  SET_INITIALIZING: boolean;
  SET_LOADING: boolean;
  ADD_MESSAGE: ChatMessage;
  APPEND_MESSAGE: ChatMessage;
  UPDATE_MESSAGE: { id: string; updates: Partial<ChatMessage> };
  REMOVE_LAST_MESSAGE: undefined;
  REMOVE_MESSAGES: string[];
  UPSERT_CONVERSATION: ChatConversation;
  UPDATE_CONVERSATION: { id: string; updates: Partial<ChatConversation> };
  REMOVE_CONVERSATION: string;
  NEW_CHAT: undefined;
  SELECT_CONVERSATION_START: { id: string; tempConversation: ChatConversation };
  SELECT_CONVERSATION_LOADED: { conversation: ChatConversation; messages: ChatMessage[] };
  SELECT_CONVERSATION_FAILED: undefined;
}

// =============================================================================
// Action Union — derived automatically from the payload map
// =============================================================================

export type ChatAction = {
  [K in keyof ChatActionPayloads]: ChatActionPayloads[K] extends undefined
    ? { type: K }
    : { type: K; payload: ChatActionPayloads[K] };
}[keyof ChatActionPayloads];

// =============================================================================
// Reducer
// =============================================================================

export const chatReducer = (state: ChatReducerState, action: ChatAction): ChatReducerState => {
  switch (action.type) {
    // -- Direct setters --
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.payload };
    case "SET_ACTIVE_CONVERSATION":
      return { ...state, activeConversation: action.payload };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "SET_INITIALIZING":
      return { ...state, isInitializing: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    // -- Message mutations --
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "APPEND_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.payload.id ? { ...m, ...action.payload.updates } : m)),
      };
    case "REMOVE_LAST_MESSAGE":
      return { ...state, messages: state.messages.slice(0, -1) };
    case "REMOVE_MESSAGES":
      return { ...state, messages: state.messages.filter((m) => !action.payload.includes(m.id)) };

    // -- Conversation mutations --
    case "UPSERT_CONVERSATION": {
      if (!action.payload.id) {
        return state;
      }
      const filtered = state.conversations.filter((c) => c.id && c.id !== action.payload.id);
      return { ...state, conversations: [action.payload, ...filtered] };
    }
    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) => (c.id === action.payload.id ? { ...c, ...action.payload.updates } : c)),
      };
    case "REMOVE_CONVERSATION":
      return { ...state, conversations: state.conversations.filter((c) => c.id !== action.payload) };

    // -- Compound actions --
    case "NEW_CHAT":
      return { ...state, activeConversation: null, messages: [], isLoading: false };
    case "SELECT_CONVERSATION_START":
      return {
        ...state,
        messages: [],
        isLoading: true,
        activeConversation: action.payload.tempConversation,
      };
    case "SELECT_CONVERSATION_LOADED":
      return {
        ...state,
        activeConversation: action.payload.conversation,
        messages: action.payload.messages,
        isInitializing: false,
        isLoading: false,
      };
    case "SELECT_CONVERSATION_FAILED":
      return { ...state, isInitializing: false, isLoading: false };

    default:
      return state;
  }
};
