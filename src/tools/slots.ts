/** Availability / slots tools. */

import { z } from "zod";
import { defineTool, apiVersionArg } from "./types.js";

export const slotTools = [
  defineTool({
    name: "cal_get_available_slots",
    title: "Get available slots",
    description:
      "Get available time slots (GET /v2/slots). Provide either eventTypeId, or username + eventTypeSlug. " +
      "`start` and `end` accept dates (YYYY-MM-DD) or ISO 8601 timestamps. Optionally set timeZone, " +
      "duration (minutes) and format ('range' for start/end pairs).",
    schema: {
      eventTypeId: z.number().int().optional().describe("Event type id to check."),
      username: z.string().optional().describe("Username (with eventTypeSlug) for public lookups."),
      eventTypeSlug: z.string().optional().describe("Event type slug (with username)."),
      start: z.string().describe("Range start: YYYY-MM-DD or ISO 8601."),
      end: z.string().describe("Range end: YYYY-MM-DD or ISO 8601."),
      timeZone: z.string().optional().describe("IANA time zone, e.g. 'Europe/Warsaw'. Defaults to UTC."),
      duration: z.number().int().positive().optional().describe("Slot duration in minutes."),
      format: z.enum(["range", "object"]).optional().describe("Output format. 'range' = start/end pairs."),
      bookingUidToReschedule: z
        .string()
        .optional()
        .describe("Exclude this booking's current slot from results when rescheduling."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const { apiVersion, ...rest } = args;
      const query: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) query[k] = v;
      }
      return client.request("GET", "/v2/slots", { query, apiVersion, family: "slots" });
    },
  }),
];

/** Backwards-friendly alias name some agents may reach for. */
export const slotAliasTools = [
  defineTool({
    name: "cal_get_availability",
    title: "Get availability (alias of cal_get_available_slots)",
    description: "Alias for cal_get_available_slots. Get available time slots (GET /v2/slots).",
    schema: {
      eventTypeId: z.number().int().optional().describe("Event type id to check."),
      username: z.string().optional().describe("Username (with eventTypeSlug)."),
      eventTypeSlug: z.string().optional().describe("Event type slug (with username)."),
      start: z.string().describe("Range start: YYYY-MM-DD or ISO 8601."),
      end: z.string().describe("Range end: YYYY-MM-DD or ISO 8601."),
      timeZone: z.string().optional().describe("IANA time zone. Defaults to UTC."),
      duration: z.number().int().positive().optional().describe("Slot duration in minutes."),
      format: z.enum(["range", "object"]).optional().describe("Output format."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const { apiVersion, ...rest } = args;
      const query: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) query[k] = v;
      }
      return client.request("GET", "/v2/slots", { query, apiVersion, family: "slots" });
    },
  }),
];
