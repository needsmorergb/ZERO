/**
 * ZERØ Context API Worker
 * Cloudflare Worker serving token context data for the ZERØ extension.
 *
 * Endpoints:
 *   GET  /health                          – liveness check
 *   GET  /context?chain=solana&ca=<mint>  – fetch ContextResponseV1
 *   POST /auth/exchange                   – Whop OAuth code exchange + access check
 *   POST /verify-membership               – license key or userId verification
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
// Developer Enrichment (Helius)
// ---------------------------------------------------------------------------

/**
 * Fetch deployer and mint age information via Helius.
 * @param {string} ca - Token mint address
 * @param {object} env
 * @returns {Promise<{ mintAgeDays: number|null, deployer: string|null, deployerMints30d: number|null, mintAuthority: string|null|undefined, freezeAuthority: string|null|undefined, metadataMutable: boolean|null, devHoldingsPct: number|null, deployerBalanceSol: number|null, deployerAgeDays: number|null, recentMints7d: number|null, status: string }>}
 */
async function fetchDevEnrichment(ca, env) {
    const result = {
        mintAgeDays: null,
        deployer: null,
        deployerMints30d: null,
        // Tier 1: Authority signals (extracted from getAsset, no extra calls)
        mintAuthority: undefined,      // null = revoked, string = active, undefined = not fetched
        freezeAuthority: undefined,    // null = revoked, string = active, undefined = not fetched
        metadataMutable: null,         // true = mutable, false = immutable, null = unknown
        // Tier 1b + 2: Deployer-dependent signals (parallel calls after deployer resolved)
        devHoldingsPct: null,          // Deployer's % of total supply
        deployerBalanceSol: null,      // Deployer wallet SOL balance
        deployerAgeDays: null,         // Age of deployer wallet
        recentMints7d: null,           // Tokens created by deployer in last 7 days
        status: STATUS.NOT_SUPPORTED,
    };

    if (!env.HELIUS_API_KEY) {
        console.log('[DevEnrichment] Skipped - HELIUS_API_KEY not configured');
        return result;
    }

    try {
        const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;

        // 1. Try Helius DAS getAsset first (may have creation time and creator info)
        const assetRes = await fetchWithTimeout(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'zero-asset',
                method: 'getAsset',
                params: { id: ca }
            })
        }, 5000);

        let createdAt = null;
        let creator = null;
        let tokenSupply = null;  // raw supply (integer string)
        let tokenDecimals = null;

        if (assetRes.ok) {
            const assetData = await assetRes.json();
            const asset = assetData?.result;

            // Check for creation timestamp
            if (asset?.content?.metadata?.created_at) {
                createdAt = asset.content.metadata.created_at;
            }

            // Check for creator info
            if (asset?.creators && asset.creators.length > 0) {
                // First creator is usually the deployer
                creator = asset.creators[0].address;
            }

            // Also check ownership for creator
            if (!creator && asset?.ownership?.owner) {
                creator = asset.ownership.owner;
            }

            // Tier 1: Extract authority signals from token_info
            const tokenInfo = asset?.token_info;
            if (tokenInfo) {
                // mint_authority: null means revoked (safe), string means active (risk)
                result.mintAuthority = tokenInfo.mint_authority ?? null;
                result.freezeAuthority = tokenInfo.freeze_authority ?? null;
                tokenSupply = tokenInfo.supply;
                tokenDecimals = tokenInfo.decimals;
            }

            // Metadata mutability: false = immutable (safe), true = mutable (risk)
            if (asset?.mutable !== undefined) {
                result.metadataMutable = asset.mutable;
            }

            console.log(`[DevEnrichment] DAS Asset data for ${ca.slice(0, 8)}:`, {
                hasCreatedAt: !!createdAt,
                hasCreator: !!creator,
                mintAuth: result.mintAuthority === null ? 'revoked' : result.mintAuthority ? 'active' : 'unknown',
                freezeAuth: result.freezeAuthority === null ? 'revoked' : result.freezeAuthority ? 'active' : 'unknown',
                mutable: result.metadataMutable
            });
        }

        // 2. Fallback: Get mint account info to extract mint authority
        if (!creator) {
            const mintRes = await fetchWithTimeout(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'zero-mint-info',
                    method: 'getAccountInfo',
                    params: [ca, { encoding: 'jsonParsed' }]
                })
            }, 5000);

            if (mintRes.ok) {
                const mintData = await mintRes.json();
                const parsedInfo = mintData?.result?.value?.data?.parsed?.info;
                const mintAuthority = parsedInfo?.mintAuthority;
                if (mintAuthority) {
                    creator = mintAuthority;
                }
                // Backfill authority signals if DAS didn't provide token_info
                if (result.mintAuthority === undefined && parsedInfo) {
                    result.mintAuthority = parsedInfo.mintAuthority ?? null;
                    result.freezeAuthority = parsedInfo.freezeAuthority ?? null;
                }
                // Backfill supply if not from DAS
                if (tokenSupply == null && parsedInfo?.supply) {
                    tokenSupply = parsedInfo.supply;
                    tokenDecimals = parsedInfo.decimals;
                }
            }
        }

        // 3. Get mint creation timestamp by paginating backwards through signatures
        let creationSig = null;
        if (!createdAt) {
            let oldestBlockTime = null;
            let beforeSig = null;
            let foundCreation = false;
            const maxPages = 5; // Limit pagination to avoid rate limits (covers ~5000 tx)

            for (let page = 0; page < maxPages; page++) {
                const params = beforeSig
                    ? [ca, { limit: 1000, before: beforeSig }]
                    : [ca, { limit: 1000 }];

                const sigsRes = await fetchWithTimeout(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: `zero-sigs-${page}`,
                        method: 'getSignaturesForAddress',
                        params: params
                    })
                }, 8000);

                if (!sigsRes.ok) break;

                const sigsData = await sigsRes.json();
                const signatures = sigsData?.result || [];

                if (signatures.length === 0) break; // No more signatures

                // Get the oldest signature from this batch
                const batchOldest = signatures[signatures.length - 1];
                if (batchOldest?.blockTime) {
                    oldestBlockTime = batchOldest.blockTime;
                    beforeSig = batchOldest.signature;
                }

                // If we got fewer than 1000 signatures, we've reached the token creation
                if (signatures.length < 1000) {
                    foundCreation = true;
                    creationSig = batchOldest.signature;
                    createdAt = oldestBlockTime * 1000;
                    console.log(`[DevEnrichment] Found token creation for ${ca.slice(0, 8)} at ${new Date(createdAt).toISOString()}`);
                    break;
                }
            }

            // If we didn't find creation (hit maxPages), don't guess - leave as null
            if (!foundCreation && oldestBlockTime) {
                console.log(`[DevEnrichment] Could not determine creation date for ${ca.slice(0, 8)} (high volume token)`);
                // createdAt remains null
            }
        }

        // 4. If deployer still unknown, extract fee payer from creation tx
        //    (handles pump.fun tokens where DAS creators and mint authority are empty/revoked)
        if (!creator && creationSig) {
            try {
                const txRes = await fetchWithTimeout(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'zero-creation-tx',
                        method: 'getTransaction',
                        params: [creationSig, { maxSupportedTransactionVersion: 0, encoding: 'json' }]
                    })
                }, 5000);

                if (txRes.ok) {
                    const txData = await txRes.json();
                    const msg = txData?.result?.transaction?.message;
                    const accountKeys = msg?.accountKeys || msg?.staticAccountKeys || [];
                    if (accountKeys.length > 0) {
                        // First account key is the fee payer (deployer)
                        const key = accountKeys[0];
                        creator = typeof key === 'string' ? key : key?.pubkey;
                        console.log(`[DevEnrichment] Deployer from creation tx for ${ca.slice(0, 8)}: ${creator?.slice(0, 8)}`);
                    }
                }
            } catch (e) {
                console.warn(`[DevEnrichment] Could not fetch creation tx: ${e?.message}`);
            }
        }

        result.deployer = creator;

        // Calculate mint age from creation timestamp
        if (createdAt) {
            const ageMs = Date.now() - createdAt;
            result.mintAgeDays = Math.floor(ageMs / (86400 * 1000));
        }

        // 5. Parallel fan-out: fetch all deployer-dependent signals at once
        if (creator) {
            const rpcCall = (id, method, params) => fetchWithTimeout(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
            }, 5000).then(r => r.ok ? r.json() : null).catch(() => null);

            const [creatorAssetsData, devTokenData, deployerInfoData, deployerSigsData] = await Promise.all([
                // (a) getAssetsByCreator — total count + recent 20 for 7-day filter
                rpcCall('zero-deployer-creations', 'getAssetsByCreator', {
                    creatorAddress: creator,
                    onlyVerified: false,
                    page: 1,
                    limit: 20,
                    sortBy: 'created',
                    sortDirection: 'desc'
                }),
                // (b) getTokenAccounts — deployer's holdings of this token
                rpcCall('zero-dev-holdings', 'getTokenAccounts', {
                    mint: ca,
                    owner: creator,
                    limit: 1
                }),
                // (c) getAccountInfo — deployer wallet SOL balance
                rpcCall('zero-deployer-info', 'getAccountInfo', [creator, { encoding: 'jsonParsed' }]),
                // (d) getSignaturesForAddress — deployer wallet age (oldest tx)
                rpcCall('zero-deployer-sigs', 'getSignaturesForAddress', [creator, { limit: 1000 }])
            ]);

            // (a) Process creator assets: total count + 7-day count
            if (creatorAssetsData?.result) {
                const total = creatorAssetsData.result.total;
                if (total != null) {
                    result.deployerMints30d = total;
                }
                // Count assets created in last 7 days
                const sevenDaysAgo = Date.now() - (7 * 86400 * 1000);
                const items = creatorAssetsData.result.items || [];
                let recent7d = 0;
                for (const item of items) {
                    const created = item?.content?.metadata?.created_at;
                    if (created && new Date(created).getTime() > sevenDaysAgo) {
                        recent7d++;
                    }
                }
                result.recentMints7d = recent7d;
                console.log(`[DevEnrichment] Deployer ${creator.slice(0, 8)}: ${total} total, ${recent7d} in 7d`);
            }

            // (b) Process dev token holdings
            if (devTokenData?.result && tokenSupply) {
                const accounts = devTokenData.result.token_accounts || [];
                if (accounts.length > 0) {
                    const devBalance = Number(accounts[0]?.amount || 0);
                    const supply = Number(tokenSupply);
                    if (supply > 0) {
                        result.devHoldingsPct = Number(((devBalance / supply) * 100).toFixed(2));
                    }
                } else {
                    // Deployer has no token account for this mint — 0%
                    result.devHoldingsPct = 0;
                }
            }

            // (c) Process deployer wallet SOL balance
            if (deployerInfoData?.result?.value) {
                const lamports = deployerInfoData.result.value.lamports;
                if (lamports != null) {
                    result.deployerBalanceSol = Number((lamports / 1e9).toFixed(4));
                }
            }

            // (d) Process deployer wallet age from oldest signature
            if (deployerSigsData?.result) {
                const sigs = deployerSigsData.result;
                if (sigs.length > 0) {
                    const oldest = sigs[sigs.length - 1];
                    if (oldest?.blockTime) {
                        const walletAgeMs = Date.now() - (oldest.blockTime * 1000);
                        result.deployerAgeDays = Math.floor(walletAgeMs / (86400 * 1000));
                        // If we got 1000 results, this is a lower bound (wallet is at least this old)
                        if (sigs.length >= 1000) {
                            console.log(`[DevEnrichment] Deployer wallet age ≥ ${result.deployerAgeDays} days (high-activity wallet)`);
                        }
                    }
                }
            }
        }

        // Mark as OK if we successfully queried the token (even if data is limited)
        result.status = STATUS.OK;
        console.log(`[DevEnrichment] Complete for ${ca.slice(0, 8)}:`, {
            mintAgeDays: result.mintAgeDays,
            deployer: result.deployer?.slice(0, 8) || 'null',
            deployerMints30d: result.deployerMints30d,
            mintAuth: result.mintAuthority === null ? 'revoked' : result.mintAuthority === undefined ? 'unknown' : 'active',
            freezeAuth: result.freezeAuthority === null ? 'revoked' : result.freezeAuthority === undefined ? 'unknown' : 'active',
            mutable: result.metadataMutable,
            devHoldingsPct: result.devHoldingsPct,
            deployerBalanceSol: result.deployerBalanceSol,
            deployerAgeDays: result.deployerAgeDays,
            recentMints7d: result.recentMints7d
        });

        return result;
    } catch (e) {
        console.warn('[DevEnrichment] Fetch failed:', e?.message || e);
        return result;
    }
}

