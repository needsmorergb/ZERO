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
} from "../shared/bridge-utils.js";

(() => {
  console.log("[ZERØ] Padre Bridge Active (document_start, MAIN world).");

  const ctx = createContext();

  // --- Padre-Specific DOM Price Scraping ---
  const scrapeDomPrice = () => {
    try {
      // 1. Check price display elements with subscript/sub-zero support
      const priceEls = document.querySelectorAll(
        '[class*="price"], [class*="Price"], [class*="token-price"], [class*="tokenPrice"]'
      );
      for (const priceEl of priceEls) {
        let fullText = "";
        priceEl.childNodes.forEach((node) => {
          if (node.nodeType === 3) fullText += node.textContent;
          else if (
            node.tagName === "SUB" ||
            node.classList?.contains("subscript") ||
            (node.tagName === "SPAN" && node.textContent.length <= 2)
          ) {
            const val = node.textContent.trim();
            if (val.match(/^[0-9]$/)) {
              fullText += "0".repeat(parseInt(val) || 0);
            } else {
              fullText += val;
            }
          } else {
            fullText += node.textContent;
          }
        });
        // Reject market cap values (M/B/K suffix)
        if (fullText.includes("$") && !fullText.match(/[MBK]\b/i)) {
          const val = parseFloat(fullText.replace(/[^0-9.]/g, ""));
          if (val > 0 && val < 1000) return val;
        }
      }

      // 2. Title fallback — reject market cap values (M/B/K suffix)
      const titleMatches = [...document.title.matchAll(/\$([0-9.,]+)\s*([MBKmbk])?/g)];
      for (const m of titleMatches) {
        if (m[2]) continue; // Skip market cap: $2.06M, $500K, $1.2B
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (val > 0 && val < 1000) return val;
      }

      // 3. Broad DOM scan — accept any $ value that isn't market cap
      const els = Array.from(document.querySelectorAll("span, div")).slice(0, 500);
      for (const el of els) {
        if (el.children.length > 5) continue;
        const text = el.textContent.trim();
        if (text.length > 30 || text.length < 3) continue;
        if (text.startsWith("$") && !text.match(/[MBK]\b/i)) {
          const val = parseFloat(text.slice(1).replace(/,/g, ""));
          if (val > 0 && val < 100) return val;
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
        if (isApiUrl || isSwapUrl) {
          if (isSwapUrl) {
            console.log(`[ZERØ] Padre: Swap URL intercepted: ${url.slice(0, 120)}`);
          }
          const clone = res.clone();
          clone
            .json()
            .then((json) => {
              if (isApiUrl) tryHandleJson(url, json, ctx);
              if (isSwapUrl) tryHandleSwap(url, json, ctx);
            })
            .catch(() => {});
        }
      } catch { /* swallowed */ }
      return res;
    };
    console.log("[ZERØ] Padre: fetch interception active");
  } catch (e) {
    console.log("[ZERØ] Padre: fetch interception blocked by SES");
  }

  // 2. MutationObserver — instant DOM price detection (SES-safe)
  const setupPriceObserver = () => {
    if (!document.body) return;
    const emitDomPrice = (val) => {
      if (val > 0 && val < 100 && val !== lastDomPrice) {
        lastDomPrice = val;
        send({
          type: "PRICE_TICK",
          source: "dom",
          price: val,
          confidence: 2,
          ts: Date.now(),
        });
      }
    };

    const checkText = (text) => {
      if (!text || text.length < 2 || text.length > 30) return;
      text = text.trim();
      if (text.startsWith("$") && !text.match(/[MBK]\b/i)) {
        const val = parseFloat(text.slice(1).replace(/,/g, ""));
        emitDomPrice(val);
        return;
      }
      if (/^0\.\d{4,}$/.test(text)) {
        const val = parseFloat(text);
        if (val > 0 && val < 0.01) {
          emitDomPrice(val);
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          checkText(m.target.textContent);
        } else if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node.nodeType === 3) checkText(node.textContent);
            else if (node.nodeType === 1 && !node.children?.length) {
              checkText(node.textContent);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    console.log("[ZERØ] Padre: MutationObserver active for instant price detection");
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

  // --- Wallet address capture for Shadow Mode balance ---
  setupWalletAddressCapture();
})();
