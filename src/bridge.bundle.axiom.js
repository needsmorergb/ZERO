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
  var SWAP_URL_PATTERNS = /swap|execute|submit|send-?tx|confirm-?tx|transaction\/send|order\/place|\/trade|\/order|jup|jupiter|raydium/i;
  function parseRequestBody(args) {
    try {
      let raw = args?.[1]?.body;
      if (!raw && args?.[0] && typeof args[0] === "object" && !(args[0] instanceof Response)) {
        raw = args[0].body;
      }
      if (!raw)
        return null;
      if (typeof raw === "string")
        return JSON.parse(raw);
      if (typeof raw === "object" && !(raw instanceof ReadableStream) && !(raw instanceof FormData) && !(raw instanceof Blob) && !(raw instanceof ArrayBuffer) && !(raw instanceof URLSearchParams)) {
        return raw;
      }
    } catch {
    }
    return null;
  }
  function parseSwapQueryParams(url) {
    try {
      const u = new URL(url, "https://placeholder.com");
      const p = u.searchParams;
      const result = {};
      for (const k of ["inputMint", "fromMint", "tokenIn", "sourceMint", "input_mint"]) {
        const v = p.get(k);
        if (v && isLikelySolanaMint(v)) {
          result.inputMint = v;
          break;
        }
      }
      for (const k of ["outputMint", "toMint", "tokenOut", "destMint", "output_mint"]) {
        const v = p.get(k);
        if (v && isLikelySolanaMint(v)) {
          result.outputMint = v;
          break;
        }
      }
      for (const k of ["inAmount", "inputAmount", "amountIn", "amount"]) {
        const v = p.get(k);
        if (v && Number.isFinite(parseFloat(v))) {
          result.inAmount = v;
          break;
        }
      }
      for (const k of ["outAmount", "outputAmount", "amountOut"]) {
        const v = p.get(k);
        if (v && Number.isFinite(parseFloat(v))) {
          result.outAmount = v;
          break;
        }
      }
      return result;
    } catch {
      return {};
    }
  }
  function tryHandleSwap(url, json, ctx, reqData) {
    if (!json || typeof json !== "object")
      return;
    const data = json.data || json.result || json;
    const txid = data.txid || data.signature || data.txSignature || data.transactionId || data.tx || data.hash;
    if (!txid || typeof txid !== "string" || txid.length < 30)
      return;
    const req = reqData ? reqData.data || reqData.result || reqData : {};
    const qp = parseSwapQueryParams(url);
    let inputMint = data.inputMint || data.fromMint || data.tokenIn || data.sourceMint || req.inputMint || req.fromMint || req.tokenIn || req.sourceMint || qp.inputMint;
    let outputMint = data.outputMint || data.toMint || data.tokenOut || data.destMint || req.outputMint || req.toMint || req.tokenOut || req.destMint || qp.outputMint;
    if (!inputMint || !outputMint) {
      console.log(`[ZER\xD8] Swap has txid=${txid.slice(0, 12)} but missing mints (checked response, request, URL) \u2014 url=${url.slice(0, 80)}`);
      console.log(`[ZER\xD8] Swap response keys: ${Object.keys(data).join(", ")}`);
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
    const inAmount = parseFloat(
      data.inAmount || data.inputAmount || data.amountIn || req.inAmount || req.inputAmount || req.amountIn || req.amount || qp.inAmount || 0
    );
    const outAmount = parseFloat(
      data.outAmount || data.outputAmount || data.amountOut || req.outAmount || req.outputAmount || req.amountOut || qp.outAmount || 0
    );
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
  var _quoteCache = [];
  var QUOTE_CACHE_SIZE = 5;
  var QUOTE_CACHE_TTL = 6e4;
  function cacheSwapQuote(json, ctx) {
    if (!json || typeof json !== "object")
      return;
    const data = json.data || json.result || json;
    if (!data || typeof data !== "object")
      return;
    const inputMint = data.inputMint || data.fromMint || data.tokenIn || data.sourceMint || data.inToken?.address || data.inputToken?.mint;
    const outputMint = data.outputMint || data.toMint || data.tokenOut || data.destMint || data.outToken?.address || data.outputToken?.mint;
    if (!inputMint || !outputMint)
      return;
    if (typeof inputMint !== "string" || typeof outputMint !== "string")
      return;
    if (inputMint.length < 30 || outputMint.length < 30)
      return;
    const inAmount = parseFloat(
      data.inAmount || data.inputAmount || data.amountIn || data.inToken?.amount || data.inputToken?.amount || 0
    );
    const outAmount = parseFloat(
      data.outAmount || data.outputAmount || data.amountOut || data.outToken?.amount || data.outputToken?.amount || 0
    );
    const symbol = data.outputSymbol || data.inputSymbol || data.outToken?.symbol || data.inToken?.symbol || ctx.symbol || null;
    const entry = {
      inputMint,
      outputMint,
      inAmount,
      outAmount,
      symbol,
      ts: Date.now()
    };
    _quoteCache.push(entry);
    if (_quoteCache.length > QUOTE_CACHE_SIZE)
      _quoteCache.shift();
    console.log(
      `[ZER\xD8] SwapDetection: Quote cached \u2014 ${inputMint.slice(0, 8)}\u2192${outputMint.slice(0, 8)}, in=${inAmount}, out=${outAmount}`
    );
  }
  function findBestQuote(ctx) {
    const now = Date.now();
    for (let i = _quoteCache.length - 1; i >= 0; i--) {
      const q = _quoteCache[i];
      if (now - q.ts > QUOTE_CACHE_TTL)
        continue;
      const hasSol = isSolMint(q.inputMint) || isSolMint(q.outputMint);
      const hasMint = !ctx.mint || q.inputMint === ctx.mint || q.outputMint === ctx.mint;
      if (hasSol && hasMint)
        return q;
    }
    return null;
  }
  function setupSwapDetection(ctx) {
    const WALLET_PROVIDERS = {
      "window.solana": () => window.solana,
      "phantom.solana": () => window.phantom?.solana,
      "solflare": () => window.solflare,
      "backpack.solana": () => window.backpack?.solana
    };
    const _hooked = /* @__PURE__ */ new Set();
    const hookProvider = (provider, name) => {
      if (!provider || _hooked.has(name))
        return;
      const methods = ["signAndSendTransaction", "sendTransaction"];
      for (const method of methods) {
        if (typeof provider[method] !== "function")
          continue;
        const origMethod = provider[method].bind(provider);
        provider[method] = async (...args) => {
          let result;
          try {
            result = await origMethod(...args);
          } catch (err) {
            throw err;
          }
          try {
            let signature = null;
            if (typeof result === "string") {
              signature = result;
            } else if (result?.signature) {
              signature = result.signature;
            } else if (result?.publicKey && result?.signature === void 0) {
              signature = null;
            }
            if (typeof signature === "string" && signature.length >= 30) {
              console.log(
                `[ZER\xD8] SwapDetection: ${method} returned sig=${signature.slice(0, 16)}...`
              );
              processSignature(signature, ctx);
            }
          } catch (hookErr) {
            console.warn("[ZER\xD8] SwapDetection: post-tx processing error:", hookErr);
          }
          return result;
        };
        _hooked.add(name);
        console.log(`[ZER\xD8] SwapDetection: Hooked ${name}.${method}`);
      }
    };
    const processSignature = (signature, ctx2) => {
      const quote = findBestQuote(ctx2);
      let side, mint, solAmount, tokenAmount, symbol;
      if (quote) {
        const isSolInput = isSolMint(quote.inputMint);
        side = isSolInput ? "BUY" : "SELL";
        mint = isSolInput ? quote.outputMint : quote.inputMint;
        const solLamports = isSolInput ? quote.inAmount : quote.outAmount;
        const tokenRaw = isSolInput ? quote.outAmount : quote.inAmount;
        solAmount = solLamports > 1e3 ? solLamports / 1e9 : solLamports;
        tokenAmount = tokenRaw;
        symbol = quote.symbol;
        console.log(
          `[ZER\xD8] SwapDetection: Matched quote \u2014 ${side} ${symbol || mint.slice(0, 8)}, ${solAmount.toFixed(4)} SOL, sig=${signature.slice(0, 12)}...`
        );
      } else {
        if (!ctx2.mint) {
          console.warn(
            "[ZER\xD8] SwapDetection: No cached quote and no ctx.mint \u2014 cannot determine trade"
          );
          return;
        }
        mint = ctx2.mint;
        symbol = ctx2.symbol;
        side = "BUY";
        solAmount = 0;
        tokenAmount = 0;
        console.warn(
          `[ZER\xD8] SwapDetection: No cached quote \u2014 using ctx.mint=${mint.slice(0, 8)}, defaulting to BUY`
        );
      }
      send({
        type: "SHADOW_TRADE_DETECTED",
        side,
        mint,
        symbol,
        solAmount,
        tokenAmount,
        priceUsd: 0,
        // Will be filled by ShadowTradeIngestion from Market.price
        signature,
        source: "bridge-hook",
        ts: Date.now()
      });
    };
    let _pollAttempts = 0;
    const pollHook = () => {
      _pollAttempts++;
      for (const [name, getP] of Object.entries(WALLET_PROVIDERS)) {
        try {
          const p = getP();
          if (p)
            hookProvider(p, name);
        } catch {
        }
      }
    };
    pollHook();
    const hookPoll = setInterval(() => {
      pollHook();
      if (_pollAttempts >= 15) {
        clearInterval(hookPoll);
        if (_hooked.size === 0) {
          console.warn("[ZER\xD8] SwapDetection: No wallet providers found after 30s");
        }
      }
    }, 2e3);
  }
  var _capturedWalletAddr = null;
  function setupWalletAddressCapture() {
    const providerMap = {
      "window.solana": () => window.solana,
      "phantom.solana": () => window.phantom?.solana,
      "solflare": () => window.solflare,
      "backpack.solana": () => window.backpack?.solana,
      "coin98.sol": () => window.coin98?.sol,
      "glow": () => window.glow,
      "brave.solana": () => window.braveSolana,
      "exodus": () => window.exodus?.solana
    };
    let _pollCount = 0;
    const tryCapture = () => {
      _pollCount++;
      const verbose = _pollCount <= 3;
      for (const [name, getP] of Object.entries(providerMap)) {
        try {
          const p = getP();
          if (!p)
            continue;
          const pk = p.publicKey;
          if (!pk) {
            if (verbose)
              console.log(`[ZER\xD8] WalletCapture: ${name} found but publicKey is null (not connected?)`);
            continue;
          }
          const addr = typeof pk === "string" ? pk : pk.toBase58?.() || pk.toString?.();
          if (addr && addr.length >= 32 && addr.length <= 44) {
            if (!_capturedWalletAddr) {
              console.log(`[ZER\xD8] Wallet address captured via ${name}: ${addr.slice(0, 8)}...`);
            }
            _capturedWalletAddr = addr;
            return addr;
          } else if (verbose) {
            console.log(`[ZER\xD8] WalletCapture: ${name} publicKey invalid (${String(addr).slice(0, 20)})`);
          }
        } catch (err) {
          if (verbose)
            console.log(`[ZER\xD8] WalletCapture: ${name} error: ${err?.message || err}`);
        }
      }
      if (verbose && _pollCount === 1) {
        const walletGlobals = ["solana", "phantom", "solflare", "backpack", "coin98", "glow", "braveSolana", "exodus"].filter((k) => !!window[k]).join(", ");
        console.log(`[ZER\xD8] WalletCapture: window wallet globals found: [${walletGlobals || "none"}]`);
      }
      return null;
    };
    const poll = setInterval(() => {
      const addr = _capturedWalletAddr || tryCapture();
      if (addr) {
        send({ type: "WALLET_ADDRESS_DETECTED", walletAddress: addr });
      }
    }, 3e3);
    tryCapture();
    const listenForConnect = (providerGetter, name) => {
      try {
        const p = providerGetter();
        if (p && typeof p.on === "function") {
          p.on("connect", (pk) => {
            try {
              const addr = typeof pk === "string" ? pk : pk?.toBase58?.() || pk?.toString?.();
              if (addr && addr.length >= 32 && addr.length <= 44 && !_capturedWalletAddr) {
                console.log(`[ZER\xD8] Wallet connected via ${name} event: ${addr.slice(0, 8)}...`);
                _capturedWalletAddr = addr;
                send({ type: "WALLET_ADDRESS_DETECTED", walletAddress: addr });
              }
            } catch {
            }
          });
        }
      } catch {
      }
    };
    listenForConnect(() => window.solana, "solana");
    listenForConnect(() => window.phantom?.solana, "phantom");
    listenForConnect(() => window.solflare, "solflare");
    listenForConnect(() => window.backpack?.solana, "backpack");
    setTimeout(() => {
      listenForConnect(() => window.solana, "solana-delayed");
      listenForConnect(() => window.phantom?.solana, "phantom-delayed");
      listenForConnect(() => window.solflare, "solflare-delayed");
    }, 2e3);
    setTimeout(() => {
      clearInterval(poll);
      if (!_capturedWalletAddr) {
        console.warn("[ZER\xD8] WalletCapture: No wallet address found after 60s of polling");
      }
    }, 6e4);
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
        const isApiUrl = /quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url);
        const isSwapUrl = SWAP_URL_PATTERNS.test(url);
        const contentType = res.headers?.get?.("content-type") || "";
        const isJson = contentType.includes("json") || isApiUrl || isSwapUrl;
        if (isJson) {
          const clone = res.clone();
          clone.json().then((json) => {
            cacheSwapQuote(json, ctx);
            if (isApiUrl)
              tryHandleJson(url, json, ctx);
            if (isSwapUrl) {
              console.log(`[ZER\xD8] Swap URL matched: ${url}`);
              const reqData = parseRequestBody(args);
              tryHandleSwap(url, json, ctx, reqData);
            }
          }).catch((err) => console.warn("[ZER\xD8] Fetch parse error:", err.message, url));
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
    XMLHttpRequest.prototype.send = function(...sendArgs) {
      let xhrReqData = null;
      try {
        if (typeof sendArgs[0] === "string")
          xhrReqData = JSON.parse(sendArgs[0]);
      } catch {
      }
      this.addEventListener("load", function() {
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
              console.log(`[ZER\xD8] Swap URL matched (XHR): ${url}`);
              tryHandleSwap(url, json, ctx, xhrReqData);
            }
          }
        } catch (err) {
          console.warn("[ZER\xD8] XHR handler error:", err.message);
        }
      });
      return XHRSend.apply(this, sendArgs);
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
    setupSwapDetection(ctx);
    setupWalletAddressCapture();
  })();
})();
