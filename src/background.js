const CACHE_MS = 5 * 60 * 1000;

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
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "sol_usd_refresh") refreshSolUsd();
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
    sendResponse({ ok: false });
  })();
  return true;
});