// ---------------------------------------------------------------------------
// On-Chain Metadata Fetching (Fallback for DexScreener)
// ---------------------------------------------------------------------------

/**
 * Fetch on-chain token metadata from Solana via Helius.
 * Fallback for when DexScreener doesn't have socials.
 * @param {string} ca - Token mint address
 * @param {object} env
 * @returns {Promise<{ xUrl: string|null, websiteUrl: string|null, communityUrls: string[] }>}
 */
async function fetchOnChainMetadata(ca, env) {
    const result = { xUrl: null, websiteUrl: null, communityUrls: [] };

    try {
        // Try Helius DAS API first (if configured), otherwise use public RPC
        const useHelius = !!env.HELIUS_API_KEY;
        const rpcUrl = useHelius
            ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
            : 'https://api.mainnet-beta.solana.com';

        if (useHelius) {
            // Use Helius DAS API
            const res = await fetchWithTimeout(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'zero-metadata',
                    method: 'getAsset',
                    params: { id: ca }
                })
            }, 5000);

            if (!res.ok) return result;

            const data = await res.json();
            const content = data?.result?.content;
            const metadata = content?.metadata;
            const links = content?.links;
            const jsonUri = content?.json_uri;

            // Check links first (newer format)
            if (links) {
                // Skip community URLs in links.twitter - they'll be parsed separately
                if (links.twitter && !links.twitter.includes('/communities/')) {
                    result.xUrl = `https://twitter.com/${links.twitter.replace('@', '')}`;
                }
                if (links.external_url) result.websiteUrl = links.external_url;
            }

            // Fallback to metadata fields
            if (metadata) {
                const twitterField = metadata.twitter || metadata.x || metadata.social_twitter;
                if (twitterField) {
                    const isCommunityUrl = twitterField.includes('/communities/');
                    if (isCommunityUrl) {
                        // Add to community URLs list
                        if (!result.communityUrls.includes(twitterField)) {
                            result.communityUrls.push(twitterField);
                        }
                    } else if (!result.xUrl) {
                        // Use as profile URL
                        if (twitterField.includes('twitter.com') || twitterField.includes('x.com')) {
                            result.xUrl = twitterField;
                        } else {
                            result.xUrl = `https://twitter.com/${twitterField.replace('@', '')}`;
                        }
                    }
                }
            }

            if (!result.websiteUrl && metadata?.external_url) {
                result.websiteUrl = metadata.external_url;
            }

            // If still no results and json_uri exists, fetch it
            if ((!result.xUrl || !result.websiteUrl) && jsonUri) {
                try {
                    const jsonRes = await fetchWithTimeout(jsonUri, {}, 5000);
                    if (jsonRes.ok) {
                        const json = await jsonRes.json();

                        // Check various fields in the external JSON
                        const twitterField = json.twitter || json.x || json.social?.twitter || json.socials?.twitter;
                        if (twitterField) {
                            const isCommunityUrl = twitterField.includes('/communities/');
                            if (isCommunityUrl) {
                                // Add to community URLs list
                                if (!result.communityUrls.includes(twitterField)) {
                                    result.communityUrls.push(twitterField);
                                }
                            } else if (!result.xUrl) {
                                // Use as profile URL
                                if (twitterField.includes('twitter.com') || twitterField.includes('x.com')) {
                                    result.xUrl = twitterField;
                                } else {
                                    result.xUrl = `https://twitter.com/${twitterField.replace('@', '')}`;
                                }
                            }
                        }

                        if (!result.websiteUrl) {
                            result.websiteUrl = json.website || json.external_url || json.url;
                        }
                    }
                } catch (e) {
                    console.warn('[OnChainMetadata] Failed to fetch json_uri:', e?.message);
                }
            }
        } else {
            // Use public RPC getAccountInfo to fetch metadata account
            // First, derive the metadata PDA address
            const metadataRes = await fetchWithTimeout(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'zero-metadata',
                    method: 'getAccountInfo',
                    params: [
                        ca,
                        { encoding: 'jsonParsed' }
                    ]
                })
            }, 5000);

            if (!metadataRes.ok) return result;

            const accountData = await metadataRes.json();
            const parsed = accountData?.result?.value?.data?.parsed;

            if (parsed?.info?.extensions) {
                // Token-2022 extensions may contain metadata
                const metadata = parsed.info.extensions.find((ext) => ext.extension === 'metadata');
                if (metadata) {
                    const uri = metadata.state?.uri;
                    if (uri) {
                        // Fetch the metadata JSON from the URI
                        try {
                            const jsonRes = await fetchWithTimeout(uri, {}, 5000);
                            if (jsonRes.ok) {
                                const json = await jsonRes.json();
                                if (json.twitter) result.xUrl = json.twitter;
                                if (json.website) result.websiteUrl = json.website;
                            }
                        } catch (_) {
                            // Ignore metadata fetch errors
                        }
                    }
                }
            }
        }

        if (result.xUrl || result.websiteUrl) {
            console.log(`[OnChainMetadata] Fetched for ${ca.slice(0, 8)}:`, result);
        }
        return result;
    } catch (e) {
        console.warn('[OnChainMetadata] Fetch failed:', e?.message || e);
        return result;
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

    console.log(`[Twitter154] Fetching fresh data for @${handle}, cached status:`, cached?.enrichmentStatus || 'none');

    // Fetch profile first (optimized: don't fetch tweets if profile fails)
    const profile = await fetchTwitter154Profile(handle, env);
    console.log(`[Twitter154] Profile fetch result for @${handle}:`, profile?._error || 'success');

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

    // 2. Fallback to on-chain metadata if DexScreener has no socials
    let onChainCommunityUrls = [];
    if (!dex.xUrl || !dex.websiteUrl) {
        console.log(`[Context] DexScreener missing socials for ${ca.slice(0, 8)}, fetching on-chain metadata`);
        const onChain = await fetchOnChainMetadata(ca, env);
        if (!dex.xUrl && onChain.xUrl) {
            dex.xUrl = onChain.xUrl;
            console.log(`[Context] Using on-chain X URL: ${onChain.xUrl}`);
        }
        if (!dex.websiteUrl && onChain.websiteUrl) {
            dex.websiteUrl = onChain.websiteUrl;
            dex.websiteDomain = onChain.websiteUrl ? new URL(onChain.websiteUrl).hostname : null;
            console.log(`[Context] Using on-chain website URL: ${onChain.websiteUrl}`);
        }
        if (onChain.communityUrls.length > 0) {
            onChainCommunityUrls = onChain.communityUrls;
            console.log(`[Context] Found ${onChainCommunityUrls.length} community URL(s) in on-chain metadata`);
        }
    }

    // 3. Fetch website metadata (Phase 1: always attempt if URL exists)
    const websiteMeta = await fetchWebsiteMetadata(dex.websiteUrl);

    // 4. Fetch X Communities from website (Phase 1: always attempt if URL exists)
    let xCommunities = await fetchAndParseXCommunities(dex.websiteUrl);

    // 4b. Merge on-chain community URLs with parsed communities
    if (onChainCommunityUrls.length > 0) {
        const existingUrls = new Set(xCommunities.items.map(c => c.url));
        for (const url of onChainCommunityUrls) {
            if (!existingUrls.has(url)) {
                xCommunities.items.push({
                    name: 'X Community',
                    url: url,
                    memberCount: null,
                    activityLevel: 'unknown',
                    evidence: ['Found in on-chain metadata']
                });
            }
        }
        if (xCommunities.items.length > 0 && xCommunities.status === STATUS.MISSING_IDENTIFIER) {
            xCommunities.status = STATUS.OK;
        }
    }

    // 5. Parse X handle
    const handle = parseXHandle(dex.xUrl);
    const handleClean = handle ? handle.replace(/^@/, '') : null;

    // 6. Twitter154 enrichment (feature-flagged, with caching and rate limit protection)
    const enrichment = await fetchTwitter154WithCache(handleClean, ca, env);

    // 7. KV rename tracking (feature-flagged via KV binding presence)
    let renameData = null;
    if (enrichment.userId && handleClean) {
        renameData = await trackHandleRename(enrichment.userId, handleClean, env);
    }

    // 8. Dev enrichment (Helius)
    const devEnrichment = await fetchDevEnrichment(ca, env);

    // 9. Build X profile
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

    // 10. Build full response
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
            mintAgeDays: devEnrichment.mintAgeDays,
            deployer: devEnrichment.deployer,
            deployerMints30d: devEnrichment.deployerMints30d,
            // Tier 1: Authority signals
            mintAuthority: devEnrichment.mintAuthority,
            freezeAuthority: devEnrichment.freezeAuthority,
            metadataMutable: devEnrichment.metadataMutable,
            // Tier 1b + 2: Deployer-dependent signals
            devHoldingsPct: devEnrichment.devHoldingsPct,
            deployerBalanceSol: devEnrichment.deployerBalanceSol,
            deployerAgeDays: devEnrichment.deployerAgeDays,
            recentMints7d: devEnrichment.recentMints7d,
            status: devEnrichment.status,
            lastFetched: devEnrichment.status === STATUS.OK ? new Date().toISOString() : null,
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

        // Match both profile URLs and status/tweet URLs
        // Profile: x.com/username or twitter.com/username
        // Status: x.com/username/status/123456
        // Other: x.com/username/with_replies, etc.
        const match = cleaned.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})(?:\/|$)/i);
        return match ? `@${match[1].toLowerCase()}` : null;
    } catch (_) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Whop Membership Verification
