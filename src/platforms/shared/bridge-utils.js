/**
 * Shared Bridge Utilities
 * Platform-independent helpers used by both Axiom and Padre bridges.
 * Runs in MAIN world (page context).
 */

export const CHANNEL = "__paper";

export const MAX_SCAN_CHARS = 200_000;

export const safe = (fn) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

export const send = (payload) => {
  window.postMessage({ [CHANNEL]: true, ...payload }, "*");
};

export const isLikelySolanaMint = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ""));

export const normalizeSymbol = (s) =>
  String(s || "")
    .trim()
    .toUpperCase();

export function createContext() {
  return {
    mint: null,
    symbol: null,
    lastEmitAt: 0,
    minEmitGapMs: 150,
    refPrice: 0,
    refMCap: 0,
  };
}

export function throttleEmit(ctx) {
  const t = Date.now();
  if (t - ctx.lastEmitAt < ctx.minEmitGapMs) return false;
  ctx.lastEmitAt = t;
  return true;
}

export function looksRelatedByString(rawStr, ctx) {
  if (!rawStr) return false;
  const s = rawStr.slice(0, MAX_SCAN_CHARS);
  const mint = ctx.mint;
  const sym = ctx.symbol;

  if (mint && s.includes(mint)) return true;
  if (sym && s.toUpperCase().includes(sym.toUpperCase())) return true;

  if (s.length < 500 && s.match(/"p":\s*0\.0/)) return true;
  if (s.length < 500 && s.match(/"price":\s*0\.0/)) return true;

  return false;
}

export function extractPriceUsd(obj) {
  if (!obj || typeof obj !== "object") return null;

  const preferred = [
    "priceUsd",
    "usdPrice",
    "price_usd",
    "markPriceUsd",
    "lastPriceUsd",
    "closeUsd",
  ];
  const common = ["price", "last", "lastPrice", "markPrice", "close", "c", "p"];

  let found = null;
  let steps = 0;
  const MAX_STEPS = 500;

  const walk = (x) => {
    if (!x || found || steps > MAX_STEPS || typeof x !== "object") return;
    steps++;

    if (Array.isArray(x)) {
      for (const it of x) walk(it);
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
      if (found) return;
      walk(v);
    }
  };

  walk(obj);
  return found;
}

export function tryHandleJson(url, json, ctx) {
  const isRelated = looksRelatedByString(JSON.stringify(json), ctx);
  const r = extractPriceUsd(json);

  if (r && isRelated) {
    if (!throttleEmit(ctx)) return;

    console.log(`[ZERØ] Price Intercepted (Network): $${r.price} (from ${url})`);
    send({
      type: "PRICE_TICK",
      source: "site",
      url,
      price: r.price,
      confidence: r.confidence,
      key: r.key || null,
      ts: Date.now(),
    });
  }
}

// --- Swap/Trade Detection for Shadow Mode ---

const SOL_MINTS = [
  "So11111111111111111111111111111111111111112", // Wrapped SOL
  "So11111111111111111111111111111111111111111", // Native SOL (rare in swap responses)
];

const isSolMint = (mint) => SOL_MINTS.some((m) => mint === m);

export const SWAP_URL_PATTERNS =
  /swap|execute|submit|send-?tx|confirm-?tx|transaction\/send|order\/place|\/trade|\/order|jup|jupiter|raydium/i;

/**
 * Safely extract JSON from a fetch request's body (args[1]?.body or args[0]?.body).
 * Returns parsed object or null.
 */
export function parseRequestBody(args) {
  try {
    let raw = args?.[1]?.body;
    if (!raw && args?.[0] && typeof args[0] === "object" && !(args[0] instanceof Response)) {
      raw = args[0].body;
    }
    if (!raw) return null;
    if (typeof raw === "string") return JSON.parse(raw);
    if (typeof raw === "object" && !(raw instanceof ReadableStream) && !(raw instanceof FormData) && !(raw instanceof Blob) && !(raw instanceof ArrayBuffer) && !(raw instanceof URLSearchParams)) {
      return raw;
    }
  } catch { /* not JSON */ }
  return null;
}

