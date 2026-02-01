/**
 * ZERØ Context API Worker
 * Cloudflare Worker serving token context data for the ZERØ extension.
 *
 * Endpoints:
 *   GET /health                          – liveness check
 *   GET /context?chain=solana&ca=<mint>  – fetch ContextResponseV1
 *
 * Data flow:
 *   1. Check Cache API (6h TTL)
 *   2. Fetch DexScreener token pairs → extract links (X, website)
 *   3. If website URL found, fetch metadata (title, status, TLS) + parse for X Community links
 *   4. (Feature-flagged) Fetch twitter154 enrichment → account age, CA mentions
 *   5. (Feature-flagged) Track handle renames via KV
 *   6. Build ContextResponseV1 with x.profile + x.communities
 *   7. Cache and return
 */

const SCHEMA_VERSION = '1.0';
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours
const FETCH_TIMEOUT_MS = 8000;
const TWITTER154_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours (increased from 1h)
const TWITTER154_COOLDOWN_SECONDS = 10 * 60; // 10 minutes cooldown on 429
const TWITTER154_HOST = 'twitter154.p.rapidapi.com';

// FieldStatus constants (mirrors extension types)
const STATUS = {
    OK: 'ok',
    MISSING_IDENTIFIER: 'missing_identifier',
    NOT_SUPPORTED: 'not_supported',
    PROVIDER_ERROR: 'provider_error',
    RATE_LIMITED: 'rate_limited',
    STALE_CACHED: 'stale_cached',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Zero-Client-Id, X-Zero-Version',
        'Access-Control-Max-Age': '86400',
    };
}

function withCors(response, request) {
    const cors = corsHeaders(request);
    const res = new Response(response.body, response);
    for (const [k, v] of Object.entries(cors)) {
        res.headers.set(k, v);
    }
    return res;
}

/**
 * Fetch with timeout.
 * @param {string} url
 * @param {RequestInit} [opts]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------------------
// DexScreener
// ---------------------------------------------------------------------------

/**
 * Fetch DexScreener pair data and extract links.
 * @param {string} ca
 * @returns {Promise<{ xUrl: string|null, websiteUrl: string|null, websiteDomain: string|null, hasImage: boolean, socialLinkCount: number, symbol: string|null, name: string|null }>}
 */
async function fetchDexScreener(ca) {
    const result = {
        xUrl: null,
        websiteUrl: null,
        websiteDomain: null,
        hasImage: false,
        socialLinkCount: 0,
        symbol: null,
        name: null,
    };

    try {
        const res = await fetchWithTimeout(
            `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`
        );
        if (!res.ok) return result;

        const data = await res.json();
        const pairs = data?.pairs;
        if (!Array.isArray(pairs) || pairs.length === 0) return result;

        // Pick highest-liquidity pair
        const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        if (!best) return result;

        result.symbol = best.baseToken?.symbol || null;
        result.name = best.baseToken?.name || null;

        const info = best.info;
        if (!info) return result;

        result.hasImage = !!info.imageUrl;

        (info.socials || []).forEach((s) => {
            result.socialLinkCount++;
            if (s.type === 'twitter' && s.url) result.xUrl = s.url;
            // Only X/Twitter links are relevant — other socials excluded
        });

        (info.websites || []).forEach((w) => {
            result.socialLinkCount++;
            if (!result.websiteUrl && w.url) {
                result.websiteUrl = w.url;
                try {
                    result.websiteDomain = new URL(w.url).hostname;
                } catch (_) { /* ignore */ }
            }
        });
    } catch (e) {
        console.warn('[Context] DexScreener fetch failed:', e?.message || e);
    }

    return result;
}

// ---------------------------------------------------------------------------
// Website Metadata Fetching (Phase 1)
// ---------------------------------------------------------------------------

