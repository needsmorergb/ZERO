/**
 * ObservedSocialXAdapter — Phase 1 SocialX implementation.
 * Derives X/Twitter presence from discovered URLs only.
 * No direct X API calls. No scraping. Purely observational.
 *
 * Phase 1 limitations:
 * - ageBucket: always 'unknown'
 * - activityBucket: always 'unknown'
 * - followerCount: null
 * - verified: null
 * - caDetected: null
 *
 * @implements {import('./types.js').SocialXAdapter}
 */

import { FIELD_STATUS, SOCIALX_SOURCE } from "./types.js";

/**
 * Parse X/Twitter handle from a URL.
 * Handles x.com and twitter.com domains. Strips query params and trailing slashes.
 * @param {string|null|undefined} url
 * @returns {string|null} Lowercase handle without @ prefix, or null
 */
export function parseXHandle(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const cleaned = url.trim().replace(/\/+$/, "").split("?")[0].split("#")[0];
    const match = cleaned.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})$/i);
    if (match) return match[1].toLowerCase();
  } catch (_) {
    /* ignore malformed URLs */
  }
  return null;
}

export const ObservedSocialXAdapter = {
  /**
   * Get an observed social profile for a token.
   * @param {{ ca: string, discoveredXUrl?: string|null, discoveredSiteUrl?: string|null, discoveredFrom?: string[] }} input
   * @returns {Promise<import('./types.js').SocialXProfile>}
   */
  async getProfile(input) {
    const { discoveredXUrl, discoveredFrom } = input || {};
    const handle = parseXHandle(discoveredXUrl);
    const presence = !!(handle && discoveredXUrl);

    return {
      handle: handle ? `@${handle}` : null,
      url: discoveredXUrl || null,
      presence,
      ageBucket: "unknown",
      activityBucket: "unknown",
      followerCount: null,
      verified: null,
      caDetected: null,
      evidence: {
        discoveredFrom: discoveredFrom || (discoveredXUrl ? ["context_links"] : []),
        notes: presence ? ["Handle parsed from discovered URL"] : ["No X URL discovered"],
      },
      source: SOCIALX_SOURCE.OBSERVED,
      lastUpdated: new Date().toISOString(),
      status: presence ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER,
    };
  },
};

/**
 * NOTE: Enrichment (followerCount, verified, ageBucket, activityBucket, caMentionCount)
 * is now handled server-side by the Context API Worker via twitter154 (feature-flagged).
 * The ObservedSocialXAdapter remains the client-side fallback for basic X handle detection.
 * See: worker-context/src/index.js — fetchTwitter154WithCache()
 */
