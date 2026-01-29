/**
 * Main World Bridge
 * Runs natively in the page context (MAIN world) to access the TradingView widget.
 */
(() => {
    const CHANNEL = "__paper";
    console.log("[ZERØ] Main World Bridge Active (document_start, MAIN world).");

    const findTV = () => {
        // 1. Check main window (Standard & Padre)
        if (window.tvWidget && typeof window.tvWidget.activeChart === 'function') return window.tvWidget;
        if (window.tradingViewApi && typeof window.tradingViewApi.activeChart === 'function') return window.tradingViewApi;
        if (window.TradingView && window.TradingView.widget && typeof window.TradingView.widget.activeChart === 'function') return window.TradingView.widget;
        if (window.widget && typeof window.widget.activeChart === 'function') return window.widget;

        // 2. Check iframes (Axiom specific)
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

    const ctx = {
        mint: null,
        symbol: null,
        lastEmitAt: 0,
        minEmitGapMs: 150, // do not spam the content script
    };

    const MAX_SCAN_CHARS = 200_000;
    const safe = (fn) => { try { return fn(); } catch { return undefined; } };

    const send = (payload) => {
        window.postMessage({ [CHANNEL]: true, ...payload }, "*");
    };

    const isLikelySolanaMint = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || ""));
    const normalizeSymbol = (s) => String(s || "").trim().toUpperCase();

    const throttleEmit = () => {
        const t = Date.now();
        if (t - ctx.lastEmitAt < ctx.minEmitGapMs) return false;
        ctx.lastEmitAt = t;
        return true;
    };

    const looksRelatedByString = (rawStr) => {
        if (!rawStr) return false;
        // AGGRESSIVE TRUST: If we have context, we are MUCH more lenient.
        // We look for any price-like structure if we are on a known trading site.
        const s = rawStr.slice(0, MAX_SCAN_CHARS);
        const mint = ctx.mint;
        const sym = ctx.symbol;

        // If explicitly related, obviously true
        if (mint && s.includes(mint)) return true;
        if (sym && s.toUpperCase().includes(sym.toUpperCase())) return true;

        // FALLBACK: If we are on Axiom/Padre and see a tiny floating point number
        // in what looks like a ticker message (short string), we trust it.
        // This catches cases where the site only sends the price in a high-frequency stream.
        if (s.length < 500 && s.match(/"p":\s*0\.0/)) return true;
        if (s.length < 500 && s.match(/"price":\s*0\.0/)) return true;

        return false;
    };

    const extractPriceUsd = (obj) => {
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
    };

    const scrapeDomPrice = () => {
        try {
            const host = window.location.hostname;
            if (host.includes('axiom.trade')) {
                // 1. Target the specific Price element with sub-zero support
                // In Axiom, the price is often in an element that looks like $0.0{sub}181
                const priceHeaders = document.querySelectorAll('div[class*="TokenHeader_price"], div[class*="price-display"], div[class*="price_display"]');
                for (const priceHeader of priceHeaders) {
                    // Axiom uses <sub> or similar for leading zeros
                    let fullText = "";
                    priceHeader.childNodes.forEach(node => {
                        if (node.nodeType === 3) fullText += node.textContent; // Text node
                        else if (node.tagName === 'SUB' || node.classList?.contains('subscript') || (node.tagName === 'SPAN' && node.textContent.length <= 2)) {
                            // Subscript means N leading zeros
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

                    if (fullText.includes('$')) {
                        const val = parseFloat(fullText.replace(/[^0-9.]/g, ''));
                        if (val > 0 && val < 1000) return val;
                    }
                }

                // 2. Title fallback (Axiom: "WOOD wood coin $0.0000181")
                const mTitle = document.title.match(/\$([0-9.]+)/) || document.title.match(/([0-9.]+) \$/);
                if (mTitle) return parseFloat(mTitle[1]);

                // 3. Reconstruct from generic display
                const els = Array.from(document.querySelectorAll('div, span')).slice(0, 300);
                for (const el of els) {
                    const text = el.textContent.trim();
                    if (text.startsWith('$') && text.includes('0.0')) {
                        const val = parseFloat(text.slice(1).replace(/,/g, ''));
                        if (val > 0 && val < 0.1) return val;
                    }
                }
            } else if (host.includes('padre.gg')) {
                const mTitle = document.title.match(/\$([0-9.]+)/);
                if (mTitle) return parseFloat(mTitle[1]);
            }
        } catch (e) { }
        return null;
    };

    let lastDomPrice = 0;
    const pollDomPrice = () => {
        const p = scrapeDomPrice();
        if (p && p !== lastDomPrice) {
            lastDomPrice = p;
            // console.log(`[ZERØ] Price Scraped from DOM: $${p}`);
            send({
                type: "PRICE_TICK",
                source: "dom",
                price: p,
                confidence: 2,
                ts: Date.now()
            });
        }
    };

    // DOM Polling Loop (High Frequency)
    setInterval(pollDomPrice, 300);

    const tryHandleJson = (url, json) => {
        const isRelated = looksRelatedByString(JSON.stringify(json));
        const r = extractPriceUsd(json);

        if (r && isRelated) {
            if (!throttleEmit()) return;

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
    };

    // --- Hooks ---
    // Fetch
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
        const res = await origFetch(...args);
        try {
            const url = String(args?.[0]?.url || args?.[0] || "");
            if (/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
                const clone = res.clone();
                clone.json().then(json => tryHandleJson(url, json)).catch(() => { });
            }
        } catch { }
        return res;
    };

    // XHR
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
                if (/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
                    const ct = (this.getResponseHeader("content-type") || "").toLowerCase();
                    if (ct.includes("json")) {
                        const json = JSON.parse(this.responseText);
                        tryHandleJson(url, json);
                    }
                }
            } catch { }
        });
        return XHRSend.apply(this, args);
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
                    if ((ctx.mint || ctx.symbol) && !looksRelatedByString(s)) return;
                    const json = safe(() => JSON.parse(s));
                    if (json) tryHandleJson(url, json);
                }
            } catch { }
        });
        return ws;
    };
    window.WebSocket.prototype = OrigWS.prototype;

    const activeMarkers = [];

    const drawMarker = (trade) => {
        console.log("[ZERØ] drawMarker() called for", trade.side, trade.symbol);

        // Poll for TradingView widget if not immediately available
        let attempts = 0;
        const maxAttempts = 20; // Try for 2 seconds (20 * 100ms)

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
                        // Fallback to our best manual shape if createExecutionShape is missing
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

        // Start polling immediately and retry every 100ms
        const pollInterval = setInterval(tryDraw, 100);
        tryDraw(); // Try immediately first
    };

    window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data?.[CHANNEL]) return;
        const d = e.data;

        if (d.type === "PAPER_SET_CONTEXT") {
            const mint = isLikelySolanaMint(d.mint) ? d.mint : null;
            const sym = normalizeSymbol(d.symbol);
            ctx.mint = mint;
            ctx.symbol = sym || null;
            console.log("[ZERØ] Bridge Context Updated:", ctx.mint, ctx.symbol);
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
})();
