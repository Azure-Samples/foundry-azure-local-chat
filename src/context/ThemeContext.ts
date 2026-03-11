// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { createContext, useContext } from "react";

import type { ThemeState } from "@/hooks/useTheme";

export const ThemeContext = createContext<ThemeState | undefined>(undefined);

export const useThemeContext = (): ThemeState => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
};
