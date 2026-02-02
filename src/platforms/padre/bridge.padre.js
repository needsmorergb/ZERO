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
    invested: /^Invested$/i,
    sold: /^Sold$/i,
    remaining: /^Remaining$/i,
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

  const scrapePadreHeader = () => {
    try {
      const results = {};
      const allEls = document.querySelectorAll("span, div, p, td, th, dt, dd, label");
      const limit = Math.min(allEls.length, 2000);

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
          }
        }
      }
      return Object.keys(results).length > 0 ? results : null;
    } catch (e) { /* swallowed */ }
    return null;
  };

  let lastHeaderPrice = 0;
  let lastHeaderMCap = 0;
  let _headerLogOnce = false;
  const pollPadreHeader = () => {
    const h = scrapePadreHeader();
    if (!h) return;

    if (!_headerLogOnce) {
      _headerLogOnce = true;
      console.log("[ZERØ] Padre header scrape result:", JSON.stringify(h));
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

        // Clone ALL JSON responses for quote caching (swap detection)
        const contentType = res.headers?.get?.("content-type") || "";
        const isJson = contentType.includes("json") || isApiUrl || isSwapUrl;

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
            })
            .catch((err) => console.warn("[ZERØ] Fetch parse error:", err.message, url));
        }
      } catch { /* swallowed */ }
      return res;
    };
    console.log("[ZERØ] Padre: fetch interception active");
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

  // 5. TradingView API fallback — async export of chart data
  const pollTvMCap = async () => {
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
