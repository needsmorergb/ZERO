const CACHE_MS = 5 * 60 * 1000;
const ZERO_STATE_KEY = "zero_state";
const EXT_KEY = "sol_paper_trader_v1";
const UPLOAD_ALARM = "zero_upload";
const LICENSE_ALARM = "zero_license_revalidation";
const UPLOAD_INTERVAL_MIN = 15;
const LICENSE_CHECK_INTERVAL_MIN = 360; // 6 hours
const LICENSE_REVALIDATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const VERIFY_ENDPOINT = "https://api.get-zero.xyz/verify-membership";
const AUTH_EXCHANGE_ENDPOINT = "https://api.get-zero.xyz/auth/exchange";
const WHOP_CLIENT_ID = "app_AOtaaGKLyuCGt1";
const WHOP_OAUTH_AUTHORIZE = "https://api.whop.com/oauth/authorize";
const BACKOFF_STEPS = [60000, 300000, 900000, 3600000]; // 1m, 5m, 15m, 60m

let cache = { price: null, feedCount: 0, ts: 0 };

/**
 * Fetches JSON from a URL with a 4.5s timeout
 * @param {string} url - The URL to fetch from
 * @returns {Promise<object|null>} Parsed JSON or null on error
 */
async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetches SOL/USD price from Coinbase API
 * @returns {Promise<number|null>} Price in USD or null on error
 */
async function getCoinbaseSolUsd() {
  const j = await fetchJson("https://api.coinbase.com/v2/prices/SOL-USD/spot");
  const v = Number(j?.data?.amount);
  return Number.isFinite(v) ? v : null;
}

/**
 * Fetches SOL/USD price from Kraken API
 * @returns {Promise<number|null>} Price in USD or null on error
 */
async function getKrakenSolUsd() {
  const j = await fetchJson("https://api.kraken.com/0/public/Ticker?pair=SOLUSD");
  const key = j?.result ? Object.keys(j.result)[0] : null;
  const v = Number(key ? j.result[key]?.c?.[0] : NaN);
  return Number.isFinite(v) ? v : null;
}

/**
 * Calculates the median of an array of numbers
 * @param {number[]} values - Array of numeric values
 * @returns {number|null} Median value or null if array is empty
 */
