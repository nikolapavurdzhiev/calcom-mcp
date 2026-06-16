/**
 * Per-endpoint `cal-api-version` handling.
 *
 * Cal.com's v2 API pins behaviour to a dated `cal-api-version` header, and different
 * endpoint families were introduced at different dates. Sending the wrong version is a
 * common cause of 400/404 responses, so each convenience tool carries a known-good
 * default for its endpoint family.
 *
 * Resolution order (first defined wins):
 *   1. explicit per-call `apiVersion` argument
 *   2. the endpoint family's known-good version (this map)
 *   3. the CALCOM_API_VERSION env fallback
 *   4. the built-in DEFAULT_API_VERSION
 *
 * The env fallback is intentionally a *fallback*, not an override: setting
 * CALCOM_API_VERSION will not silently break a booking call that needs a newer
 * version than event-types. To force a specific version on a single call, pass the
 * `apiVersion` argument (every tool supports it) or use the generic `cal_api_request` tool.
 */

export type EndpointFamily =
  | "default"
  | "me"
  | "bookings"
  | "eventTypes"
  | "slots"
  | "schedules"
  | "calendars"
  | "webhooks"
  | "teams"
  | "users";

/** Broadly-accepted recent stable version used when nothing else applies. */
export const DEFAULT_API_VERSION = "2024-08-13";

/**
 * Known-good `cal-api-version` per endpoint family, based on the Cal.com v2 docs
 * (the dates at which each family's current schema was introduced).
 */
export const API_VERSIONS: Record<EndpointFamily, string> = {
  default: DEFAULT_API_VERSION,
  me: DEFAULT_API_VERSION,
  bookings: "2024-08-13",
  eventTypes: "2024-06-14",
  slots: "2024-09-04",
  schedules: "2024-06-11",
  calendars: DEFAULT_API_VERSION,
  webhooks: DEFAULT_API_VERSION,
  teams: DEFAULT_API_VERSION,
  users: DEFAULT_API_VERSION,
};

/**
 * Resolve the effective `cal-api-version` for a call.
 *
 * @param explicit  per-call override (highest priority); may be undefined
 * @param family    endpoint family whose known-good default should apply
 * @param envFallback CALCOM_API_VERSION value, if configured
 */
export function resolveApiVersion(
  explicit: string | undefined,
  family: EndpointFamily,
  envFallback: string | undefined,
): string {
  return explicit?.trim() || API_VERSIONS[family] || envFallback?.trim() || DEFAULT_API_VERSION;
}
