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
  function tryDetectRpcSignature(json, args, ctx) {
    if (json?.jsonrpc !== "2.0")
      return;
    if (!json.result || typeof json.result !== "string")
      return;
    if (json.result.length < 64 || json.result.length > 100)
      return;
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(json.result))
      return;
    const signature = json.result;
    send({
      type: "SHADOW_SWAP_SIGNATURE",
      signature,
      mint: ctx.mint || null,
      symbol: ctx.symbol || null,
      ts: Date.now()
    });
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
      return;
    }
    const isSolInput = isSolMint(inputMint);
    const isSolOutput = isSolMint(outputMint);
    if (!isSolInput && !isSolOutput) {
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
  function _bs58encode(bytes) {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = 0n;
    for (const b of bytes)
      num = num * 256n + BigInt(b);
    let str = "";
    while (num > 0n) {
      str = ALPHABET[Number(num % 58n)] + str;
      num /= 58n;
    }
    for (let i = 0; i < bytes.length && bytes[i] === 0; i++)
      str = "1" + str;
    return str;
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
      const methods = ["signAndSendTransaction", "sendTransaction", "signTransaction"];
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
            } else if (result?.signature && typeof result.signature === "string") {
              signature = result.signature;
            }
            if (!signature) {
              try {
                const sigs = result?.signatures;
                if (Array.isArray(sigs) && sigs[0] instanceof Uint8Array && sigs[0].length === 64) {
                  if (sigs[0].some((b) => b !== 0))
                    signature = _bs58encode(sigs[0]);
                }
                if (!signature && result?.signature instanceof Uint8Array && result.signature.length === 64) {
                  if (result.signature.some((b) => b !== 0))
                    signature = _bs58encode(result.signature);
                }
              } catch {
              }
            }
            if (typeof signature === "string" && signature.length >= 30) {
              processSignature(signature, ctx);
            } else {
            }
          } catch (hookErr) {
          }
          return result;
        };
        _hooked.add(name);
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
      } else {
        send({
          type: "SHADOW_SWAP_SIGNATURE",
          signature,
          mint: ctx2.mint || null,
          symbol: ctx2.symbol || null,
          ts: Date.now()
        });
        return;
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
              ;
            continue;
          }
          const addr = typeof pk === "string" ? pk : pk.toBase58?.() || pk.toString?.();
          if (addr && addr.length >= 32 && addr.length <= 44) {
            if (!_capturedWalletAddr) {
            }
            _capturedWalletAddr = addr;
            return addr;
          } else if (verbose) {
          }
        } catch (err) {
          if (verbose)
            ;
        }
      }
      if (verbose && _pollCount === 1) {
        const walletGlobals = ["solana", "phantom", "solflare", "backpack", "coin98", "glow", "braveSolana", "exodus"].filter((k) => !!window[k]).join(", ");
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
            return frame.tradingViewApi;
          }
          if (frame.tvWidget && typeof frame.tvWidget.activeChart === "function") {
            return frame.tvWidget;
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
    return null;
  };
  var activeMarkers = [];
  var drawMarker = (trade) => {
    let attempts = 0;
    const maxAttempts = 20;
    const tryDraw = () => {
      attempts++;
      const tv = findTV();
      if (tv && tv.activeChart) {
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
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
      } else {
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
      }
      if (d.type === "PAPER_PRICE_REFERENCE") {
        ctx.refPrice = d.priceUsd || 0;
        ctx.refMCap = d.marketCapUsd || 0;
        if (onPriceReference)
          onPriceReference(ctx);
      }
      if (d.type === "PAPER_DRAW_MARKER") {
        drawMarker(d.trade);
      }
      if (d.type === "PAPER_DRAW_ALL") {
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
          } catch (err) {
          }
        }
      }
    });
  }

  // src/platforms/padre/bridge.padre.js
  (() => {
    const ctx = createContext();
    const HEADER_LABELS = {
      price: /^Price$/i,
      mc: /^(?:MC|MCap|Market\s*Cap)$/i,
      liquidity: /^(?:Liq|Liquidity)$/i,
      tpnl: /^T\.?\s*PNL$/i,
      invested: /^(?:Invested|Total\s*Invested|Inv|Buy\s*Value|Cost)$/i,
      sold: /^(?:Sold|Total\s*Sold|Sell\s*Value)$/i,
      remaining: /^(?:Remaining|Holdings?|Balance)$/i
    };
    const parseHeaderValue = (text) => {
      const neg = text.includes("-") ? -1 : 1;
      const clean = text.replace(/[^0-9.MKBmkb]/g, "");
      if (!clean)
        return null;
      const m = clean.match(/([0-9.]+)\s*([MKBmkb])?$/);
      if (!m)
        return null;
      let val = parseFloat(m[1]);
      if (isNaN(val))
        return null;
      const suffix = (m[2] || "").toUpperCase();
      if (suffix === "K")
        val *= 1e3;
      else if (suffix === "M")
        val *= 1e6;
      else if (suffix === "B")
        val *= 1e9;
      return val * neg;
    };
    const _posCache = {
      investedValEl: null,
      soldValEl: null,
      remainingValEl: null,
      tpnlValEl: null,
      lastDeepScan: 0,
      DEEP_SCAN_INTERVAL: 3e3
      // Re-discover elements every 3s
    };
    let _aggressiveScrapeUntil = 0;
    const POS_FIELD_KEYS = [
      ["invested", "investedValEl"],
      ["sold", "soldValEl"],
      ["remaining", "remainingValEl"],
      ["tpnl", "tpnlValEl"]
    ];
    function deepScanPositionFields() {
      const allEls = document.querySelectorAll("span, div, p, td, th, dt, dd, label");
      const limit = Math.min(allEls.length, 8e3);
      const posLabels = {
        invested: HEADER_LABELS.invested,
        sold: HEADER_LABELS.sold,
        remaining: HEADER_LABELS.remaining,
        tpnl: HEADER_LABELS.tpnl
      };
      for (let i = 0; i < limit; i++) {
        const el = allEls[i];
        if (el.children.length > 3)
          continue;
        const text = el.textContent?.trim();
        if (!text || text.length > 20)
          continue;
        for (const [key, pattern] of Object.entries(posLabels)) {
          if (!pattern.test(text))
            continue;
          const cacheKey = key + "ValEl";
          if (_posCache[cacheKey] && _posCache[cacheKey].isConnected)
            continue;
          const valueEl = el.nextElementSibling || el.parentElement?.nextElementSibling?.querySelector("span, div, p") || el.parentElement?.nextElementSibling || (i + 1 < limit ? allEls[i + 1] : null);
          if (!valueEl)
            continue;
          _posCache[cacheKey] = valueEl;
        }
      }
    }
    function readCachedPosField(cacheKey) {
      const el = _posCache[cacheKey];
      if (!el || !el.isConnected)
        return void 0;
      const val = parseHeaderValue(el.textContent?.trim() || "");
      return val !== null ? val : void 0;
    }
    const scrapePadreHeader = () => {
      try {
        const results = {};
        const allEls = document.querySelectorAll("span, div, p, td, th, dt, dd, label");
        const limit = Math.min(allEls.length, 2e3);
        for (let i = 0; i < limit; i++) {
          const el = allEls[i];
          if (el.children.length > 3)
            continue;
          const text = el.textContent?.trim();
          if (!text || text.length > 20)
            continue;
          for (const [key, pattern] of Object.entries(HEADER_LABELS)) {
            if (results[key] !== void 0)
              continue;
            if (!pattern.test(text))
              continue;
            const valueEl = el.nextElementSibling || el.parentElement?.nextElementSibling?.querySelector("span, div, p") || el.parentElement?.nextElementSibling || (i + 1 < limit ? allEls[i + 1] : null);
            if (!valueEl)
              continue;
            const valText = valueEl.textContent?.trim();
            if (!valText)
              continue;
            const parsed = parseHeaderValue(valText);
            if (parsed !== null) {
              results[key] = parsed;
              const cacheKey = key + "ValEl";
              if (cacheKey in _posCache)
                _posCache[cacheKey] = valueEl;
            }
          }
        }
        for (const [key, cacheKey] of POS_FIELD_KEYS) {
          if (results[key] !== void 0)
            continue;
          const val = readCachedPosField(cacheKey);
          if (val !== void 0)
            results[key] = val;
        }
        const now = Date.now();
        const isAggressive = now < _aggressiveScrapeUntil;
        const shouldDeepScan = now - _posCache.lastDeepScan > _posCache.DEEP_SCAN_INTERVAL || isAggressive;
        if (shouldDeepScan && (results.invested === void 0 || results.sold === void 0)) {
          _posCache.lastDeepScan = now;
          deepScanPositionFields();
          for (const [key, cacheKey] of POS_FIELD_KEYS) {
            if (results[key] !== void 0)
              continue;
            const val = readCachedPosField(cacheKey);
            if (val !== void 0)
              results[key] = val;
          }
        }
        return Object.keys(results).length > 0 ? results : null;
      } catch (e) {
      }
      return null;
    };
    const _td = {
      lastInvested: null,
      // null = never seen
      lastSold: null,
      // null = never seen
      lastMint: null,
      settledAt: 0,
      // timestamp when mint change is "settled" (DOM stabilized)
      MIN_DELTA: 5e-3,
      // $0.005 minimum to filter noise
      SETTLE_MS: 1500
      // wait 1.5s after mint change before detecting
    };
    function invalidatePosCache() {
      _posCache.investedValEl = null;
      _posCache.soldValEl = null;
      _posCache.remainingValEl = null;
      _posCache.tpnlValEl = null;
      _posCache.lastDeepScan = 0;
    }
    function detectHeaderTrade(h) {
      const mint = ctx.mint;
      if (!mint)
        return;
      if (mint !== _td.lastMint) {
        _td.lastMint = mint;
        _td.settledAt = Date.now() + _td.SETTLE_MS;
        _td.lastInvested = h.invested !== void 0 ? h.invested : null;
        _td.lastSold = h.sold !== void 0 ? h.sold : null;
        return;
      }
      if (Date.now() < _td.settledAt)
        return;
      const invested = h.invested;
      const sold = h.sold;
      if (invested !== void 0 && invested > 0) {
        if (_td.lastInvested === null) {
          if (invested > _td.MIN_DELTA) {
            _td.lastInvested = invested;
            invalidatePosCache();
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
              ts: Date.now()
            });
          }
        } else if (invested > _td.lastInvested) {
          const delta = invested - _td.lastInvested;
          _td.lastInvested = invested;
          invalidatePosCache();
          if (delta > _td.MIN_DELTA) {
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
              ts: Date.now()
            });
          }
        }
      }
      if (sold !== void 0 && sold > 0) {
        if (_td.lastSold === null) {
          if (sold > _td.MIN_DELTA) {
            _td.lastSold = sold;
            invalidatePosCache();
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
              ts: Date.now()
            });
          }
        } else if (sold > _td.lastSold) {
          const delta = sold - _td.lastSold;
          _td.lastSold = sold;
          invalidatePosCache();
          if (delta > _td.MIN_DELTA) {
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
              ts: Date.now()
            });
          }
        }
      }
    }
    let lastHeaderPrice = 0;
    let lastHeaderMCap = 0;
    let _headerLogMint = null;
    let _headerDiagTimer = 0;
    const pollPadreHeader = () => {
      const h = scrapePadreHeader();
      if (!h)
        return;
      if (ctx.mint && ctx.mint !== _headerLogMint) {
        _headerLogMint = ctx.mint;
      }
      const now = Date.now();
      if (now > _headerDiagTimer) {
        _headerDiagTimer = now + 1e4;
      }
      if (h.price && h.price > 0 && h.price !== lastHeaderPrice) {
        lastHeaderPrice = h.price;
        send({
          type: "PRICE_TICK",
          source: "padre-header",
          price: h.price,
          chartMCap: h.mc || 0,
          confidence: 4,
          ts: Date.now()
        });
      }
      if (h.mc && h.mc > 0 && h.mc !== lastHeaderMCap) {
        lastHeaderMCap = h.mc;
        if (!h.price && lastHeaderPrice > 0) {
          send({
            type: "PRICE_TICK",
            source: "padre-header-mc",
            price: lastHeaderPrice,
            chartMCap: h.mc,
            confidence: 3,
            ts: Date.now()
          });
        }
      }
      if (h.tpnl !== void 0) {
        send({ type: "PADRE_PNL_TICK", tpnl: h.tpnl, ts: Date.now() });
      }
      detectHeaderTrade(h);
    };
    setInterval(pollPadreHeader, 200);
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
    const scrapePadreMCap = () => {
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
    try {
      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        const res = await origFetch(...args);
        try {
          const url = String(args?.[0]?.url || args?.[0] || "");
          const isApiUrl = /quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url);
          const isSwapUrl = SWAP_URL_PATTERNS.test(url);
          const isRpcUrl = /rpc|helius|quicknode|alchemy|triton|shyft/i.test(url);
          const contentType = res.headers?.get?.("content-type") || "";
          const isJson = contentType.includes("json") || isApiUrl || isSwapUrl || isRpcUrl;
          if (isJson) {
            const clone = res.clone();
            clone.json().then((json) => {
              cacheSwapQuote(json, ctx);
              if (isApiUrl)
                tryHandleJson(url, json, ctx);
              if (isSwapUrl) {
                const reqData = parseRequestBody(args);
                tryHandleSwap(url, json, ctx, reqData);
              }
              tryDetectRpcSignature(json, args, ctx);
            }).catch((err) => void 0);
          }
        } catch {
        }
        return res;
      };
      const _ourFetch = window.fetch;
      setTimeout(() => {
        if (window.fetch === _ourFetch) {
        } else {
        }
      }, 3e3);
    } catch (e) {
    }
    try {
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
                tryHandleSwap(url, json, ctx, xhrReqData);
              }
              tryDetectRpcSignature(json, [url, { body: sendArgs[0] }], ctx);
            }
          } catch (err) {
          }
        });
        return XHRSend.apply(this, sendArgs);
      };
    } catch (e) {
    }
    const PERFOBS_SWAP_PATH = /\/swap|\/execute|\/submit|send-?tx|confirm-?tx|transaction\/send|order\/place|\/jup|\/jupiter|\/raydium/i;
    const PERFOBS_TX_PATH = /sendTransaction|signTransaction/i;
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.initiatorType !== "fetch" && entry.initiatorType !== "xmlhttprequest")
            continue;
          const url = entry.name || "";
          let pathname = url;
          try {
            pathname = new URL(url).pathname;
          } catch {
          }
          if (PERFOBS_SWAP_PATH.test(pathname) || PERFOBS_TX_PATH.test(pathname)) {
            _aggressiveScrapeUntil = Date.now() + 5e3;
            _posCache.lastDeepScan = 0;
          }
        }
      });
      po.observe({ type: "resource", buffered: false });
    } catch (e) {
    }
    const setupPriceObserver = () => {
      if (!document.body)
        return;
      let _mutationTimer = null;
      const observer = new MutationObserver(() => {
        if (_mutationTimer)
          return;
        _mutationTimer = setTimeout(() => {
          _mutationTimer = null;
          pollPadreHeader();
        }, 100);
      });
      observer.observe(document.body, {
        characterData: true,
        childList: true,
        subtree: true
      });
    };
    if (document.body) {
      setupPriceObserver();
    } else {
      document.addEventListener("DOMContentLoaded", setupPriceObserver);
    }
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
      const mcap = scrapePadreMCap();
      if (!mcap)
        return;
      if (mcap === lastChartMCap)
        return;
      lastChartMCap = mcap;
      const inferredPrice = ctx.refPrice * (mcap / ctx.refMCap);
      if (inferredPrice > 0 && inferredPrice < 1e3) {
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
    let _tvExecHooked = false;
    function hookTvExecutionShapes() {
      if (_tvExecHooked)
        return;
      const tv = findTV();
      if (!tv || !tv.activeChart)
        return;
      try {
        const chart = tv.activeChart();
        if (typeof chart.createExecutionShape !== "function")
          return;
        const origCreate = chart.createExecutionShape.bind(chart);
        chart.createExecutionShape = function(...args) {
          const shape = origCreate(...args);
          const td = {};
          for (const [setter, key] of [["setDirection", "dir"], ["setPrice", "price"], ["setText", "text"], ["setTime", "time"]]) {
            if (typeof shape[setter] === "function") {
              const orig = shape[setter].bind(shape);
              shape[setter] = (val) => {
                td[key] = val;
                return orig(val);
              };
            }
          }
          setTimeout(() => {
            if (td.dir && td.text !== "BUY" && td.text !== "SELL") {
            }
          }, 0);
          return shape;
        };
        _tvExecHooked = true;
      } catch (e) {
      }
    }
    const pollTvMCap = async () => {
      hookTvExecutionShapes();
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