function median(values) {
  const a = values.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/**
 * Parses a raw Solana transaction to detect SOL<->token swaps.
 * Uses pre/post balance changes — works with any DEX (Jupiter, Raydium, etc.)
 * @param {object} tx - Raw getTransaction response
 * @param {string} walletAddress - The wallet to track
 * @param {string} signature - Transaction signature
 * @returns {object|null} Swap data or null if not a swap
 */
function parseSwapFromTx(tx, walletAddress, signature) {
  const meta = tx.meta;
  if (!meta || meta.err) return null;

  const accountKeys = tx.transaction?.message?.accountKeys || [];

  // Find wallet's index in the account list
  let walletIndex = -1;
  for (let i = 0; i < accountKeys.length; i++) {
    const key = typeof accountKeys[i] === "string" ? accountKeys[i] : accountKeys[i]?.pubkey;
    if (key === walletAddress) {
      walletIndex = i;
      break;
    }
  }
  if (walletIndex === -1) return null;

  // SOL balance change (lamports → SOL)
  const preLamports = meta.preBalances?.[walletIndex] || 0;
  const postLamports = meta.postBalances?.[walletIndex] || 0;
  const fee = (meta.fee || 0) / 1e9;
  const solDelta = (postLamports - preLamports) / 1e9; // negative = spent, positive = received

  // Token balance changes for this wallet (exclude wrapped SOL)
  const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
  const preTokens = {};
  const postTokens = {};

  for (const tb of meta.preTokenBalances || []) {
    if (tb.owner === walletAddress && tb.mint !== WRAPPED_SOL) {
      preTokens[tb.mint] = parseFloat(tb.uiTokenAmount?.uiAmountString || "0");
    }
  }
  for (const tb of meta.postTokenBalances || []) {
    if (tb.owner === walletAddress && tb.mint !== WRAPPED_SOL) {
      postTokens[tb.mint] = parseFloat(tb.uiTokenAmount?.uiAmountString || "0");
    }
  }

  // Find the token with the largest balance change
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

  // BUY: SOL decreased (spent) + token increased (received)
  if (solDelta < -0.001 && bestDelta > 0) {
    const swapSolAmount = Math.abs(solDelta) - fee; // Remove fee
    if (swapSolAmount <= 0) return null;
    return {
      type: "SHADOW_TRADE_DETECTED",
      __paper: true,
      side: "BUY",
      mint: bestMint,
      solAmount: swapSolAmount,
      tokenAmount: bestDelta,
      priceUsd: 0,
      signature,
      source: "helius",
      ts: Date.now(),
    };
  }

  // SELL: SOL increased (received) + token decreased (spent)
  if (solDelta > 0.001 && bestDelta < 0) {
    const swapSolAmount = solDelta + fee; // Add fee back (fee was deducted from proceeds)
    if (swapSolAmount <= 0) return null;
    return {
      type: "SHADOW_TRADE_DETECTED",
      __paper: true,
      side: "SELL",
      mint: bestMint,
      solAmount: swapSolAmount,
      tokenAmount: Math.abs(bestDelta),
      priceUsd: 0,
      signature,
      source: "helius",
      ts: Date.now(),
    };
  }

  return null; // Not a SOL<->token swap
}

/**
 * Refreshes SOL/USD price by fetching from multiple sources and calculating median
 * @returns {Promise<object|null>} Cache object with price, feedCount, and timestamp
 */
async function refreshSolUsd() {
  const [cb, kr] = await Promise.all([getCoinbaseSolUsd(), getKrakenSolUsd()]);
  const feeds = [cb, kr].filter((x) => Number.isFinite(x));
  const m = median(feeds);
  if (!m) return null;

  cache = { price: m, feedCount: feeds.length, ts: Date.now() };
  return cache;
}

chrome.alarms.create("sol_usd_refresh", { periodInMinutes: 5 });
chrome.alarms.create(UPLOAD_ALARM, { periodInMinutes: UPLOAD_INTERVAL_MIN });
chrome.alarms.create(LICENSE_ALARM, { periodInMinutes: LICENSE_CHECK_INTERVAL_MIN });

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "sol_usd_refresh") refreshSolUsd();
  if (a.name === UPLOAD_ALARM) handleUploadAlarm();
  if (a.name === LICENSE_ALARM) handleLicenseRevalidation();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_SOL_USD") {
      const force = !!msg.force;
      const stale = !cache.price || Date.now() - cache.ts > CACHE_MS;
      if (force || stale) await refreshSolUsd();

      sendResponse({
        ok: !!cache.price,
        data: cache.price ? { price: cache.price, feedCount: cache.feedCount, ts: cache.ts } : null,
      });
      return;
    }

    // Content script can trigger an upload attempt
    if (msg?.type === "ZERO_TRIGGER_UPLOAD") {
      const result = await handleUploadAlarm();
      sendResponse({ ok: true, result });
      return;
    }

    // License verification via Context API Worker (supports licenseKey or userId)
    if (msg?.type === "VERIFY_LICENSE") {
      const { licenseKey, userId } = msg;
      if (!licenseKey && !userId) {
        sendResponse({ ok: false, error: "no_key" });
        return;
      }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const body = userId ? { userId } : { licenseKey };
        const r = await fetch(VERIFY_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const data = await r.json();
        sendResponse(data);
      } catch (e) {
        sendResponse({ ok: false, error: e.toString() });
      }
      return;
    }

    // Whop OAuth login — opens OAuth popup, exchanges code, checks membership
    if (msg?.type === "WHOP_OAUTH_LOGIN") {
      try {
        // Generate PKCE code_verifier (32 random bytes -> base64url)
        const verifierBytes = new Uint8Array(32);
        crypto.getRandomValues(verifierBytes);
        const codeVerifier = btoa(String.fromCharCode(...verifierBytes))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        // Compute code_challenge = base64url(SHA-256(code_verifier))
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        // Generate state and nonce for CSRF protection
        const stateBytes = new Uint8Array(16);
        crypto.getRandomValues(stateBytes);
        const state = Array.from(stateBytes).map(b => b.toString(16).padStart(2, "0")).join("");
        const nonceBytes = new Uint8Array(16);
        crypto.getRandomValues(nonceBytes);
        const nonce = Array.from(nonceBytes).map(b => b.toString(16).padStart(2, "0")).join("");

        const redirectUri = chrome.identity.getRedirectURL();

        const params = new URLSearchParams({
          response_type: "code",
          client_id: WHOP_CLIENT_ID,
          redirect_uri: redirectUri,
          scope: "openid",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          nonce,
        });

        const authUrl = `${WHOP_OAUTH_AUTHORIZE}?${params.toString()}`;

        // Open Chrome OAuth popup
        const responseUrl = await new Promise((resolve, reject) => {
          chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            (redirectUrl) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(redirectUrl);
            }
          );
        });

        // Extract authorization code from redirect URL
        const redirectParams = new URL(responseUrl).searchParams;
        const code = redirectParams.get("code");
        const returnedState = redirectParams.get("state");

        if (!code) {
          sendResponse({ ok: false, error: "no_auth_code" });
          return;
        }
        if (returnedState !== state) {
          sendResponse({ ok: false, error: "state_mismatch" });
          return;
        }

        // Exchange code via our worker
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(AUTH_EXCHANGE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, codeVerifier, redirectUri: redirectUri }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const data = await r.json();
        sendResponse(data);
      } catch (e) {
        const errorMsg = e?.message || e?.toString() || "unknown_error";
        // User closed the popup
        if (errorMsg.includes("canceled") || errorMsg.includes("cancelled") || errorMsg.includes("closed")) {
          sendResponse({ ok: false, error: "user_cancelled" });
        } else {
          sendResponse({ ok: false, error: errorMsg });
        }
      }
      return;
    }

    // Generic Proxy Fetch (Avoids CORS on Content Scripts)
    if (msg?.type === "PROXY_FETCH") {
      const { url, options } = msg;

      // Security: Safelist allowed domains to prevent abuse
      const ALLOWED_DOMAINS = [
        "api.coingecko.com",
        "api.dexscreener.com",
        "api.coinbase.com",
        "api.kraken.com",
        "api.jup.ag",
        "lite-api.jup.ag",
        "mainnet.helius-rpc.com",
        "api.helius.xyz",
        "api.get-zero.xyz",
      ];

      try {
        const hostname = new URL(url).hostname;
        if (!ALLOWED_DOMAINS.includes(hostname)) {
          console.warn(`[Proxy] Blocked domain: ${hostname}`);
          sendResponse({ ok: false, error: "Domain not allowed" });
          return;
        }

        const r = await fetch(url, options || {});
        if (!r.ok) {
          sendResponse({ ok: false, status: r.status, statusText: r.statusText });
          return;
        }

        const contentType = r.headers.get("content-type");
        const data =
          contentType && contentType.includes("application/json") ? await r.json() : await r.text();

        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e.toString() });
      }
      return;
    }

    // Event-driven swap resolution — single getTransaction call per detected trade.
    // Triggered by SHADOW_SWAP_SIGNATURE from bridge wallet hooks.
    if (msg?.type === "RESOLVE_SWAP_TX") {
      const { signature, walletAddress } = msg;
      if (!signature || !walletAddress) {
        sendResponse({ ok: false, error: "Missing signature or walletAddress" });
        return;
      }

      console.log(
        `[BG] RESOLVE_SWAP_TX: sig=${signature.slice(0, 16)}, wallet=${walletAddress.slice(0, 8)}`,
      );

      try {
        const rpcUrl = "https://mainnet.helius-rpc.com/?api-key=public";
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);

        try {
          const resp = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getTransaction",
              params: [signature, { maxSupportedTransactionVersion: 0 }],
            }),
            signal: ctrl.signal,
          });
          clearTimeout(t);
          const data = await resp.json();

          if (data?.error) {
            console.warn("[BG] RESOLVE_SWAP_TX RPC error:", data.error);
            sendResponse({ ok: true, swap: null }); // tx may not be indexed yet
            return;
          }

          if (!data?.result) {
            sendResponse({ ok: true, swap: null }); // tx not indexed yet
            return;
          }

          const swap = parseSwapFromTx(data.result, walletAddress, signature);
          if (swap) {
            swap.blockTime = data.result.blockTime || 0;
            console.log(
              `[BG] RESOLVE_SWAP_TX: ${swap.side} ${swap.solAmount.toFixed(4)} SOL → ${swap.mint?.slice(0, 8)}`,
            );
          } else {
            console.log("[BG] RESOLVE_SWAP_TX: tx parsed but not a SOL<->token swap");
          }
          sendResponse({ ok: true, swap });
        } catch (fetchErr) {
          clearTimeout(t);
          if (fetchErr.name === "AbortError") {
            console.warn("[BG] RESOLVE_SWAP_TX: RPC timeout (10s)");
            sendResponse({ ok: true, swap: null });
          } else {
            throw fetchErr;
          }
        }
      } catch (e) {
        console.error("[BG] RESOLVE_SWAP_TX failed:", e);
        sendResponse({ ok: false, error: e.toString() });
      }
      return;
    }

    // Wallet Balance (Shadow Mode auto-detect)
    if (msg?.type === "GET_WALLET_BALANCE") {
      try {
        // Prefer address from message, then fallback to stored state
        let walletAddress = msg.walletAddress;
        if (!walletAddress) {
          const storeData = await chrome.storage.local.get("sol_paper_trader_v1");
          const state = storeData?.sol_paper_trader_v1;
          walletAddress = state?.shadow?.walletAddress;
        }

        if (!walletAddress) {
          sendResponse({ ok: false, error: "No wallet address" });
          return;
        }

        // Helius RPC getBalance
        const rpcUrl = "https://mainnet.helius-rpc.com/?api-key=public";
        const r = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [walletAddress],
          }),
        });

        const data = await r.json();
        const lamports = data?.result?.value || 0;
        const balance = lamports / 1e9; // lamports to SOL

        sendResponse({ ok: true, balance });
      } catch (e) {
        console.error("[BG] GET_WALLET_BALANCE failed:", e);
        sendResponse({ ok: false, error: e.toString() });
      }
      return;
    }

    sendResponse({ ok: false });
  })();
  return true;
});