// ---------------------------------------------------------------------------

const WHOP_API_BASE = 'https://api.whop.com/api/v1';

/**
 * SHA-256 hash a string and return hex.
 * @param {string} str
 * @returns {Promise<string>}
 */
async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Rate-limit check via KV. Returns true if request should be blocked.
 * @param {string} ip
 * @param {object} env
 * @returns {Promise<boolean>}
 */
async function isRateLimited(ip, env) {
    if (!env?.LICENSE_CACHE) return false;
    const key = `ratelimit:${ip}`;
    try {
        const val = await env.LICENSE_CACHE.get(key, { type: 'json' });
        if (val && val.count >= 10) return true;
        const count = (val?.count || 0) + 1;
        await env.LICENSE_CACHE.put(key, JSON.stringify({ count }), { expirationTtl: 3600 });
        return false;
    } catch (_) {
        return false;
    }
}

/**
 * Determine plan type from Whop membership response.
 * @param {object} membership - Whop membership object
 * @param {string} productId - Which product ID matched
 * @param {object} env
 * @returns {string} 'monthly' | 'annual' | 'founders'
 */
function derivePlan(membership, productId, env) {
    if (productId === env.WHOP_PRODUCT_ID_FOUNDERS) return 'founders';
    // Distinguish monthly vs annual by renewal period length
    if (membership.renewal_period_start && membership.renewal_period_end) {
        const start = new Date(membership.renewal_period_start).getTime();
        const end = new Date(membership.renewal_period_end).getTime();
        const daysInPeriod = (end - start) / (86400 * 1000);
        if (daysInPeriod > 60) return 'annual';
    }
    return 'monthly';
}

