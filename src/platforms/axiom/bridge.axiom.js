/**
 * Axiom Bridge (MAIN World)
 * Runs in page context on axiom.trade only.
 * Full network interception (fetch/XHR/WebSocket) + Axiom-specific DOM scraping.
 */
import {
    CHANNEL, MAX_SCAN_CHARS, safe, send,
    createContext, throttleEmit, looksRelatedByString,
    extractPriceUsd, tryHandleJson, findTV,
    setupMessageListener
} from '../shared/bridge-utils.js';

(() => {
    console.log("[ZERØ] Axiom Bridge Active (document_start, MAIN world).");

    const ctx = createContext();

    // --- Axiom-Specific DOM Price Scraping ---
    const scrapeDomPrice = () => {
        try {
            // 1. Target the specific Price element with sub-zero support
            // In Axiom, the price is often in an element that looks like $0.0{sub}181
            const priceHeaders = document.querySelectorAll('div[class*="TokenHeader_price"], div[class*="price-display"], div[class*="price_display"]');
            for (const priceHeader of priceHeaders) {
                let fullText = "";
                priceHeader.childNodes.forEach(node => {
                    if (node.nodeType === 3) fullText += node.textContent;
                    else if (node.tagName === 'SUB' || node.classList?.contains('subscript') || (node.tagName === 'SPAN' && node.textContent.length <= 2)) {
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
        } catch (e) { }
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

    // --- Full Network Hooks (safe on Axiom — no SES lockdown) ---

    // Fetch
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
        const res = await origFetch(...args);
        try {
            const url = String(args?.[0]?.url || args?.[0] || "");
            if (/quote|price|ticker|market|candles|kline|chart|pair|swap|route/i.test(url)) {
                const clone = res.clone();
                clone.json().then(json => tryHandleJson(url, json, ctx)).catch(() => { });
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
                        tryHandleJson(url, json, ctx);
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
                    if ((ctx.mint || ctx.symbol) && !looksRelatedByString(s, ctx)) return;
                    const json = safe(() => JSON.parse(s));
                    if (json) tryHandleJson(url, json, ctx);
                }
            } catch { }
        });
        return ws;
    };
    window.WebSocket.prototype = OrigWS.prototype;

    // --- Message Listener (shared handlers) ---
    setupMessageListener(ctx);
})();
