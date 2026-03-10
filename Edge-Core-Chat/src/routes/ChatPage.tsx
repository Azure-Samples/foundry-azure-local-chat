import * as React from "react";
import { useParams } from "react-router-dom";

import { Chat } from "@/components/Chat/Chat";
import { config } from "@/config/constants";
import { type ChatModule, loadChatModule } from "@/services/chatApiFactory";
import { useGlobalStyles } from "@/styles/globalStyles";

// Lazy load ChatHistory only when needed
const ChatHistory = React.lazy(() =>
  import("@/components/ChatHistory/ChatHistory").then((module) => ({ default: module.ChatHistory })),
);

/**
 * ChatPage - Main chat page with code-split API/hook loading
 *
 * Note: Two-component pattern required because React hooks cannot be called conditionally.
 * ChatPage loads module, ChatPageContent uses the hook.
 */
export const ChatPage = () => {
  const [chatModule, setChatModule] = React.useState<ChatModule | null>(null);

  React.useEffect(() => {
    loadChatModule().then(setChatModule);
  }, []);

  return chatModule ? <ChatPageContent {...chatModule} /> : null;
};

const ChatPageContent = ({ api, useChatConversation }: ChatModule) => {
  const { conversationId: initialConversationId } = useParams<{ conversationId?: string }>();

  const { state: chatState, handlers } = useChatConversation({ initialConversationId, api });

  const layoutStyles = useGlobalStyles("layout");

  // Render with history sidebar if enabled
  if (config.isEnabled("chat.enableHistory")) {
    return (
      <div className={layoutStyles.pageWrapper}>
        <React.Suspense fallback={null}>
          <ChatHistory
            conversations={chatState.conversations}
            activeConversationId={chatState.activeConversation?.id}
            onNewChat={handlers.handleNewChat}
            onSelectConversation={handlers.handleSelectConversation}
            onDeleteConversation={handlers.handleDeleteConversation}
            onRenameConversation={handlers.handleRenameConversation}
          />
        </React.Suspense>
        <Chat
          activeConversation={chatState.activeConversation}
          messages={chatState.messages}
          isInitializing={chatState.isInitializing}
          isLoading={chatState.isLoading}
          handleSendMessage={handlers.handleSendMessage}
          handleStop={handlers.handleStop}
        />
      </div>
    );
  }

  // Render without history sidebar
  return (
    <Chat
      activeConversation={chatState.activeConversation}
      messages={chatState.messages}
      isInitializing={chatState.isInitializing}
      isLoading={chatState.isLoading}
      handleSendMessage={handlers.handleSendMessage}
      handleStop={handlers.handleStop}
    />
  );
};
