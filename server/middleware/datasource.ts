/**
 * Datasource Middleware
 *
 * Routes requests to mock or API based on server-side configuration.
 * Use POST /api/admin/datasource to switch between mock and api at runtime.
 */

import { NextFunction, Request, Response, Router } from "express";

import { shouldUseMock } from "../utils/datasources";

/**
 * Create a middleware that routes between mock and API routers
 * Uses server-side active datasource (toggled via admin endpoint)
 */
export const createHybridRouter = (mockRouter: Router, apiRouter: Router) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldUseMock()) {
      return mockRouter(req, res, next);
    }
    return apiRouter(req, res, next);
  };
};
