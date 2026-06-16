/** Event type tools, including graceful 403 fallback for get-by-id. */

import { z } from "zod";
import { defineTool, apiVersionArg, bodyArg } from "./types.js";
import type { CalClient } from "../calClient.js";
import type { CalResult } from "../types.js";

/**
 * Pull the event-type array out of whatever envelope the list endpoint returns.
 * Handles: top-level array, { data: [...] }, { data: { eventTypes: [...] } }, { eventTypes: [...] }.
 */
export function extractEventTypeList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.eventTypes)) return obj.eventTypes as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.eventTypes)) return inner.eventTypes as Record<string, unknown>[];
    }
  }
  return [];
}

/** List event types once and return both the raw result and the normalized array. */
async function listEventTypes(
  client: CalClient,
  apiVersion: string | undefined,
): Promise<{ result: CalResult; list: Record<string, unknown>[] }> {
  const result = await client.request("GET", "/v2/event-types", {
    apiVersion,
    family: "eventTypes",
  });
  return { result, list: result.success ? extractEventTypeList(result.data) : [] };
}

/**
 * Get an event type by id with 403/404 fallback: if the direct endpoint is forbidden
 * or missing, list all event types and filter by id, returning the match with a warning.
 */
export async function getEventTypeWithFallback(
  client: CalClient,
  id: number,
  apiVersion: string | undefined,
): Promise<CalResult> {
  const direct = await client.request("GET", `/v2/event-types/${id}`, {
    apiVersion,
    family: "eventTypes",
  });
  if (direct.success) return direct;

  const status = direct.status_code;
  if (status !== 403 && status !== 404) {
    // A different failure (401, 429, 5xx, network) — return it as-is.
    return direct;
  }

  const { result: listResult, list } = await listEventTypes(client, apiVersion);
  if (!listResult.success) {
    return {
      ...direct,
      warning: `Direct GET /v2/event-types/${id} failed with ${status}, and the list fallback also failed.`,
    };
  }

  const match = list.find((et) => Number(et.id) === id);
  if (!match) {
    return {
      success: false,
      status_code: status,
      request: direct.request,
      error: {
        type: "not_found",
        message: `Direct GET /v2/event-types/${id} returned ${status}, and no event type with id ${id} was found in the list.`,
      },
    };
  }

  return {
    success: true,
    status_code: 200,
    data: match,
    request: listResult.request,
    warning: `Direct GET /v2/event-types/${id} returned ${status} (forbidden/not found for this key); served from GET /v2/event-types instead.`,
  };
}

/** Extract the high-value settings an operator usually wants to audit. */
function settingsSummary(et: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "id",
    "title",
    "slug",
    "hidden",
    "lengthInMinutes",
    "lengthInMinutesOptions",
    "length",
    "beforeEventBuffer",
    "afterEventBuffer",
    "minimumBookingNotice",
    "slotInterval",
    "bookingWindow",
    "bookingLimitsCount",
    "bookingLimitsDuration",
    "confirmationPolicy",
    "requiresConfirmation",
    "locations",
    "bookingFields",
    "seats",
    "seatsPerTimeSlot",
    "disableGuests",
    "disableCancelling",
    "disableRescheduling",
    "schedulingType",
    "scheduleId",
    "bookingUrl",
    "calVideoSettings",
    "price",
    "currency",
  ];
  const summary: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in et) summary[k] = et[k];
  }
  // Payment / app metadata is nested under metadata.apps (e.g. stripe).
  const metadata = et.metadata as Record<string, unknown> | undefined;
  if (metadata && typeof metadata === "object") {
    summary.metadata = metadata;
    if (metadata.apps) summary.apps = metadata.apps;
  }
  return summary;
}

