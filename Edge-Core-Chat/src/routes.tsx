import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import { PageNotFound } from "./components/PageNotFound/PageNotFound";
import { config } from "./config/constants";
import { ChatPage } from "./routes/ChatPage";


export const AppRoutes = () => {
  const basename = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL;
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