/**
 * Fetch website metadata: title, meta description, status code, TLS, redirects.
 * @param {string} websiteUrl
 * @returns {Promise<{ title: string|null, metaDescription: string|null, statusCode: number|null, tls: boolean|null, redirects: number, status: string, lastFetched: string }>}
 */
async function fetchWebsiteMetadata(websiteUrl) {
    const result = {
        title: null,
        metaDescription: null,
        statusCode: null,
        tls: null,
        redirects: 0,
        status: STATUS.PROVIDER_ERROR,
        lastFetched: new Date().toISOString(),
    };

    if (!websiteUrl) {
        result.status = STATUS.MISSING_IDENTIFIER;
        return result;
    }

    try {
        const parsedUrl = new URL(websiteUrl);
        result.tls = parsedUrl.protocol === 'https:';

        const res = await fetchWithTimeout(websiteUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZeroBot/1.0)',
                'Accept': 'text/html',
            },
            redirect: 'follow',
        }, 8000);

        result.statusCode = res.status;
        result.redirects = res.redirected ? 1 : 0; // CF Workers don't expose redirect count, estimate

        if (!res.ok) {
            result.status = STATUS.PROVIDER_ERROR;
            return result;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            result.status = STATUS.PROVIDER_ERROR;
            return result;
        }

        // Read first 512KB
        const reader = res.body.getReader();
        const chunks = [];
        let totalBytes = 0;
        const maxBytes = 512 * 1024;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalBytes += value.length;
            if (totalBytes >= maxBytes) break;
        }

        const decoder = new TextDecoder('utf-8', { fatal: false });
        const html = decoder.decode(
            chunks.reduce((acc, chunk) => {
                const merged = new Uint8Array(acc.length + chunk.length);
                merged.set(acc);
                merged.set(chunk, acc.length);
                return merged;
            }, new Uint8Array(0))
        );

        // Parse <title>
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            result.title = titleMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 200);
        }

        // Parse <meta name="description">
        const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
        if (metaDescMatch && metaDescMatch[1]) {
            result.metaDescription = metaDescMatch[1].trim().substring(0, 300);
        }

        result.status = STATUS.OK;
        return result;
    } catch (e) {
        console.warn('[Context] Website metadata fetch failed:', e?.message || e);
        result.status = STATUS.PROVIDER_ERROR;
        return result;
    }
}

// ---------------------------------------------------------------------------
// X Communities Parser (Phase 1)
// ---------------------------------------------------------------------------

/**
 * Regex patterns for X community URLs.
 * Matches: x.com/i/communities/<id>, x.com/communities/<id>,
 * twitter.com/i/communities/<id>, twitter.com/communities/<id>
 */
const X_COMMUNITY_REGEX = /https?:\/\/(?:x\.com|twitter\.com)\/(?:i\/)?communities\/(\d+)/gi;

/**
 * Parse website HTML for X Community links.
 * @param {string} html - Raw HTML string
 * @returns {Array<{ name: string, url: string }>}
 */
function parseXCommunities(html) {
    if (!html || typeof html !== 'string') return [];

    const communities = [];
    const seen = new Set();

    // Strategy 1: Find community URLs in anchor tags to extract both URL and name
    const anchorRegex = /<a[^>]*href=["']?(https?:\/\/(?:x\.com|twitter\.com)\/(?:i\/)?communities\/(\d+))[^"'\s]*["']?[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorRegex.exec(html)) !== null) {
        const url = match[1];
        const id = match[2];
        if (seen.has(id)) continue;
        seen.add(id);

        // Extract text content from anchor (strip HTML tags)
        let name = match[3].replace(/<[^>]*>/g, '').trim();
        if (!name || name.length > 100) name = null;

        communities.push({
            name: name || `X Community`,
            url: url,
            memberCount: null,
            activityLevel: 'unknown',
            evidence: ['Detected in project website HTML'],
        });
    }

    // Strategy 2: Find bare community URLs not inside anchors
    X_COMMUNITY_REGEX.lastIndex = 0;
    while ((match = X_COMMUNITY_REGEX.exec(html)) !== null) {
        const url = match[0];
        const id = match[1];
        if (seen.has(id)) continue;
        seen.add(id);

        communities.push({
            name: `X Community`,
            url: url,
            memberCount: null,
            activityLevel: 'unknown',
            evidence: ['URL found in project website HTML'],
        });
    }

    return communities;
}

