/**
 * Context Aggregator Client
 * Fetches unified context data for a given token CA from the live ZERO API.
 *
 * Endpoint: GET https://api.get-zero.xyz/context?chain=solana&ca=<mint>
 * Returns: ContextResponseV1
 *
 * Features:
 * - In-flight request deduplication (one fetch per CA at a time)
 * - In-memory cache with 6h TTL
 * - chrome.storage.local persistence for rehydration on context invalidation
 * - LRU eviction at 30 entries
 * - On fetch failure: rehydrate from storage and mark statuses as stale_cached
 *
 * @typedef {import('../socialx/types.js').FieldStatus} FieldStatus
 */

import { FIELD_STATUS, SCHEMA_VERSION } from "../socialx/types.js";
import { proxyFetch } from "../shared/proxy-fetch.js";

/** Live API base URL. */
const CONTEXT_API_BASE = "https://api.get-zero.xyz";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CACHE = 30;
const STORAGE_PREFIX = "zero_ctx_";

/**
 * @typedef {Object} ContextResponseV1
 * @property {string} schemaVersion
 * @property {{ ca: string, name?: string, symbol?: string, hasImage?: boolean }} token
 * @property {{ website?: { url: string|null, status: FieldStatus }, x?: { url: string|null, status: FieldStatus } }} links
 * @property {{ profile: { url: string|null, handle: string|null, status: FieldStatus, accountAgeDays?: number|null, followerCount?: number|null, verified?: boolean|null, caMentionCount?: number|null, displayName?: string|null, renameCount?: number|null, enrichmentStatus?: FieldStatus }, communities: { items: Array<{ name: string, url: string, memberCount?: number|null, activityLevel?: string, evidence?: string[] }>, status: FieldStatus, lastFetched: string|null } }} [x]
 * @property {{ url: string|null, domain: string|null, title: string|null, metaDescription: string|null, domainAgeDays?: number|null, statusCode?: number|null, tls?: boolean|null, redirects?: number|null, lastFetched: string|null, status: FieldStatus }} website
 * @property {{ mintAgeDays?: number|null, deployer?: string|null, deployerMints30d?: number|null, mintAuthority?: string|null, freezeAuthority?: string|null, metadataMutable?: boolean|null, devHoldingsPct?: number|null, deployerBalanceSol?: number|null, deployerAgeDays?: number|null, recentMints7d?: number|null, status: FieldStatus, lastFetched: string|null }} dev
 * @property {string} fetchedAt
 */

/** @type {Object.<string, { response: ContextResponseV1, fetchedTs: number }>} */
const _cache = {};

/** @type {Object.<string, Promise<ContextResponseV1>>} */
const _inflight = {};

/**
 * Fetch unified context for a token.
 * Deduplicates in-flight requests for the same CA.
 *
 * @param {{ ca: string, existingDexInfo?: object|null }} params
 * @returns {Promise<ContextResponseV1>}
 */
export async function fetchContext({ ca, existingDexInfo }) {
  if (!ca) return _emptyResponse("");

  // Check in-memory cache
  const cached = _cache[ca];
  if (cached && Date.now() - cached.fetchedTs < CACHE_TTL_MS) {
    return cached.response;
  }

  // Deduplicate in-flight requests
  if (_inflight[ca]) {
    return _inflight[ca];
  }

  const promise = _fetchContextImpl({ ca, existingDexInfo });
  _inflight[ca] = promise;

  try {
    return await promise;
  } finally {
    delete _inflight[ca];
  }
}

/**
 * Internal implementation of context fetching.
 * Calls the live API, falls back to chrome.storage.local on failure.
 * @param {{ ca: string, existingDexInfo?: object|null }} params
 * @returns {Promise<ContextResponseV1>}
 */
async function _fetchContextImpl({ ca }) {
  try {
    const url = `${CONTEXT_API_BASE}/context?chain=solana&ca=${encodeURIComponent(ca)}`;
    const response = await proxyFetch(url);

    if (response.ok && response.data) {
      const ctx = /** @type {ContextResponseV1} */ (response.data);

      // Ensure schemaVersion is present
      if (!ctx.schemaVersion) ctx.schemaVersion = SCHEMA_VERSION;
      if (!ctx.fetchedAt) ctx.fetchedAt = new Date().toISOString();

      _cacheAndPersist(ca, ctx);
      console.log("[MarketContext] context loaded", ca.slice(0, 8));
      return ctx;
    }

    // API returned non-ok — attempt rehydration
    console.warn("[MarketContext] API response not ok, attempting rehydration");
    const stored = await _rehydrateFromStorage(ca);
    if (stored) {
      _markStale(stored);
      return stored;
    }

    return _emptyResponse(ca);
  } catch (e) {
    const msg = e?.message || "";
    console.warn("[MarketContext] Fetch failed, attempting rehydration:", msg);

    // Attempt rehydration from storage
    const stored = await _rehydrateFromStorage(ca);
    if (stored) {
      _markStale(stored);
      return stored;
    }

    return _emptyResponse(ca);
  }
}

