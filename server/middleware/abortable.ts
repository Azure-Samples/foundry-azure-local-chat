// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Middleware to handle client disconnection and provide abort signal
 * This allows long-running requests to be cancelled when client disconnects
 */
import type { NextFunction, Request, Response } from "express";

// Extend Express Request type
export interface AbortableRequest extends Request {
  /** AbortSignal that fires when client disconnects */
  abortSignal?: AbortSignal;
  /** Check if client is still connected */
  isClientConnected?: () => boolean;
}

/**
 * Middleware that adds abort signal to request
 * Use on routes that make long-running external calls
 */
export const abortableRequest = (req: Request, _res: Response, next: NextFunction): void => {
  const abortController = new AbortController();
  const abortableReq = req as AbortableRequest;

  // Check if client is still connected
  const isClientConnected = () => Boolean(req.socket) && !req.socket.destroyed;

  // Handle disconnect
  const handleDisconnect = () => {
    if (!abortController.signal.aborted) {
      console.log(`[Middleware] Client disconnected: ${req.method} ${req.path}`);
      abortController.abort(new Error("Client disconnected"));
    }
  };

  // Listen for socket close
  req.socket?.on("close", handleDisconnect);

  // Attach to request
  abortableReq.abortSignal = abortController.signal;
  abortableReq.isClientConnected = isClientConnected;

  // Cleanup on response finish or close
  const cleanup = () => {
    req.socket?.off("close", handleDisconnect);
  };

  _res.on("finish", cleanup);
  _res.on("close", cleanup);
  _res.on("error", cleanup);

  next();
};