/**
 * Handle POST /verify-membership
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response>}
 */
async function handleVerifyMembership(request, env) {
    // Validate env
    if (!env.WHOP_API_KEY) {
        return json({ ok: false, error: 'server_misconfigured' }, 500);
    }

    // Rate limit by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await isRateLimited(ip, env)) {
        return json({ ok: false, error: 'rate_limited' }, 429);
    }

    // Parse body
    let body;
    try {
        body = await request.json();
    } catch (_) {
        return json({ ok: false, error: 'invalid_json' }, 400);
    }

    const { licenseKey, userId } = body;

    // User-ID-based verification (OAuth flow)
    if (userId && typeof userId === 'string' && userId.length > 2) {
        return handleVerifyByUserId(userId, env);
    }

    // Legacy license-key-based verification
    if (!licenseKey || typeof licenseKey !== 'string' || licenseKey.length < 4) {
        return json({ ok: false, error: 'invalid_key' }, 400);
    }

    // Check KV cache first
    const cacheKey = `license:${await sha256Hex(licenseKey)}`;
    if (env.LICENSE_CACHE) {
        try {
            const cached = await env.LICENSE_CACHE.get(cacheKey, { type: 'json' });
            if (cached && cached.cachedAt && (Date.now() - cached.cachedAt) < 86400000) {
                console.log('[Whop] Returning cached license validation');
                return json({ ok: true, membership: cached.membership, cachedAt: cached.cachedAt, fromCache: true });
            }
        } catch (_) { /* cache miss */ }
    }

    // Call Whop API: GET /memberships/{licenseKey}
    try {
        const res = await fetchWithTimeout(
            `${WHOP_API_BASE}/memberships/${encodeURIComponent(licenseKey)}`,
            {
                headers: {
                    'Authorization': `Bearer ${env.WHOP_API_KEY}`,
                    'Accept': 'application/json',
                },
            },
            8000
        );

        if (res.status === 404) {
            return json({ ok: false, error: 'invalid_key' }, 404);
        }

        if (res.status === 429) {
            return json({ ok: false, error: 'whop_rate_limited' }, 429);
        }

        if (!res.ok) {
            console.warn(`[Whop] API returned ${res.status}`);
            return json({ ok: false, error: 'verification_failed' }, 502);
        }

        const data = await res.json();

        // Validate product ID matches one of our products
        const memberProductId = data.product?.id || null;
        const validProductIds = [
            env.WHOP_PRODUCT_ID_ELITE,
            env.WHOP_PRODUCT_ID_FOUNDERS,
        ].filter(Boolean);

        if (!memberProductId || !validProductIds.includes(memberProductId)) {
            console.warn(`[Whop] Product ID mismatch: ${memberProductId}`);
            return json({ ok: false, error: 'invalid_product' }, 403);
        }

        // Check membership status
        const isValid = data.status === 'active' || data.status === 'trialing';
        const plan = derivePlan(data, memberProductId, env);

        const membership = {
            valid: isValid,
            status: data.status,
            plan,
            tier: isValid ? 'elite' : 'free',
            expiresAt: plan === 'founders' ? null : (data.renewal_period_end || null),
        };

        // Cache in KV (24h TTL)
        if (env.LICENSE_CACHE) {
            try {
                await env.LICENSE_CACHE.put(cacheKey, JSON.stringify({
                    membership,
                    cachedAt: Date.now(),
                }), { expirationTtl: 86400 });
            } catch (_) { /* non-critical */ }
        }

        return json({ ok: true, membership, cachedAt: Date.now(), fromCache: false });
    } catch (e) {
        console.error('[Whop] Verification error:', e?.message || e);
        return json({ ok: false, error: 'service_unavailable' }, 503);
    }
}

