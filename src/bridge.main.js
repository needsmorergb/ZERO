/**
 * Main World Bridge
 * Runs natively in the page context (MAIN world) to access the TradingView widget.
 */
(() => {
    const CHANNEL = "__paper";
    console.log("[ZERØ] Main World Bridge Active.");

    const findTV = () => {
        // 1. Standard global objects (Padre, self-hosted)
        if (window.tvWidget) return window.tvWidget;
        if (window.tradingViewApi) return window.tradingViewApi;
        if (window.widget) return window.widget;

        // 2. Axiom Iframe logic (e.g. tradingview_f7f89)
        // Look for iframes with id starting with tradingview_
        const frames = document.querySelectorAll('iframe[id^="tradingview_"]');
        for (const frame of frames) {
            try {
                // Same-origin blob check
                if (frame.contentWindow && frame.contentWindow.tradingViewApi) {
                    return frame.contentWindow.tradingViewApi;
                }
            } catch (e) {
                // Cross-origin access blocked
            }
        }

        return null;
    };

    const activeMarkers = [];

    const drawMarker = (trade) => {
        const tv = findTV();
        if (tv && tv.activeChart) {
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
        }
    };

    window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data?.[CHANNEL]) return;
        if (e.data.type === "PAPER_DRAW_MARKER") {
            drawMarker(e.data.trade);
        }
        if (e.data.type === "PAPER_DRAW_ALL") {
            (e.data.trades || []).forEach(drawMarker);
        }
        if (e.data.type === "PAPER_CLEAR_MARKERS") {
            const tv = findTV();
            if (tv && tv.activeChart) {
                try {
                    const chart = tv.activeChart();
                    // 1. Remove tracked markers
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

                    // 2. Fallback: try nuclear option just in case
                    if (chart.removeAllShapes) chart.removeAllShapes();

                    console.log("[ZERØ] Markers cleared.");
                } catch (err) {
                    console.warn("[ZERØ] Failed to clear markers:", err);
                }
            }
        }
    });

    // Also handle price updates if needed (though DOM polling works)
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
        const res = await origFetch(...args);
        const url = String(args?.[0]?.url || args?.[0] || "");
        if (url.includes("price") || url.includes("ticker")) {
            res.clone().json().then(j => {
                const p = j.price || j.lastPrice || (j.data && j.data.price);
                if (p) window.postMessage({ [CHANNEL]: true, type: "PRICE_TICK", price: p }, "*");
            }).catch(() => { });
        }
        return res;
    };
})();
