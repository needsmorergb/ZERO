const CACHE_MS = 5 * 60 * 1000;
const ZERO_STATE_KEY = 'zero_state';
const UPLOAD_ALARM = 'zero_upload';
const UPLOAD_INTERVAL_MIN = 15;
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

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "sol_usd_refresh") refreshSolUsd();
  if (a.name === UPLOAD_ALARM) handleUploadAlarm();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_SOL_USD") {
      const force = !!msg.force;
      const stale = !cache.price || (Date.now() - cache.ts) > CACHE_MS;
      if (force || stale) await refreshSolUsd();

      sendResponse({
        ok: !!cache.price,
        data: cache.price
          ? { price: cache.price, feedCount: cache.feedCount, ts: cache.ts }
          : null
      });
      return;
    }

    // Content script can trigger an upload attempt
    if (msg?.type === "ZERO_TRIGGER_UPLOAD") {
      const result = await handleUploadAlarm();
      sendResponse({ ok: true, result });
      return;
    }

    // Generic Proxy Fetch (Avoids CORS on Content Scripts)
    if (msg?.type === "PROXY_FETCH") {
      const { url, options } = msg;

      // Security: Safelist allowed domains to prevent abuse
      const ALLOWED_DOMAINS = [
        'api.coingecko.com',
        'api.dexscreener.com',
        'api.coinbase.com',
        'api.kraken.com',
        'api.jup.ag',
        'lite-api.jup.ag'
      ];

      try {
        const hostname = new URL(url).hostname;
        if (!ALLOWED_DOMAINS.includes(hostname)) {
          console.warn(`[Proxy] Blocked domain: ${hostname}`);
          sendResponse({ ok: false, error: 'Domain not allowed' });
          return;
        }

        const r = await fetch(url, options || {});
        if (!r.ok) {
          sendResponse({ ok: false, status: r.status, statusText: r.statusText });
          return;
        }

        const contentType = r.headers.get('content-type');
        const data = contentType && contentType.includes('application/json')
          ? await r.json()
          : await r.text();

        sendResponse({ ok: true, data });
      } catch (e) {
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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Main upload handler — called on alarm and on-demand.
 */
async function handleUploadAlarm() {
  const state = await readZeroState();
  if (!state) return 'no_state';

  // Check opt-in
  if (!state.settings?.privacy?.autoSendDiagnostics) return 'disabled';

  // Check backoff
  if (Date.now() < (state.upload?.backoffUntilTs || 0)) return 'backoff';

  const endpointUrl = state.settings?.diagnostics?.endpointUrl;
  if (!endpointUrl) return 'no_endpoint';

  // Check queue — if empty, build a packet from delta events
  if (!state.upload) state.upload = { queue: [], backoffUntilTs: 0, lastError: null };

  if (state.upload.queue.length === 0) {
    const lastTs = state.settings?.diagnostics?.lastUploadedEventTs || 0;
    const events = (state.events || []).filter((e) => e.ts > lastTs);
    if (events.length === 0) return 'no_data';

    // Build packet
    const packet = {
      uploadId: genUUID(),
      clientId: state.clientId || 'unknown',
      createdAt: Date.now(),
      schemaVersion: state.schemaVersion || 3,
      extensionVersion: chrome.runtime.getManifest?.()?.version || '0.0.0',
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
      type: 'UPLOAD_PACKET_ENQUEUED',
      platform: 'UNKNOWN',
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
  if (!item || !item.payload) return 'empty_queue';

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Zero-Client-Id': state.clientId || '',
      'X-Zero-Version': chrome.runtime.getManifest?.()?.version || '',
    };

    // Add API key if configured (stored in payload or state)
    // For beta, no key is needed unless explicitly set
    // The endpoint URL is the full ingest URL

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);

    const response = await fetch(endpointUrl, {
      method: 'POST',
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
        type: 'UPLOAD_SENT',
        platform: 'UNKNOWN',
        payload: { uploadId: item.uploadId },
      });

      await writeZeroState(state);
      return 'sent';
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    const errMsg = err?.message || 'Unknown error';

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
      type: 'UPLOAD_FAILED',
      platform: 'UNKNOWN',
      payload: { uploadId: item.uploadId, error: errMsg },
    });

    // Trim events ring buffer
    if (state.events.length > 20000) {
      state.events = state.events.slice(-20000);
    }

    await writeZeroState(state);
    return 'failed';
  }
}
