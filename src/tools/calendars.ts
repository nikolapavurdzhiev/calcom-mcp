/** Calendar / integration tools. Best-effort: endpoints vary by account; errors are structured. */

import { z } from "zod";
import { defineTool, apiVersionArg } from "./types.js";

export const calendarTools = [
  defineTool({
    name: "cal_list_calendars",
    title: "List connected calendars",
    description:
      "List connected calendars and their connection status (GET /v2/calendars). Returns a structured " +
      "error if the key/account does not support this endpoint.",
    schema: { ...apiVersionArg },
    handler: (client, args) =>
      client.request("GET", "/v2/calendars", { apiVersion: args.apiVersion, family: "calendars" }),
  }),

  defineTool({
    name: "cal_get_calendar_busy_times",
    title: "Get calendar busy times",
    description:
      "Get busy times across connected calendars (GET /v2/calendars/busy-times). Provide dateFrom/dateTo " +
      "(YYYY-MM-DD or ISO 8601) and the loggedInUsersTz time zone. Some accounts also require " +
      "credentialId and externalId per calendar.",
    schema: {
      loggedInUsersTz: z.string().describe("Caller's IANA time zone, e.g. 'Europe/Warsaw'."),
      dateFrom: z.string().optional().describe("Range start (YYYY-MM-DD or ISO 8601)."),
      dateTo: z.string().optional().describe("Range end (YYYY-MM-DD or ISO 8601)."),
      credentialId: z.number().int().optional().describe("Calendar credential id, if required."),
      externalId: z.string().optional().describe("External calendar id, if required."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const { apiVersion, ...rest } = args;
      const query: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) query[k] = v;
      }
      return client.request("GET", "/v2/calendars/busy-times", {
        query,
        apiVersion,
        family: "calendars",
      });
    },
  }),
];