/**
 * Fetch website HTML and parse for X Community links.
 * @param {string} websiteUrl
 * @returns {Promise<{ items: Array, status: string, lastFetched: string }>}
 */
async function fetchAndParseXCommunities(websiteUrl) {
    const result = {
        items: [],
        status: STATUS.MISSING_IDENTIFIER,
        lastFetched: new Date().toISOString(),
    };

    if (!websiteUrl) {
        return result;
    }

    try {
        const res = await fetchWithTimeout(websiteUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZeroBot/1.0)',
                'Accept': 'text/html',
            },
        }, 6000);

        if (!res.ok) {
            result.status = STATUS.PROVIDER_ERROR;
            return result;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            result.status = STATUS.PROVIDER_ERROR;
            return result;
        }

        // Read only first 512KB to avoid memory issues
        const reader = res.body.getReader();
        const chunks = [];
        let totalBytes = 0;
        const maxBytes = 512 * 1024;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalBytes += value.length;
            if (totalBytes >= maxBytes) break;
        }

        const decoder = new TextDecoder('utf-8', { fatal: false });
        const html = decoder.decode(
            chunks.reduce((acc, chunk) => {
                const merged = new Uint8Array(acc.length + chunk.length);
                merged.set(acc);
                merged.set(chunk, acc.length);
                return merged;
            }, new Uint8Array(0))
        );

        result.items = parseXCommunities(html);
        result.status = STATUS.OK; // OK even if items is empty - successful search
        return result;
    } catch (e) {
        console.warn('[Context] X communities fetch failed:', e?.message || e);
        result.status = STATUS.PROVIDER_ERROR;
        return result;
    }
}

// ---------------------------------------------------------------------------
// Twitter154 Provider (Feature-Flagged with Rate Limit Protection)
// ---------------------------------------------------------------------------

/**
 * Check if twitter154 enrichment is enabled.
 * @param {object} env - Worker environment bindings
 * @returns {boolean}
 */
function isTwitter154Enabled(env) {
    return env?.TWITTER154_ENABLED === 'true' && !!env?.TWITTER154_API_KEY;
}

/**
 * Get cached twitter154 enrichment data (per-handle caching).
 * @param {string} handle
 * @returns {Promise<object|null>}
 */
async function getTwitter154Cache(handle) {
    try {
        const cache = caches.default;
        const cacheKey = new Request(`https://twitter154-cache.internal/handle/${handle}`);
        const cached = await cache.match(cacheKey);
        if (!cached) return null;
        return await cached.json();
    } catch (_) {
        return null;
    }
}

/**
 * Set twitter154 enrichment cache (per-handle).
 * @param {string} handle
 * @param {object} data
 * @param {number} ttlSeconds
 */
async function setTwitter154Cache(handle, data, ttlSeconds) {
    try {
        const cache = caches.default;
        const cacheKey = new Request(`https://twitter154-cache.internal/handle/${handle}`);
        const response = new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${ttlSeconds}`,
            },
        });
        await cache.put(cacheKey, response);
    } catch (_) { /* non-critical */ }
}

/**
 * Get rate limit cooldown status for a handle.
 * Returns cooldown expiry timestamp or null if not in cooldown.
 * @param {string} handle
 * @returns {Promise<number|null>}
 */
async function getRateLimitCooldown(handle) {
    try {
        const cache = caches.default;
        const cacheKey = new Request(`https://twitter154-cooldown.internal/handle/${handle}`);
        const cached = await cache.match(cacheKey);
        if (!cached) return null;
        const data = await cached.json();
        const cooldownUntil = data?.cooldownUntil || 0;
        if (Date.now() < cooldownUntil) {
            return cooldownUntil;
        }
        return null;
    } catch (_) {
        return null;
    }
}

