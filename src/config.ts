/**
 * Configuration loading from environment variables.
 *
 * Environment variables:
 *   CALCOM_API_KEY      (required)  Cal.com / Cal.eu API key. Sent as a Bearer token.
 *   CALCOM_BASE_URL     (optional)  API base URL. Default: https://api.cal.eu
 *   CALCOM_API_VERSION  (optional)  Fallback cal-api-version when an endpoint has no
 *                                   known default and no per-call override is supplied.
 *   CALCOM_TIMEOUT_MS   (optional)  Per-request timeout in milliseconds. Default: 30000
 *   CALCOM_DEBUG        (optional)  When truthy, log redacted request/response info to stderr.
 */

export interface CalConfig {
  apiKey: string;
  baseUrl: string;
  /** Fallback cal-api-version. May be undefined; the client falls back further if so. */
  apiVersion?: string;
  timeoutMs: number;
  debug: boolean;
}

export const DEFAULT_BASE_URL = "https://api.cal.eu";
export const DEFAULT_TIMEOUT_MS = 30_000;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on", "debug"].includes(value.trim().toLowerCase());
}

/** Remove a single trailing slash so `${baseUrl}${path}` never doubles up. */
function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Build a {@link CalConfig} from an environment-like record.
 * Pass an explicit record in tests; defaults to `process.env`.
 *
 * @throws {ConfigError} when CALCOM_API_KEY is missing/blank or values are invalid.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): CalConfig {
  const apiKey = env.CALCOM_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError(
      "CALCOM_API_KEY is required but was not set. Provide it via the MCP client env or your shell.",
    );
  }

  const baseUrl = normalizeBaseUrl(env.CALCOM_BASE_URL?.trim() || DEFAULT_BASE_URL);
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new ConfigError(
      `CALCOM_BASE_URL must start with http:// or https:// (got: ${JSON.stringify(baseUrl)}).`,
    );
  }

  const apiVersion = env.CALCOM_API_VERSION?.trim() || undefined;

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (env.CALCOM_TIMEOUT_MS != null && env.CALCOM_TIMEOUT_MS.trim() !== "") {
    const parsed = Number(env.CALCOM_TIMEOUT_MS);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new ConfigError(
        `CALCOM_TIMEOUT_MS must be a positive number of milliseconds (got: ${JSON.stringify(env.CALCOM_TIMEOUT_MS)}).`,
      );
    }
    timeoutMs = Math.floor(parsed);
  }

  return {
    apiKey,
    baseUrl,
    apiVersion,
    timeoutMs,
    debug: truthy(env.CALCOM_DEBUG),
  };
}
