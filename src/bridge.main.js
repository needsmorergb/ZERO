/**
 * Main World Bridge
 * Runs natively in the page context (MAIN world) to access the TradingView widget.
 */
(() => {
    const CHANNEL = "__paper";
    console.log("[ZERØ] Main World Bridge Active.");

    const findTV = () => {
        return window.tvWidget || window.tradingViewApi || window.widget;
    };

    const drawMarker = (trade) => {
        const tv = findTV();
        if (tv && tv.activeChart) {
            try {
                const chart = tv.activeChart();
                const side = (trade.side || "").toUpperCase();
                const isBuy = side === "BUY";

                const ts = Math.floor(trade.ts / 1000) - 5;
                // CRITICAL: charts on Padre often show Market Cap on Y-axis.
                // We MUST use marketCap if it exists and is not zero.
                const chartPrice = trade.marketCap || trade.priceUsd;
                const color = isBuy ? "#10b981" : "#ef4444";

                // SPECIALIZED TRADINGVIEW API (Same as Production)
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
                    console.log(`[ZERØ] Execution Shape created (${side}) @ ${chartPrice}`);
                } else {
                    // Fallback to our best manual shape if createExecutionShape is missing
                    chart.createShape({ time: ts, location: isBuy ? "belowbar" : "abovebar" }, {
                        shape: "text",
                        lock: true,
                        text: isBuy ? "\n\n\n\n↑\nB" : "S\n↓\n\n\n\n",
                        overrides: { color, fontsize: 16, bold: true }
                    });
                    console.log(`[ZERØ] Manual Shape placed (${side})`);
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