/**
 * Extract swap-related query parameters from a URL string.
 */
function parseSwapQueryParams(url) {
  try {
    const u = new URL(url, "https://placeholder.com");
    const p = u.searchParams;
    const result = {};
    for (const k of ["inputMint", "fromMint", "tokenIn", "sourceMint", "input_mint"]) {
      const v = p.get(k);
      if (v && isLikelySolanaMint(v)) { result.inputMint = v; break; }
    }
    for (const k of ["outputMint", "toMint", "tokenOut", "destMint", "output_mint"]) {
      const v = p.get(k);
      if (v && isLikelySolanaMint(v)) { result.outputMint = v; break; }
    }
    for (const k of ["inAmount", "inputAmount", "amountIn", "amount"]) {
      const v = p.get(k);
      if (v && Number.isFinite(parseFloat(v))) { result.inAmount = v; break; }
    }
    for (const k of ["outAmount", "outputAmount", "amountOut"]) {
      const v = p.get(k);
      if (v && Number.isFinite(parseFloat(v))) { result.outAmount = v; break; }
    }
    return result;
  } catch { return {}; }
}

export function tryHandleSwap(url, json, ctx, reqData) {
  if (!json || typeof json !== "object") return;

  // Unwrap common response wrappers
  const data = json.data || json.result || json;

  // Must have a transaction signature (proof of on-chain execution)
  const txid =
    data.txid || data.signature || data.txSignature || data.transactionId || data.tx || data.hash;
  if (!txid || typeof txid !== "string" || txid.length < 30) return;

  // Look for mint info — response first, then request body, then URL query params
  const req = reqData ? (reqData.data || reqData.result || reqData) : {};
  const qp = parseSwapQueryParams(url);

  let inputMint =
    data.inputMint || data.fromMint || data.tokenIn || data.sourceMint ||
    req.inputMint || req.fromMint || req.tokenIn || req.sourceMint ||
    qp.inputMint;
  let outputMint =
    data.outputMint || data.toMint || data.tokenOut || data.destMint ||
    req.outputMint || req.toMint || req.tokenOut || req.destMint ||
    qp.outputMint;

  if (!inputMint || !outputMint) {
    console.log(`[ZERØ] Swap has txid=${txid.slice(0, 12)} but missing mints (checked response, request, URL) — url=${url.slice(0, 80)}`);
    console.log(`[ZERØ] Swap response keys: ${Object.keys(data).join(", ")}`);
    return;
  }

  // Determine side: SOL in = BUY token, SOL out = SELL token
  const isSolInput = isSolMint(inputMint);
  const isSolOutput = isSolMint(outputMint);

  if (!isSolInput && !isSolOutput) {
    console.log(`[ZERØ] Swap has no SOL side — skipping (${inputMint} → ${outputMint})`);
    return;
  }

  const side = isSolInput ? "BUY" : "SELL";
  const mint = isSolInput ? outputMint : inputMint;

  // Amounts — response first, then request body, then URL query params
  const inAmount = parseFloat(
    data.inAmount || data.inputAmount || data.amountIn ||
    req.inAmount || req.inputAmount || req.amountIn || req.amount ||
    qp.inAmount || 0
  );
  const outAmount = parseFloat(
    data.outAmount || data.outputAmount || data.amountOut ||
    req.outAmount || req.outputAmount || req.amountOut ||
    qp.outAmount || 0
  );

  // SOL amount: lamports → SOL (1 SOL = 1e9 lamports)
  const solLamports = isSolInput ? inAmount : outAmount;
  const tokenRaw = isSolInput ? outAmount : inAmount;
  const solAmount = solLamports > 1000 ? solLamports / 1e9 : solLamports; // Auto-detect if already in SOL vs lamports

  // Price info (optional — may be enriched later by content script)
  const priceUsd = parseFloat(data.priceUsd || data.price || data.tokenPriceUsd || 0);

  // Symbol (optional)
  const symbol = data.symbol || data.outputSymbol || data.inputSymbol || ctx.symbol || null;

  console.log(
    `[ZERØ] Swap Detected: ${side} ${symbol || mint.slice(0, 8)} — ${solAmount.toFixed(4)} SOL, tx=${txid.slice(0, 12)}...`
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
    ts: Date.now(),
  });
}

