/**
 * Shared Bridge Utilities
 * Platform-independent helpers used by both Axiom and Padre bridges.
 * Runs in MAIN world (page context).
 */

export const CHANNEL = "__paper";

export const MAX_SCAN_CHARS = 200_000;

export const safe = (fn) => { try { return fn(); } catch { return undefined; } };

export const send = (payload) => {
    window.postMessage({ [CHANNEL]: true, ...payload }, "*");
};

export const isLikelySolanaMint = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ""));

export const normalizeSymbol = (s) => String(s || "").trim().toUpperCase();

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

    const preferred = ["priceUsd", "usdPrice", "price_usd", "markPriceUsd", "lastPriceUsd", "closeUsd"];
    const common = ["price", "last", "lastPrice", "markPrice", "close", "c", "p"];

    let found = null;
    let steps = 0;
    const MAX_STEPS = 500;

    const walk = (x) => {
        if (!x || found || steps > MAX_STEPS || typeof x !== 'object') return;
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
            ts: Date.now()
        });
    }
}

// --- Swap/Trade Detection for Shadow Mode ---

const SOL_MINTS = [
    'So11111111111111111111111111111111111111112',  // Wrapped SOL
    'So11111111111111111111111111111111111111111',   // Native SOL (rare in swap responses)
];

const isSolMint = (mint) => SOL_MINTS.some(m => mint === m);

export const SWAP_URL_PATTERNS = /swap|execute|submit|send-?tx|confirm-?tx|transaction\/send|order\/place/i;

export function tryHandleSwap(url, json, ctx) {
    if (!json || typeof json !== 'object') return;

    // Unwrap common response wrappers
    const data = json.data || json.result || json;

    // Must have a transaction signature (proof of on-chain execution)
    const txid = data.txid || data.signature || data.txSignature
        || data.transactionId || data.tx || data.hash;
    if (!txid || typeof txid !== 'string' || txid.length < 30) return;

    // Look for mint info — Jupiter v6 pattern is most common
    const inputMint = data.inputMint || data.fromMint || data.tokenIn || data.sourceMint;
    const outputMint = data.outputMint || data.toMint || data.tokenOut || data.destMint;

    if (!inputMint || !outputMint) {
        console.log(`[ZERØ] Swap response has txid but missing mints — url=${url}`);
        return;
    }

    // Determine side: SOL in = BUY token, SOL out = SELL token
    const isSolInput = isSolMint(inputMint);
    const isSolOutput = isSolMint(outputMint);

    if (!isSolInput && !isSolOutput) {
        console.log(`[ZERØ] Swap has no SOL side — skipping (${inputMint} → ${outputMint})`);
        return;
    }

    const side = isSolInput ? 'BUY' : 'SELL';
    const mint = isSolInput ? outputMint : inputMint;

    // Amounts (typically in lamports / smallest token units)
    const inAmount = parseFloat(data.inAmount || data.inputAmount || data.amountIn || 0);
    const outAmount = parseFloat(data.outAmount || data.outputAmount || data.amountOut || 0);

    // SOL amount: lamports → SOL (1 SOL = 1e9 lamports)
    const solLamports = isSolInput ? inAmount : outAmount;
    const tokenRaw = isSolInput ? outAmount : inAmount;
    const solAmount = solLamports > 1000 ? solLamports / 1e9 : solLamports; // Auto-detect if already in SOL vs lamports

    // Price info (optional — may be enriched later by content script)
    const priceUsd = parseFloat(data.priceUsd || data.price || data.tokenPriceUsd || 0);

    // Symbol (optional)
    const symbol = data.symbol || data.outputSymbol || data.inputSymbol || ctx.symbol || null;

    console.log(`[ZERØ] Swap Detected: ${side} ${symbol || mint.slice(0, 8)} — ${solAmount.toFixed(4)} SOL, tx=${txid.slice(0, 12)}...`);

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

export const findTV = () => {
    // 1. Check main window (Standard & Padre)
    if (window.tvWidget && typeof window.tvWidget.activeChart === 'function') return window.tvWidget;
    if (window.tradingViewApi && typeof window.tradingViewApi.activeChart === 'function') return window.tradingViewApi;
    if (window.TradingView && window.TradingView.widget && typeof window.TradingView.widget.activeChart === 'function') return window.TradingView.widget;
    if (window.widget && typeof window.widget.activeChart === 'function') return window.widget;

    // 2. Check iframes (Axiom specific — harmless no-op on Padre)
    try {
        for (let i = 0; i < window.frames.length; i++) {
            try {
                const frame = window.frames[i];
                if (frame.tradingViewApi && typeof frame.tradingViewApi.activeChart === 'function') {
                    console.log('[ZERØ] Found tradingViewApi in iframe[' + i + ']');
                    return frame.tradingViewApi;
                }
                if (frame.tvWidget && typeof frame.tvWidget.activeChart === 'function') {
                    console.log('[ZERØ] Found tvWidget in iframe[' + i + ']');
                    return frame.tvWidget;
                }
            } catch (e) { /* Cross-origin iframe, skip */ }
        }
    } catch (e) { console.log('[ZERØ] Error searching iframes:', e); }

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

                if (typeof chart.createExecutionShape === 'function') {
                    const shape = chart.createExecutionShape()
                        .setTime(ts)
                        .setPrice(chartPrice)
                        .setDirection(isBuy ? 'buy' : 'sell')
                        .setText(isBuy ? 'BUY' : 'SELL')
                        .setTextColor('#ffffff')
                        .setArrowColor(color)
                        .setArrowSpacing(8)
                        .setArrowHeight(22);

                    try { shape.setFont('bold 12px Inter'); } catch (e) { }
                    activeMarkers.push({ fmt: 'exec', ref: shape });
                } else {
                    const id = chart.createShape({ time: ts, location: isBuy ? "belowbar" : "abovebar" }, {
                        shape: "text",
                        lock: true,
                        text: isBuy ? "\n\n\n\n↑\nB" : "S\n↓\n\n\n\n",
                        overrides: { color, fontsize: 16, bold: true }
                    });
                    if (id) activeMarkers.push({ fmt: 'std', id: id });
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
                    activeMarkers.forEach(m => {
                        try {
                            if (m.fmt === 'exec' && m.ref && m.ref.remove) {
                                m.ref.remove();
                            } else if (m.fmt === 'std' && m.id) {
                                chart.removeEntity(m.id);
                            }
                        } catch (err) { }
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
