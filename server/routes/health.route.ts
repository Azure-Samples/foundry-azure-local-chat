/**
 * Health Routes
 * Server health check endpoints
 *
 * Endpoints:
 * - GET /health - Server health check and agent status
 */

import { Request, Response, Router } from "express";

import { getAgentName } from "../services";
import { config } from "../utils/datasources";

const router = Router();

/** Health check response */
interface HealthResponse {
  success: true;
  status: "ok";
  agent: string | null;
  capabilities: {
    streaming: boolean;
  };
}

/**
 * GET /health
 * Returns server status, connected agent name, and capabilities
 */
router.get("/health", (_req: Request, res: Response<HealthResponse>) => {
  res.json({
    success: true,
    status: "ok",
    agent: getAgentName(),
    capabilities: {
      streaming: config.isStreamingEnabled(),
    },
  });
});

export default router;
