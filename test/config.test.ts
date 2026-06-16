import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError, DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "../src/config.js";

describe("loadConfig", () => {
  it("requires CALCOM_API_KEY", () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(ConfigError);
    expect(() => loadConfig({ CALCOM_API_KEY: "   " } as NodeJS.ProcessEnv)).toThrow(/required/i);
  });

  it("defaults the base URL to https://api.cal.eu", () => {
    const cfg = loadConfig({ CALCOM_API_KEY: "k" } as NodeJS.ProcessEnv);
    expect(cfg.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(cfg.baseUrl).toBe("https://api.cal.eu");
  });

  it("strips a trailing slash from the base URL", () => {
    const cfg = loadConfig({
      CALCOM_API_KEY: "k",
      CALCOM_BASE_URL: "https://api.cal.com/",
    } as NodeJS.ProcessEnv);
    expect(cfg.baseUrl).toBe("https://api.cal.com");
  });

  it("rejects a base URL without http(s)", () => {
    expect(() =>
      loadConfig({ CALCOM_API_KEY: "k", CALCOM_BASE_URL: "ftp://x" } as NodeJS.ProcessEnv),
    ).toThrow(/http/i);
  });

  it("defaults timeout and parses an override", () => {
    expect(loadConfig({ CALCOM_API_KEY: "k" } as NodeJS.ProcessEnv).timeoutMs).toBe(
      DEFAULT_TIMEOUT_MS,
    );
    expect(
      loadConfig({ CALCOM_API_KEY: "k", CALCOM_TIMEOUT_MS: "1234" } as NodeJS.ProcessEnv).timeoutMs,
    ).toBe(1234);
  });

  it("rejects an invalid timeout", () => {
    expect(() =>
      loadConfig({ CALCOM_API_KEY: "k", CALCOM_TIMEOUT_MS: "-5" } as NodeJS.ProcessEnv),
    ).toThrow(ConfigError);
    expect(() =>
      loadConfig({ CALCOM_API_KEY: "k", CALCOM_TIMEOUT_MS: "abc" } as NodeJS.ProcessEnv),
    ).toThrow(ConfigError);
  });

  it("reads the api version fallback and debug flag", () => {
    const cfg = loadConfig({
      CALCOM_API_KEY: "k",
      CALCOM_API_VERSION: "2024-08-13",
      CALCOM_DEBUG: "true",
    } as NodeJS.ProcessEnv);
    expect(cfg.apiVersion).toBe("2024-08-13");
    expect(cfg.debug).toBe(true);
  });
});
