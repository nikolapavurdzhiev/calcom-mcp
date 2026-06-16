/** Shared result and request shapes used by the client and every tool. */

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** A non-secret summary of the outbound request, safe to return to the model/user. */
export interface RequestSummary {
  method: HttpMethod;
  /** Full URL with the base host, query string included. Never contains the API key. */
  url: string;
  path: string;
  apiVersion: string;
  hasBody: boolean;
}

/** Structured error returned on any non-2xx response or transport failure. */
export interface CalErrorObject {
  /** Machine-readable error kind, e.g. "unauthorized", "forbidden", "timeout". */
  type: string;
  /** Human-friendly explanation, already redacted. */
  message: string;
  /** Raw response body (parsed JSON or text) when available, redacted. */
  details?: unknown;
}

/**
 * Uniform result returned by `CalClient.request` and by every tool handler.
 * This is what gets serialized into the MCP tool response.
 */
export interface CalResult<T = unknown> {
  success: boolean;
  /** HTTP status code when a response was received. Absent for transport errors. */
  status_code?: number;
  /** Parsed response payload on success. */
  data?: T;
  /** Present when success is false. */
  error?: CalErrorObject;
  /** Non-secret description of the request that was made. */
  request?: RequestSummary;
  /** Optional advisory note (e.g. a 403 fallback was used). */
  warning?: string;
}

export interface RequestOptions {
  query?: Record<string, unknown> | undefined;
  body?: unknown;
  /** Per-call cal-api-version override. */
  apiVersion?: string | undefined;
  /** Endpoint family used to pick a default cal-api-version. Defaults to "default". */
  family?: import("./apiVersions.js").EndpointFamily;
  /** Sends an `Idempotency-Key` header when provided. */
  idempotencyKey?: string | undefined;
}
