/**
 * Minimal, dependency-free .env loader.
 *
 * Loads `.env.local` then `.env` from the project root (and the current working
 * directory, as a fallback) into process.env. Values already present in the
 * environment are NEVER overwritten — so variables passed by the MCP client
 * (Claude Desktop / Hermes `env` block) always take precedence over files.
 *
 * Resolution of the project root works whether the code runs from `src/` (tsx) or
 * `dist/` (compiled): both are one directory below the project root.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    // Strip a single pair of matching surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Load env files without overriding variables already set in process.env. */
export function loadEnvFiles(env: NodeJS.ProcessEnv = process.env): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url)); // src/ or dist/
  const projectRoot = resolve(moduleDir, "..");

  // Order matters: .env.local before .env; project root before cwd.
  const candidates = [
    resolve(projectRoot, ".env.local"),
    resolve(projectRoot, ".env"),
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
  ];

  const loaded: string[] = [];
  const seen = new Set<string>();
  for (const path of candidates) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (!existsSync(path)) continue;
    try {
      const parsed = parseEnvFile(readFileSync(path, "utf8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (env[key] === undefined) env[key] = value;
      }
      loaded.push(path);
    } catch {
      // Ignore unreadable files; config validation will surface missing vars.
    }
  }
  return loaded;
}
