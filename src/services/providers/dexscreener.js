/**
 * DexScreener Link Discovery Provider
 * Fetches token pair data from DexScreener and extracts project links.
 *
 * Data extracted:
 * - X/Twitter URL
 * - Website URL + domain
 * - Token image presence
 * - Social link count
 *
 * Note: This provider is currently orphaned (not imported by any module).
 * The live Context API at api.get-zero.xyz handles DexScreener fetching server-side.
 *
 * Caching: In-memory with 6-hour TTL per CA. LRU eviction at 50 entries.
 */

import { proxyFetch } from '../shared/proxy-fetch.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CACHE = 50;

/** @type {Object.<string, { data: DexScreenerLinks, fetchedTs: number }>} */
const _cache = {};

/**
 * @typedef {Object} DexScreenerLinks
 * @property {string|null} xUrl - X/Twitter profile URL
 * @property {string|null} websiteUrl - Project website URL
 * @property {string|null} websiteDomain - Parsed hostname
 * @property {boolean} hasImage - Whether token has an image/logo
 * @property {number} socialLinkCount - Total number of social + website links
 * @property {string|null} symbol - Token symbol
 * @property {string|null} name - Token name
 * @property {object|null} rawInfo - Raw DexScreener info object (for pass-through)
 */

/**
 * Parse DexScreener info object into structured links.
 * @param {object|null} info - The `info` field from a DexScreener pair
 * @returns {{ xUrl: string|null, websiteUrl: string|null, websiteDomain: string|null, hasImage: boolean, socialLinkCount: number }}
 */
export function parseDexScreenerInfo(info) {
    const result = {
        xUrl: null,
        websiteUrl: null,
        websiteDomain: null,
        hasImage: false,
        socialLinkCount: 0
    };

    if (!info) return result;

    result.hasImage = !!info.imageUrl;

    (info.socials || []).forEach(s => {
        result.socialLinkCount++;
        if (s.type === 'twitter' && s.url) result.xUrl = s.url;
    });

    (info.websites || []).forEach(w => {
        result.socialLinkCount++;
        if (!result.websiteUrl && w.url) {
            result.websiteUrl = w.url;
            try {
                result.websiteDomain = new URL(w.url).hostname;
            } catch (_) { /* ignore invalid URLs */ }
        }
    });

    return result;
}

/**
 * Fetch token links from DexScreener API.
 * Returns cached result if available and fresh.
 *
 * @param {string} ca - Token contract address (mint)
 * @param {{ existingInfo?: object|null }} [opts] - Optional pre-fetched DexScreener info
 * @returns {Promise<DexScreenerLinks>}
 */
export async function fetchDexScreenerLinks(ca, opts) {
    if (!ca) return _emptyLinks();

    // Check cache
    const cached = _cache[ca];
    if (cached && (Date.now() - cached.fetchedTs) < CACHE_TTL_MS) {
        return cached.data;
    }

    // If caller already has DexScreener info (from TokenMarketDataService), use it
    if (opts?.existingInfo) {
        const links = parseDexScreenerInfo(opts.existingInfo);
        const result = {
            ...links,
            symbol: null,
            name: null,
            rawInfo: opts.existingInfo
        };
        _cacheResult(ca, result);
        return result;
    }

    // Fetch from DexScreener API
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${ca}`;
        const response = await proxyFetch(url);

        if (!response.ok || !response.data?.pairs?.length) {
            return _emptyLinks();
        }

        const bestPair = response.data.pairs
            .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

        if (!bestPair) return _emptyLinks();

        const links = parseDexScreenerInfo(bestPair.info);
        const result = {
            ...links,
            symbol: bestPair.baseToken?.symbol || null,
            name: bestPair.baseToken?.name || null,
            rawInfo: bestPair.info || null
        };

        _cacheResult(ca, result);
        return result;
    } catch (e) {
        console.warn('[DexScreener] Fetch failed:', e?.message || e);
        return _emptyLinks();
    }
}

/**
 * Get cached links synchronously (for render loops).
 * @param {string} ca
 * @returns {DexScreenerLinks|null}
 */
export function getCachedDexScreenerLinks(ca) {
    const cached = _cache[ca];
    if (cached && (Date.now() - cached.fetchedTs) < CACHE_TTL_MS) {
        return cached.data;
    }
    return null;
}

function _emptyLinks() {
    return {
        xUrl: null,
        websiteUrl: null,
        websiteDomain: null,
        hasImage: false,
        socialLinkCount: 0,
        symbol: null,
        name: null,
        rawInfo: null
    };
}

function _cacheResult(ca, data) {
    _cache[ca] = { data, fetchedTs: Date.now() };

    // LRU eviction
    const keys = Object.keys(_cache);
    if (keys.length > MAX_CACHE) {
        const sorted = keys.sort((a, b) => (_cache[a].fetchedTs) - (_cache[b].fetchedTs));
        sorted.slice(0, keys.length - MAX_CACHE).forEach(k => delete _cache[k]);
    }
}
