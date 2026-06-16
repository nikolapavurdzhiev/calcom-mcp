/** Aggregates every tool and registers them on an McpServer. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CalClient } from "../calClient.js";
import type { CalResult } from "../types.js";
import type { ToolDefinition } from "./types.js";

import { genericTools } from "./generic.js";
import { accountTools } from "./account.js";
import { bookingTools } from "./bookings.js";
import { eventTypeTools } from "./eventTypes.js";
import { slotTools, slotAliasTools } from "./slots.js";
import { scheduleTools } from "./schedules.js";
import { calendarTools } from "./calendars.js";
import { webhookTools } from "./webhooks.js";

/** Every tool exposed by the server, in a sensible listing order. */
export const allTools: ToolDefinition[] = [
  ...genericTools,
  ...accountTools,
  ...bookingTools,
  ...eventTypeTools,
  ...slotTools,
  ...slotAliasTools,
  ...scheduleTools,
  ...calendarTools,
  ...webhookTools,
];

/**
 * Run a tool handler defensively: handler exceptions become structured errors
 * (with the API key redacted) instead of crashing the server.
 */
export async function runTool(
  def: ToolDefinition,
  client: CalClient,
  args: Record<string, unknown>,
): Promise<CalResult> {
  try {
    return await def.handler(client, args);
  } catch (err) {
    const raw = err instanceof Error ? (err.stack ?? err.message) : String(err);
    return {
      success: false,
      error: {
        type: "tool_error",
        message: client.redact(`Unexpected error in ${def.name}: ${raw}`),
      },
    };
  }
}

export function registerAllTools(server: McpServer, client: CalClient): void {
  for (const def of allTools) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        const result = await runTool(def, client, args);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      },
    );
  }
}
