/** The generic full-access tool: cal_api_request. */

import { z } from "zod";
import { defineTool, apiVersionArg } from "./types.js";
import type { HttpMethod } from "../types.js";

export const genericTools = [
  defineTool({
    name: "cal_api_request",
    title: "Cal API request (generic)",
    description:
      "Call ANY Cal.com / Cal.eu v2 endpoint. Use this for endpoints not covered by a dedicated tool. " +
      "The path must start with '/' (e.g. '/v2/event-types'); only the configured base URL is contacted — external URLs are rejected. " +
      "Returns a structured result: { success, status_code, data | error, request }.",
    schema: {
      method: z
        .enum(["GET", "POST", "PATCH", "PUT", "DELETE"])
        .describe("HTTP method."),
      path: z
        .string()
        .describe("Path beginning with '/', e.g. '/v2/bookings' or '/v2/event-types/123'."),
      query: z
        .record(z.unknown())
        .optional()
        .describe("Query parameters as an object. Array values produce repeated keys."),
      body: z
        .unknown()
        .optional()
        .describe("JSON request body (object). Ignored for GET."),
      apiVersion: apiVersionArg.apiVersion,
      idempotencyKey: z
        .string()
        .optional()
        .describe("Optional Idempotency-Key header for safe retries on POST."),
    },
    handler: (client, args) =>
      client.request(args.method as HttpMethod, args.path, {
        query: args.query,
        body: args.body,
        apiVersion: args.apiVersion,
        idempotencyKey: args.idempotencyKey,
        family: "default",
      }),
  }),
];
