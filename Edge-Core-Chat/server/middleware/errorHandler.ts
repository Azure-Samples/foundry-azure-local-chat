/**
 * Error Handler Middleware
 * Global error handling for the server
 */

import { ErrorRequestHandler } from "express";

import { createApiError, extractApiError } from "../utils/createApiError";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Server error:", err.message);

  // CORS errors
  if (err.message?.startsWith("CORS_BLOCKED:")) {
    const origin = err.message.split(":")[1];
    res.status(403).json(createApiError("cors_error", `Origin '${origin}' not allowed`, "cors_error"));
    return;
  }

  // Extract status/code from OpenAI/Azure AI SDK errors
  const { status, body } = extractApiError(err);
  res.status(status).json(body);
};
