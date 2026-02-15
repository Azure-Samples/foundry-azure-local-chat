/**
 * Simple session middleware
 *
 * Assigns a unique session ID to each user via cookie.
 * This keeps conversations isolated per browser session.
 */

import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

const SESSION_COOKIE_NAME = "edge_chat_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Extend Express Request to include sessionId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

/**
 * Session middleware - assigns unique session ID per user
 */
export const sessionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check for existing session cookie
  let sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    // Generate new session ID
    sessionId = randomUUID();

    // Set cookie
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    });
  }

  // Attach to request
  req.sessionId = sessionId;

  next();
};

/**
 * Get session ID from request (for use in routes)
 * Use after requireSession middleware to guarantee non-null
 */
export const getSessionId = (req: Request): string => {
  // After requireSession middleware, sessionId is guaranteed to exist
  return req.sessionId;
};

/**
 * Require session middleware - returns 401 if no session
 */
export const requireSession = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.sessionId) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Session required" },
    });
    return;
  }
  next();
};
