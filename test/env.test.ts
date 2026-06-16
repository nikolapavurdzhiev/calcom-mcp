import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnvFile, loadEnvFiles } from "../src/env.js";

describe("parseEnvFile", () => {
  it("parses pairs, ignores comments/blanks, strips quotes and export, keeps '=' in values", () => {
    const parsed = parseEnvFile(
      [
        "# a comment",
        "",
        "CALCOM_API_KEY=abc123",
        'CALCOM_BASE_URL="https://api.cal.eu"',
        "export CALCOM_API_VERSION='2024-08-13'",
        "WEIRD=a=b=c",
        "NOEQUALS",
      ].join("\n"),
    );
    expect(parsed).toEqual({
      CALCOM_API_KEY: "abc123",
      CALCOM_BASE_URL: "https://api.cal.eu",
      CALCOM_API_VERSION: "2024-08-13",
      WEIRD: "a=b=c",
    });
  });
});

describe("loadEnvFiles", () => {
  const original = process.cwd();
  let dir: string | undefined;

  afterEach(() => {
    process.chdir(original);
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("loads from cwd and never overrides values already in the environment", () => {
    dir = mkdtempSync(join(tmpdir(), "calenv-"));
    writeFileSync(
      join(dir, ".env.local"),
      "__ENV_TEST_UNIQUE__=fromfile\n__ENV_PRESET_UNIQUE__=fromfile\n",
    );
    process.chdir(dir);

    const env: NodeJS.ProcessEnv = { __ENV_PRESET_UNIQUE__: "preset" };
    const loaded = loadEnvFiles(env);

    expect(loaded.some((p) => p.endsWith(".env.local"))).toBe(true);
    expect(env.__ENV_TEST_UNIQUE__).toBe("fromfile"); // newly set
    expect(env.__ENV_PRESET_UNIQUE__).toBe("preset"); // not overridden
  });
});