// --- Swap Quote Cache + signAndSendTransaction Hook for Shadow Mode ---

const _quoteCache = []; // Ring buffer of recent swap quotes
const QUOTE_CACHE_SIZE = 5;
const QUOTE_CACHE_TTL = 60_000; // 60s

export function cacheSwapQuote(json, ctx) {
  if (!json || typeof json !== "object") return;

  // Unwrap common response wrappers
  const data = json.data || json.result || json;
  if (!data || typeof data !== "object") return;

  // Detect quote-shaped data: must have input + output mint fields
  const inputMint =
    data.inputMint || data.fromMint || data.tokenIn || data.sourceMint ||
    data.inToken?.address || data.inputToken?.mint;
  const outputMint =
    data.outputMint || data.toMint || data.tokenOut || data.destMint ||
    data.outToken?.address || data.outputToken?.mint;

  if (!inputMint || !outputMint) return;
  if (typeof inputMint !== "string" || typeof outputMint !== "string") return;
  if (inputMint.length < 30 || outputMint.length < 30) return;

  const inAmount = parseFloat(
    data.inAmount || data.inputAmount || data.amountIn ||
    data.inToken?.amount || data.inputToken?.amount || 0
  );
  const outAmount = parseFloat(
    data.outAmount || data.outputAmount || data.amountOut ||
    data.outToken?.amount || data.outputToken?.amount || 0
  );

  const symbol =
    data.outputSymbol || data.inputSymbol || data.outToken?.symbol ||
    data.inToken?.symbol || ctx.symbol || null;

  const entry = {
    inputMint,
    outputMint,
    inAmount,
    outAmount,
    symbol,
    ts: Date.now(),
  };

  // Ring buffer: push new, evict oldest if over limit
  _quoteCache.push(entry);
  if (_quoteCache.length > QUOTE_CACHE_SIZE) _quoteCache.shift();

  console.log(
    `[ZERØ] SwapDetection: Quote cached — ${inputMint.slice(0, 8)}→${outputMint.slice(0, 8)}, in=${inAmount}, out=${outAmount}`
  );
}

function findBestQuote(ctx) {
  const now = Date.now();
  // Search from most recent
  for (let i = _quoteCache.length - 1; i >= 0; i--) {
    const q = _quoteCache[i];
    if (now - q.ts > QUOTE_CACHE_TTL) continue;
    // Match: one side should be SOL, other should match ctx.mint
    const hasSol = isSolMint(q.inputMint) || isSolMint(q.outputMint);
    const hasMint = !ctx.mint || q.inputMint === ctx.mint || q.outputMint === ctx.mint;
    if (hasSol && hasMint) return q;
  }
  return null;
}

