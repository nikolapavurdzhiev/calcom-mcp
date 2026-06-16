/** Account / profile tools. */

import { defineTool, apiVersionArg } from "./types.js";

export const accountTools = [
  defineTool({
    name: "cal_get_me",
    title: "Get my Cal profile",
    description:
      "Get the authenticated user's profile (GET /v2/me): email, username, timeZone, default schedule id, etc.",
    schema: { ...apiVersionArg },
    handler: (client, args) =>
      client.request("GET", "/v2/me", { apiVersion: args.apiVersion, family: "me" }),
  }),
];
