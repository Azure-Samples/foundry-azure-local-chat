// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Runtime Environment
 *
 * Single access point for all VITE_* configuration, supporting runtime injection
 * in Docker/Kubernetes deployments.
 *
 * In Docker, the entrypoint script reads ALL VITE_* env vars from the pod
 * and writes them to window.__RUNTIME_CONFIG__. This lets Helm charts inject
 * any VITE_* variable without rebuilding the image.
 *
 * Fallback order:
 * 1. window.__RUNTIME_CONFIG__.VITE_xxx (set by docker-entrypoint.sh at container startup)
 * 2. import.meta.env.VITE_xxx (baked at Vite build time)
 */

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Record<string, string>;
  }
}

const runtime = typeof window !== "undefined" ? (window.__RUNTIME_CONFIG__ ?? {}) : {};

const metaEnv: Record<string, string> = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

/**
 * Get a VITE_* config value with runtime override support.
 * Usage: env("VITE_API_URL", "/api")
 */
export const env = (key: string, fallback = ""): string =>
  runtime[key] || metaEnv[key] || fallback;
