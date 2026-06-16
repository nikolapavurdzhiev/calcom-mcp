import { describe, it, expect } from "vitest";
import { CalClient } from "../src/calClient.js";
import { allTools, runTool } from "../src/tools/index.js";
import { extractEventTypeList, getEventTypeWithFallback } from "../src/tools/eventTypes.js";
import type { ToolDefinition } from "../src/tools/types.js";
import { makeMockFetch, testConfig } from "./helpers.js";

function tool(name: string): ToolDefinition {
  const def = allTools.find((t) => t.name === name);
  if (!def) throw new Error(`tool not found: ${name}`);
  return def;
}

describe("tool registry", () => {
  it("registers the generic tool and the documented convenience tools", () => {
    const names = allTools.map((t) => t.name);
    for (const expected of [
      "cal_api_request",
      "cal_get_me",
      "cal_list_bookings",
      "cal_get_booking",
      "cal_create_booking",
      "cal_cancel_booking",
      "cal_reschedule_booking",
      "cal_mark_booking_no_show",
      "cal_list_event_types",
      "cal_get_event_type",
      "cal_create_event_type",
      "cal_update_event_type",
      "cal_delete_event_type",
      "cal_duplicate_event_type",
      "cal_find_event_type_by_slug",
      "cal_get_event_type_settings_summary",
      "cal_get_available_slots",
      "cal_list_schedules",
      "cal_get_default_schedule",
      "cal_list_calendars",
      "cal_list_webhooks",
    ]) {
      expect(names, `missing tool ${expected}`).toContain(expected);
    }
    expect(new Set(names).size).toBe(names.length); // no duplicate names
  });
});

describe("extractEventTypeList", () => {
  it("normalizes the common envelope shapes", () => {
    expect(extractEventTypeList([{ id: 1 }])).toHaveLength(1);
    expect(extractEventTypeList({ data: [{ id: 1 }, { id: 2 }] })).toHaveLength(2);
    expect(extractEventTypeList({ data: { eventTypes: [{ id: 9 }] } })).toHaveLength(1);
    expect(extractEventTypeList({ eventTypes: [{ id: 9 }] })).toHaveLength(1);
    expect(extractEventTypeList({ nope: true })).toHaveLength(0);
  });
});

describe("cal_list_event_types", () => {
  it("parses the list and forwards the eventTypes version", async () => {
    const mock = makeMockFetch({
      body: { status: "success", data: [{ id: 1001, slug: "intro-call" }] },
    });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await runTool(tool("cal_list_event_types"), client, {});

    expect(res.success).toBe(true);
    expect(extractEventTypeList(res.data)).toHaveLength(1);
    expect(mock.last().headers["cal-api-version"]).toBe("2024-06-14");
    expect(mock.last().url).toBe("https://api.cal.eu/v2/event-types");
  });
});

describe("cal_get_event_type 403 fallback", () => {
  it("falls back to list-and-filter when the direct endpoint is forbidden", async () => {
    const mock = makeMockFetch([
      { status: 403, body: { message: "forbidden" } }, // GET /v2/event-types/1003
      { body: { data: [{ id: 1002, slug: "follow-up" }, { id: 1003, slug: "discovery-call" }] } },
    ]);
    const client = new CalClient(testConfig(), mock.fetch);

    const res = await getEventTypeWithFallback(client, 1003, undefined);

    expect(res.success).toBe(true);
    expect((res.data as Record<string, unknown>).slug).toBe("discovery-call");
    expect(res.warning).toMatch(/403/);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0]!.url).toBe("https://api.cal.eu/v2/event-types/1003");
    expect(mock.calls[1]!.url).toBe("https://api.cal.eu/v2/event-types");
  });

  it("returns the direct success when the by-id endpoint works", async () => {
    const mock = makeMockFetch({ body: { data: { id: 5, slug: "ok" } } });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await getEventTypeWithFallback(client, 5, undefined);
    expect(res.success).toBe(true);
    expect(res.warning).toBeUndefined();
    expect(mock.calls).toHaveLength(1);
  });

  it("does NOT fall back on non-403/404 errors (e.g. 401)", async () => {
    const mock = makeMockFetch({ status: 401, body: { message: "bad key" } });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await getEventTypeWithFallback(client, 5, undefined);
    expect(res.success).toBe(false);
    expect(res.status_code).toBe(401);
    expect(mock.calls).toHaveLength(1); // no list attempt
  });
});

describe("cal_find_event_type_by_slug", () => {
  it("matches a slug case-insensitively", async () => {
    const mock = makeMockFetch({
      body: { data: [{ id: 1, slug: "intro-call" }, { id: 2, slug: "discovery-call" }] },
    });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await runTool(tool("cal_find_event_type_by_slug"), client, { slug: "Discovery-Call" });
    expect(res.success).toBe(true);
    expect((res.data as Record<string, unknown>).id).toBe(2);
  });
});

describe("cal_list_bookings", () => {
  it("forwards filters and the bookings version", async () => {
    const mock = makeMockFetch({ body: { data: [{ uid: "abc" }] } });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await runTool(tool("cal_list_bookings"), client, { status: "upcoming", limit: 5 });
    expect(res.success).toBe(true);
    const call = mock.last();
    expect(call.url).toBe("https://api.cal.eu/v2/bookings?status=upcoming&limit=5");
    expect(call.headers["cal-api-version"]).toBe("2024-08-13");
  });
});

describe("cal_api_request (generic)", () => {
  it("performs a POST with a JSON body to an arbitrary path", async () => {
    const mock = makeMockFetch({ status: 201, body: { id: 99 } });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await runTool(tool("cal_api_request"), client, {
      method: "POST",
      path: "/v2/webhooks",
      body: { subscriberUrl: "https://example.com/hook", triggers: ["BOOKING_CREATED"] },
    });
    expect(res.success).toBe(true);
    const call = mock.last();
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://api.cal.eu/v2/webhooks");
    expect(call.body).toEqual({
      subscriberUrl: "https://example.com/hook",
      triggers: ["BOOKING_CREATED"],
    });
  });

  it("rejects an invalid path before making any request", async () => {
    const mock = makeMockFetch({ body: {} });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await runTool(tool("cal_api_request"), client, {
      method: "GET",
      path: "https://evil.example.com",
    });
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe("invalid_path");
    expect(mock.calls).toHaveLength(0);
  });
});
