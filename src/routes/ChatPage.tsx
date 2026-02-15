import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Chat } from "@/components/Chat/Chat";
import { config } from "@/config/constants";
import { type ChatModule, loadChatModule } from "@/services/chatApiFactory";

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
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();

  const onConversationChange = React.useCallback((id: string | null) => {
    api.setConversationId(id);
    if (config.isEnabled("chat.useRoutes")) {
      navigate(id ? `/chat/${id}` : "/");
    }
  }, [api, navigate]);

  const props = useChatConversation({ initialConversationId: conversationId, api, onConversationChange });
  
  return <Chat {...props} />;
};
