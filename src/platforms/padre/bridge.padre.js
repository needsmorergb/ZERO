/**
 * Padre Bridge (MAIN World)
 * Runs in page context on trade.padre.gg only.
 * SES-safe interception (no XHR/WebSocket hooks), MutationObserver,
 * Chart MCap → Price inference pipeline.
 */
import {
  CHANNEL,
  MAX_SCAN_CHARS,
  safe,
  send,
  createContext,
  throttleEmit,
  looksRelatedByString,
  extractPriceUsd,
  tryHandleJson,
  findTV,
  setupMessageListener,
  tryHandleSwap,
  SWAP_URL_PATTERNS,
  setupWalletAddressCapture,
  setupSwapDetection,
  cacheSwapQuote,
  parseRequestBody,
  tryDetectRpcSignature,
} from "../shared/bridge-utils.js";

(() => {
  console.log("[ZERØ] Padre Bridge Active (document_start, MAIN world).");

  const ctx = createContext();

  // --- Padre Header Bar Price/Stats Scraping ---
  // Padre displays stats as label-value pairs in the header bar:
  //   MC: $1.28M | Price: $0.00128 | Liquidity: $117K | ... | T.PNL: -$0.007
  // Uses label-adjacent element discovery (Tailwind-proof — no CSS class dependency).

  const HEADER_LABELS = {
    price: /^Price$/i,
    mc: /^(?:MC|MCap|Market\s*Cap)$/i,
    liquidity: /^(?:Liq|Liquidity)$/i,
    tpnl: /^T\.?\s*PNL$/i,
    invested: /^(?:Invested|Total\s*Invested|Inv|Buy\s*Value|Cost)$/i,
    sold: /^(?:Sold|Total\s*Sold|Sell\s*Value)$/i,
    remaining: /^(?:Remaining|Holdings?|Balance)$/i,
  };

  const parseHeaderValue = (text) => {
    // Handle: "$1.28M", "$0.00128", "-$0.007", "$117K", "$0.10"
    const neg = text.includes("-") ? -1 : 1;
    const clean = text.replace(/[^0-9.MKBmkb]/g, "");
    if (!clean) return null;
    const m = clean.match(/([0-9.]+)\s*([MKBmkb])?$/);
    if (!m) return null;
    let val = parseFloat(m[1]);
    if (isNaN(val)) return null;
    const suffix = (m[2] || "").toUpperCase();
    if (suffix === "K") val *= 1_000;
    else if (suffix === "M") val *= 1_000_000;
    else if (suffix === "B") val *= 1_000_000_000;
    return val * neg;
  };

  // --- Cached position field elements ---
  // After TradingView chart renders, the DOM has >2000 elements and invested/sold
  // labels (in the position panel) get pushed past the fast scan limit.
  // We cache their value element references for instant re-read on every poll.
  const _posCache = {
    investedValEl: null,
    soldValEl: null,
    remainingValEl: null,
    tpnlValEl: null,
    lastDeepScan: 0,
    DEEP_SCAN_INTERVAL: 3000, // Re-discover elements every 3s
  };

  // PerformanceObserver triggers aggressive re-scanning after swap URLs are detected
  let _aggressiveScrapeUntil = 0;

  const POS_FIELD_KEYS = [
    ["invested", "investedValEl"],
    ["sold", "soldValEl"],
    ["remaining", "remainingValEl"],
    ["tpnl", "tpnlValEl"],
  ];

  // Deep scan: find position field VALUE elements in up to 8000 DOM nodes
  function deepScanPositionFields() {
    const allEls = document.querySelectorAll("span, div, p, td, th, dt, dd, label");
    const limit = Math.min(allEls.length, 8000);
    const posLabels = {
      invested: HEADER_LABELS.invested,
      sold: HEADER_LABELS.sold,
      remaining: HEADER_LABELS.remaining,
      tpnl: HEADER_LABELS.tpnl,
    };

    for (let i = 0; i < limit; i++) {
      const el = allEls[i];
      if (el.children.length > 3) continue;
      const text = el.textContent?.trim();
      if (!text || text.length > 20) continue;

      for (const [key, pattern] of Object.entries(posLabels)) {
        if (!pattern.test(text)) continue;
        // Prefer FIRST match — skip if we already cached a connected element for this key
        const cacheKey = key + "ValEl";
        if (_posCache[cacheKey] && _posCache[cacheKey].isConnected) continue;
        const valueEl =
          el.nextElementSibling ||
          el.parentElement?.nextElementSibling?.querySelector("span, div, p") ||
          el.parentElement?.nextElementSibling ||
          (i + 1 < limit ? allEls[i + 1] : null);
        if (!valueEl) continue;
        _posCache[cacheKey] = valueEl;
      }
    }
  }

  // Read a cached position field value element
  function readCachedPosField(cacheKey) {
    const el = _posCache[cacheKey];
    if (!el || !el.isConnected) return undefined;
    const val = parseHeaderValue(el.textContent?.trim() || "");
    return val !== null ? val : undefined;
  }

  const scrapePadreHeader = () => {
    try {
      const results = {};
      const allEls = document.querySelectorAll("span, div, p, td, th, dt, dd, label");
      const limit = Math.min(allEls.length, 2000);

      // Fast scan (limit 2000): reliably finds price, MC, liquidity in header bar
      for (let i = 0; i < limit; i++) {
        const el = allEls[i];
        if (el.children.length > 3) continue;
        const text = el.textContent?.trim();
        if (!text || text.length > 20) continue;

        for (const [key, pattern] of Object.entries(HEADER_LABELS)) {
          if (results[key] !== undefined) continue;
          if (!pattern.test(text)) continue;

          // Found a label — find the adjacent value element
          const valueEl =
            el.nextElementSibling ||
            el.parentElement?.nextElementSibling?.querySelector("span, div, p") ||
            el.parentElement?.nextElementSibling ||
            (i + 1 < limit ? allEls[i + 1] : null);

          if (!valueEl) continue;
          const valText = valueEl.textContent?.trim();
          if (!valText) continue;

          const parsed = parseHeaderValue(valText);
          if (parsed !== null) {
            results[key] = parsed;
            // Cache position field value elements when found in fast scan too
            const cacheKey = key + "ValEl";
            if (cacheKey in _posCache) _posCache[cacheKey] = valueEl;
          }
        }
      }

      // Position fields: try cached elements for any fields not found in fast scan
      for (const [key, cacheKey] of POS_FIELD_KEYS) {
        if (results[key] !== undefined) continue;
        const val = readCachedPosField(cacheKey);
        if (val !== undefined) results[key] = val;
      }

      // Periodic deep scan: re-discover position field elements when missing
      const now = Date.now();
      const isAggressive = now < _aggressiveScrapeUntil;
      const shouldDeepScan = (now - _posCache.lastDeepScan > _posCache.DEEP_SCAN_INTERVAL) || isAggressive;
      if (shouldDeepScan && (results.invested === undefined || results.sold === undefined)) {
        _posCache.lastDeepScan = now;
        deepScanPositionFields();
        // Re-try cached reads after deep scan
        for (const [key, cacheKey] of POS_FIELD_KEYS) {
          if (results[key] !== undefined) continue;
          const val = readCachedPosField(cacheKey);
          if (val !== undefined) results[key] = val;
        }
      }

      return Object.keys(results).length > 0 ? results : null;
    } catch (e) { /* swallowed */ }
    return null;
  };

  // --- Header Delta Trade Detection (Shadow Mode) ---
  // Padre shows cumulative "Invested" and "Sold" USD in the header — but ONLY
  // when the user already has a position for that token. For a fresh token these
  // fields are absent from the DOM until the first buy completes.
  //
  // State semantics:
  //   null  = field has NEVER been seen in the header for this mint
  //   0     = field was seen with value $0 (or appeared with zero)
  //   >0    = last known cumulative value
  //
  // Detection:
  //   null → value > MIN_DELTA  →  "first appearance" trade (full value is the trade amount)
  //   prev → value > prev       →  "delta" trade (increase is the trade amount)
  const _td = {
    lastInvested: null,   // null = never seen
    lastSold: null,       // null = never seen
    lastMint: null,
    settledAt: 0,         // timestamp when mint change is "settled" (DOM stabilized)
    MIN_DELTA: 0.005,     // $0.005 minimum to filter noise
    SETTLE_MS: 1500,      // wait 1.5s after mint change before detecting
  };

  // Invalidate cached position elements — forces deep scan to re-discover them
  // Called after trade detection because Padre's React may re-render the position panel
  function invalidatePosCache() {
    _posCache.investedValEl = null;
    _posCache.soldValEl = null;
    _posCache.remainingValEl = null;
    _posCache.tpnlValEl = null;
    _posCache.lastDeepScan = 0; // Force immediate deep scan on next poll
  }

  function detectHeaderTrade(h) {
    const mint = ctx.mint;
    if (!mint) return;

    // Reset tracking on mint change
    if (mint !== _td.lastMint) {
      _td.lastMint = mint;
      _td.settledAt = Date.now() + _td.SETTLE_MS;
      // If invested/sold already present (returning to a token with position), initialize to current values.
      // If absent (undefined), set to null to indicate "never seen for this mint".
      _td.lastInvested = h.invested !== undefined ? h.invested : null;
      _td.lastSold = h.sold !== undefined ? h.sold : null;
      console.log(
        `[ZERØ] Header trade tracking reset — mint=${mint.slice(0, 8)}, invested=${_td.lastInvested}, sold=${_td.lastSold}, fields: ${JSON.stringify(Object.keys(h))}`
      );
      return;
    }

    // Don't detect during settling period (prevents stale header data from previous token)
    if (Date.now() < _td.settledAt) return;

    // Keep invested/sold as undefined (not coerced to 0) to distinguish "absent" from "zero"
    const invested = h.invested;
    const sold = h.sold;

    // --- BUY Detection ---
    if (invested !== undefined && invested > 0) {
      if (_td.lastInvested === null) {
        // FIRST APPEARANCE: invested was never seen → it just appeared after a buy
        if (invested > _td.MIN_DELTA) {
          console.log(`[ZERØ] Header BUY (first): +$${invested.toFixed(4)} for ${ctx.symbol || mint.slice(0, 8)}`);
          _td.lastInvested = invested;
          invalidatePosCache(); // DOM may re-render after trade
          send({
            type: "SHADOW_TRADE_DETECTED",
            side: "BUY",
            mint,
            symbol: ctx.symbol || null,
            solAmount: 0,
            usdAmount: invested,
            tokenAmount: 0,
            priceUsd: h.price || 0,
            signature: `hdr-B-${mint.slice(0, 8)}-${Date.now()}`,
            source: "padre-header",
            ts: Date.now(),
          });
        }
      } else if (invested > _td.lastInvested) {
        // DELTA: invested increased (subsequent buy)
        const delta = invested - _td.lastInvested;
        _td.lastInvested = invested;
        invalidatePosCache(); // DOM may re-render after trade
        if (delta > _td.MIN_DELTA) {
          console.log(`[ZERØ] Header BUY (delta): +$${delta.toFixed(4)} for ${ctx.symbol || mint.slice(0, 8)}`);
          send({
            type: "SHADOW_TRADE_DETECTED",
            side: "BUY",
            mint,
            symbol: ctx.symbol || null,
            solAmount: 0,
            usdAmount: delta,
            tokenAmount: 0,
            priceUsd: h.price || 0,
            signature: `hdr-B-${mint.slice(0, 8)}-${Date.now()}`,
            source: "padre-header",
            ts: Date.now(),
          });
        }
      }
    }

    // --- SELL Detection ---
    if (sold !== undefined && sold > 0) {
      if (_td.lastSold === null) {
        // FIRST APPEARANCE: sold was never seen → it just appeared after a sell
        if (sold > _td.MIN_DELTA) {
          console.log(`[ZERØ] Header SELL (first): +$${sold.toFixed(4)} for ${ctx.symbol || mint.slice(0, 8)}`);
          _td.lastSold = sold;
          invalidatePosCache(); // DOM may re-render after trade
          send({
            type: "SHADOW_TRADE_DETECTED",
            side: "SELL",
            mint,
            symbol: ctx.symbol || null,
            solAmount: 0,
            usdAmount: sold,
            tokenAmount: 0,
            priceUsd: h.price || 0,
            signature: `hdr-S-${mint.slice(0, 8)}-${Date.now()}`,
            source: "padre-header",
            ts: Date.now(),
          });
        }
      } else if (sold > _td.lastSold) {
        // DELTA: sold increased (subsequent sell)
        const delta = sold - _td.lastSold;
        _td.lastSold = sold;
        invalidatePosCache(); // DOM may re-render after trade
        if (delta > _td.MIN_DELTA) {
          console.log(`[ZERØ] Header SELL (delta): +$${delta.toFixed(4)} for ${ctx.symbol || mint.slice(0, 8)}`);
          send({
            type: "SHADOW_TRADE_DETECTED",
            side: "SELL",
            mint,
            symbol: ctx.symbol || null,
            solAmount: 0,
            usdAmount: delta,
            tokenAmount: 0,
            priceUsd: h.price || 0,
            signature: `hdr-S-${mint.slice(0, 8)}-${Date.now()}`,
            source: "padre-header",
            ts: Date.now(),
          });
        }
      }
    }
  }

  let lastHeaderPrice = 0;
  let lastHeaderMCap = 0;
  let _headerLogMint = null;   // Log header on each mint change
  let _headerDiagTimer = 0;    // Periodic diagnostic (every 10s)
  const pollPadreHeader = () => {
    const h = scrapePadreHeader();
    if (!h) return;

    // Log full header on mint change (shows which fields are available)
    if (ctx.mint && ctx.mint !== _headerLogMint) {
      _headerLogMint = ctx.mint;
      console.log(`[ZERØ] Header scrape [${ctx.mint.slice(0, 8)}]:`, JSON.stringify(h));
    }

    // Periodic diagnostic: log every 10s unconditionally to track field appearance/disappearance
    const now = Date.now();
    if (now > _headerDiagTimer) {
      _headerDiagTimer = now + 10000;
      console.log(
        `[ZERØ] Header fields [${(ctx.mint || "?").slice(0, 8)}]: invested=${h.invested}, sold=${h.sold}, tpnl=${h.tpnl}, remaining=${h.remaining}, keys=${JSON.stringify(Object.keys(h))}`
      );
    }

    // Price — highest confidence, this IS what the user sees on Padre
    if (h.price && h.price > 0 && h.price !== lastHeaderPrice) {
      lastHeaderPrice = h.price;
      send({
        type: "PRICE_TICK",
        source: "padre-header",
        price: h.price,
        chartMCap: h.mc || 0,
        confidence: 4,
        ts: Date.now(),
      });
    }

    // MC only (if price didn't fire but MC changed)
    if (h.mc && h.mc > 0 && h.mc !== lastHeaderMCap) {
      lastHeaderMCap = h.mc;
      if (!h.price && lastHeaderPrice > 0) {
        send({
          type: "PRICE_TICK",
          source: "padre-header-mc",
          price: lastHeaderPrice,
          chartMCap: h.mc,
          confidence: 3,
          ts: Date.now(),
        });
      }
    }

    // T.PNL — optional, for future cross-reference
    if (h.tpnl !== undefined) {
      send({ type: "PADRE_PNL_TICK", tpnl: h.tpnl, ts: Date.now() });
    }

    // Shadow Mode: detect trades from invested/sold deltas
    detectHeaderTrade(h);
  };

  setInterval(pollPadreHeader, 200);

  // --- Chart MCap Scraping (Padre: Y-axis = Market Cap, not token price) ---
  const parseOhlcClose = (text) => {
    if (!text) return null;
    if (!/[OHL]\s*[↓↑]?\s*\$?\s*[0-9]/.test(text)) return null;
    const m = text.match(/C\s*[↓↑]?\s*\$?\s*([0-9,.]+)\s*([KMBkmb])?/);
    if (!m) return null;
    let val = parseFloat(m[1].replace(/,/g, ""));
    if (!val || val <= 0) return null;
    const suffix = (m[2] || "").toUpperCase();
    if (suffix === "K") val *= 1_000;
    else if (suffix === "M") val *= 1_000_000;
    else if (suffix === "B") val *= 1_000_000_000;
    if (val < 100 || val > 100_000_000_000) return null;
    return val;
  };

  const scrapePadreMCap = () => {
    try {
      const docs = [document];
      try {
        for (let i = 0; i < window.frames.length; i++) {
          try {
            docs.push(window.frames[i].document);
          } catch (e) { /* swallowed – cross-origin frame */ }
        }
      } catch (e) { /* swallowed – frames access denied */ }

      for (const doc of docs) {
        try {
          // 1. Targeted: TradingView legend/header elements
          const legendEls = doc.querySelectorAll(
            '[class*="valuesWrapper"], [class*="legend"], [class*="headerRow"], ' +
              '[class*="values-"], [class*="mainSeries"], [class*="sourcesWrapper"]'
          );
          for (const el of legendEls) {
            const val = parseOhlcClose(el.textContent);
            if (val) return val;
          }

          // 2. Y-axis current price label
          const yAxisEls = doc.querySelectorAll(
            '[class*="lastPrice"], [class*="lastValue"], [class*="markLine"], ' +
              '[class*="price-axis-last"], [class*="currentPrice"], [class*="pane-legend-line"]'
          );
          for (const el of yAxisEls) {
            const text = (el.textContent || "").trim();
            const m = text.match(/^\$?\s*([0-9,.]+)\s*([KMBkmb])?$/);
            if (m) {
              let val = parseFloat(m[1].replace(/,/g, ""));
              const suffix = (m[2] || "").toUpperCase();
              if (suffix === "K") val *= 1_000;
              else if (suffix === "M") val *= 1_000_000;
              else if (suffix === "B") val *= 1_000_000_000;
              if (val > 100 && val < 100_000_000_000) return val;
            }
          }

          // 3. Broader: scan elements for OHLC pattern
          const allEls = doc.querySelectorAll("div, span");
          const limit = Math.min(allEls.length, 400);
          for (let i = 0; i < limit; i++) {
            const el = allEls[i];
            if (el.children.length > 10) continue;
            const text = el.textContent;
            if (!text || text.length > 200 || text.length < 3) continue;
            if (!text.includes("C ") && !text.includes("C↑") && !text.includes("C↓")) continue;
            const val = parseOhlcClose(text);
            if (val) return val;
          }
        } catch (e) { /* swallowed – doc scrape error */ }
      }
    } catch (e) { /* swallowed */ }
    return null;
  };

  // --- SES-Safe Network Interception ---

  // 1. Try fetch-only interception (window.fetch is NOT a prototype — SES may allow it)
  try {
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      try {
        const url = String(args?.[0]?.url || args?.[0] || "");
        const isApiUrl = /quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url);
        const isSwapUrl = SWAP_URL_PATTERNS.test(url);
        const isRpcUrl = /rpc|helius|quicknode|alchemy|triton|shyft/i.test(url);

        // Clone ALL JSON responses for quote caching (swap detection)
        const contentType = res.headers?.get?.("content-type") || "";
        const isJson = contentType.includes("json") || isApiUrl || isSwapUrl || isRpcUrl;

        if (isJson) {
          const clone = res.clone();
          clone
            .json()
            .then((json) => {
              cacheSwapQuote(json, ctx); // Always cache potential quotes
              if (isApiUrl) tryHandleJson(url, json, ctx);
              if (isSwapUrl) {
                console.log(`[ZERØ] Swap URL matched: ${url}`);
                const reqData = parseRequestBody(args);
                tryHandleSwap(url, json, ctx, reqData);
              }
              // Detect RPC sendTransaction responses (catches sign-then-send flow)
              tryDetectRpcSignature(json, args, ctx);
            })
            .catch((err) => console.warn("[ZERØ] Fetch parse error:", err.message, url));
        }
      } catch { /* swallowed */ }
      return res;
    };
    console.log("[ZERØ] Padre: fetch interception active");
    // Verify fetch override survives SES lockdown
    const _ourFetch = window.fetch;
    setTimeout(() => {
      if (window.fetch === _ourFetch) {
        console.log("[ZERØ] fetch override verified active (post-SES)");
      } else {
        console.warn("[ZERØ] fetch override was REPLACED (likely SES lockdown)");
      }
    }, 3000);
  } catch (e) {
    console.log("[ZERØ] Padre: fetch interception blocked by SES");
  }

  // 1b. Try XHR interception (may be blocked by SES — if so, just log and continue)
  try {
    const XHROpen = XMLHttpRequest.prototype.open;
    const XHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__paper_url = String(url || "");
      return XHROpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...sendArgs) {
      let xhrReqData = null;
      try {
        if (typeof sendArgs[0] === "string") xhrReqData = JSON.parse(sendArgs[0]);
      } catch { /* not JSON */ }

      this.addEventListener("load", function () {
        try {
          const url = this.__paper_url || "";
          const ct = (this.getResponseHeader("content-type") || "").toLowerCase();
          if (ct.includes("json")) {
            const json = JSON.parse(this.responseText);
            cacheSwapQuote(json, ctx);
            if (/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
              tryHandleJson(url, json, ctx);
            }
            if (SWAP_URL_PATTERNS.test(url)) {
              console.log(`[ZERØ] Swap URL matched (XHR/Padre): ${url}`);
              tryHandleSwap(url, json, ctx, xhrReqData);
            }
            // Detect RPC sendTransaction responses (catches sign-then-send flow)
            tryDetectRpcSignature(json, [url, { body: sendArgs[0] }], ctx);
          }
        } catch (err) {
          console.warn("[ZERØ] Padre XHR handler error:", err.message);
        }
      });
      return XHRSend.apply(this, sendArgs);
    };
    console.log("[ZERØ] Padre: XHR interception active");
  } catch (e) {
    console.log("[ZERØ] Padre: XHR interception blocked by SES:", e.message);
  }

  // 1c. PerformanceObserver — SES-safe network activity detection
  // Detects swap/transaction URLs even after SES replaces fetch/XHR.
  // Resource Timing API is read-only — SES never modifies it.
  // IMPORTANT: Test PATHNAME only (not full URL) because trade.padre.gg domain
  // contains "trade" which would match SWAP_URL_PATTERNS on every single request.
  const PERFOBS_SWAP_PATH = /\/swap|\/execute|\/submit|send-?tx|confirm-?tx|transaction\/send|order\/place|\/jup|\/jupiter|\/raydium/i;
  const PERFOBS_TX_PATH = /sendTransaction|signTransaction/i;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.initiatorType !== "fetch" && entry.initiatorType !== "xmlhttprequest") continue;
        const url = entry.name || "";
        // Parse pathname to avoid false matches on domain name (trade.padre.gg)
        let pathname = url;
        try { pathname = new URL(url).pathname; } catch { /* use full url as fallback */ }
        if (PERFOBS_SWAP_PATH.test(pathname) || PERFOBS_TX_PATH.test(pathname)) {
          console.log(`[ZERØ] PerfObs: swap/tx request → ${url.slice(0, 80)}`);
          // Trigger aggressive deep scan for the next 5 seconds
          _aggressiveScrapeUntil = Date.now() + 5000;
          _posCache.lastDeepScan = 0; // Force immediate deep scan
        }
      }
    });
    po.observe({ type: "resource", buffered: false });
    console.log("[ZERØ] PerformanceObserver active for swap detection");
  } catch (e) {
    console.log("[ZERØ] PerformanceObserver not available:", e.message);
  }

  // 2. MutationObserver — triggers header re-scrape on DOM changes (SES-safe)
  const setupPriceObserver = () => {
    if (!document.body) return;

    // Debounced header re-scrape on any text mutation
    let _mutationTimer = null;
    const observer = new MutationObserver(() => {
      if (_mutationTimer) return;
      _mutationTimer = setTimeout(() => {
        _mutationTimer = null;
        pollPadreHeader();
      }, 100);
    });

    observer.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    console.log("[ZERØ] Padre: MutationObserver active for header price detection");
  };

  if (document.body) {
    setupPriceObserver();
  } else {
    document.addEventListener("DOMContentLoaded", setupPriceObserver);
  }

  // 3. PostMessage listener — catch TradingView iframe price data (SES-safe)
  window.addEventListener("message", (e) => {
    if (e.data?.__paper) return; // Skip our own messages
    try {
      const raw = typeof e.data === "string" ? e.data : null;
      const obj = typeof e.data === "object" ? e.data : raw ? safe(() => JSON.parse(raw)) : null;
      if (obj && (ctx.mint || ctx.symbol)) {
        const str = raw || JSON.stringify(obj);
        if (looksRelatedByString(str, ctx)) {
          tryHandleJson("postMessage", obj, ctx);
        }
      }
    } catch { /* swallowed */ }
  });

  // 4. Chart MCap → Price Inference
  // CRITICAL: Padre charts show Market Cap on Y-axis, not token price.
  // When we have an API reference (price + MCap), we derive real-time price
  // from the chart's Close value: inferredPrice = refPrice * (chartMCap / refMCap)
  let lastChartMCap = 0;
  const pollChartMCap = () => {
    if (ctx.refPrice <= 0 || ctx.refMCap <= 0) return;
    const mcap = scrapePadreMCap();
    if (!mcap) return;
    if (mcap === lastChartMCap) return;
    lastChartMCap = mcap;

    const inferredPrice = ctx.refPrice * (mcap / ctx.refMCap);
    if (inferredPrice > 0 && inferredPrice < 1000) {
      console.log(
        `[ZERØ] Chart MCap→Price: MCap=$${mcap.toLocaleString()} → $${inferredPrice.toFixed(10)}`
      );
      send({
        type: "PRICE_TICK",
        source: "chart",
        price: inferredPrice,
        chartMCap: mcap,
        confidence: 3,
        ts: Date.now(),
      });
    }
  };
  setInterval(pollChartMCap, 200);

  // 5a. TradingView Execution Shape Hook — detect Padre trade markers (secondary diagnostic)
  let _tvExecHooked = false;
  function hookTvExecutionShapes() {
    if (_tvExecHooked) return;
    const tv = findTV();
    if (!tv || !tv.activeChart) return;
    try {
      const chart = tv.activeChart();
      if (typeof chart.createExecutionShape !== "function") return;
      const origCreate = chart.createExecutionShape.bind(chart);
      chart.createExecutionShape = function (...args) {
        const shape = origCreate(...args);
        const td = {};
        for (const [setter, key] of [["setDirection", "dir"], ["setPrice", "price"], ["setText", "text"], ["setTime", "time"]]) {
          if (typeof shape[setter] === "function") {
            const orig = shape[setter].bind(shape);
            shape[setter] = (val) => { td[key] = val; return orig(val); };
          }
        }
        setTimeout(() => {
          // Only log Padre's markers (ours use "BUY"/"SELL", Padre uses different text)
          if (td.dir && td.text !== "BUY" && td.text !== "SELL") {
            console.log(`[ZERØ] Padre TV marker: ${td.dir} at MCap=${td.price}, text="${td.text}"`);
          }
        }, 0);
        return shape;
      };
      _tvExecHooked = true;
      console.log("[ZERØ] TV createExecutionShape hooked for trade markers");
    } catch (e) { /* TV hook failed — non-critical */ }
  }

  // 5b. TradingView API fallback — async export of chart data
  const pollTvMCap = async () => {
    // Try hooking TV execution shapes (once, when TV widget first available)
    hookTvExecutionShapes();

    if (ctx.refPrice <= 0 || ctx.refMCap <= 0) return;
    const tv = findTV();
    if (!tv || !tv.activeChart) return;
    try {
      const chart = tv.activeChart();
      if (!ctx._tvApiLogged) {
        ctx._tvApiLogged = true;
        try {
          const proto = Object.getPrototypeOf(chart);
          const methods = Object.getOwnPropertyNames(proto).filter(
            (m) => typeof chart[m] === "function"
          );
          console.log("[ZERØ] TV chart API methods:", methods.join(", "));
        } catch (e) { /* swallowed – TV introspection failed */ }
      }
      if (typeof chart.exportData === "function") {
        const now = Math.floor(Date.now() / 1000);
        const data = await chart.exportData({ from: now - 120, to: now + 60 });
        if (data?.data?.length > 0) {
          const last = data.data[data.data.length - 1];
          const close = last[4]; // OHLCV: [time, open, high, low, close, vol]
          if (close > 100 && close !== lastChartMCap) {
            lastChartMCap = close;
            const inferredPrice = ctx.refPrice * (close / ctx.refMCap);
            if (inferredPrice > 0 && inferredPrice < 1000) {
              console.log(
                `[ZERØ] TV API MCap→Price: MCap=$${close.toLocaleString()} → $${inferredPrice.toFixed(10)}`
              );
              send({
                type: "PRICE_TICK",
                source: "chart-api",
                price: inferredPrice,
                chartMCap: close,
                confidence: 3,
                ts: Date.now(),
              });
            }
          }
        }
      }
    } catch (e) { /* swallowed */ }
  };
  setInterval(pollTvMCap, 1000);

  // --- Message Listener (shared handlers + price reference) ---
  setupMessageListener(ctx);

  // --- Shadow Mode: Swap Detection (signAndSendTransaction hook + quote cache) ---
  setupSwapDetection(ctx);

  // --- Wallet address capture for Shadow Mode balance ---
  setupWalletAddressCapture();
})();