export function setupSwapDetection(ctx) {
  const WALLET_PROVIDERS = {
    "window.solana": () => window.solana,
    "phantom.solana": () => window.phantom?.solana,
    "solflare": () => window.solflare,
    "backpack.solana": () => window.backpack?.solana,
  };

  const _hooked = new Set();

  const hookProvider = (provider, name) => {
    if (!provider || _hooked.has(name)) return;

    // Hook signAndSendTransaction
    const methods = ["signAndSendTransaction", "sendTransaction"];
    for (const method of methods) {
      if (typeof provider[method] !== "function") continue;
      const origMethod = provider[method].bind(provider);
      provider[method] = async (...args) => {
        let result;
        try {
          result = await origMethod(...args);
        } catch (err) {
          // CRITICAL: Never swallow wallet errors — re-throw immediately
          throw err;
        }

        // Process successful transaction (in try/catch — never break user's flow)
        try {
          // Extract signature from result
          let signature = null;
          if (typeof result === "string") {
            signature = result;
          } else if (result?.signature) {
            signature = result.signature;
          } else if (result?.publicKey && result?.signature === undefined) {
            // Some wallets return { publicKey, signature } where signature is the tx sig
            signature = null;
          }

          if (typeof signature === "string" && signature.length >= 30) {
            console.log(
              `[ZERØ] SwapDetection: ${method} returned sig=${signature.slice(0, 16)}...`
            );
            processSignature(signature, ctx);
          }
        } catch (hookErr) {
          console.warn("[ZERØ] SwapDetection: post-tx processing error:", hookErr);
        }

        return result;
      };

      _hooked.add(name);
      console.log(`[ZERØ] SwapDetection: Hooked ${name}.${method}`);
    }
  };

  const processSignature = (signature, ctx) => {
    const quote = findBestQuote(ctx);

    let side, mint, solAmount, tokenAmount, symbol;

    if (quote) {
      const isSolInput = isSolMint(quote.inputMint);
      side = isSolInput ? "BUY" : "SELL";
      mint = isSolInput ? quote.outputMint : quote.inputMint;

      const solLamports = isSolInput ? quote.inAmount : quote.outAmount;
      const tokenRaw = isSolInput ? quote.outAmount : quote.inAmount;
      solAmount = solLamports > 1000 ? solLamports / 1e9 : solLamports;
      tokenAmount = tokenRaw;
      symbol = quote.symbol;

      console.log(
        `[ZERØ] SwapDetection: Matched quote — ${side} ${symbol || mint.slice(0, 8)}, ${solAmount.toFixed(4)} SOL, sig=${signature.slice(0, 12)}...`
      );
    } else {
      // No cached quote — use context as fallback
      if (!ctx.mint) {
        console.warn(
          "[ZERØ] SwapDetection: No cached quote and no ctx.mint — cannot determine trade"
        );
        return;
      }
      mint = ctx.mint;
      symbol = ctx.symbol;
      side = "BUY"; // Default assumption — most trades are buys
      solAmount = 0; // Will need to be filled by ShadowTradeIngestion
      tokenAmount = 0;
      console.warn(
        `[ZERØ] SwapDetection: No cached quote — using ctx.mint=${mint.slice(0, 8)}, defaulting to BUY`
      );
    }

    send({
      type: "SHADOW_TRADE_DETECTED",
      side,
      mint,
      symbol,
      solAmount,
      tokenAmount,
      priceUsd: 0, // Will be filled by ShadowTradeIngestion from Market.price
      signature,
      source: "bridge-hook",
      ts: Date.now(),
    });
  };

  // Poll for wallet providers and hook them as they appear
  let _pollAttempts = 0;
  const pollHook = () => {
    _pollAttempts++;
    for (const [name, getP] of Object.entries(WALLET_PROVIDERS)) {
      try {
        const p = getP();
        if (p) hookProvider(p, name);
      } catch { /* swallowed */ }
    }
  };

  // Immediately try
  pollHook();

  // Retry every 2s for 30s
  const hookPoll = setInterval(() => {
    pollHook();
    if (_pollAttempts >= 15) {
      clearInterval(hookPoll);
      if (_hooked.size === 0) {
        console.warn("[ZERØ] SwapDetection: No wallet providers found after 30s");
      }
    }
  }, 2000);
}

// --- Wallet Address Detection for Shadow Mode Balance ---

let _capturedWalletAddr = null;