// ---------------------------------------------------------------------------
// OAuth Code Exchange + User Access Check
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload without verification (we trust Whop's response).
 * @param {string} jwt
 * @returns {object|null}
 */
function decodeJwtPayload(jwt) {
    try {
        const parts = jwt.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
        return JSON.parse(atob(padded));
    } catch (_) {
        return null;
    }
}

/**
 * Check if a Whop user has access to our products.
 * Uses App API Key — no user token needed.
 * @param {string} userId - Whop user ID (user_xxx)
 * @param {object} env
 * @returns {Promise<{ valid: boolean, productId: string|null, accessLevel: string|null }>}
 */
async function checkUserAccess(userId, env) {
    const productIds = [
        env.WHOP_PRODUCT_ID_ELITE,
        env.WHOP_PRODUCT_ID_FOUNDERS,
    ].filter(Boolean);

    for (const pid of productIds) {
        try {
            const res = await fetchWithTimeout(
                `${WHOP_API_BASE}/users/${encodeURIComponent(userId)}/access/${encodeURIComponent(pid)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${env.WHOP_API_KEY}`,
                        'Accept': 'application/json',
                    },
                },
                8000
            );
            if (res.ok) {
                const data = await res.json();
                if (data.has_access) {
                    return { valid: true, productId: pid, accessLevel: data.access_level || 'customer' };
                }
            }
        } catch (_) { /* try next product */ }
    }
    return { valid: false, productId: null, accessLevel: null };
}

