import { describe, it, expect } from "vitest";
import { CalClient } from "../src/calClient.js";
import { makeMockFetch, testConfig } from "./helpers.js";

describe("CalClient.request", () => {
  it("builds the correct URL, query string and headers", async () => {
    const mock = makeMockFetch({ body: { ok: true } });
    const client = new CalClient(testConfig(), mock.fetch);

    const res = await client.request("GET", "/v2/bookings", {
      query: { status: "upcoming", limit: 5 },
      family: "bookings",
    });

    expect(res.success).toBe(true);
    expect(res.status_code).toBe(200);
    const call = mock.last();
    expect(call.url).toBe("https://api.cal.eu/v2/bookings?status=upcoming&limit=5");
    expect(call.method).toBe("GET");
    expect(call.headers["Authorization"]).toBe("Bearer test_key_SECRET123");
    expect(call.headers["cal-api-version"]).toBe("2024-08-13"); // bookings family default
    expect(call.headers["Accept"]).toBe("application/json");
  });

  it("defaults to the cal.eu base URL", async () => {
    const mock = makeMockFetch({ body: {} });
    const client = new CalClient(testConfig(), mock.fetch);
    await client.request("GET", "/v2/me", { family: "me" });
    expect(mock.last().url.startsWith("https://api.cal.eu/")).toBe(true);
  });

  it("uses the per-endpoint cal-api-version and honors per-call override", async () => {
    const mock = makeMockFetch([{ body: {} }, { body: {} }]);
    const client = new CalClient(testConfig(), mock.fetch);

    await client.request("GET", "/v2/event-types", { family: "eventTypes" });
    expect(mock.calls[0]!.headers["cal-api-version"]).toBe("2024-06-14");

    await client.request("GET", "/v2/event-types", {
      family: "eventTypes",
      apiVersion: "2030-01-01",
    });
    expect(mock.calls[1]!.headers["cal-api-version"]).toBe("2030-01-01");
  });

  it("sends a JSON body on POST and sets Content-Type", async () => {
    const mock = makeMockFetch({ status: 201, body: { id: 1 } });
    const client = new CalClient(testConfig(), mock.fetch);

    const res = await client.request("POST", "/v2/event-types", {
      body: { title: "Test", slug: "test" },
      family: "eventTypes",
    });

    expect(res.success).toBe(true);
    const call = mock.last();
    expect(call.method).toBe("POST");
    expect(call.headers["Content-Type"]).toBe("application/json");
    expect(call.body).toEqual({ title: "Test", slug: "test" });
    expect(res.request?.hasBody).toBe(true);
  });

  it("sends an Idempotency-Key header when provided", async () => {
    const mock = makeMockFetch({ body: {} });
    const client = new CalClient(testConfig(), mock.fetch);
    await client.request("POST", "/v2/bookings", {
      body: { eventTypeId: 1 },
      idempotencyKey: "abc-123",
      family: "bookings",
    });
    expect(mock.last().headers["Idempotency-Key"]).toBe("abc-123");
  });

  it("rejects paths that do not start with '/'", async () => {
    const mock = makeMockFetch({ body: {} });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await client.request("GET", "v2/bookings");
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe("invalid_path");
    expect(mock.calls.length).toBe(0); // never hit the network
  });

  it("rejects absolute external URLs", async () => {
    const mock = makeMockFetch({ body: {} });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await client.request("GET", "https://evil.example.com/steal");
    expect(res.success).toBe(false);
    expect(res.error?.type).toBe("invalid_path");
    expect(mock.calls.length).toBe(0);
  });

  it("formats non-2xx responses with a helpful message and status code", async () => {
    const mock = makeMockFetch({
      status: 403,
      statusText: "Forbidden",
      body: { message: "You do not have access" },
    });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await client.request("GET", "/v2/event-types/123", { family: "eventTypes" });

    expect(res.success).toBe(false);
    expect(res.status_code).toBe(403);
    expect(res.error?.type).toBe("forbidden");
    expect(res.error?.message).toMatch(/403/);
    expect(res.error?.message).toMatch(/Cal says: You do not have access/);
  });

  it("handles 401 with an api-key hint", async () => {
    const mock = makeMockFetch({ status: 401, body: { message: "bad key" } });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await client.request("GET", "/v2/me", { family: "me" });
    expect(res.error?.type).toBe("unauthorized");
    expect(res.error?.message).toMatch(/CALCOM_API_KEY/);
  });

  it("redacts the API key from error details", async () => {
    const mock = makeMockFetch({
      status: 500,
      // Pathological server echoing the key back in the body.
      body: { message: "leaked test_key_SECRET123 here" },
    });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await client.request("GET", "/v2/me", { family: "me" });

    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain("test_key_SECRET123");
    expect(serialized).toContain("***REDACTED***");
  });

  it("never includes the Authorization header in the request summary", async () => {
    const mock = makeMockFetch({ body: {} });
    const client = new CalClient(testConfig(), mock.fetch);
    const res = await client.request("GET", "/v2/me", { family: "me" });
    expect(JSON.stringify(res.request)).not.toContain("test_key_SECRET123");
  });
});