/**
 * Get cached context synchronously (for render loops).
 * @param {string} ca
 * @returns {ContextResponseV1|null}
 */
export function getCachedContext(ca) {
  const cached = _cache[ca];
  if (cached && Date.now() - cached.fetchedTs < CACHE_TTL_MS) {
    return cached.response;
  }
  return null;
}

/**
 * Mark all mutable status fields in a context response as stale_cached.
 * @param {ContextResponseV1} ctx
 */
function _markStale(ctx) {
  if (ctx.links?.website?.status === FIELD_STATUS.OK) {
    ctx.links.website.status = FIELD_STATUS.STALE_CACHED;
  }
  if (ctx.links?.x?.status === FIELD_STATUS.OK) {
    ctx.links.x.status = FIELD_STATUS.STALE_CACHED;
  }
  if (ctx.website?.status === FIELD_STATUS.OK) {
    ctx.website.status = FIELD_STATUS.STALE_CACHED;
  }
  if (ctx.dev?.status === FIELD_STATUS.OK) {
    ctx.dev.status = FIELD_STATUS.STALE_CACHED;
  }
  if (ctx.x?.communities?.status === FIELD_STATUS.OK) {
    ctx.x.communities.status = FIELD_STATUS.STALE_CACHED;
  }
  if (ctx.x?.profile?.status === FIELD_STATUS.OK) {
    ctx.x.profile.status = FIELD_STATUS.STALE_CACHED;
  }
  if (ctx.x?.profile?.enrichmentStatus === FIELD_STATUS.OK) {
    ctx.x.profile.enrichmentStatus = FIELD_STATUS.STALE_CACHED;
  }
}

/**
 * Create an empty context response with appropriate statuses.
 * @param {string} ca
 * @returns {ContextResponseV1}
 */
function _emptyResponse(ca) {
  return {
    schemaVersion: SCHEMA_VERSION,
    token: { ca: ca || "" },
    links: {
      website: { url: null, status: FIELD_STATUS.MISSING_IDENTIFIER },
      x: { url: null, status: FIELD_STATUS.MISSING_IDENTIFIER },
    },
    website: {
      url: null,
      domain: null,
      title: null,
      metaDescription: null,
      domainAgeDays: null,
      statusCode: null,
      tls: null,
      redirects: null,
      lastFetched: null,
      status: FIELD_STATUS.MISSING_IDENTIFIER,
    },
    x: {
      profile: { url: null, handle: null, status: FIELD_STATUS.MISSING_IDENTIFIER },
      communities: { items: [], status: FIELD_STATUS.MISSING_IDENTIFIER, lastFetched: null },
    },
    dev: {
      mintAgeDays: null,
      deployer: null,
      deployerMints30d: null,
      mintAuthority: undefined,
      freezeAuthority: undefined,
      metadataMutable: null,
      devHoldingsPct: null,
      deployerBalanceSol: null,
      deployerAgeDays: null,
      recentMints7d: null,
      status: FIELD_STATUS.NOT_SUPPORTED,
      lastFetched: null,
    },
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Cache response in memory and persist to chrome.storage.local.
 * @param {string} ca
 * @param {ContextResponseV1} response
 */
function _cacheAndPersist(ca, response) {
  _cache[ca] = { response, fetchedTs: Date.now() };

  // LRU eviction
  const keys = Object.keys(_cache);
  if (keys.length > MAX_CACHE) {
    const sorted = keys.sort((a, b) => _cache[a].fetchedTs - _cache[b].fetchedTs);
    sorted.slice(0, keys.length - MAX_CACHE).forEach((k) => delete _cache[k]);
  }

  // Persist to chrome.storage.local for rehydration
  _persistToStorage(ca, response);
}

/**
 * Persist context to chrome.storage.local.
 * @param {string} ca
 * @param {ContextResponseV1} response
 */
function _persistToStorage(ca, response) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    const key = STORAGE_PREFIX + ca.slice(0, 12);
    chrome.storage.local.set({ [key]: { response, ts: Date.now() } });
  } catch (_) {
    /* silent — storage may be unavailable */
  }
}

/**
 * Rehydrate context from chrome.storage.local.
 * @param {string} ca
 * @returns {Promise<ContextResponseV1|null>}
 */
async function _rehydrateFromStorage(ca) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
    const key = STORAGE_PREFIX + ca.slice(0, 12);
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const stored = res[key];
        if (stored && stored.response && Date.now() - stored.ts < CACHE_TTL_MS) {
          // Mark as stale cached
          _cache[ca] = { response: stored.response, fetchedTs: stored.ts };
          resolve(stored.response);
        } else {
          resolve(null);
        }
      });
    });
  } catch (_) {
    return null;
  }
}