export function setupWalletAddressCapture() {
  const providerMap = {
    "window.solana": () => window.solana,
    "phantom.solana": () => window.phantom?.solana,
    "solflare": () => window.solflare,
    "backpack.solana": () => window.backpack?.solana,
    "coin98.sol": () => window.coin98?.sol,
    "glow": () => window.glow,
    "brave.solana": () => window.braveSolana,
    "exodus": () => window.exodus?.solana,
  };

  let _pollCount = 0;

  const tryCapture = () => {
    _pollCount++;
    const verbose = _pollCount <= 3; // Log details for first 3 attempts

    for (const [name, getP] of Object.entries(providerMap)) {
      try {
        const p = getP();
        if (!p) continue;
        const pk = p.publicKey;
        if (!pk) {
          if (verbose) console.log(`[ZERØ] WalletCapture: ${name} found but publicKey is null (not connected?)`);
          continue;
        }
        const addr = typeof pk === "string" ? pk : pk.toBase58?.() || pk.toString?.();
        if (addr && addr.length >= 32 && addr.length <= 44) {
          if (!_capturedWalletAddr) {
            console.log(`[ZERØ] Wallet address captured via ${name}: ${addr.slice(0, 8)}...`);
          }
          _capturedWalletAddr = addr;
          return addr;
        } else if (verbose) {
          console.log(`[ZERØ] WalletCapture: ${name} publicKey invalid (${String(addr).slice(0, 20)})`);
        }
      } catch (err) {
        if (verbose) console.log(`[ZERØ] WalletCapture: ${name} error: ${err?.message || err}`);
      }
    }

    if (verbose && _pollCount === 1) {
      // Also log what globals exist for debugging
      const walletGlobals = ["solana", "phantom", "solflare", "backpack", "coin98", "glow", "braveSolana", "exodus"]
        .filter(k => !!window[k])
        .join(", ");
      console.log(`[ZERØ] WalletCapture: window wallet globals found: [${walletGlobals || "none"}]`);
    }

    return null;
  };

  // Keep broadcasting the address for 60 seconds so the content script catches it
  // regardless of when it registers its listener. The content script deduplicates.
  const poll = setInterval(() => {
    const addr = _capturedWalletAddr || tryCapture();
    if (addr) {
      send({ type: "WALLET_ADDRESS_DETECTED", walletAddress: addr });
    }
  }, 3000);

  // Try immediately
  tryCapture();

  // Also listen for wallet adapter 'connect' events (fires when user connects wallet)
  const listenForConnect = (providerGetter, name) => {
    try {
      const p = providerGetter();
      if (p && typeof p.on === "function") {
        p.on("connect", (pk) => {
          try {
            const addr = typeof pk === "string" ? pk : pk?.toBase58?.() || pk?.toString?.();
            if (addr && addr.length >= 32 && addr.length <= 44 && !_capturedWalletAddr) {
              console.log(`[ZERØ] Wallet connected via ${name} event: ${addr.slice(0, 8)}...`);
              _capturedWalletAddr = addr;
              send({ type: "WALLET_ADDRESS_DETECTED", walletAddress: addr });
            }
          } catch { /* swallowed */ }
        });
      }
    } catch { /* swallowed */ }
  };

  // Register connect listeners (safe — no-op if provider doesn't exist yet)
  listenForConnect(() => window.solana, "solana");
  listenForConnect(() => window.phantom?.solana, "phantom");
  listenForConnect(() => window.solflare, "solflare");
  listenForConnect(() => window.backpack?.solana, "backpack");

  // Retry registering connect listeners after 2s (providers may inject late)
  setTimeout(() => {
    listenForConnect(() => window.solana, "solana-delayed");
    listenForConnect(() => window.phantom?.solana, "phantom-delayed");
    listenForConnect(() => window.solflare, "solflare-delayed");
  }, 2000);

  // Stop polling after 60 seconds (extended from 30 — some DApps lazy-connect)
  // Connect event listeners stay active indefinitely
  setTimeout(() => {
    clearInterval(poll);
    if (!_capturedWalletAddr) {
      console.warn("[ZERØ] WalletCapture: No wallet address found after 60s of polling");
    }
  }, 60000);
}

export const findTV = () => {
  // 1. Check main window (Standard & Padre)
  if (window.tvWidget && typeof window.tvWidget.activeChart === "function") return window.tvWidget;
  if (window.tradingViewApi && typeof window.tradingViewApi.activeChart === "function")
    return window.tradingViewApi;
  if (
    window.TradingView &&
    window.TradingView.widget &&
    typeof window.TradingView.widget.activeChart === "function"
  )
    return window.TradingView.widget;
  if (window.widget && typeof window.widget.activeChart === "function") return window.widget;

  // 2. Check iframes (Axiom specific — harmless no-op on Padre)
  try {
    for (let i = 0; i < window.frames.length; i++) {
      try {
        const frame = window.frames[i];
        if (frame.tradingViewApi && typeof frame.tradingViewApi.activeChart === "function") {
          console.log("[ZERØ] Found tradingViewApi in iframe[" + i + "]");
          return frame.tradingViewApi;
        }
        if (frame.tvWidget && typeof frame.tvWidget.activeChart === "function") {
          console.log("[ZERØ] Found tvWidget in iframe[" + i + "]");
          return frame.tvWidget;
        }
      } catch (e) {
        /* Cross-origin iframe, skip */
      }
    }
  } catch (e) {
    console.log("[ZERØ] Error searching iframes:", e);
  }

  return null;
};