// ---------------------------------------------------------------------------
// Diagnostics Upload System
// ---------------------------------------------------------------------------

/**
 * Read zero_state from chrome.storage.local.
 * @returns {Promise<object|null>}
 */
async function readZeroState() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([ZERO_STATE_KEY], (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(res[ZERO_STATE_KEY] || null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Write zero_state back to chrome.storage.local.
 * @param {object} state
 */
async function writeZeroState(state) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [ZERO_STATE_KEY]: state }, () => resolve());
    } catch {
      resolve();
    }
  });
}

/**
 * Generate a UUID v4.
 */
function genUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Background license revalidation — called by chrome.alarm every 6 hours.
 * Reads whopUserId or license key from storage and re-verifies if stale (>24h).
 */
async function handleLicenseRevalidation() {
  try {
    const data = await new Promise((resolve) => {
      chrome.storage.local.get([EXT_KEY], (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(res[EXT_KEY] || null);
      });
    });

    const license = data?.settings?.license;
    if (!license) return;

    // Need either whopUserId or legacy key
    const hasUserId = license.whopUserId && typeof license.whopUserId === "string";
    const hasKey = license.key && typeof license.key === "string";
    if (!hasUserId && !hasKey) return;

    const elapsed = license.lastVerified ? Date.now() - license.lastVerified : Infinity;
    if (elapsed < LICENSE_REVALIDATION_MS) return; // Still fresh

    console.log("[Background] License revalidation triggered");

    const body = hasUserId ? { userId: license.whopUserId } : { licenseKey: license.key };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (!r.ok) {
      console.warn("[Background] License revalidation HTTP error:", r.status);
      return; // Keep cached validity (grace period handles expiry)
    }

    const result = await r.json();
    if (result.ok && result.membership) {
      const m = result.membership;
      data.settings.license.valid = m.valid;
      data.settings.license.status = m.status || (m.valid ? "active" : "expired");
      data.settings.license.plan = m.plan || license.plan;
      data.settings.license.expiresAt = m.expiresAt || license.expiresAt;
      data.settings.license.lastVerified = Date.now();
      data.settings.tier = m.valid ? "elite" : "free";
    } else {
      // Verification returned invalid — but respect grace period
      const GRACE_MS = 72 * 60 * 60 * 1000;
      if (license.lastVerified && Date.now() - license.lastVerified > GRACE_MS) {
        data.settings.license.valid = false;
        data.settings.license.status = "expired";
        data.settings.tier = "free";
      }
    }

    await new Promise((resolve) => {
      chrome.storage.local.set({ [EXT_KEY]: data }, () => resolve());
    });
  } catch (e) {
    console.warn("[Background] License revalidation error:", e?.message || e);
  }
}

