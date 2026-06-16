/** Shared test utilities: a controllable fetch mock and a config factory. */

import type { CalConfig } from "../src/config.js";

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockFetch {
  fetch: typeof fetch;
  /** All requests captured, in order. */
  calls: CapturedRequest[];
  /** The most recent captured request. */
  last(): CapturedRequest;
}

interface MockResponseSpec {
  status?: number;
  statusText?: string;
  /** Object → JSON-stringified; string → sent as-is. */
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Build a fetch mock. Pass a single response spec (reused for every call) or an array
 * (consumed in order). Captures method/url/headers/parsed-body for assertions.
 */
export function makeMockFetch(spec: MockResponseSpec | MockResponseSpec[]): MockFetch {
  const queue = Array.isArray(spec) ? [...spec] : null;
  const calls: CapturedRequest[] = [];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    let parsedBody: unknown = undefined;
    if (typeof init?.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers,
      body: parsedBody,
    });

    const current = queue ? queue.shift() ?? {} : (spec as MockResponseSpec);
    const status = current.status ?? 200;
    const bodyText =
      current.body === undefined
        ? ""
        : typeof current.body === "string"
          ? current.body
          : JSON.stringify(current.body);

    return new Response(bodyText, {
      status,
      statusText: current.statusText ?? "",
      headers: current.headers ?? { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return {
    fetch: fetchImpl,
    calls,
    last() {
      const c = calls[calls.length - 1];
      if (!c) throw new Error("No fetch calls were captured.");
      return c;
    },
  };
}

export function testConfig(overrides: Partial<CalConfig> = {}): CalConfig {
  return {
    apiKey: "test_key_SECRET123",
    baseUrl: "https://api.cal.eu",
    apiVersion: undefined,
    timeoutMs: 5000,
    debug: false,
    ...overrides,
  };
}
