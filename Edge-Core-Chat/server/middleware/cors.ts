/**
 * CORS Middleware
 * Configures Cross-Origin Resource Sharing
 */

import cors from "cors";
import { NextFunction, Request, RequestHandler, Response } from "express";

let cachedMiddleware: RequestHandler | null = null;

/**
 * Creates the CORS middleware lazily
 * This ensures dotenv config is loaded before we read env vars
 */
const getCorsMiddleware = (): RequestHandler => {
  if (cachedMiddleware) {
    return cachedMiddleware;
  }

  const ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim());

  // CORS_ORIGINS=* disables CORS checks (dev/BYOB convenience)
  if (ALLOWED_ORIGINS?.includes("*")) {
    cachedMiddleware = cors({ origin: true, credentials: true });
    return cachedMiddleware;
  }

  // Default to localhost if not specified
  const origins =
    ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ["http://localhost:5173", "http://localhost:5174"];

  cachedMiddleware = cors({
    origin: (origin, callback) => {
      if (!origin) {
        // Allow requests with no origin (same-origin requests from localhost)
        return callback(null, true);
      }

      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS_BLOCKED:${origin}`));
      }
    },
    credentials: true,
  });

  return cachedMiddleware;
};

/**
 * CORS middleware - lazily initialized
 */
export const corsMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  return getCorsMiddleware()(req, res, next);
};
