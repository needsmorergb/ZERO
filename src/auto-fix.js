// Paper Trader Auto-Fix - Chart Markers & Price Monitoring
// With enhanced debugging for trade events

(function () {
    'use strict';

    // Platform detection for dual-platform support
    const PLATFORM_NAME = window.location.hostname.includes('axiom.trade') ? 'Axiom' : 'Padre';

    // NOTE: We don't exit early anymore - we set up a URL watcher that will
    // only start monitoring when we're on a trade page

    console.log(`[paper-fix:${PLATFORM_NAME}] Script loaded`);

    // Store active trade markers
    const tradeMarkers = [];

    // ===========================================
    // PRICE MONITORING
    // ===========================================

    function getCurrentTokenPrice() {
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

        if (window.tvWidget && typeof window.tvWidget.activeChart === 'function') {
            isProcessingQueue = true;
            console.log('[paper-fix] tvWidget ready, processing', pendingMarkers.length, 'pending markers');

            while (pendingMarkers.length > 0) {
                const marker = pendingMarkers.shift();
                createMarkerNow(marker.side, marker.price, marker.marketCap, marker.timestamp);
            }
            isProcessingQueue = false;
        } else if (pendingMarkers.length > 0) {
            // Try alternative widget access patterns
            const widget = window.tvWidget || window.TradingView?.widget || window.widget;
            console.log('[paper-fix] DEBUG: Alternative widget check:', widget);
        }
    }

    // Poll for tvWidget availability
    setInterval(processPendingMarkers, 2000); // Slower poll to reduce console spam

    function createMarkerNow(side, price, marketCap, timestamp) {
        try {
            const chart = window.tvWidget.activeChart();
            const ts = timestamp ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);
            const chartPrice = marketCap || price; // Padre shows market cap on Y-axis
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

        // Check if tvWidget is ready now
        if (window.tvWidget && typeof window.tvWidget.activeChart === 'function') {
            return createMarkerNow(side, price, marketCap, timestamp);
        } else {
            // Queue the marker for when tvWidget becomes available
            console.log('[paper-fix] tvWidget not ready, queuing marker for later');
            pendingMarkers.push({ side, price, marketCap, timestamp });
            return null;
        }
    }

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
            console.log('[paper-fix] Received message:', msg.type, msg);

            if (msg.type === 'TRADE_EXECUTED') {
                console.log('[paper-fix] 🎯 Trade event!', msg.side, msg.price, 'MC:', msg.marketCap);
                createTradeMarker(msg.side, msg.price, msg.marketCap, msg.timestamp);
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

    // Platform-specific initialization timing
    if (PLATFORM_NAME === 'Padre') {
        console.log(`[paper-fix:${PLATFORM_NAME}] Loaded, watching for trade pages...`);

        let hasStarted = false;
        let lastPath = window.location.pathname;

        const isOnTradePage = () => window.location.pathname.includes('/trade/');

        const tryStartMonitoring = () => {
            if (hasStarted) return;

            const isReady = document.querySelector('canvas') ||
                document.querySelector('button.MuiButton-colorPositive') ||
                document.querySelector('h2.MuiTypography-h2');

            if (isReady) {
                console.log(`[paper-fix:${PLATFORM_NAME}] Trade page ready, starting`);
                hasStarted = true;
                startMonitoring();
            } else {
                setTimeout(tryStartMonitoring, 500);
            }
        };

        // URL watcher for SPA navigation
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
    } else {
        // Axiom: Initialize immediately
        startMonitoring();
    }
})();
