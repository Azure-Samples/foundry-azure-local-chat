// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Routes index - Register all routes
 *
 * Azure AI Foundry Responses API (conversations + responses)
 *
 * Data Sources (DATASOURCES env var):
 * - "mock" - Start with mock (toggleable at runtime)
 * - "api" - Start with API (toggleable at runtime)
 *
 * All routes use the DataProvider abstraction for dynamic datasource switching.
 */

import { Express } from "express";

import { config } from "../utils/datasources";
import adminRoutes from "./admin.route";
import conversationItemsRoutes from "./conversation-items.route";
import conversationsRoutes from "./conversations.route";
import healthRoutes from "./health.route";
import responsesRoutes from "./responses.route";
import settingsRoutes from "./settings.route";

export const registerRoutes = (app: Express): void => {
  // Health check always available
  app.use("/", healthRoutes);

  // Settings endpoint for clients (read-only)
  app.use("/api/settings", settingsRoutes);

  // Admin routes (datasource toggle, etc.)
  app.use("/api/admin", adminRoutes);

  // Log initial configuration
  config.log();

  // Note: conversation-items route must be registered before conversations to avoid path conflicts
  app.use("/api/conversations/:conversationId/items", conversationItemsRoutes);
  app.use("/api/conversations", conversationsRoutes);
  app.use("/api/responses", responsesRoutes);

  console.log("📖 Endpoints:");
  console.log("   GET    /api/settings                - Get server settings");
  console.log("   GET    /api/conversations");
  console.log("   POST   /api/conversations");
  console.log("   GET    /api/conversations/{id}");
  console.log("   DELETE /api/conversations/{id}");
  console.log("   GET    /api/conversations/{id}/items");
  console.log("   POST   /api/responses");
  console.log("   🔀 Admin endpoints:");
  console.log("   GET    /api/admin/config            - Get current config");
  console.log("   POST   /api/admin/datasource        - Set active datasource");
  console.log("   POST   /api/admin/datasource/toggle - Toggle mock/api");
  console.log("   POST   /api/admin/streaming/toggle  - Toggle streaming");
};
