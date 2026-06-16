/** Booking tools. */

import { z } from "zod";
import { defineTool, apiVersionArg } from "./types.js";

const statusValues = ["upcoming", "recurring", "past", "cancelled", "unconfirmed"] as const;

export const bookingTools = [
  defineTool({
    name: "cal_list_bookings",
    title: "List bookings",
    description:
      "List bookings (GET /v2/bookings) with optional filters. `status` accepts one value or several " +
      "(upcoming, recurring, past, cancelled, unconfirmed). Pagination uses `take`/`skip` per current docs; " +
      "`limit` is also forwarded for compatibility.",
    schema: {
      status: z
        .union([z.enum(statusValues), z.array(z.enum(statusValues))])
        .optional()
        .describe("Filter by booking status. One value or an array."),
      attendeeEmail: z.string().optional().describe("Filter by attendee email."),
      attendeeName: z.string().optional().describe("Filter by attendee name."),
      eventTypeId: z.number().int().optional().describe("Filter by event type id."),
      afterStart: z.string().optional().describe("ISO 8601 lower bound on booking start."),
      beforeEnd: z.string().optional().describe("ISO 8601 upper bound on booking end."),
      sortStart: z.enum(["asc", "desc"]).optional().describe("Sort by start time."),
      take: z.number().int().positive().optional().describe("Page size (canonical)."),
      skip: z.number().int().nonnegative().optional().describe("Items to skip (offset)."),
      limit: z.number().int().positive().optional().describe("Alias for page size; forwarded as-is."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const { apiVersion, ...query } = args;
      return client.request("GET", "/v2/bookings", { query, apiVersion, family: "bookings" });
    },
  }),

  defineTool({
    name: "cal_get_booking",
    title: "Get a booking by UID",
    description: "Get a single booking by its UID (GET /v2/bookings/{uid}).",
    schema: {
      uid: z.string().describe("Booking UID."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("GET", `/v2/bookings/${encodeURIComponent(args.uid)}`, {
        apiVersion: args.apiVersion,
        family: "bookings",
      }),
  }),

  defineTool({
    name: "cal_create_booking",
    title: "Create a booking",
    description:
      "Create a booking (POST /v2/bookings). Requires eventTypeId, start (ISO 8601) and an attendee " +
      "{ name, email, timeZone? }. Optionally set lengthInMinutes, location, guests and metadata.",
    schema: {
      eventTypeId: z.number().int().describe("Event type id to book."),
      start: z.string().describe("Start time in ISO 8601, e.g. 2026-07-01T09:00:00Z."),
      attendee: z
        .object({
          name: z.string(),
          email: z.string().email(),
          timeZone: z.string().optional(),
          language: z.string().optional(),
          phoneNumber: z.string().optional(),
        })
        .describe("Primary attendee."),
      lengthInMinutes: z
        .number()
        .int()
        .optional()
        .describe("Duration override (must be one of the event type's allowed lengths)."),
      location: z
        .record(z.unknown())
        .optional()
        .describe("Location object, e.g. { type: 'integration', integration: 'google-meet' } or { type: 'phone', phone: '+1...' }."),
      guests: z.array(z.string().email()).optional().describe("Additional guest emails."),
      metadata: z.record(z.unknown()).optional().describe("Arbitrary metadata."),
      bookingFieldsResponses: z
        .record(z.unknown())
        .optional()
        .describe("Responses to custom booking fields, keyed by field slug."),
      idempotencyKey: z.string().optional().describe("Optional Idempotency-Key header."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const { apiVersion, idempotencyKey, ...body } = args;
      return client.request("POST", "/v2/bookings", {
        body,
        apiVersion,
        idempotencyKey,
        family: "bookings",
      });
    },
  }),

  defineTool({
    name: "cal_cancel_booking",
    title: "Cancel a booking",
    description: "Cancel a booking (POST /v2/bookings/{uid}/cancel). Optionally include a cancellation reason.",
    schema: {
      uid: z.string().describe("Booking UID to cancel."),
      cancellationReason: z.string().optional().describe("Reason shown to attendees."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("POST", `/v2/bookings/${encodeURIComponent(args.uid)}/cancel`, {
        body: args.cancellationReason ? { cancellationReason: args.cancellationReason } : {},
        apiVersion: args.apiVersion,
        family: "bookings",
      }),
  }),

  defineTool({
    name: "cal_reschedule_booking",
    title: "Reschedule a booking",
    description:
      "Reschedule a booking to a new start time (POST /v2/bookings/{uid}/reschedule). Returns the new booking.",
    schema: {
      uid: z.string().describe("Booking UID to reschedule."),
      start: z.string().describe("New start time in ISO 8601."),
      reschedulingReason: z.string().optional().describe("Reason for rescheduling."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("POST", `/v2/bookings/${encodeURIComponent(args.uid)}/reschedule`, {
        body: {
          start: args.start,
          ...(args.reschedulingReason ? { reschedulingReason: args.reschedulingReason } : {}),
        },
        apiVersion: args.apiVersion,
        family: "bookings",
      }),
  }),

  defineTool({
    name: "cal_mark_booking_no_show",
    title: "Mark booking absent / no-show",
    description:
      "Mark a booking's host or attendees as absent (POST /v2/bookings/{uid}/mark-absent). " +
      "Set noShowHost true to mark the host, and/or pass attendees [{ email, absent }].",
    schema: {
      uid: z.string().describe("Booking UID."),
      noShowHost: z.boolean().optional().describe("Mark the host as a no-show."),
      attendees: z
        .array(z.object({ email: z.string().email(), absent: z.boolean() }))
        .optional()
        .describe("Per-attendee absence flags."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const body: Record<string, unknown> = {};
      if (args.noShowHost !== undefined) body.noShowHost = args.noShowHost;
      if (args.attendees !== undefined) body.attendees = args.attendees;
      return client.request("POST", `/v2/bookings/${encodeURIComponent(args.uid)}/mark-absent`, {
        body,
        apiVersion: args.apiVersion,
        family: "bookings",
      });
    },
  }),
];
