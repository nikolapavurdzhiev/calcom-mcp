/**
 * CalClient: a thin, safe wrapper over the Cal.com / Cal.eu v2 REST API.
 *
 * Responsibilities:
 *   - Build URLs strictly from CALCOM_BASE_URL (no arbitrary external hosts).
 *   - Attach auth + cal-api-version headers.
 *   - Enforce a per-request timeout.
 *   - Normalize every outcome into a {@link CalResult} (success or structured error).
 *   - Redact the API key from every message, error, and debug log.
 */

import type { CalConfig } from "./config.js";
import { resolveApiVersion, type EndpointFamily } from "./apiVersions.js";
import type {
  CalResult,
  HttpMethod,
  RequestOptions,
  RequestSummary,
} from "./types.js";

/** Status-specific guidance surfaced in error messages for common failures. */
const STATUS_HINTS: Record<number, { type: string; hint: string }> = {
  400: { type: "bad_request", hint: "The request was rejected. Check the body/params and the cal-api-version." },
  401: { type: "unauthorized", hint: "Invalid or missing API key. Verify CALCOM_API_KEY." },
  403: {
    type: "forbidden",
    hint: "The API key lacks access to this resource. Some endpoints (e.g. GET /v2/event-types/{id}) are commonly forbidden for personal keys; try the list endpoint instead.",
  },
  404: { type: "not_found", hint: "The endpoint or object was not found. Check the path/id and base URL." },
  409: { type: "conflict", hint: "Conflict, e.g. a duplicate slug or an idempotency clash." },
  422: { type: "unprocessable_entity", hint: "Validation failed on Cal's side. Check required fields and value formats." },
  429: { type: "rate_limited", hint: "Rate limit hit. Back off and retry after a short delay." },
};

export class CalClient {
  private readonly config: CalConfig;
  private readonly fetchImpl: typeof fetch;

  /**
   * @param config  loaded configuration
   * @param fetchImpl  injectable fetch (defaults to global fetch); tests pass a mock.
   */
  constructor(config: CalConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /** Replace any occurrence of the API key with a redaction marker. */
  redact(text: string): string {
    if (!text) return text;
    const key = this.config.apiKey;
    if (!key) return text;
    // Replace the full key and, defensively, the bearer form.
    return text.split(key).join("***REDACTED***");
  }

  private debugLog(...parts: unknown[]): void {
    if (!this.config.debug) return;
    const line = parts
      .map((p) => (typeof p === "string" ? p : safeStringify(p)))
      .join(" ");
    // stderr only — stdout is reserved for the MCP stdio transport.
    process.stderr.write(`[calcom-mcp] ${this.redact(line)}\n`);
  }

  /**
   * Perform a request. Always resolves (never rejects) with a {@link CalResult}.
   *
   * @param method HTTP method
   * @param path   must start with "/" (e.g. "/v2/bookings"). External URLs are rejected.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<CalResult<T>> {
    const family: EndpointFamily = options.family ?? "default";
    const apiVersion = resolveApiVersion(options.apiVersion, family, this.config.apiVersion);

    // --- Path validation: only our base host, never arbitrary URLs. ---
    if (typeof path !== "string" || !path.startsWith("/")) {
      return {
        success: false,
        error: {
          type: "invalid_path",
          message: `path must be a string starting with "/" (got: ${JSON.stringify(path)}). Only ${this.config.baseUrl} is callable.`,
        },
      };
    }
    if (/^https?:\/\//i.test(path) || path.startsWith("//")) {
      return {
        success: false,
        error: {
          type: "invalid_path",
          message: "Absolute/external URLs are not allowed. Provide a path like /v2/bookings; requests only go to the configured base URL.",
        },
      };
    }

    let url: URL;
    try {
      url = new URL(this.config.baseUrl + path);
    } catch (err) {
      return {
        success: false,
        error: {
          type: "invalid_path",
          message: `Could not build a URL from base + path: ${this.redact(String(err))}`,
        },
      };
    }
    appendQuery(url, options.query);

    const hasBody = options.body !== undefined && method !== "GET";
    const summary: RequestSummary = {
      method,
      url: url.toString(),
      path,
      apiVersion,
      hasBody,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "cal-api-version": apiVersion,
      Accept: "application/json",
    };
    if (hasBody) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    this.debugLog(`-> ${method} ${url.toString()} (cal-api-version: ${apiVersion})`);
    if (hasBody) this.debugLog("   body:", options.body);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body: hasBody ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        success: false,
        request: summary,
        error: {
          type: aborted ? "timeout" : "network_error",
          message: aborted
            ? `Request timed out after ${this.config.timeoutMs}ms.`
            : `Network error contacting Cal API: ${this.redact(errMessage(err))}`,
        },
      };
    } finally {
      clearTimeout(timer);
    }

    const status = response.status;
    const rawText = await safeReadText(response);
    const parsed = tryParseJson(rawText);

    this.debugLog(`<- ${status} ${method} ${path}`);

    if (response.ok) {
      return {
        success: true,
        status_code: status,
        data: (parsed ?? rawText ?? null) as T,
        request: summary,
      };
    }

    // --- Non-2xx: build a structured, redacted error. ---
    const hint = STATUS_HINTS[status];
    const serverMessage = extractServerMessage(parsed);
    const messageParts = [
      `Cal API returned ${status}${response.statusText ? ` ${response.statusText}` : ""}.`,
      hint?.hint,
      serverMessage ? `Cal says: ${serverMessage}` : undefined,
    ].filter(Boolean);

    return {
      success: false,
      status_code: status,
      request: summary,
      error: {
        type: hint?.type ?? (status >= 500 ? "server_error" : "http_error"),
        message: this.redact(messageParts.join(" ")),
        details: redactDeep(parsed ?? rawText, this.config.apiKey),
      },
    };
  }
}

// --------------------------- helpers ---------------------------

function appendQuery(url: URL, query: Record<string, unknown> | undefined): void {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.append(key, String(value));
    }
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function tryParseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Pull a human-readable message out of a Cal error payload, if present. */
function extractServerMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const obj = parsed as Record<string, unknown>;
  const candidates: unknown[] = [
    obj.message,
    (obj.error as Record<string, unknown> | undefined)?.message,
    obj.error,
    obj.detail,
    (obj.data as Record<string, unknown> | undefined)?.message,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Recursively redact the API key from any string within a value. */
function redactDeep(value: unknown, key: string): unknown {
  if (!key) return value;
  if (typeof value === "string") return value.split(key).join("***REDACTED***");
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, key));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v, key);
    return out;
  }
  return value;
}
