/**
 * End-to-end: register tools on a real McpServer and drive them through a real MCP Client
 * over a linked in-memory transport. Verifies tool listing and a tool call round-trip,
 * with the HTTP layer mocked.
 */

import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { CalClient } from "../src/calClient.js";
import { registerAllTools, allTools } from "../src/tools/index.js";
import { makeMockFetch, testConfig } from "./helpers.js";

async function connect(calClient: CalClient): Promise<Client> {
  const server = new McpServer({ name: "calcom-mcp-test", version: "0.0.0" });
  registerAllTools(server, calClient);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function parse(result: { content: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  const text = result.content.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

describe("MCP server integration", () => {
  it("lists every registered tool over the protocol", async () => {
    const calClient = new CalClient(testConfig(), makeMockFetch({ body: {} }).fetch);
    const client = await connect(calClient);

    const listed = await client.listTools();
    expect(listed.tools.length).toBe(allTools.length);
    const names = listed.tools.map((t) => t.name);
    expect(names).toContain("cal_api_request");
    expect(names).toContain("cal_get_me");

    await client.close();
  });

  it("calls cal_get_me and returns the mocked profile as JSON text", async () => {
    const mock = makeMockFetch({ body: { data: { username: "demo-user" } } });
    const client = await connect(new CalClient(testConfig(), mock.fetch));

    const result = (await client.callTool({ name: "cal_get_me", arguments: {} })) as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    expect(result.isError).toBeFalsy();
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect((payload.data as Record<string, unknown>).data).toMatchObject({
      username: "demo-user",
    });

    await client.close();
  });

  it("surfaces a tool error (isError) with a redacted message", async () => {
    const mock = makeMockFetch({ status: 401, body: { message: "bad key test_key_SECRET123" } });
    const client = await connect(new CalClient(testConfig(), mock.fetch));

    const result = (await client.callTool({ name: "cal_get_me", arguments: {} })) as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };

    expect(result.isError).toBe(true);
    const text = result.content.find((c) => c.type === "text")?.text ?? "";
    expect(text).not.toContain("test_key_SECRET123");

    await client.close();
  });
});
