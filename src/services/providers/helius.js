/**
 * Helius Developer Enrichment Provider (Optional)
 * Fetches token metadata from Helius DAS API to derive:
 * - Mint age (days since creation)
 * - Deployer / update authority address
 * - Deployer activity (mints in last 30 days) — not available in Phase 1
 *
 * If no API key is configured, returns status: NOT_SUPPORTED.
 * Caching: In-memory with 24-hour TTL per CA.
 */

import { proxyFetch } from '../shared/proxy-fetch.js';
import { FIELD_STATUS } from '../socialx/types.js';

/** Set to a valid Helius API key to enable developer enrichment. */
const HELIUS_API_KEY = null;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE = 30;

/** @type {Object.<string, { data: HeliusDevResult, fetchedTs: number }>} */
const _cache = {};

/**
 * @typedef {Object} HeliusDevResult
 * @property {number|null} mintAgeDays - Days since token was created
 * @property {string|null} deployer - Deployer or update authority address
 * @property {number|null} deployerMints30d - Number of tokens deployed by same address in 30 days
 * @property {import('../socialx/types.js').FieldStatus} status - Result status
 * @property {string|null} lastFetched - ISO 8601 timestamp of fetch
 */

/**
 * Fetch developer enrichment data for a token.
 * @param {string} ca - Token contract address (mint)
 * @returns {Promise<HeliusDevResult>}
 */
export async function fetchHeliusDev(ca) {
    // No API key → immediately return NOT_SUPPORTED
    if (!HELIUS_API_KEY) {
        return {
            mintAgeDays: null,
            deployer: null,
            deployerMints30d: null,
            status: FIELD_STATUS.NOT_SUPPORTED,
            lastFetched: null
        };
    }

    if (!ca) {
        return _notSupported();
    }

    // Check cache
    const cached = _cache[ca];
    if (cached && (Date.now() - cached.fetchedTs) < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
        const response = await proxyFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'zero-dev-ctx',
                method: 'getAsset',
                params: { id: ca }
            })
        });

        if (!response.ok || !response.data?.result) {
            const result = {
                mintAgeDays: null,
                deployer: null,
                deployerMints30d: null,
                status: FIELD_STATUS.PROVIDER_ERROR,
                lastFetched: new Date().toISOString()
            };
            _cacheResult(ca, result);
            return result;
        }

        const asset = response.data.result;
        const authorities = asset.authorities || [];
        const deployer = authorities.length > 0 ? authorities[0].address : null;

        // Derive mint age from creation timestamp if available
        let mintAgeDays = null;
        if (asset.created_at) {
            const created = new Date(asset.created_at);
            if (!isNaN(created.getTime())) {
                mintAgeDays = Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000));
            }
        }

        const result = {
            mintAgeDays,
            deployer,
            deployerMints30d: null, // Not available without additional queries
            status: FIELD_STATUS.OK,
            lastFetched: new Date().toISOString()
        };

        _cacheResult(ca, result);
        return result;
    } catch (e) {
        console.warn('[Helius] Fetch failed:', e?.message || e);
        return {
            mintAgeDays: null,
            deployer: null,
            deployerMints30d: null,
            status: FIELD_STATUS.PROVIDER_ERROR,
            lastFetched: new Date().toISOString()
        };
    }
}

function _notSupported() {
    return {
        mintAgeDays: null,
        deployer: null,
        deployerMints30d: null,
        status: FIELD_STATUS.NOT_SUPPORTED,
        lastFetched: null
    };
}

function _cacheResult(ca, data) {
    _cache[ca] = { data, fetchedTs: Date.now() };

    const keys = Object.keys(_cache);
    if (keys.length > MAX_CACHE) {
        const sorted = keys.sort((a, b) => (_cache[a].fetchedTs) - (_cache[b].fetchedTs));
        sorted.slice(0, keys.length - MAX_CACHE).forEach(k => delete _cache[k]);
    }
}
