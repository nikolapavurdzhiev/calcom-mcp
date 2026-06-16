/** Webhook tools. */

import { z } from "zod";
import { defineTool, apiVersionArg, bodyArg } from "./types.js";

export const webhookTools = [
  defineTool({
    name: "cal_list_webhooks",
    title: "List webhooks",
    description: "List webhooks (GET /v2/webhooks).",
    schema: {
      take: z.number().int().positive().optional().describe("Page size."),
      skip: z.number().int().nonnegative().optional().describe("Offset."),
      ...apiVersionArg,
    },
    handler: (client, args) => {
      const { apiVersion, ...query } = args;
      return client.request("GET", "/v2/webhooks", {
        query: Object.keys(query).length ? query : undefined,
        apiVersion,
        family: "webhooks",
      });
    },
  }),

  defineTool({
    name: "cal_get_webhook",
    title: "Get a webhook",
    description: "Get a webhook by id (GET /v2/webhooks/{id}).",
    schema: {
      webhookId: z.string().describe("Webhook id."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("GET", `/v2/webhooks/${encodeURIComponent(args.webhookId)}`, {
        apiVersion: args.apiVersion,
        family: "webhooks",
      }),
  }),

  defineTool({
    name: "cal_create_webhook",
    title: "Create a webhook",
    description:
      "Create a webhook (POST /v2/webhooks). Body commonly includes: subscriberUrl, triggers " +
      "(e.g. ['BOOKING_CREATED','BOOKING_CANCELLED']), active, payloadTemplate, secret.",
    schema: {
      body: bodyArg,
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("POST", "/v2/webhooks", {
        body: args.body,
        apiVersion: args.apiVersion,
        family: "webhooks",
      }),
  }),

  defineTool({
    name: "cal_update_webhook",
    title: "Update a webhook",
    description: "Update a webhook (PATCH /v2/webhooks/{id}). Pass only the fields to change in `body`.",
    schema: {
      webhookId: z.string().describe("Webhook id to update."),
      body: bodyArg,
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("PATCH", `/v2/webhooks/${encodeURIComponent(args.webhookId)}`, {
        body: args.body,
        apiVersion: args.apiVersion,
        family: "webhooks",
      }),
  }),

  defineTool({
    name: "cal_delete_webhook",
    title: "Delete a webhook",
    description: "Delete a webhook (DELETE /v2/webhooks/{id}). This is irreversible.",
    schema: {
      webhookId: z.string().describe("Webhook id to delete."),
      ...apiVersionArg,
    },
    handler: (client, args) =>
      client.request("DELETE", `/v2/webhooks/${encodeURIComponent(args.webhookId)}`, {
        apiVersion: args.apiVersion,
        family: "webhooks",
      }),
  }),
];
