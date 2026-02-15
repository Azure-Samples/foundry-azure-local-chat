import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import { PageNotFound } from "./components/PageNotFound/PageNotFound";
import { config } from "./config/constants";
import { ChatPage } from "./routes/ChatPage";


export const AppRoutes = () => {
  // Vite already handles base path, router should use root
  const basename = "";
  const useRoutes = config.isEnabled("chat.useRoutes");

  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        {useRoutes && <Route path="/chat/:conversationId" element={<ChatPage />} />}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Router>
  );
};

