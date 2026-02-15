/**
 * Data Providers
 *
 * Clean abstraction for data sources (mock vs API).
 *
 * ============================================
 * HOW TO REMOVE MOCK PROVIDER:
 * ============================================
 * 1. Delete /server/providers/mock folder
 * 2. Delete /server/routes/mock folder
 * 3. In /server/routes/index.ts:
 *    - Remove: import { mock* } from "./mock"
 *    - Remove: createHybridRouter usage
 *    - Use API routes directly: app.use("/api/conversations", conversationsRoutes)
 * 4. Remove DATASOURCES from .env (defaults to api)
 * 5. Remove admin toggle endpoints if not needed
 * ============================================
 */

export * from "./types";
