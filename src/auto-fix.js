// Paper Trader Auto-Fix - Chart Markers & Price Monitoring
// Version: 0.7.0

(function () {
    'use strict';

    // SINGLETON CHECK: Prevent multiple instances from running
    if (window.__ZER0_AUTO_FIX_LOADED) {
        console.log(`%c [auto-fix] Already loaded, skipping injection`, 'color: #777');
        return;
    }
    window.__ZER0_AUTO_FIX_LOADED = true;

    const VERSION = '0.8.0';

    // Platform detection for dual-platform support
    const PLATFORM_NAME = window.location.hostname.includes('axiom.trade') ? 'Axiom' : 'Padre';

    // VERY VISIBLE version announcement
    console.log('%c ================================', 'color: #f59e0b');
    console.log(`%c 🎯 auto-fix.js v${VERSION} LOADED 🎯`, 'color: #f59e0b; font-weight: bold; font-size: 14px; background: #0d1117; padding: 8px 16px; border-radius: 6px;');
    console.log('%c ================================', 'color: #f59e0b');

    // Store active trade markers
    const tradeMarkers = [];

    // Track which trades have been marked (by timestamp) to prevent duplicates
    const markedTradeIds = new Set();

    // ===========================================
    // PRICE MONITORING
    // ===========================================

    function getCurrentTokenPrice() {
        // Strategy 1: Try to find Axiom's "Price" label and parse <sub> tag format
        const priceLabels = Array.from(document.querySelectorAll('span')).filter(
            el => el.textContent.trim() === 'Price' && el.children.length === 0
        );

        for (const label of priceLabels) {
            const sibling = label.nextElementSibling;
            if (sibling) {
                const priceSpan = sibling.querySelector('span') || sibling;
                if (priceSpan) {
                    const html = priceSpan.innerHTML || '';
                    const text = priceSpan.textContent || '';

                    // Parse Axiom <sub> format: $0.0<sub>3</sub>1 = 0.0001
                    if (html.includes('<sub') && text.includes('$')) {
                        const match = html.match(/\$0\.0*\s*<sub[^>]*>\s*(\d+)\s*<\/sub>\s*(\d+)/i);
                        if (match) {
                            const zeroCount = parseInt(match[1], 10);
                            const digits = match[2];
                            const priceStr = '0.' + '0'.repeat(zeroCount) + digits;
                            const price = parseFloat(priceStr);
                            if (price > 0.0000001 && price < 10) {
                                return price;
                            }
                        }
                    }

                    // Try standard format: $0.00001234
                    const stdMatch = text.match(/\$([\d.]+)/);
                    if (stdMatch) {
                        const price = parseFloat(stdMatch[1]);
                        if (price > 0.0000001 && price < 10) {
                            return price;
                        }
                    }
                }
            }
        }

        // Strategy 2: Fallback - find any element with standard price format
        const elements = Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const text = el.textContent || '';
                return /\$0\.\d{4,}/.test(text) && el.childElementCount === 0;
            })
            .slice(0, 20);

        for (const el of elements) {
            const match = (el.textContent || '').match(/\$(\d+\.\d+)/);
            if (match) {
                const price = parseFloat(match[1]);
                if (price > 0.000001 && price < 10) {
                    return price;
                }
            }
        }
        return null;
    }


    let lastPrice = null;
    function monitorPrice() {
        const price = getCurrentTokenPrice();
        if (price && price !== lastPrice) {
            lastPrice = price;
            window.postMessage({
                __paper: true,
                type: 'PRICE_TICK',
                price: price,
                ts: Date.now()
            }, '*');
        }
    }

    // ===========================================
    // CHART DETECTION & MARKERS
    // ===========================================

    function getChartCanvas() {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height));

        for (const canvas of canvases) {
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 300 && rect.height > 200 && rect.left < window.innerWidth / 2) {
                return { canvas, rect };
            }
        }
        return null;
    }

    // Queue of pending markers to create when tvWidget becomes available
    const pendingMarkers = [];
    let isProcessingQueue = false;

    function processPendingMarkers() {
        if (isProcessingQueue || pendingMarkers.length === 0) return;

        // Debug: Check what TradingView-related objects exist
        const tvVars = Object.keys(window).filter(k =>
            k.toLowerCase().includes('tv') ||
            k.toLowerCase().includes('trading') ||
            k.toLowerCase().includes('chart') ||
            k.toLowerCase().includes('widget')
        );

        if (pendingMarkers.length > 0 && tvVars.length > 0) {
            console.log('[paper-fix] DEBUG: TradingView-related window vars:', tvVars);
            console.log('[paper-fix] DEBUG: window.tvWidget =', window.tvWidget);
            console.log('[paper-fix] DEBUG: window.TradingView =', window.TradingView);
        }

        const widget = getWidgetInstance();
        if (widget) {
            isProcessingQueue = true;
            console.log('[paper-fix] Widget ready, processing', pendingMarkers.length, 'pending markers');

            while (pendingMarkers.length > 0) {
                const marker = pendingMarkers.shift();
                createMarkerNowWithWidget(widget, marker.side, marker.price, marker.marketCap, marker.timestamp);
            }
            isProcessingQueue = false;
        } else if (pendingMarkers.length > 0) {
            console.log('[paper-fix] DEBUG: No TradingView widget found yet, will retry...');
        }
    }

    // Poll for tvWidget availability
    setInterval(processPendingMarkers, 2000); // Slower poll to reduce console spam

    // Helper to find TradingView widget - checks main window AND iframes
    const getWidgetInstance = () => {
        // 1. Check main window (Padre pattern)
        if (window.tvWidget && typeof window.tvWidget.activeChart === 'function') {
            console.log('[paper-fix] Found tvWidget on main window');
            return window.tvWidget;
        }
        if (window.TradingView?.widget && typeof window.TradingView.widget.activeChart === 'function') {
            return window.TradingView.widget;
        }
        if (window.widget && typeof window.widget.activeChart === 'function') {
            return window.widget;
        }

        // 2. Check iframes for tradingViewApi (Axiom pattern)
        // Axiom embeds TradingView in an iframe where API is at window.frames[X].tradingViewApi
        try {
            for (let i = 0; i < window.frames.length; i++) {
                try {
                    const frame = window.frames[i];
                    if (frame.tradingViewApi && typeof frame.tradingViewApi.activeChart === 'function') {
                        console.log('[paper-fix] Found tradingViewApi in iframe[' + i + ']');
                        return frame.tradingViewApi;
                    }
                    // Also check tvWidget inside iframe
                    if (frame.tvWidget && typeof frame.tvWidget.activeChart === 'function') {
                        console.log('[paper-fix] Found tvWidget in iframe[' + i + ']');
                        return frame.tvWidget;
                    }
                } catch (e) { /* Cross-origin iframe, skip */ }
            }
        } catch (e) { console.log('[paper-fix] Error searching iframes:', e); }

        // 3. Search window properties for any object with activeChart
        for (const key of Object.keys(window)) {
            try {
                const val = window[key];
                if (val && typeof val === 'object' && typeof val.activeChart === 'function') {
                    console.log('[paper-fix] Found widget at window.' + key);
                    return val;
                }
            } catch (e) { /* ignore access errors */ }
        }

        return null;
    };

    function createMarkerNowWithWidget(widget, side, price, marketCap, timestamp) {
        try {
            const chart = widget.activeChart();
            const ts = timestamp ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);
            const chartPrice = marketCap || price; // Charts often show market cap on Y-axis
            const direction = side.toLowerCase();
            const isBuy = direction === 'buy';
            const label = isBuy ? 'BUY' : 'SELL';
            const color = isBuy ? '#00FF00' : '#FF0000';

            // TradingView createExecutionShape returns an object with setter methods
            const shape = chart.createExecutionShape()
                .setTime(ts)
                .setPrice(chartPrice)
                .setDirection(direction)
                .setText(label)
                .setTextColor(color)
                .setArrowColor(color)
                .setArrowHeight(24)       // Much larger arrow
                .setArrowSpacing(8);      // More spacing

            // Try to set font if available
            try {
                shape.setFont('bold 14px Arial');
            } catch (e) { /* font method may not exist */ }

            console.log('[paper-fix] ✓ TradingView marker created:', shape, 'at time:', ts, 'price:', chartPrice, 'direction:', direction);
            return shape;
        } catch (e) {
            console.log('[paper-fix] TradingView API error:', e);
            return null;
        }
    }

    function createTradeMarker(side, price, marketCap, timestamp) {
        console.log('[paper-fix] Creating marker via TradingView API:', side, price, 'MC:', marketCap);

        const widget = getWidgetInstance();
        if (widget) {
            return createMarkerNowWithWidget(widget, side, price, marketCap, timestamp);
        } else {
            // Queue the marker for when widget becomes available
            console.log(`[auto-fix v${VERSION}] Widget not ready, queuing marker for later`);
            pendingMarkers.push({ side, price, marketCap, timestamp });
            return null;
        }
    }

    // CHART DETECTION
    let lastChartRef = null;
    function checkChartRecreation() {
        const widget = getWidgetInstance();
        if (widget) {
            try {
                const chart = widget.activeChart();
                if (chart && chart !== lastChartRef) {
                    if (lastChartRef !== null) {
                        console.log(`[auto-fix v${VERSION}] ♻️ Chart instance changed! Clearing marked trade IDs to allow re-rendering.`);
                        markedTradeIds.clear();
                    }
                    lastChartRef = chart;
                }
            } catch (e) { }
        }
    }
    setInterval(checkChartRecreation, 1000);

    // ===========================================
    // MESSAGE LISTENER - CRITICAL FOR TRADE EVENTS
    // ===========================================

    // Listen for ALL messages and filter for paper trader events
    window.addEventListener('message', function (event) {
        // Accept messages from any source (content script sends via window)
        const msg = event.data;

        // Skip non-object messages
        if (!msg || typeof msg !== 'object') return;

        // Check for paper trader messages
        if (msg.__paper === true) {
            console.log(`[auto-fix v${VERSION}] Received message:`, msg.type);

            if (msg.type === 'TRADE_EXECUTED') {
                const tradeId = msg.timestamp || Date.now();

                // Skip if already marked
                if (markedTradeIds.has(tradeId)) {
                    console.log(`[auto-fix v${VERSION}] ⏭️ Skipping duplicate trade ${tradeId}`);
                    return;
                }

                console.log(`[auto-fix v${VERSION}] 🎯 NEW Trade!`, msg.side, 'MC:', msg.marketCap);
                createTradeMarker(msg.side, msg.price, msg.marketCap, msg.timestamp);
                markedTradeIds.add(tradeId);
            }

            // Handle bulk re-render request from content script (for navigation)
            if (msg.type === 'RENDER_STORED_MARKERS' && Array.isArray(msg.trades)) {
                // Filter out already-marked trades
                const newTrades = msg.trades.filter(t => !markedTradeIds.has(t.ts));
                console.log(`[auto-fix v${VERSION}] 📋 RENDER_STORED_MARKERS: ${msg.trades.length} total, ${newTrades.length} new`);

                if (newTrades.length === 0) {
                    console.log(`[auto-fix v${VERSION}] All trades already marked, skipping`);
                    return;
                }

                // Wait for widget to be ready with retry logic
                const tryRender = (attempts = 0) => {
                    const widget = getWidgetInstance();
                    if (widget) {
                        console.log(`[auto-fix v${VERSION}] ✅ Widget ready, rendering ${newTrades.length} new markers`);
                        let renderedCount = 0;
                        newTrades.forEach(trade => {
                            // Deduplicate within the batch (in case STATE has duplicate trades with same TS)
                            if (markedTradeIds.has(trade.ts)) return;

                            createMarkerNowWithWidget(widget, trade.side.toLowerCase(), trade.priceUsd, trade.marketCap, trade.ts);
                            markedTradeIds.add(trade.ts);
                            renderedCount++;
                        });
                        console.log(`[auto-fix v${VERSION}] ✓ Rendered ${renderedCount} unique markers (from ${newTrades.length} candidates)`);
                    } else if (attempts < 10) {
                        console.log(`[auto-fix v${VERSION}] Widget not ready, retry ${attempts + 1}/10...`);
                        setTimeout(() => tryRender(attempts + 1), 1000);
                    } else {
                        console.log(`[auto-fix v${VERSION}] ❌ Widget never became ready after 10 attempts`);
                    }
                };
                tryRender();
            }
        }
    });

    console.log(`[paper-fix:${PLATFORM_NAME}] ✓ Message listener registered`);

    // ===========================================
    // INITIALIZATION
    // ===========================================

    function startMonitoring() {
        setInterval(monitorPrice, 500);
        console.log(`[paper-fix:${PLATFORM_NAME}] ✓ Price monitor active`);
        console.log(`[paper-fix:${PLATFORM_NAME}] ✓ Ready for trade events`);
    }

    // Unified initialization for both platforms
    console.log(`[paper-fix:${PLATFORM_NAME}] Loaded, watching for trade pages...`);

    let hasStarted = false;
    let lastPath = window.location.pathname;

    // Trade page detection for both platforms
    const isOnTradePage = () => {
        const path = window.location.pathname;
        return path.includes('/trade/') || path.includes('/meme/');
    };

    const tryStartMonitoring = () => {
        if (hasStarted) return;

        // Platform-specific readiness checks
        let isReady = false;
        if (PLATFORM_NAME === 'Padre') {
            isReady = document.querySelector('canvas') ||
                document.querySelector('button.MuiButton-colorPositive') ||
                document.querySelector('h2.MuiTypography-h2');
        } else {
            // Axiom: Look for chart canvas or trading widget
            isReady = document.querySelector('canvas') ||
                document.querySelector('[class*="chart"]') ||
                document.querySelector('[class*="trading"]') ||
                document.querySelector('button:has-text("Buy")');
        }

        if (isReady) {
            console.log(`[paper-fix:${PLATFORM_NAME}] Trade page ready, starting`);
            hasStarted = true;
            startMonitoring();
        } else {
            setTimeout(tryStartMonitoring, 500);
        }
    };

    // URL watcher for SPA navigation (both platforms)
    const checkForNavigation = () => {
        const currentPath = window.location.pathname;
        if (currentPath !== lastPath) {
            lastPath = currentPath;
            if (isOnTradePage() && !hasStarted) {
                console.log(`[paper-fix:${PLATFORM_NAME}] Navigated to trade page`);
                setTimeout(tryStartMonitoring, 3000);
            } else if (!isOnTradePage()) {
                hasStarted = false;
            }
        }
    };

    setInterval(checkForNavigation, 2000);

    if (isOnTradePage()) {
        setTimeout(tryStartMonitoring, 1000);
    }
})();
