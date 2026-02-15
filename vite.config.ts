import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import { createHtmlPlugin } from "vite-plugin-html";

import { config } from "./src/config/constants";

// Toggle to show ESLint/TypeScript errors in browser overlay
const ENABLE_DEV_CHECKER = process.env.VITE_DEV_CHECKER !== "false";

// Optional: Enable local server proxy (only if server folder exists)
// Set to false if you're using a remote API or no backend
const ENABLE_LOCAL_PROXY = process.env.VITE_ENABLE_PROXY !== "false";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react(),
    createHtmlPlugin({
      inject: {
        data: {
          title: config.get("app.title"),
          favicon: config.get("app.favicon"),
        },
      },
    }),
    // ESLint and TypeScript checking with browser overlay
    ENABLE_DEV_CHECKER &&
      checker({
        typescript: true,
        eslint: {
          lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
          useFlatConfig: true,
        },
        overlay: {
          initialIsOpen: false,
          badgeStyle: "margin-bottom: 4px; margin-right: 4px;",
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./src") + "/",
    },
  },
  server: ENABLE_LOCAL_PROXY
    ? {
        proxy: {
          "/api": {
            target: process.env.VITE_PROXY_TARGET || "http://localhost:3001",
            changeOrigin: true,
          },
        },
      }
    : undefined,
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "fluent-components": ["@fluentui/react-components"],
          "fluent-copilot": ["@fluentui-copilot/react-copilot"],
        },
      },
      treeshake: {
        moduleSideEffects: false,
      },
    },
  },
});
