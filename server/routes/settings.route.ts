// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Settings Route
 *
 * Public endpoint for clients to fetch current server settings.
 * Unlike /admin routes, this is read-only and meant for client consumption.
 *
 * Endpoints:
 *   GET /settings - Get current settings (streaming, datasource)
 */

import { Router } from "express";

import { config } from "../utils/datasources";

const router = Router();

/**
 * GET /settings - Get current server settings
 * Response: { streaming: boolean, datasource: "api" | "mock" }
 */
router.get("/", (_req, res) => {
  const status = config.getStatus();
  res.json({
    streaming: status.streaming,
    datasource: status.datasource,
    aiConfigured: Boolean(process.env.AI_PROJECT_ENDPOINT && process.env.AI_AGENT_ID),
  });
});

export default router;
