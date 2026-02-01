/**
 * Page Bridge Script
 *
 * Runs in the PAGE context (not extension isolated world).
 * Hooks fetch, XMLHttpRequest, and WebSocket APIs to intercept price updates.
 * Emits PRICE_TICK messages to the content script via window.postMessage.
 *
 * Context Matching:
 * - Content script sends PAPER_SET_CONTEXT with { mint, symbol }
 * - Only emits prices when the response matches the current context
 */

(() => {
  const CHANNEL = "__paper";
  const MAX_SCAN_CHARS = 200_000; // safety cap for string scans

  const ctx = {
    mint: null,
    symbol: null,
    lastEmitAt: 0,
    minEmitGapMs: 150, // do not spam the content script
  };

  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  function send(payload) {
    window.postMessage({ [CHANNEL]: true, ...payload }, "*");
  }

  function isLikelySolanaMint(s) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ""));
  }

  function normalizeSymbol(s) {
    return String(s || "")
      .trim()
      .toUpperCase();
  }

  function throttleEmit() {
    const t = Date.now();
    if (t - ctx.lastEmitAt < ctx.minEmitGapMs) return false;
    ctx.lastEmitAt = t;
    return true;
  }

  function looksRelatedByString(rawStr) {
    if (!rawStr) return false;
    const s = rawStr.slice(0, MAX_SCAN_CHARS);
    const mint = ctx.mint;
    const sym = ctx.symbol;

    if (mint && s.includes(mint)) return true;

    // symbol match is weaker, but still useful as a fallback
    if (sym) {
      const up = s.toUpperCase();
      if (up.includes(sym)) return true;
    }
    return false;
  }

  // Try to find a plausible USD price in an object.
  // Heuristics:
  // - prefer explicit USD keys first
  // - otherwise scan for "price-like" fields
  function extractPriceUsd(obj) {
    if (!obj || typeof obj !== "object") return null;

    // Prefer explicit USD fields first
    const preferred = [
      "priceUsd",
      "usdPrice",
      "price_usd",
      "markPriceUsd",
      "lastPriceUsd",
      "closeUsd",
    ];
    for (const k of preferred) {
      const v = obj[k];
      const n = typeof v === "string" ? Number(v) : v;
      if (Number.isFinite(n) && n > 0) return { price: n, confidence: 3, key: k };
    }

    // Common generic keys
    const common = ["price", "last", "lastPrice", "markPrice", "close", "c", "p"];
    for (const k of common) {
      const v = obj[k];
      const n = typeof v === "string" ? Number(v) : v;
      if (Number.isFinite(n) && n > 0) {
        // This might be USD or SOL-denominated. We mark lower confidence.
        return { price: n, confidence: 1, key: k };
      }
    }

    // Bounded deep scan
    let found = null;
    let steps = 0;
    const MAX_STEPS = 700;

    const walk = (x) => {
      if (!x || found || steps > MAX_STEPS) return;
      steps++;

      if (Array.isArray(x)) {
        for (const it of x) walk(it);
        return;
      }
      if (typeof x !== "object") return;

      // try preferred keys on each object
      for (const k of preferred) {
        if (found) return;
        if (k in x) {
          const v = x[k];
          const n = typeof v === "string" ? Number(v) : v;
          if (Number.isFinite(n) && n > 0) {
            found = { price: n, confidence: 3, key: k };
            return;
          }
        }
      }

      for (const k of common) {
        if (found) return;
        if (k in x) {
          const v = x[k];
          const n = typeof v === "string" ? Number(v) : v;
          if (Number.isFinite(n) && n > 0) {
            found = { price: n, confidence: 1, key: k };
            return;
          }
        }
      }

      for (const v of Object.values(x)) {
        if (found) return;
        walk(v);
      }
    };

    walk(obj);
    return found;
  }

  function tryHandleJson(url, json) {
    // If we have context, only emit if the payload is likely related.
    // We do string matching on a capped JSON string.
    if (ctx.mint || ctx.symbol) {
      const s = safe(() => JSON.stringify(json)) || "";
      if (!looksRelatedByString(s)) return;
    }

    const r = extractPriceUsd(json);
    if (!r) return;

    if (!throttleEmit()) return;

    // DEBUG LOG
    console.log(`[Bridge] Emitting PRICE_TICK: $${r.price} (conf: ${r.confidence}) from ${url}`);

    send({
      type: "PRICE_TICK",
      source: "site",
      url,
      price: r.price,
      confidence: r.confidence, // 3 = likely USD, 1 = generic
      key: r.key || null,
      ts: Date.now(),
    });
  }

  // Receive context from content script
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d[CHANNEL] !== true) return;

    if (d.type === "PAPER_SET_CONTEXT") {
      const mint = isLikelySolanaMint(d.mint) ? d.mint : null;
      const sym = normalizeSymbol(d.symbol);

      ctx.mint = mint;
      ctx.symbol = sym || null;

      send({ type: "CONTEXT_ACK", mint: ctx.mint, symbol: ctx.symbol, ts: Date.now() });
    }
  });

  // -------------------------
  // Hook fetch
  // -------------------------
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await origFetch(...args);
    try {
      const url = String(args?.[0]?.url || args?.[0] || "");
      // Only inspect likely market-data URLs to keep overhead low
      if (!/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) return res;

      const clone = res.clone();

      // Try JSON only
      clone
        .json()
        .then((json) => {
          tryHandleJson(url, json);
        })
        .catch(() => {});
    } catch { /* swallowed */ }
    return res;
  };

  // -------------------------
  // Hook XHR
  // -------------------------
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__paper_url = String(url || "");
    return XHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        const url = this.__paper_url || "";
        if (!/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) return;

        const ct = (this.getResponseHeader("content-type") || "").toLowerCase();
        if (!ct.includes("json")) return;

        const text = String(this.responseText || "");
        if (!text) return;

        const json = JSON.parse(text);
        tryHandleJson(url, json);
      } catch { /* swallowed */ }
    });

    return XHRSend.apply(this, args);
  };

  // -------------------------
  // Hook WebSocket (optional but helpful for chart feeds)
  // -------------------------
  const OrigWS = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new OrigWS(...args);
    const url = String(args?.[0] || "");

    ws.addEventListener("message", (ev) => {
      try {
        if (!/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
          // Still allow parsing if message includes mint/symbol
          // (do not return early)
        }

        // Most WS payloads are string JSON
        if (typeof ev.data === "string") {
          const s = ev.data.slice(0, MAX_SCAN_CHARS);
          if ((ctx.mint || ctx.symbol) && !looksRelatedByString(s)) return;

          const json = safe(() => JSON.parse(s));
          if (json) tryHandleJson(url, json);
        }
      } catch { /* swallowed */ }
    });

    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;

  send({ type: "BRIDGE_READY", ts: Date.now() });
})();
