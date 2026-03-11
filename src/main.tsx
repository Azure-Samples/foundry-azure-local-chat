// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "./routes";


createRoot(document.getElementById("root")!).render(
  // <StrictMode >
  <AppProviders>
    <AppRoutes />
  </AppProviders>,
  // </StrictMode>,
);