export const eventTypeTools = [
  defineTool({
    name: "cal_list_event_types",
    title: "List event types",
    description:
      "List event types (GET /v2/event-types). With no filters this returns the API key owner's event types. " +
      "Optionally filter by username and/or eventSlug for public lookups.",
    schema: {
      username: z.string().optional().describe("Filter to a specific username's public event types."),
      eventSlug: z.string().optional().describe("Filter by event type slug (with username)."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const query: Record<string, unknown> = {};
      if (args.username) query.username = args.username;
      if (args.eventSlug) query.eventSlug = args.eventSlug;
      return client.request("GET", "/v2/event-types", {
        query: Object.keys(query).length ? query : undefined,
        apiVersion: args.apiVersion,
        family: "eventTypes",
      });
    },
  }),

  defineTool({
    name: "cal_get_event_type",
    title: "Get an event type (with 403 fallback)",
    description:
      "Get a single event type by id. Tries GET /v2/event-types/{id}; if that is forbidden (403) or not " +
      "found (404) — common for personal API keys — it falls back to listing and filtering by id, and " +
      "returns the result with a warning.",
    schema: {
      eventTypeId: z.number().int().describe("Event type id."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      getEventTypeWithFallback(client, args.eventTypeId, args.apiVersion),
  }),

  defineTool({
    name: "cal_get_event_type_settings_summary",
    title: "Summarize event type settings",
    description:
      "Fetch an event type (using the same 403 fallback) and return a compact summary of operationally " +
      "important settings: buffers, minimum booking notice, slot interval, booking window, locations, " +
      "booking fields, seats, hidden/public, confirmation policy, payment/app metadata, and lengths.",
    schema: {
      eventTypeId: z.number().int().describe("Event type id."),
      ...apiVersionArg,
    },
    handler: async (client, args) => {
      const result = await getEventTypeWithFallback(client, args.eventTypeId, args.apiVersion);
      if (!result.success || !result.data) return result;
      return {
        ...result,
        data: settingsSummary(result.data as Record<string, unknown>),
      };
    },
  }),

  defineTool({
    name: "cal_find_event_type_by_slug",
    title: "Find an event type by slug",
    description: "List event types and return the one whose slug matches (case-insensitive).",
    schema: {
      slug: z.string().describe("Event type slug, e.g. 'discovery-call'."),
      ...apiVersionArg,
    },
    handler: async (client, args) => {
      const { result, list } = await listEventTypes(client, args.apiVersion);
      if (!result.success) return result;
      const target = args.slug.trim().toLowerCase();
      const match = list.find((et) => String(et.slug ?? "").toLowerCase() === target);
      if (!match) {
        return {
          success: false,
          status_code: result.status_code,
          request: result.request,
          error: {
            type: "not_found",
            message: `No event type found with slug '${args.slug}'. ${list.length} event types were listed.`,
          },
        };
      }
      return { success: true, status_code: 200, data: match, request: result.request };
    },
  }),

  defineTool({
    name: "cal_create_event_type",
    title: "Create an event type",
    description:
      "Create an event type (POST /v2/event-types). Provide the full body per the Cal v2 docs. Common fields: " +
      "title, slug, lengthInMinutes, lengthInMinutesOptions, description, hidden, locations, " +
      "beforeEventBuffer, afterEventBuffer, minimumBookingNotice, slotInterval, bookingFields, scheduleId, " +
      "bookingLimitsCount, confirmationPolicy, seats, price/currency, metadata.",
    schema: {
      body: bodyArg,
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("POST", "/v2/event-types", {
        body: args.body,
        apiVersion: args.apiVersion,
        family: "eventTypes",
      }),
  }),

  defineTool({
    name: "cal_update_event_type",
    title: "Update an event type",
    description:
      "Update an event type (PATCH /v2/event-types/{id}). Pass only the fields to change in `body`.",
    schema: {
      eventTypeId: z.number().int().describe("Event type id to update."),
      body: bodyArg,
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("PATCH", `/v2/event-types/${args.eventTypeId}`, {
        body: args.body,
        apiVersion: args.apiVersion,
        family: "eventTypes",
      }),
  }),

  defineTool({
    name: "cal_delete_event_type",
    title: "Delete an event type",
    description: "Delete an event type (DELETE /v2/event-types/{id}). This is irreversible.",
    schema: {
      eventTypeId: z.number().int().describe("Event type id to delete."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("DELETE", `/v2/event-types/${args.eventTypeId}`, {
        apiVersion: args.apiVersion,
        family: "eventTypes",
      }),
  }),

  defineTool({
    name: "cal_duplicate_event_type",
    title: "Duplicate an event type",
    description:
      "Duplicate an existing event type by reading it (with 403 fallback), then creating a copy with a new " +
      "slug/title. You must provide a unique newSlug. Provide newTitle to override the copied title. " +
      "Use `overrides` to change any other fields on the copy.",
    schema: {
      eventTypeId: z.number().int().describe("Source event type id."),
      newSlug: z.string().describe("Slug for the new copy (must be unique)."),
      newTitle: z.string().optional().describe("Title for the copy. Defaults to '<title> (copy)'."),
      overrides: z.record(z.unknown()).optional().describe("Extra fields to set/override on the copy."),
      ...apiVersionArg,
    },
    handler: async (client, args) => {
      const source = await getEventTypeWithFallback(client, args.eventTypeId, args.apiVersion);
      if (!source.success || !source.data) return source;

      const src = source.data as Record<string, unknown>;
      // Strip server-managed / identity fields that must not be copied.
      const strip = new Set([
        "id",
        "slug",
        "bookingUrl",
        "ownerId",
        "userId",
        "teamId",
        "createdAt",
        "updatedAt",
        "users",
        "hosts",
        "owner",
      ]);
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(src)) {
        if (!strip.has(k)) body[k] = v;
      }
      body.slug = args.newSlug;
      body.title = args.newTitle ?? `${String(src.title ?? "Event")} (copy)`;
      if (args.overrides) Object.assign(body, args.overrides);

      const created = await client.request("POST", "/v2/event-types", {
        body,
        apiVersion: args.apiVersion,
        family: "eventTypes",
      });
      if (created.success && source.warning) {
        return { ...created, warning: `Source read via list fallback. ${source.warning}` };
      }
      return created;
    },
  }),
];
