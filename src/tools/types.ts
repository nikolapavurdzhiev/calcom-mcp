/** Tool definition framework shared by every tool module. */

import { z } from "zod";
import type { CalClient } from "../calClient.js";
import type { CalResult } from "../types.js";

/** A registered tool, decoupled from the MCP server so handlers are unit-testable. */
export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  /** Raw zod shape passed straight to `server.registerTool({ inputSchema })`. */
  inputSchema: z.ZodRawShape;
  handler: (client: CalClient, args: Record<string, unknown>) => Promise<CalResult>;
}

/**
 * Type-safe tool factory. Define the input as a raw zod shape; the handler receives
 * the fully parsed/typed args.
 */
export function defineTool<S extends z.ZodRawShape>(def: {
  name: string;
  title: string;
  description: string;
  schema: S;
  handler: (client: CalClient, args: z.infer<z.ZodObject<S>>) => Promise<CalResult>;
}): ToolDefinition {
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    inputSchema: def.schema,
    handler: def.handler as ToolDefinition["handler"],
  };
}

/** Optional per-call `cal-api-version` override, spread into tool schemas. */
export const apiVersionArg = {
  apiVersion: z
    .string()
    .optional()
    .describe(
      "Override the cal-api-version header for this single call (e.g. '2024-08-13'). Defaults to the endpoint's known-good version.",
    ),
};

/** Freeform JSON body for endpoints whose payload schema is large/evolving. */
export const bodyArg = z
  .record(z.unknown())
  .describe("JSON request body as an object. See the Cal.com v2 docs for the endpoint's fields.");