/**
 * Main upload handler — called on alarm and on-demand.
 */
async function handleUploadAlarm() {
  // Exclusive lock check (Internal session flag)
  if (self._isUploading) return "locked";
  self._isUploading = true;

  try {
    const state = await readZeroState();
    if (!state) return "no_state";

    // Check opt-in
    if (!state.settings?.privacy?.autoSendDiagnostics) return "disabled";

    // Check backoff
    if (Date.now() < (state.upload?.backoffUntilTs || 0)) return "backoff";

    const endpointUrl = state.settings?.diagnostics?.endpointUrl;
    if (!endpointUrl) return "no_endpoint";

    // Check queue — if empty, build a packet from delta events
    if (!state.upload) state.upload = { queue: [], backoffUntilTs: 0, lastError: null };

    if (state.upload.queue.length === 0) {
      const lastTs = state.settings?.diagnostics?.lastUploadedEventTs || 0;
      const events = (state.events || []).filter((e) => e.ts > lastTs);
      if (events.length === 0) return "no_data";

      // Build packet
      const packet = {
        uploadId: genUUID(),
        clientId: state.clientId || "unknown",
        createdAt: Date.now(),
        schemaVersion: state.schemaVersion || 3,
        extensionVersion: chrome.runtime.getManifest?.()?.version || "0.0.0",
        eventsDelta: events.slice(-2000), // cap at 2000 events per packet
      };

      state.upload.queue.push({
        uploadId: packet.uploadId,
        createdAt: packet.createdAt,
        eventCount: packet.eventsDelta.length,
        payload: packet,
      });

      // Log enqueue event
      state.events.push({
        eventId: genUUID(),
        ts: Date.now(),
        type: "UPLOAD_PACKET_ENQUEUED",
        platform: "UNKNOWN",
        payload: { uploadId: packet.uploadId },
      });

      // Trim events ring buffer
      if (state.events.length > 20000) {
        state.events = state.events.slice(-20000);
      }

      await writeZeroState(state);
    }

    // Attempt to send first packet
    const item = state.upload.queue[0];
    if (!item || !item.payload) return "empty_queue";

    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Zero-Client-Id": state.clientId || "",
        "X-Zero-Version": chrome.runtime.getManifest?.()?.version || "",
      };

      // Add API key if configured (stored in payload or state)
      // For beta, no key is needed unless explicitly set
      // The endpoint URL is the full ingest URL

      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 15000);

      const response = await fetch(endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(item.payload),
        signal: ctrl.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        // Success — dequeue
        state.upload.queue.shift();

        // Update last uploaded event timestamp
        const maxTs = Math.max(...(item.payload.eventsDelta || []).map((e) => e.ts || 0));
        if (maxTs > 0) {
          if (!state.settings.diagnostics) state.settings.diagnostics = {};
          state.settings.diagnostics.lastUploadedEventTs = maxTs;
        }

        // Clear backoff
        state.upload.backoffUntilTs = 0;
        state.upload.lastError = null;

        // Log success
        state.events.push({
          eventId: genUUID(),
          ts: Date.now(),
          type: "UPLOAD_SENT",
          platform: "UNKNOWN",
          payload: { uploadId: item.uploadId },
        });

        await writeZeroState(state);
        return "sent";
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      const errMsg = err?.message || "Unknown error";

      // Calculate backoff step
      const failCount = (state.upload._failCount || 0) + 1;
      state.upload._failCount = failCount;
      const stepIdx = Math.min(failCount - 1, BACKOFF_STEPS.length - 1);
      const backoffMs = BACKOFF_STEPS[stepIdx];
      state.upload.backoffUntilTs = Date.now() + backoffMs;
      state.upload.lastError = errMsg;

      // Log failure
      state.events.push({
        eventId: genUUID(),
        ts: Date.now(),
        type: "UPLOAD_FAILED",
        platform: "UNKNOWN",
        payload: { uploadId: item.uploadId, error: errMsg },
      });

      // Trim events ring buffer
      if (state.events.length > 20000) {
        state.events = state.events.slice(-20000);
      }

      await writeZeroState(state);
      return "failed";
    }
  } catch (err) {
    console.error("[Background] handleUploadAlarm outer error:", err);
    return "error";
  } finally {
    self._isUploading = false;
  }
}
