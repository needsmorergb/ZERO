(() => {
  // src/platforms/shared/bridge-utils.js
  var CHANNEL = "__paper";
  var MAX_SCAN_CHARS = 2e5;
  var safe = (fn) => {
    try {
      return fn();
    } catch {
      return void 0;
    }
  };
  var send = (payload) => {
    window.postMessage({ [CHANNEL]: true, ...payload }, "*");
  };
  var isLikelySolanaMint = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ""));
  var normalizeSymbol = (s) => String(s || "").trim().toUpperCase();
  function createContext() {
    return {
      mint: null,
      symbol: null,
      lastEmitAt: 0,
      minEmitGapMs: 150,
      refPrice: 0,
      refMCap: 0
    };
  }
  function throttleEmit(ctx) {
    const t = Date.now();
    if (t - ctx.lastEmitAt < ctx.minEmitGapMs)
      return false;
    ctx.lastEmitAt = t;
    return true;
  }
  function looksRelatedByString(rawStr, ctx) {
    if (!rawStr)
      return false;
    const s = rawStr.slice(0, MAX_SCAN_CHARS);
    const mint = ctx.mint;
    const sym = ctx.symbol;
    if (mint && s.includes(mint))
      return true;
    if (sym && s.toUpperCase().includes(sym.toUpperCase()))
      return true;
    if (s.length < 500 && s.match(/"p":\s*0\.0/))
      return true;
    if (s.length < 500 && s.match(/"price":\s*0\.0/))
      return true;
    return false;
  }
  function extractPriceUsd(obj) {
    if (!obj || typeof obj !== "object")
      return null;
    const preferred = [
      "priceUsd",
      "usdPrice",
      "price_usd",
      "markPriceUsd",
      "lastPriceUsd",
      "closeUsd"
    ];
    const common = ["price", "last", "lastPrice", "markPrice", "close", "c", "p"];
    let found = null;
    let steps = 0;
    const MAX_STEPS = 500;
    const walk = (x) => {
      if (!x || found || steps > MAX_STEPS || typeof x !== "object")
        return;
      steps++;
      if (Array.isArray(x)) {
        for (const it of x)
          walk(it);
        return;
      }
      for (const k of preferred) {
        const v = x[k];
        const n = typeof v === "string" ? Number(v) : v;
        if (Number.isFinite(n) && n > 0) {
          found = { price: n, confidence: 3, key: k };
          return;
        }
      }
      for (const k of common) {
        const v = x[k];
        const n = typeof v === "string" ? Number(v) : v;
        if (Number.isFinite(n) && n > 0) {
          found = { price: n, confidence: 1, key: k };
          return;
        }
      }
      for (const v of Object.values(x)) {
        if (found)
          return;
        walk(v);
      }
    };
    walk(obj);
    return found;
  }
  function tryHandleJson(url, json, ctx) {
    const isRelated = looksRelatedByString(JSON.stringify(json), ctx);
    const r = extractPriceUsd(json);
    if (r && isRelated) {
      if (!throttleEmit(ctx))
        return;
      console.log(`[ZER\xD8] Price Intercepted (Network): $${r.price} (from ${url})`);
      send({
        type: "PRICE_TICK",
        source: "site",
        url,
        price: r.price,
        confidence: r.confidence,
        key: r.key || null,
        ts: Date.now()
      });
    }
  }
  var SOL_MINTS = [
    "So11111111111111111111111111111111111111112",
    // Wrapped SOL
    "So11111111111111111111111111111111111111111"
    // Native SOL (rare in swap responses)
  ];
  var isSolMint = (mint) => SOL_MINTS.some((m) => mint === m);
  var SWAP_URL_PATTERNS = /swap|execute|submit|send-?tx|confirm-?tx|transaction\/send|order\/place/i;
  function tryHandleSwap(url, json, ctx) {
    if (!json || typeof json !== "object")
      return;
    const data = json.data || json.result || json;
    const txid = data.txid || data.signature || data.txSignature || data.transactionId || data.tx || data.hash;
    if (!txid || typeof txid !== "string" || txid.length < 30)
      return;
    const inputMint = data.inputMint || data.fromMint || data.tokenIn || data.sourceMint;
    const outputMint = data.outputMint || data.toMint || data.tokenOut || data.destMint;
    if (!inputMint || !outputMint) {
      console.log(`[ZER\xD8] Swap response has txid but missing mints \u2014 url=${url}`);
      return;
    }
    const isSolInput = isSolMint(inputMint);
    const isSolOutput = isSolMint(outputMint);
    if (!isSolInput && !isSolOutput) {
      console.log(`[ZER\xD8] Swap has no SOL side \u2014 skipping (${inputMint} \u2192 ${outputMint})`);
      return;
    }
    const side = isSolInput ? "BUY" : "SELL";
    const mint = isSolInput ? outputMint : inputMint;
    const inAmount = parseFloat(data.inAmount || data.inputAmount || data.amountIn || 0);
    const outAmount = parseFloat(data.outAmount || data.outputAmount || data.amountOut || 0);
    const solLamports = isSolInput ? inAmount : outAmount;
    const tokenRaw = isSolInput ? outAmount : inAmount;
    const solAmount = solLamports > 1e3 ? solLamports / 1e9 : solLamports;
    const priceUsd = parseFloat(data.priceUsd || data.price || data.tokenPriceUsd || 0);
    const symbol = data.symbol || data.outputSymbol || data.inputSymbol || ctx.symbol || null;
    console.log(
      `[ZER\xD8] Swap Detected: ${side} ${symbol || mint.slice(0, 8)} \u2014 ${solAmount.toFixed(4)} SOL, tx=${txid.slice(0, 12)}...`
    );
    send({
      type: "SHADOW_TRADE_DETECTED",
      side,
      mint,
      symbol,
      solAmount,
      tokenAmount: tokenRaw,
      priceUsd,
      signature: txid,
      url,
      ts: Date.now()
    });
  }
  var findTV = () => {
    if (window.tvWidget && typeof window.tvWidget.activeChart === "function")
      return window.tvWidget;
    if (window.tradingViewApi && typeof window.tradingViewApi.activeChart === "function")
      return window.tradingViewApi;
    if (window.TradingView && window.TradingView.widget && typeof window.TradingView.widget.activeChart === "function")
      return window.TradingView.widget;
    if (window.widget && typeof window.widget.activeChart === "function")
      return window.widget;
    try {
      for (let i = 0; i < window.frames.length; i++) {
        try {
          const frame = window.frames[i];
          if (frame.tradingViewApi && typeof frame.tradingViewApi.activeChart === "function") {
            console.log("[ZER\xD8] Found tradingViewApi in iframe[" + i + "]");
            return frame.tradingViewApi;
          }
          if (frame.tvWidget && typeof frame.tvWidget.activeChart === "function") {
            console.log("[ZER\xD8] Found tvWidget in iframe[" + i + "]");
            return frame.tvWidget;
          }
        } catch (e) {
        }
      }
    } catch (e) {
      console.log("[ZER\xD8] Error searching iframes:", e);
    }
    return null;
  };
  var activeMarkers = [];
  var drawMarker = (trade) => {
    console.log("[ZER\xD8] drawMarker() called for", trade.side, trade.symbol);
    let attempts = 0;
    const maxAttempts = 20;
    const tryDraw = () => {
      attempts++;
      const tv = findTV();
      if (tv && tv.activeChart) {
        console.log("[ZER\xD8] TradingView widget found, drawing marker...");
        clearInterval(pollInterval);
        try {
          const chart = tv.activeChart();
          const side = (trade.side || "").toUpperCase();
          const isBuy = side === "BUY";
          const ts = Math.floor(trade.ts / 1e3);
          const chartPrice = trade.marketCap || trade.priceUsd;
          const color = isBuy ? "#10b981" : "#ef4444";
          if (typeof chart.createExecutionShape === "function") {
            const shape = chart.createExecutionShape().setTime(ts).setPrice(chartPrice).setDirection(isBuy ? "buy" : "sell").setText(isBuy ? "BUY" : "SELL").setTextColor("#ffffff").setArrowColor(color).setArrowSpacing(8).setArrowHeight(22);
            try {
              shape.setFont("bold 12px Inter");
            } catch (e) {
            }
            activeMarkers.push({ fmt: "exec", ref: shape });
          } else {
            const id = chart.createShape(
              { time: ts, location: isBuy ? "belowbar" : "abovebar" },
              {
                shape: "text",
                lock: true,
                text: isBuy ? "\n\n\n\n\u2191\nB" : "S\n\u2193\n\n\n\n",
                overrides: { color, fontsize: 16, bold: true }
              }
            );
            if (id)
              activeMarkers.push({ fmt: "std", id });
          }
        } catch (e) {
          console.warn("[ZER\xD8] Marker failed:", e);
        }
      } else if (attempts >= maxAttempts) {
        console.warn(`[ZER\xD8] TradingView widget not found after ${maxAttempts} attempts`);
        clearInterval(pollInterval);
      } else {
        console.log(`[ZER\xD8] TradingView widget not found yet, attempt ${attempts}/${maxAttempts}`);
      }
    };
    const pollInterval = setInterval(tryDraw, 100);
    tryDraw();
  };
  function setupMessageListener(ctx, opts = {}) {
    const { onPriceReference } = opts;
    window.addEventListener("message", (e) => {
      if (e.source !== window || !e.data?.[CHANNEL])
        return;
      const d = e.data;
      if (d.type === "PAPER_SET_CONTEXT") {
        const mint = isLikelySolanaMint(d.mint) ? d.mint : null;
        const sym = normalizeSymbol(d.symbol);
        ctx.mint = mint;
        ctx.symbol = sym || null;
        ctx.refPrice = 0;
        ctx.refMCap = 0;
        console.log("[ZER\xD8] Bridge Context Updated:", ctx.mint, ctx.symbol);
      }
      if (d.type === "PAPER_PRICE_REFERENCE") {
        ctx.refPrice = d.priceUsd || 0;
        ctx.refMCap = d.marketCapUsd || 0;
        console.log(`[ZER\xD8] Price Reference: $${ctx.refPrice}, MCap: $${ctx.refMCap}`);
        if (onPriceReference)
          onPriceReference(ctx);
      }
      if (d.type === "PAPER_DRAW_MARKER") {
        drawMarker(d.trade);
      }
      if (d.type === "PAPER_DRAW_ALL") {
        console.log("[ZER\xD8] Drawing", (d.trades || []).length, "markers");
        (d.trades || []).forEach(drawMarker);
      }
      if (d.type === "PAPER_CLEAR_MARKERS") {
        const tv = findTV();
        if (tv && tv.activeChart) {
          try {
            const chart = tv.activeChart();
            activeMarkers.forEach((m) => {
              try {
                if (m.fmt === "exec" && m.ref && m.ref.remove) {
                  m.ref.remove();
                } else if (m.fmt === "std" && m.id) {
                  chart.removeEntity(m.id);
                }
              } catch (err) {
              }
            });
            activeMarkers.length = 0;
            if (chart.removeAllShapes)
              chart.removeAllShapes();
            console.log("[ZER\xD8] Markers cleared.");
          } catch (err) {
            console.warn("[ZER\xD8] Failed to clear markers:", err);
          }
        }
      }
    });
  }

  // src/platforms/axiom/bridge.axiom.js
  (() => {
    console.log("[ZER\xD8] Axiom Bridge Active (document_start, MAIN world).");
    const ctx = createContext();
    const scrapeDomPrice = () => {
      try {
        const priceHeaders = document.querySelectorAll(
          'div[class*="TokenHeader_price"], div[class*="price-display"], div[class*="price_display"]'
        );
        for (const priceHeader of priceHeaders) {
          let fullText = "";
          priceHeader.childNodes.forEach((node) => {
            if (node.nodeType === 3)
              fullText += node.textContent;
            else if (node.tagName === "SUB" || node.classList?.contains("subscript") || node.tagName === "SPAN" && node.textContent.length <= 2) {
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
            if (val > 0 && val < 50)
              return val;
          }
        }
        const mTitle = document.title.match(/\$([0-9.]+)([KMBkmb]?)/) || document.title.match(/([0-9.]+) \$/);
        if (mTitle) {
          const suffix = (mTitle[2] || "").toUpperCase();
          if (!suffix) {
            const titlePrice = parseFloat(mTitle[1]);
            if (titlePrice > 0 && titlePrice < 100)
              return titlePrice;
          }
        }
        const els = Array.from(document.querySelectorAll("span, div")).slice(0, 300);
        for (const el of els) {
          if (el.children.length > 5)
            continue;
          const text = el.textContent.trim();
          if (text.length > 30 || text.length < 3)
            continue;
          if (text.startsWith("$") && !text.match(/[MBK]\b/i)) {
            if (text.includes("0.0")) {
              const val = parseFloat(text.slice(1).replace(/,/g, ""));
              if (val > 0 && val < 0.01)
                return val;
            }
          }
          if (/^0\.\d{4,}$/.test(text)) {
            const val = parseFloat(text);
            if (val > 0 && val < 0.01)
              return val;
          }
        }
      } catch (e) {
      }
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
          ts: Date.now()
        });
      }
    };
    setInterval(pollDomPrice, 200);
    const parseOhlcClose = (text) => {
      if (!text)
        return null;
      if (!/[OHL]\s*[↓↑]?\s*\$?\s*[0-9]/.test(text))
        return null;
      const m = text.match(/C\s*[↓↑]?\s*\$?\s*([0-9,.]+)\s*([KMBkmb])?/);
      if (!m)
        return null;
      let val = parseFloat(m[1].replace(/,/g, ""));
      if (!val || val <= 0)
        return null;
      const suffix = (m[2] || "").toUpperCase();
      if (suffix === "K")
        val *= 1e3;
      else if (suffix === "M")
        val *= 1e6;
      else if (suffix === "B")
        val *= 1e9;
      if (val < 100 || val > 1e11)
        return null;
      return val;
    };
    const scrapeChartMCap = () => {
      try {
        const docs = [document];
        try {
          for (let i = 0; i < window.frames.length; i++) {
            try {
              docs.push(window.frames[i].document);
            } catch (e) {
            }
          }
        } catch (e) {
        }
        for (const doc of docs) {
          try {
            const legendEls = doc.querySelectorAll(
              '[class*="valuesWrapper"], [class*="legend"], [class*="headerRow"], [class*="values-"], [class*="mainSeries"], [class*="sourcesWrapper"]'
            );
            for (const el of legendEls) {
              const val = parseOhlcClose(el.textContent);
              if (val)
                return val;
            }
            const yAxisEls = doc.querySelectorAll(
              '[class*="lastPrice"], [class*="lastValue"], [class*="markLine"], [class*="price-axis-last"], [class*="currentPrice"], [class*="pane-legend-line"]'
            );
            for (const el of yAxisEls) {
              const text = (el.textContent || "").trim();
              const m = text.match(/^\$?\s*([0-9,.]+)\s*([KMBkmb])?$/);
              if (m) {
                let val = parseFloat(m[1].replace(/,/g, ""));
                const suffix = (m[2] || "").toUpperCase();
                if (suffix === "K")
                  val *= 1e3;
                else if (suffix === "M")
                  val *= 1e6;
                else if (suffix === "B")
                  val *= 1e9;
                if (val > 100 && val < 1e11)
                  return val;
              }
            }
            const allEls = doc.querySelectorAll("div, span");
            const limit = Math.min(allEls.length, 400);
            for (let i = 0; i < limit; i++) {
              const el = allEls[i];
              if (el.children.length > 10)
                continue;
              const text = el.textContent;
              if (!text || text.length > 200 || text.length < 3)
                continue;
              if (!text.includes("C ") && !text.includes("C\u2191") && !text.includes("C\u2193"))
                continue;
              const val = parseOhlcClose(text);
              if (val)
                return val;
            }
          } catch (e) {
          }
        }
      } catch (e) {
      }
      return null;
    };
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      try {
        const url = String(args?.[0]?.url || args?.[0] || "");
        if (/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
          const clone = res.clone();
          clone.json().then((json) => tryHandleJson(url, json, ctx)).catch(() => {
          });
        }
        if (SWAP_URL_PATTERNS.test(url)) {
          const clone2 = res.clone();
          clone2.json().then((json) => tryHandleSwap(url, json, ctx)).catch(() => {
          });
        }
      } catch {
      }
      return res;
    };
    const XHROpen = XMLHttpRequest.prototype.open;
    const XHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__paper_url = String(url || "");
      return XHROpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener("load", function() {
        try {
          const url = this.__paper_url || "";
          const ct = (this.getResponseHeader("content-type") || "").toLowerCase();
          if (/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
            if (ct.includes("json")) {
              const json = JSON.parse(this.responseText);
              tryHandleJson(url, json, ctx);
            }
          }
          if (SWAP_URL_PATTERNS.test(url) && ct.includes("json")) {
            const json = JSON.parse(this.responseText);
            tryHandleSwap(url, json, ctx);
          }
        } catch {
        }
      });
      return XHRSend.apply(this, args);
    };
    const OrigWS = window.WebSocket;
    window.WebSocket = function(...args) {
      const ws = new OrigWS(...args);
      const url = String(args?.[0] || "");
      ws.addEventListener("message", (ev) => {
        try {
          if (typeof ev.data === "string") {
            const s = ev.data.slice(0, MAX_SCAN_CHARS);
            if ((ctx.mint || ctx.symbol) && !looksRelatedByString(s, ctx))
              return;
            const json = safe(() => JSON.parse(s));
            if (json)
              tryHandleJson(url, json, ctx);
          }
        } catch {
        }
      });
      return ws;
    };
    window.WebSocket.prototype = OrigWS.prototype;
    window.addEventListener("message", (e) => {
      if (e.data?.__paper)
        return;
      try {
        const raw = typeof e.data === "string" ? e.data : null;
        const obj = typeof e.data === "object" ? e.data : raw ? safe(() => JSON.parse(raw)) : null;
        if (obj && (ctx.mint || ctx.symbol)) {
          const str = raw || JSON.stringify(obj);
          if (looksRelatedByString(str, ctx)) {
            tryHandleJson("postMessage", obj, ctx);
          }
        }
      } catch {
      }
    });
    let lastChartMCap = 0;
    const pollChartMCap = () => {
      if (ctx.refPrice <= 0 || ctx.refMCap <= 0)
        return;
      const mcap = scrapeChartMCap();
      if (!mcap)
        return;
      if (mcap === lastChartMCap)
        return;
      lastChartMCap = mcap;
      const inferredPrice = ctx.refPrice * (mcap / ctx.refMCap);
      if (inferredPrice > 0 && inferredPrice < 1e3) {
        console.log(
          `[ZER\xD8] Chart MCap\u2192Price: MCap=$${mcap.toLocaleString()} \u2192 $${inferredPrice.toFixed(10)}`
        );
        send({
          type: "PRICE_TICK",
          source: "chart",
          price: inferredPrice,
          chartMCap: mcap,
          confidence: 3,
          ts: Date.now()
        });
      }
    };
    setInterval(pollChartMCap, 200);
    const pollTvMCap = async () => {
      if (ctx.refPrice <= 0 || ctx.refMCap <= 0)
        return;
      const tv = findTV();
      if (!tv || !tv.activeChart)
        return;
      try {
        const chart = tv.activeChart();
        if (!ctx._tvApiLogged) {
          ctx._tvApiLogged = true;
          try {
            const proto = Object.getPrototypeOf(chart);
            const methods = Object.getOwnPropertyNames(proto).filter(
              (m) => typeof chart[m] === "function"
            );
            console.log("[ZER\xD8] TV chart API methods:", methods.join(", "));
          } catch (e) {
          }
        }
        if (typeof chart.exportData === "function") {
          const now = Math.floor(Date.now() / 1e3);
          const data = await chart.exportData({ from: now - 120, to: now + 60 });
          if (data?.data?.length > 0) {
            const last = data.data[data.data.length - 1];
            const close = last[4];
            if (close > 100 && close !== lastChartMCap) {
              lastChartMCap = close;
              const inferredPrice = ctx.refPrice * (close / ctx.refMCap);
              if (inferredPrice > 0 && inferredPrice < 1e3) {
                console.log(
                  `[ZER\xD8] TV API MCap\u2192Price: MCap=$${close.toLocaleString()} \u2192 $${inferredPrice.toFixed(10)}`
                );
                send({
                  type: "PRICE_TICK",
                  source: "chart-api",
                  price: inferredPrice,
                  chartMCap: close,
                  confidence: 3,
                  ts: Date.now()
                });
              }
            }
          }
        }
      } catch (e) {
      }
    };
    setInterval(pollTvMCap, 1e3);
    setupMessageListener(ctx);
  })();
})();
