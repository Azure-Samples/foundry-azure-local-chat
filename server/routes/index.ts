/**
 * Routes index - Register all routes
 *
 * Azure AI Foundry Responses API (conversations + responses)
 *
 * Data Sources (DATASOURCES env var):
 * - "mock" - Start with mock (toggleable at runtime)
 * - "api" - Start with API (toggleable at runtime)
 *
 * All routes use hybrid router for dynamic datasource switching.
 */

import { Express } from "express";

import { createHybridRouter } from "../middleware";
import { config } from "../utils/datasources";
import adminRoutes from "./admin.route";
import conversationsRoutes from "./conversations.route";
import healthRoutes from "./health.route";
import itemsRoutes from "./items.route";
import { mockConversationsRoutes, mockItemsRoutes, mockResponsesRoutes } from "./mock";
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

  // Always use hybrid router for dynamic datasource switching at runtime
  // Note: items route must be registered before conversations to avoid path conflicts
  app.use("/api/conversations/:conversationId/items", createHybridRouter(mockItemsRoutes, itemsRoutes));
  app.use("/api/conversations", createHybridRouter(mockConversationsRoutes, conversationsRoutes));
  app.use("/api/responses", createHybridRouter(mockResponsesRoutes, responsesRoutes));

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