/**
 * Set rate limit cooldown for a handle (10 minute cooldown).
 * @param {string} handle
 */
async function setRateLimitCooldown(handle) {
    try {
        const cooldownUntil = Date.now() + (TWITTER154_COOLDOWN_SECONDS * 1000);
        const cache = caches.default;
        const cacheKey = new Request(`https://twitter154-cooldown.internal/handle/${handle}`);
        const response = new Response(JSON.stringify({ cooldownUntil }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${TWITTER154_COOLDOWN_SECONDS}`,
            },
        });
        await cache.put(cacheKey, response);
        console.log(`[Twitter154] Set cooldown for @${handle} until ${new Date(cooldownUntil).toISOString()}`);
    } catch (_) { /* non-critical */ }
}

/**
 * Fetch X account profile from twitter154 (The Old Bird) API.
 * @param {string} handle - X handle without @
 * @param {object} env
 * @returns {Promise<object|null>} Raw twitter154 user object or null
 */
async function fetchTwitter154Profile(handle, env) {
    if (!handle || !isTwitter154Enabled(env)) return null;

    try {
        const url = `https://${TWITTER154_HOST}/user/details?username=${encodeURIComponent(handle)}`;
        const res = await fetchWithTimeout(url, {
            headers: {
                'X-RapidAPI-Key': env.TWITTER154_API_KEY,
                'X-RapidAPI-Host': TWITTER154_HOST,
            },
        }, 6000);

        if (res.status === 429) {
            console.warn('[Twitter154] Rate limited on profile fetch');
            return { _error: STATUS.RATE_LIMITED };
        }

        if (!res.ok) {
            console.warn(`[Twitter154] Profile fetch failed: ${res.status}`);
            return { _error: STATUS.PROVIDER_ERROR };
        }

        return await res.json();
    } catch (e) {
        console.warn('[Twitter154] Profile fetch error:', e?.message || e);
        return { _error: STATUS.PROVIDER_ERROR };
    }
}

/**
 * Fetch recent tweets for a user and count mentions of a CA.
 * Only called if profile fetch succeeded and not rate limited.
 * @param {string} handle - X handle without @
 * @param {string} ca - Token contract address to search for
 * @param {object} env
 * @returns {Promise<{ caMentionCount: number, tweetsChecked: number }|null>}
 */
async function fetchCaMentionCount(handle, ca, env) {
    if (!handle || !ca || !isTwitter154Enabled(env)) return null;

    try {
        const url = `https://${TWITTER154_HOST}/user/tweets?username=${encodeURIComponent(handle)}&limit=100&include_replies=false&include_pinned=true`;
        const res = await fetchWithTimeout(url, {
            headers: {
                'X-RapidAPI-Key': env.TWITTER154_API_KEY,
                'X-RapidAPI-Host': TWITTER154_HOST,
            },
        }, 8000);

        if (res.status === 429) {
            console.warn('[Twitter154] Rate limited on tweets fetch');
            return null; // Don't fail the whole enrichment if tweets are rate limited
        }

        if (!res.ok) return null;

        const data = await res.json();
        const tweets = data?.results || [];

        // Search for CA in tweet text (case-insensitive, first 8+ chars is sufficient for Solana CAs)
        const caLower = ca.toLowerCase();
        const caShort = ca.slice(0, 8).toLowerCase();
        let mentionCount = 0;

        for (const tweet of tweets) {
            const text = (tweet.text || '').toLowerCase();
            if (text.includes(caLower) || text.includes(caShort)) {
                mentionCount++;
            }
        }

        return { caMentionCount: mentionCount, tweetsChecked: tweets.length };
    } catch (e) {
        console.warn('[Twitter154] Tweets fetch error:', e?.message || e);
        return null;
    }
}

/**
 * Build enriched X profile data from twitter154 response.
 * @param {object|null} profile - Raw twitter154 user object
 * @param {{ caMentionCount: number, tweetsChecked: number }|null} caData
 * @returns {object} Enrichment fields
 */
function buildTwitter154Enrichment(profile, caData) {
    if (!profile || profile._error) {
        return {
            accountAgeDays: null,
            followerCount: null,
            verified: null,
            caMentionCount: null,
            displayName: null,
            userId: null,
            enrichmentStatus: profile?._error || STATUS.NOT_SUPPORTED,
        };
    }

    // Calculate account age from creation timestamp
    let accountAgeDays = null;
    if (profile.timestamp) {
        const createdMs = profile.timestamp * 1000;
        accountAgeDays = Math.floor((Date.now() - createdMs) / (86400 * 1000));
    } else if (profile.creation_date) {
        try {
            const createdMs = new Date(profile.creation_date).getTime();
            if (!isNaN(createdMs)) {
                accountAgeDays = Math.floor((Date.now() - createdMs) / (86400 * 1000));
            }
        } catch (_) { /* ignore */ }
    }

    return {
        accountAgeDays,
        followerCount: profile.follower_count ?? null,
        verified: profile.is_blue_verified ?? null,
        caMentionCount: caData?.caMentionCount ?? null,
        displayName: profile.name || null,
        userId: profile.user_id || null,
        enrichmentStatus: STATUS.OK,
    };
}

/**
 * Fetch twitter154 enrichment with per-handle caching and rate limit protection.
 * Optimized: fetch profile first, only fetch tweets if profile succeeded.
 * @param {string} handle - X handle without @
 * @param {string} ca
 * @param {object} env
 * @returns {Promise<object>} Enrichment data with enrichmentStatus
 */
async function fetchTwitter154WithCache(handle, ca, env) {
    if (!handle || !isTwitter154Enabled(env)) {
        return {
            accountAgeDays: null,
            followerCount: null,
            verified: null,
            caMentionCount: null,
            displayName: null,
            userId: null,
            enrichmentStatus: STATUS.NOT_SUPPORTED,
        };
    }

    // Check if in rate limit cooldown
    const cooldownUntil = await getRateLimitCooldown(handle);
    if (cooldownUntil) {
        console.log(`[Twitter154] Skipping API call for @${handle}, in cooldown until ${new Date(cooldownUntil).toISOString()}`);
        // Try to return cached data
        const cached = await getTwitter154Cache(handle);
        if (cached) {
            // Return cached data with rate_limited status
            return {
                ...cached,
                enrichmentStatus: STATUS.RATE_LIMITED,
            };
        }
        // No cached data, return rate_limited status
        return {
            accountAgeDays: null,
            followerCount: null,
            verified: null,
            caMentionCount: null,
            displayName: null,
            userId: null,
            enrichmentStatus: STATUS.RATE_LIMITED,
        };
    }

    // Check cache first (per-handle cache)
    const cached = await getTwitter154Cache(handle);
    if (cached && cached.enrichmentStatus === STATUS.OK) {
        console.log(`[Twitter154] Using cached data for @${handle}`);
        return cached;
    }

    // Fetch profile first (optimized: don't fetch tweets if profile fails)
    const profile = await fetchTwitter154Profile(handle, env);

    // If rate limited, set cooldown and return
    if (profile?._error === STATUS.RATE_LIMITED) {
        await setRateLimitCooldown(handle);
        // Try to return stale cached data
        if (cached) {
            return {
                ...cached,
                enrichmentStatus: STATUS.RATE_LIMITED,
            };
        }
        return {
            accountAgeDays: null,
            followerCount: null,
            verified: null,
            caMentionCount: null,
            displayName: null,
            userId: null,
            enrichmentStatus: STATUS.RATE_LIMITED,
        };
    }

    // If profile failed with other error, return cached or error status
    if (profile?._error) {
        if (cached) {
            return {
                ...cached,
                enrichmentStatus: STATUS.STALE_CACHED,
            };
        }
        return buildTwitter154Enrichment(profile, null);
    }

    // Profile succeeded - now fetch tweets (only if profile is OK)
    const caData = await fetchCaMentionCount(handle, ca, env);

    const enrichment = buildTwitter154Enrichment(profile, caData);

    // Cache successful enrichment (6 hour TTL)
    if (enrichment.enrichmentStatus === STATUS.OK) {
        await setTwitter154Cache(handle, enrichment, TWITTER154_CACHE_TTL_SECONDS);
        console.log(`[Twitter154] Cached enrichment for @${handle} (6h TTL)`);
    }

    return enrichment;
}

// ---------------------------------------------------------------------------
// KV Handle Rename Tracking
// ---------------------------------------------------------------------------

/**
 * Track handle rename history for a userId.
 * KV key: `rename:<userId>`
 * Value: { lastHandle, renameCount, firstSeen, history: [{handle, ts}] }
 *
 * @param {string|null} userId
 * @param {string|null} currentHandle
 * @param {object} env - Worker env bindings (expects HANDLE_TRACKING KV)
 * @returns {Promise<{ renameCount: number, lastHandle: string|null }|null>}
 */
async function trackHandleRename(userId, currentHandle, env) {
    if (!userId || !currentHandle || !env?.HANDLE_TRACKING) return null;

    const key = `rename:${userId}`;

    try {
        const existing = await env.HANDLE_TRACKING.get(key, { type: 'json' });

        if (!existing) {
            // First time seeing this user
            const record = {
                lastHandle: currentHandle,
                renameCount: 0,
                firstSeen: new Date().toISOString(),
                history: [{ handle: currentHandle, ts: new Date().toISOString() }],
            };
            await env.HANDLE_TRACKING.put(key, JSON.stringify(record), {
                expirationTtl: 90 * 86400, // 90 days
            });
            return { renameCount: 0, lastHandle: currentHandle };
        }

        if (existing.lastHandle !== currentHandle) {
            // Handle changed — increment rename count
            existing.renameCount = (existing.renameCount || 0) + 1;
            existing.lastHandle = currentHandle;

            // Keep last 20 renames in history
            if (!existing.history) existing.history = [];
            existing.history.push({ handle: currentHandle, ts: new Date().toISOString() });
            if (existing.history.length > 20) {
                existing.history = existing.history.slice(-20);
            }

            await env.HANDLE_TRACKING.put(key, JSON.stringify(existing), {
                expirationTtl: 90 * 86400,
            });
        }

        return { renameCount: existing.renameCount || 0, lastHandle: existing.lastHandle };
    } catch (e) {
        console.warn('[KV] Handle rename tracking error:', e?.message || e);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Context Builder
// ---------------------------------------------------------------------------

/**
 * Build ContextResponseV1 for a Solana token.
 * @param {string} ca
 * @param {object} env - Worker environment bindings
 * @returns {Promise<object>}
 */
async function buildContext(ca, env) {
    // 1. Fetch DexScreener data
    const dex = await fetchDexScreener(ca);

    // 2. Fetch website metadata (Phase 1: always attempt if URL exists)
    const websiteMeta = await fetchWebsiteMetadata(dex.websiteUrl);

    // 3. Fetch X Communities from website (Phase 1: always attempt if URL exists)
    const xCommunities = await fetchAndParseXCommunities(dex.websiteUrl);

    // 4. Parse X handle
    const handle = parseXHandle(dex.xUrl);
    const handleClean = handle ? handle.replace(/^@/, '') : null;

    // 5. Twitter154 enrichment (feature-flagged, with caching and rate limit protection)
    const enrichment = await fetchTwitter154WithCache(handleClean, ca, env);

    // 6. KV rename tracking (feature-flagged via KV binding presence)
    let renameData = null;
    if (enrichment.userId && handleClean) {
        renameData = await trackHandleRename(enrichment.userId, handleClean, env);
    }

    // 7. Build X profile
    const xProfile = {
        url: dex.xUrl,
        handle: handle,
        status: dex.xUrl ? STATUS.OK : STATUS.MISSING_IDENTIFIER,
        // Enriched fields (from twitter154)
        accountAgeDays: enrichment.accountAgeDays,
        followerCount: enrichment.followerCount,
        verified: enrichment.verified,
        caMentionCount: enrichment.caMentionCount,
        displayName: enrichment.displayName,
        renameCount: renameData?.renameCount ?? null,
        enrichmentStatus: enrichment.enrichmentStatus,
    };

    // 8. Build full response
    return {
        schemaVersion: SCHEMA_VERSION,
        token: {
            ca,
            name: dex.name || undefined,
            symbol: dex.symbol || undefined,
            hasImage: dex.hasImage,
        },
        links: {
            website: {
                url: dex.websiteUrl,
                status: dex.websiteUrl ? STATUS.OK : STATUS.MISSING_IDENTIFIER,
            },
            x: {
                url: dex.xUrl,
                status: dex.xUrl ? STATUS.OK : STATUS.MISSING_IDENTIFIER,
            },
        },
        x: {
            profile: xProfile,
            communities: xCommunities,
        },
        website: {
            url: dex.websiteUrl,
            domain: dex.websiteDomain,
            title: websiteMeta.title,
            metaDescription: websiteMeta.metaDescription,
            domainAgeDays: null, // Not implemented yet
            statusCode: websiteMeta.statusCode,
            tls: websiteMeta.tls,
            redirects: websiteMeta.redirects,
            lastFetched: websiteMeta.lastFetched,
            status: websiteMeta.status,
        },
        dev: {
            mintAgeDays: null,
            deployer: null,
            deployerMints30d: null,
            status: STATUS.NOT_SUPPORTED,
            lastFetched: null,
        },
        fetchedAt: new Date().toISOString(),
    };
}

/**
 * Parse X handle from URL.
 * @param {string|null} url
 * @returns {string|null}
 */
function parseXHandle(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const cleaned = url.trim().replace(/\/+$/, '').split('?')[0].split('#')[0];
        const match = cleaned.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})$/i);
        return match ? `@${match[1].toLowerCase()}` : null;
    } catch (_) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Route: /context
// ---------------------------------------------------------------------------

async function handleContext(request, env) {
    const url = new URL(request.url);
    const chain = url.searchParams.get('chain');
    const ca = url.searchParams.get('ca');

    if (!chain || chain !== 'solana') {
        return json({ ok: false, error: 'Unsupported chain. Use chain=solana' }, 400);
    }

    if (!ca || ca.length < 20) {
        return json({ ok: false, error: 'Missing or invalid ca parameter' }, 400);
    }

    // Check Cache API
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
        return cachedResponse;
    }

    // Build fresh context
    const context = await buildContext(ca, env);

    // Create cacheable response
    const response = json(context, 200, {
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    });

    // Store in cache (non-blocking)
    const responseToCache = response.clone();
    // @ts-ignore - waitUntil available in CF Workers
    try {
        await cache.put(cacheKey, responseToCache);
    } catch (_) {
        // Cache put failure is non-critical
    }

    return response;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(request) });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        // Health
        if (path === '/health' && request.method === 'GET') {
            return withCors(json({
                ok: true,
                version: '1.0',
                twitter154Enabled: isTwitter154Enabled(env),
            }), request);
        }

        // Context
        if (path === '/context' && request.method === 'GET') {
            const response = await handleContext(request, env);
            return withCors(response, request);
        }

        return withCors(json({ ok: false, error: 'Not found' }, 404), request);
    },
};
