/**
 * Axiom Bridge (MAIN World)
 * Runs in page context on axiom.trade only.
 * Full network interception (fetch/XHR/WebSocket) + Axiom-specific DOM scraping.
 * Chart MCap → Price inference pipeline (matching Padre's approach).
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
  console.log("[ZERØ] Axiom Bridge Active (document_start, MAIN world).");

  const ctx = createContext();

  // --- Axiom-Specific DOM Price Scraping ---
  const scrapeDomPrice = () => {
    try {
      // 1. Target the specific Price element with sub-zero support
      // In Axiom, the price is often in an element that looks like $0.0{sub}181
      const priceHeaders = document.querySelectorAll(
        'div[class*="TokenHeader_price"], div[class*="price-display"], div[class*="price_display"]'
      );
      for (const priceHeader of priceHeaders) {
        let fullText = "";
        priceHeader.childNodes.forEach((node) => {
          if (node.nodeType === 3) fullText += node.textContent;
          else if (
            node.tagName === "SUB" ||
            node.classList?.contains("subscript") ||
            (node.tagName === "SPAN" && node.textContent.length <= 2)
          ) {
            const val = node.textContent.trim();
            if (val.match(/^[0-9]$/)) {
              const zeros = parseInt(val) || 0;
              fullText += "0".repeat(zeros);
            } else {
              fullText += val;
            }
          } else {
            fullText += node.textContent;
          }
        });

        if (fullText.includes("$") && !fullText.match(/[MBK]\b/i)) {
          const val = parseFloat(fullText.replace(/[^0-9.]/g, ""));
          // Accept only values < $50 (meme coins are typically < $1)
          // Reject SOL price range and values that look like market caps
          if (val > 0 && val < 50) return val;
        }
      }

      // 2. Title fallback (Axiom: "WOOD wood coin $0.0000181")
      // IMPORTANT: Skip values with K/M/B suffix — those are market caps, not prices
      // e.g. "$2.07K" = $2,070 market cap, NOT $2.07 price
      const mTitle =
        document.title.match(/\$([0-9.]+)([KMBkmb]?)/) || document.title.match(/([0-9.]+) \$/);
      if (mTitle) {
        const suffix = (mTitle[2] || "").toUpperCase();
        if (!suffix) {
          // No suffix = actual price
          const titlePrice = parseFloat(mTitle[1]);
          if (titlePrice > 0 && titlePrice < 100) return titlePrice;
        }
        // Has K/M/B suffix = market cap, skip it
      }

      // 3. Narrow generic fallback — only accept tiny decimals in short, leaf elements
      // Avoid picking up random values from trade lists, order books, etc.
      const els = Array.from(document.querySelectorAll("span, div")).slice(0, 300);
      for (const el of els) {
        if (el.children.length > 5) continue;
        const text = el.textContent.trim();
        if (text.length > 30 || text.length < 3) continue;
        if (text.startsWith("$") && !text.match(/[MBK]\b/i)) {
          // Only accept sub-penny values (typical meme coin prices)
          if (text.includes("0.0")) {
            const val = parseFloat(text.slice(1).replace(/,/g, ""));
            if (val > 0 && val < 0.01) return val;
          }
        }
        // Non-$ tiny decimal values (per-token price like "0.0003152")
        if (/^0\.\d{4,}$/.test(text)) {
          const val = parseFloat(text);
          if (val > 0 && val < 0.01) return val;
        }
      }
    } catch (e) { /* swallowed */ }
    return null;
  };

  let lastDomPrice = 0;
  const pollDomPrice = () => {
    const p = scrapeDomPrice();
    if (p && p !== lastDomPrice) {
      lastDomPrice = p;
      send({
        type: "PRICE_TICK",
        source: "dom",
        price: p,
        confidence: 2,
        ts: Date.now(),
      });
    }
  };

  setInterval(pollDomPrice, 200);

  // --- Chart MCap Scraping (Axiom: Y-axis = Market Cap, not token price) ---
  // Ported from Padre: Extracts MCap from TradingView chart OHLC legend & Y-axis labels.
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

  const scrapeChartMCap = () => {
    try {
      // Search both main document and iframes (TradingView is in an iframe on Axiom)
      const docs = [document];
      try {
        for (let i = 0; i < window.frames.length; i++) {
          try {
            docs.push(window.frames[i].document);
          } catch (e) { /* swallowed – cross-origin iframe */ }
        }
      } catch (e) { /* swallowed */ }

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
        } catch (e) { /* swallowed */ }
      }
    } catch (e) { /* swallowed */ }
    return null;
  };

  // --- Full Network Hooks (safe on Axiom — no SES lockdown) ---

  // Fetch — clone API responses for price data + swap detection
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

  // XHR
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__paper_url = String(url || "");
    return XHROpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...sendArgs) {
    // Capture request body for swap detection fallback
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
          cacheSwapQuote(json, ctx); // Always cache potential quotes
          if (/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
            tryHandleJson(url, json, ctx);
          }
          if (SWAP_URL_PATTERNS.test(url)) {
            console.log(`[ZERØ] Swap URL matched (XHR): ${url}`);
            tryHandleSwap(url, json, ctx, xhrReqData);
          }
        }
      } catch (err) {
        console.warn("[ZERØ] XHR handler error:", err.message);
      }
    });
    return XHRSend.apply(this, sendArgs);
  };

  // WebSocket
  const OrigWS = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new OrigWS(...args);
    const url = String(args?.[0] || "");
    ws.addEventListener("message", (ev) => {
      try {
        if (typeof ev.data === "string") {
          const s = ev.data.slice(0, MAX_SCAN_CHARS);
          if ((ctx.mint || ctx.symbol) && !looksRelatedByString(s, ctx)) return;
          const json = safe(() => JSON.parse(s));
          if (json) tryHandleJson(url, json, ctx);
        }
      } catch { /* swallowed */ }
    });
    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;

  // --- PostMessage Listener (catch TradingView iframe price data) ---
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

  // --- Chart MCap → Price Inference ---
  // CRITICAL: Axiom charts (like Padre) show Market Cap on Y-axis, not token price.
  // When we have an API reference (price + MCap), we derive real-time price
  // from the chart's Close value: inferredPrice = refPrice * (chartMCap / refMCap)
  let lastChartMCap = 0;
  const pollChartMCap = () => {
    if (ctx.refPrice <= 0 || ctx.refMCap <= 0) return;
    const mcap = scrapeChartMCap();
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

  // --- TradingView API fallback — async export of chart data ---
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
        } catch (e) { /* swallowed */ }
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
