/** Schedule (availability template) tools. */

import { z } from "zod";
import { defineTool, apiVersionArg, bodyArg } from "./types.js";

export const scheduleTools = [
  defineTool({
    name: "cal_list_schedules",
    title: "List schedules",
    description: "List the authenticated user's availability schedules (GET /v2/schedules).",
    schema: { ...apiVersionArg },
    handler: (client, args) =>
      client.request("GET", "/v2/schedules", { apiVersion: args.apiVersion, family: "schedules" }),
  }),

  defineTool({
    name: "cal_get_schedule",
    title: "Get a schedule",
    description: "Get a schedule by id (GET /v2/schedules/{id}).",
    schema: {
      scheduleId: z.number().int().describe("Schedule id."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("GET", `/v2/schedules/${args.scheduleId}`, {
        apiVersion: args.apiVersion,
        family: "schedules",
      }),
  }),

  defineTool({
    name: "cal_get_default_schedule",
    title: "Get the default schedule",
    description: "Get the user's default availability schedule (GET /v2/schedules/default).",
    schema: { ...apiVersionArg },
    handler: (client, args) =>
      client.request("GET", "/v2/schedules/default", {
        apiVersion: args.apiVersion,
        family: "schedules",
      }),
  }),

  defineTool({
    name: "cal_create_schedule",
    title: "Create a schedule",
    description:
      "Create an availability schedule (POST /v2/schedules). Body commonly includes: name, timeZone, " +
      "isDefault, and availability [{ days, startTime, endTime }]. See the Cal v2 docs for full schema.",
    schema: {
      body: bodyArg,
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("POST", "/v2/schedules", {
        body: args.body,
        apiVersion: args.apiVersion,
        family: "schedules",
      }),
  }),

  defineTool({
    name: "cal_update_schedule",
    title: "Update a schedule",
    description: "Update a schedule (PATCH /v2/schedules/{id}). Pass only the fields to change in `body`.",
    schema: {
      scheduleId: z.number().int().describe("Schedule id to update."),
      body: bodyArg,
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("PATCH", `/v2/schedules/${args.scheduleId}`, {
        body: args.body,
        apiVersion: args.apiVersion,
        family: "schedules",
      }),
  }),

  defineTool({
    name: "cal_delete_schedule",
    title: "Delete a schedule",
    description: "Delete a schedule (DELETE /v2/schedules/{id}). This is irreversible.",
    schema: {
      scheduleId: z.number().int().describe("Schedule id to delete."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("DELETE", `/v2/schedules/${args.scheduleId}`, {
        apiVersion: args.apiVersion,
        family: "schedules",
      }),
  }),
];
