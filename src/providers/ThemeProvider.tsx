// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { PropsWithChildren } from "react";

import { CopilotProvider } from "@fluentui-copilot/react-copilot";

import { config } from "@/config/constants";
import { ThemeContext } from "@/context/ThemeContext";
import { useTheme } from "@/hooks/useTheme";

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const themeState = useTheme();
  const designVersion = config.get("copilot.designVersion");

  return (
    <ThemeContext.Provider value={themeState}>
      <CopilotProvider
        theme={themeState.theme}
        mode={config.get("copilot.mode")}
        designVersion={designVersion}
      >
        {children}
      </CopilotProvider>
    </ThemeContext.Provider>
  );
};
