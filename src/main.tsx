// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./routes";

import "highlight.js/styles/github-dark.css";

createRoot(document.getElementById("root")!).render(
  // <StrictMode >
  <AppProviders>
    <AppRoutes />
  </AppProviders>,
  // </StrictMode>,
);
