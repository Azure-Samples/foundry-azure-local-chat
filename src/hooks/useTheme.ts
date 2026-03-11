// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { useCallback, useEffect, useState } from "react";

import { type Theme, webDarkTheme, webLightTheme } from "@fluentui/react-components";

import { config } from "@/config/constants";

// Types
type ThemeMode = "light" | "dark" | "system";

export interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
}

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"] as const;

// Main hook
export const useTheme = (): ThemeState => {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [systemDark, setSystemDark] = useState(getSystemPreference);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = mode === "system" ? systemDark : mode === "dark";
  const theme = isDark ? webDarkTheme : webLightTheme;

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  return { mode, isDark, theme, setMode };
};

// Helpers
const STORAGE_KEY = config.get("storage.theme");
const QUERY_KEY = config.get("query.theme");

const isValidMode = (v: string | null): v is ThemeMode => v !== null && THEME_MODES.includes(v as ThemeMode);

const getSystemPreference = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const getInitialMode = (): ThemeMode => {
  const param = new URLSearchParams(window.location.search).get(QUERY_KEY);
  if (isValidMode(param)) {
    localStorage.setItem(STORAGE_KEY, param);
    return param;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  return isValidMode(stored) ? stored : "system";
};