/**
 * Handle POST /auth/exchange
 * Exchanges OAuth authorization code for tokens, extracts user ID,
 * and checks membership access.
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response>}
 */
async function handleAuthExchange(request, env) {
    if (!env.WHOP_API_KEY || !env.WHOP_CLIENT_ID) {
        return json({ ok: false, error: 'server_misconfigured' }, 500);
    }

    // Rate limit by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await isRateLimited(ip, env)) {
        return json({ ok: false, error: 'rate_limited' }, 429);
    }

    let body;
    try {
        body = await request.json();
    } catch (_) {
        return json({ ok: false, error: 'invalid_json' }, 400);
    }

    const { code, codeVerifier, redirectUri } = body;
    if (!code || !codeVerifier || !redirectUri) {
        return json({ ok: false, error: 'missing_params' }, 400);
    }

    // Step 1: Exchange authorization code for tokens
    let tokens;
    try {
        const tokenBody = {
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: env.WHOP_CLIENT_ID,
            code_verifier: codeVerifier,
        };
        // Include client_secret if available (optional for PKCE but some providers require it)
        if (env.WHOP_CLIENT_SECRET) {
            tokenBody.client_secret = env.WHOP_CLIENT_SECRET;
        }

        const tokenRes = await fetchWithTimeout(
            'https://api.whop.com/oauth/token',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tokenBody),
            },
            10000
        );

        if (!tokenRes.ok) {
            const errText = await tokenRes.text().catch(() => '');
            console.error(`[Auth] Token exchange failed: ${tokenRes.status} ${errText}`);
            return json({ ok: false, error: 'token_exchange_failed' }, 502);
        }

        tokens = await tokenRes.json();
    } catch (e) {
        console.error('[Auth] Token exchange error:', e?.message || e);
        return json({ ok: false, error: 'token_exchange_error' }, 502);
    }

    // Step 2: Extract user ID from id_token (JWT sub claim)
    let userId = null;
    if (tokens.id_token) {
        const payload = decodeJwtPayload(tokens.id_token);
        if (payload?.sub) userId = payload.sub;
    }

    // Fallback: use access_token to call /me
    if (!userId && tokens.access_token) {
        try {
            const meRes = await fetchWithTimeout(
                `${WHOP_API_BASE}/me`,
                {
                    headers: {
                        'Authorization': `Bearer ${tokens.access_token}`,
                        'Accept': 'application/json',
                    },
                },
                8000
            );
            if (meRes.ok) {
                const meData = await meRes.json();
                userId = meData.id || meData.user_id || null;
            }
        } catch (_) { /* proceed without userId */ }
    }

    if (!userId) {
        return json({ ok: false, error: 'user_id_not_found' }, 502);
    }

    // Step 3: Check if user has access to our products
    const access = await checkUserAccess(userId, env);

    const plan = access.productId === env.WHOP_PRODUCT_ID_FOUNDERS ? 'founders' : (access.valid ? 'monthly' : null);
    const membership = {
        valid: access.valid,
        status: access.valid ? 'active' : 'no_access',
        plan,
        tier: access.valid ? 'elite' : 'free',
        expiresAt: plan === 'founders' ? null : undefined,
    };

    // Cache in KV by user ID
    if (env.LICENSE_CACHE && userId) {
        try {
            const userCacheKey = `user:${await sha256Hex(userId)}`;
            await env.LICENSE_CACHE.put(userCacheKey, JSON.stringify({
                membership,
                userId,
                cachedAt: Date.now(),
            }), { expirationTtl: 86400 });
        } catch (_) { /* non-critical */ }
    }

    return json({ ok: true, userId, membership, cachedAt: Date.now() });
}

