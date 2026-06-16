#!/usr/bin/env node
/**
 * Entry point: a local stdio MCP server bridging an AI agent to the Cal.com / Cal.eu v2 API.
 *
 * Reads configuration from environment variables (see src/config.ts), then exposes a generic
 * `cal_api_request` tool plus strongly-named convenience tools for bookings, event types,
 * availability, schedules, calendars and webhooks.
 *
 * Run: `node dist/index.js` (after `npm run build`) or `npm run dev`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadEnvFiles } from "./env.js";
import { loadConfig, ConfigError } from "./config.js";
import { CalClient } from "./calClient.js";
import { registerAllTools, allTools } from "./tools/index.js";

async function main(): Promise<void> {
  // Load .env.local / .env (client-passed env still wins).
  const envFiles = loadEnvFiles();

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`[calcom-mcp] Configuration error: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const client = new CalClient(config);
  const server = new McpServer({ name: "calcom-mcp", version: "1.0.0" });

  registerAllTools(server, client);

  // Never write anything other than protocol frames to stdout; diagnostics go to stderr.
  if (envFiles.length > 0) {
    process.stderr.write(`[calcom-mcp] Loaded env from: ${envFiles.join(", ")}\n`);
  }
  process.stderr.write(
    `[calcom-mcp] Ready. Base URL: ${config.baseUrl} | tools: ${allTools.length}\n`,
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[calcom-mcp] Fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