export const activeMarkers = [];

export const drawMarker = (trade) => {
  console.log("[ZERØ] drawMarker() called for", trade.side, trade.symbol);

  let attempts = 0;
  const maxAttempts = 20;

  const tryDraw = () => {
    attempts++;
    const tv = findTV();
    if (tv && tv.activeChart) {
      console.log("[ZERØ] TradingView widget found, drawing marker...");
      clearInterval(pollInterval);
      try {
        const chart = tv.activeChart();
        const side = (trade.side || "").toUpperCase();
        const isBuy = side === "BUY";

        const ts = Math.floor(trade.ts / 1000);
        const chartPrice = trade.marketCap || trade.priceUsd;
        const color = isBuy ? "#10b981" : "#ef4444";

        if (typeof chart.createExecutionShape === "function") {
          const shape = chart
            .createExecutionShape()
            .setTime(ts)
            .setPrice(chartPrice)
            .setDirection(isBuy ? "buy" : "sell")
            .setText(isBuy ? "BUY" : "SELL")
            .setTextColor("#ffffff")
            .setArrowColor(color)
            .setArrowSpacing(8)
            .setArrowHeight(22);

          try {
            shape.setFont("bold 12px Inter");
          } catch (e) { /* swallowed */ }
          activeMarkers.push({ fmt: "exec", ref: shape });
        } else {
          const id = chart.createShape(
            { time: ts, location: isBuy ? "belowbar" : "abovebar" },
            {
              shape: "text",
              lock: true,
              text: isBuy ? "\n\n\n\n↑\nB" : "S\n↓\n\n\n\n",
              overrides: { color, fontsize: 16, bold: true },
            }
          );
          if (id) activeMarkers.push({ fmt: "std", id: id });
        }
      } catch (e) {
        console.warn("[ZERØ] Marker failed:", e);
      }
    } else if (attempts >= maxAttempts) {
      console.warn(`[ZERØ] TradingView widget not found after ${maxAttempts} attempts`);
      clearInterval(pollInterval);
    } else {
      console.log(`[ZERØ] TradingView widget not found yet, attempt ${attempts}/${maxAttempts}`);
    }
  };

  const pollInterval = setInterval(tryDraw, 100);
  tryDraw();
};

export function setupMessageListener(ctx, opts = {}) {
  const { onPriceReference } = opts;

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data?.[CHANNEL]) return;
    const d = e.data;

    if (d.type === "PAPER_SET_CONTEXT") {
      const mint = isLikelySolanaMint(d.mint) ? d.mint : null;
      const sym = normalizeSymbol(d.symbol);
      ctx.mint = mint;
      ctx.symbol = sym || null;
      ctx.refPrice = 0;
      ctx.refMCap = 0;
      console.log("[ZERØ] Bridge Context Updated:", ctx.mint, ctx.symbol);
    }

    if (d.type === "PAPER_PRICE_REFERENCE") {
      ctx.refPrice = d.priceUsd || 0;
      ctx.refMCap = d.marketCapUsd || 0;
      console.log(`[ZERØ] Price Reference: $${ctx.refPrice}, MCap: $${ctx.refMCap}`);
      if (onPriceReference) onPriceReference(ctx);
    }

    if (d.type === "PAPER_DRAW_MARKER") {
      drawMarker(d.trade);
    }
    if (d.type === "PAPER_DRAW_ALL") {
      console.log("[ZERØ] Drawing", (d.trades || []).length, "markers");
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
            } catch (err) { /* swallowed */ }
          });
          activeMarkers.length = 0;
          if (chart.removeAllShapes) chart.removeAllShapes();
          console.log("[ZERØ] Markers cleared.");
        } catch (err) {
          console.warn("[ZERØ] Failed to clear markers:", err);
        }
      }
    }
  });
}