/**
 * Handle user-based membership verification via has_access API.
 * Called during revalidation when we have a stored userId.
 * @param {string} userId
 * @param {object} env
 * @returns {Promise<Response>}
 */
async function handleVerifyByUserId(userId, env) {
    // Check KV cache first
    const userCacheKey = `user:${await sha256Hex(userId)}`;
    if (env.LICENSE_CACHE) {
        try {
            const cached = await env.LICENSE_CACHE.get(userCacheKey, { type: 'json' });
            if (cached && cached.cachedAt && (Date.now() - cached.cachedAt) < 86400000) {
                console.log('[Whop] Returning cached user access validation');
                return json({ ok: true, membership: cached.membership, cachedAt: cached.cachedAt, fromCache: true });
            }
        } catch (_) { /* cache miss */ }
    }

    const access = await checkUserAccess(userId, env);
    const plan = access.productId === env.WHOP_PRODUCT_ID_FOUNDERS ? 'founders' : (access.valid ? 'monthly' : null);
    const membership = {
        valid: access.valid,
        status: access.valid ? 'active' : 'no_access',
        plan,
        tier: access.valid ? 'elite' : 'free',
        expiresAt: plan === 'founders' ? null : undefined,
    };

    // Cache result
    if (env.LICENSE_CACHE) {
        try {
            await env.LICENSE_CACHE.put(userCacheKey, JSON.stringify({
                membership,
                userId,
                cachedAt: Date.now(),
            }), { expirationTtl: 86400 });
        } catch (_) { /* non-critical */ }
    }

    return json({ ok: true, membership, cachedAt: Date.now(), fromCache: false });
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
// Route: /wallet/poll — Shadow Mode Swap Detection via Helius RPC
// ---------------------------------------------------------------------------

/**
 * Polls a wallet's recent transactions and returns parsed swap data.
 * Uses getSignaturesForAddress + getTransaction with the Helius API key.
 *
 * Query params:
 *   address  — Solana wallet address to poll
 *   after    — (optional) Only return transactions newer than this signature
 */
async function handleWalletPoll(request, env) {
    if (!env.HELIUS_API_KEY) {
        return json({ ok: false, error: 'Helius API key not configured' }, 503);
    }

    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const after = url.searchParams.get('after') || null;

    if (!address || address.length < 32 || address.length > 44) {
        return json({ ok: false, error: 'Invalid address' }, 400);
    }

    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;

    try {
        // Step 1: Get recent signatures
        const sigParams = { limit: 5 };
        if (after) sigParams.until = after;

        const sigResp = await fetchWithTimeout(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1,
                method: 'getSignaturesForAddress',
                params: [address, sigParams],
            }),
        }, 10000);

        const sigData = await sigResp.json();
        const signatures = sigData?.result || [];

        if (signatures.length === 0) {
            return json({ ok: true, swaps: [], lastSignature: after });
        }

        // Step 2: Parse each transaction for swap activity
        const swaps = [];

        for (const sigInfo of signatures) {
            if (sigInfo.err) continue;

            try {
                const txResp = await fetchWithTimeout(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0', id: 1,
                        method: 'getTransaction',
                        params: [sigInfo.signature, { maxSupportedTransactionVersion: 0 }],
                    }),
                }, 10000);

                const txData = await txResp.json();
                const tx = txData?.result;
                if (!tx) continue;

                const swap = workerParseSwap(tx, address, sigInfo.signature);
                if (swap) swaps.push(swap);
            } catch (_) { /* skip individual tx errors */ }
        }

        const newLastSig = signatures[0]?.signature || after;
        return json({ ok: true, swaps, lastSignature: newLastSig });
    } catch (e) {
        console.error('[WalletPoll] Error:', e?.message || e);
        return json({ ok: false, error: 'RPC error' }, 502);
    }
}

