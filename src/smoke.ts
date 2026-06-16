#!/usr/bin/env node
/**
 * Manual smoke test. Requires a real CALCOM_API_KEY in the environment.
 *
 * Safely calls a few read-only endpoints and prints a concise, non-sensitive summary:
 *   GET /v2/me
 *   GET /v2/event-types
 *   GET /v2/bookings?status=upcoming&limit=5
 *
 * Run: `npm run smoke`  (uses tsx)  — or after build: `npm run smoke:dist`.
 * The API key is never printed.
 */

import { loadEnvFiles } from "./env.js";
import { loadConfig, ConfigError } from "./config.js";
import { CalClient } from "./calClient.js";
import { extractEventTypeList } from "./tools/eventTypes.js";
import type { CalResult } from "./types.js";

function line(label: string, ok: boolean, detail: string): void {
  const mark = ok ? "OK " : "ERR";
  process.stdout.write(`  [${mark}] ${label.padEnd(28)} ${detail}\n`);
}

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.bookings)) return inner.bookings;
    }
    if (Array.isArray(obj.bookings)) return obj.bookings;
  }
  return [];
}

function summarizeError(result: CalResult): string {
  const code = result.status_code ? `${result.status_code} ` : "";
  return `${code}${result.error?.type ?? "error"}: ${result.error?.message ?? "unknown error"}`;
}

async function main(): Promise<void> {
  loadEnvFiles();
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`Configuration error: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  process.stdout.write(`Cal.com MCP smoke test\n`);
  process.stdout.write(`  Base URL: ${config.baseUrl}\n`);
  process.stdout.write(`  API key:  ${config.apiKey ? "set (hidden)" : "MISSING"}\n\n`);

  const client = new CalClient(config);
  let failures = 0;

  // 1) Profile
  const me = await client.request("GET", "/v2/me", { family: "me" });
  if (me.success) {
    const data = (me.data as Record<string, unknown>) ?? {};
    const profile = (data.data as Record<string, unknown>) ?? data;
    const username = profile.username ?? "(unknown)";
    const tz = profile.timeZone ?? profile.timezone ?? "(unknown)";
    line("GET /v2/me", true, `username=${username} timeZone=${tz}`);
  } else {
    failures++;
    line("GET /v2/me", false, summarizeError(me));
  }

  // 2) Event types
  const ets = await client.request("GET", "/v2/event-types", { family: "eventTypes" });
  if (ets.success) {
    const list = extractEventTypeList(ets.data);
    line("GET /v2/event-types", true, `${list.length} event type(s)`);
  } else {
    failures++;
    line("GET /v2/event-types", false, summarizeError(ets));
  }

  // 3) Upcoming bookings (limit 5)
  const bookings = await client.request("GET", "/v2/bookings", {
    query: { status: "upcoming", limit: 5 },
    family: "bookings",
  });
  if (bookings.success) {
    const list = asArray(bookings.data);
    line("GET /v2/bookings (upcoming)", true, `${list.length} upcoming (max 5)`);
  } else {
    failures++;
    line("GET /v2/bookings (upcoming)", false, summarizeError(bookings));
  }

  process.stdout.write(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`Smoke test crashed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
