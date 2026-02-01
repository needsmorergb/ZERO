/**
 * SocialX Types — Constants and JSDoc type definitions for the SocialX adapter system.
 * Schema version: 1.0
 *
 * @typedef {'observed' | 'api' | 'scrape' | 'aggregator'} SocialXSource
 *
 * @typedef {'ok' | 'missing_identifier' | 'not_supported' | 'provider_error' | 'rate_limited' | 'stale_cached'} FieldStatus
 *
 * @typedef {Object} SocialXProfile
 * @property {string|null} handle - Normalized handle (e.g., "@example")
 * @property {string|null} url - Full X/Twitter URL
 * @property {boolean} presence - Whether an X account was detected
 * @property {'unknown'|'new'|'established'} ageBucket - Account age classification
 * @property {'unknown'|'recent'|'stale'} activityBucket - Recent activity classification
 * @property {number|null} [followerCount] - Follower count (null if not fetched)
 * @property {boolean|null} [verified] - Verified badge status (null if not fetched)
 * @property {boolean|null} [caDetected] - Whether CA was found in bio/pinned (null if not checked)
 * @property {{ discoveredFrom: Array<'context_links'|'dexscreener'|'website'|'tokenPage'|'manual'>, notes: string[] }} evidence
 * @property {SocialXSource} source - Data source identifier
 * @property {string|null} lastUpdated - ISO 8601 timestamp
 * @property {FieldStatus} status - Overall profile fetch status
 *
 * @typedef {Object} SocialXAdapter
 * @property {function({ ca: string, discoveredXUrl?: string|null, discoveredSiteUrl?: string|null }): Promise<SocialXProfile>} getProfile
 */

/** Enum-like constants for FieldStatus values. */
export const FIELD_STATUS = {
  OK: "ok",
  MISSING_IDENTIFIER: "missing_identifier",
  NOT_SUPPORTED: "not_supported",
  PROVIDER_ERROR: "provider_error",
  RATE_LIMITED: "rate_limited",
  STALE_CACHED: "stale_cached",
};

/** Enum-like constants for SocialXSource values. */
export const SOCIALX_SOURCE = {
  OBSERVED: "observed",
  API: "api",
  SCRAPE: "scrape",
  AGGREGATOR: "aggregator",
};

/** Schema version for context responses. */
export const SCHEMA_VERSION = "1.0";