/**
 * Parse a raw Solana transaction for SOL<->token swaps.
 * Detects swaps by comparing pre/post balance changes — works with any DEX.
 */
function workerParseSwap(tx, walletAddress, signature) {
    const meta = tx.meta;
    if (!meta || meta.err) return null;

    const accountKeys = tx.transaction?.message?.accountKeys || [];

    let walletIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
        const key = typeof accountKeys[i] === 'string' ? accountKeys[i] : accountKeys[i]?.pubkey;
        if (key === walletAddress) { walletIndex = i; break; }
    }
    if (walletIndex === -1) return null;

    const preLamports = meta.preBalances?.[walletIndex] || 0;
    const postLamports = meta.postBalances?.[walletIndex] || 0;
    const fee = (meta.fee || 0) / 1e9;
    const solDelta = (postLamports - preLamports) / 1e9;

    const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';
    const preTokens = {};
    const postTokens = {};

    for (const tb of meta.preTokenBalances || []) {
        if (tb.owner === walletAddress && tb.mint !== WRAPPED_SOL) {
            preTokens[tb.mint] = parseFloat(tb.uiTokenAmount?.uiAmountString || '0');
        }
    }
    for (const tb of meta.postTokenBalances || []) {
        if (tb.owner === walletAddress && tb.mint !== WRAPPED_SOL) {
            postTokens[tb.mint] = parseFloat(tb.uiTokenAmount?.uiAmountString || '0');
        }
    }

    const allMints = new Set([...Object.keys(preTokens), ...Object.keys(postTokens)]);
    let bestMint = null;
    let bestDelta = 0;

    for (const mint of allMints) {
        const delta = (postTokens[mint] || 0) - (preTokens[mint] || 0);
        if (Math.abs(delta) > Math.abs(bestDelta)) {
            bestMint = mint;
            bestDelta = delta;
        }
    }

    if (!bestMint || Math.abs(bestDelta) < 0.000001) return null;

    // BUY: SOL decreased + token increased
    if (solDelta < -0.001 && bestDelta > 0) {
        const swapSolAmount = Math.abs(solDelta) - fee;
        if (swapSolAmount <= 0) return null;
        return { side: 'BUY', mint: bestMint, solAmount: swapSolAmount, tokenAmount: bestDelta, signature };
    }

    // SELL: SOL increased + token decreased
    if (solDelta > 0.001 && bestDelta < 0) {
        const swapSolAmount = solDelta + fee;
        if (swapSolAmount <= 0) return null;
        return { side: 'SELL', mint: bestMint, solAmount: swapSolAmount, tokenAmount: Math.abs(bestDelta), signature };
    }

    return null;
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

        // OAuth Code Exchange
        if (path === '/auth/exchange' && request.method === 'POST') {
            const response = await handleAuthExchange(request, env);
            return withCors(response, request);
        }

        // Verify Membership (Whop) — supports both licenseKey and userId
        if (path === '/verify-membership' && request.method === 'POST') {
            const response = await handleVerifyMembership(request, env);
            return withCors(response, request);
        }

        // Wallet Swap Polling (Shadow Mode)
        if (path === '/wallet/poll' && request.method === 'GET') {
            const response = await handleWalletPoll(request, env);
            return withCors(response, request);
        }

        return withCors(json({ ok: false, error: 'Not found' }, 404), request);
    },
};
