import { TokenContextResolver } from './token-context.js';
import { TokenMarketDataService } from './token-market-data.js';

export const Market = {
    price: 0,
    marketCap: 0,
    liquidity: 0,
    currentMint: null,
    currentSymbol: null,
    sourceSite: null,
    listeners: [],

    // Legacy support flags if needed
    lastTickTs: 0,
    lastSource: null, // 'site', 'dom', 'api'
    lastChartMCapTs: 0, // Dedicated tracker for chart MCap activity

    init() {
        console.log('[Market] Initializing API-Driven Market Service');

        // 1. Subscribe to Data Service (API Polling)
        TokenMarketDataService.subscribe((data) => {
            const now = Date.now();
            // Use dedicated chart MCap timestamp — immune to lastSource race condition
            // when multiple API responses arrive between chart ticks
            const chartMCapActive = (now - this.lastChartMCapTs) < 3000;

            // ALWAYS accept API price — it's the authoritative source from DexScreener/Jupiter.
            // This prevents the DOM price corruption problem on initial load.
            if (data.priceUsd > 0) {
                this.price = data.priceUsd;
                this.priceIsFresh = !data.isStale;
            }

            // Only protect marketCap from API overwrite when chart is actively providing MCap.
            // Chart MCap matches the Y-axis display; API FDV may differ.
            if (!chartMCapActive && data.marketCapUsd > 0) {
                this.marketCap = data.marketCapUsd;
            }

            this.liquidity = data.liquidityUsd;
            if (data.symbol) this.currentSymbol = data.symbol;
            this.lastSource = 'api';

            // Send price/MCap reference to bridge for chart-based price inference
            // Only send when values change meaningfully (>0.5%) to reduce noise
            if (data.priceUsd > 0 && data.marketCapUsd > 0) {
                const priceDelta = this._lastRefPrice ? Math.abs(data.priceUsd - this._lastRefPrice) / this._lastRefPrice : 1;
                if (priceDelta > 0.005 || !this._lastRefPrice) {
                    this._lastRefPrice = data.priceUsd;
                    window.postMessage({
                        __paper: true,
                        type: 'PAPER_PRICE_REFERENCE',
                        priceUsd: data.priceUsd,
                        marketCapUsd: data.marketCapUsd
                    }, '*');
                }
            }

            // Notify UI
            this.notify();
        });

        // 2. Start Context Polling Loop
        this.pollContext();
        setInterval(() => this.pollContext(), 250);

        // 3. Listen for Real-time Price Ticks from Page Bridge
        window.addEventListener('message', (e) => {
            if (e.source !== window || !e.data?.__paper) return;
            const d = e.data;
            if (d.type === 'PRICE_TICK') {
                if (d.price > 0 && d.confidence >= 1) {
                    const now = Date.now();
                    // Basic sanity check to prevent extreme "dirty" jumps from bad DOM scraping
                    if (this.price > 0 && Math.abs(d.price - this.price) / this.price > 0.8 && d.confidence < 3) return;

                    console.log(`[Market] Real-time Price Integration (${d.source}): $${d.price}`);
                    this.price = d.price;
                    this.priceIsFresh = true;
                    this.lastTickTs = now;
                    this.lastSource = d.source || 'site';

                    // Use chart MCap when provided (matches chart display, not API FDV)
                    if (d.chartMCap > 0) {
                        this.marketCap = d.chartMCap;
                        this.lastChartMCapTs = now;
                    }

                    this.notify();
                }
            }
        });
    },

    pollContext() {
        // Resolve Context
        const { activeMint, activeSymbol, sourceSite } = TokenContextResolver.resolve();

        if (activeMint !== this.currentMint) {
            console.log(`[Market] Context Changed: ${this.currentMint} -> ${activeMint} (${sourceSite})`);
            this.currentMint = activeMint;
            this.sourceSite = sourceSite;
            this.currentSymbol = activeSymbol;

            // Tell Bridge to switch context for real-time interception
            window.postMessage({
                __paper: true,
                type: 'PAPER_SET_CONTEXT',
                mint: activeMint,
                symbol: activeSymbol
            }, '*');

            // Tell Data Service to switch mints (starts polling Dexscreener as fallback)
            TokenMarketDataService.setMint(activeMint);

            // Notify UI of mint change immediately
            this.notify();
        }
    },

    subscribe(callback) {
        this.listeners.push(callback);
    },

    notify() {
        this.listeners.forEach(cb => cb({
            price: this.price,
            marketCap: this.marketCap,
            mint: this.currentMint,
            symbol: this.currentSymbol,
            context: { // Legacy shape adaptation for 'context' if needed by HUD
                liquidity: this.liquidity,
                fdv: this.marketCap,
                symbol: this.currentSymbol
            }
        }));
    },

    // Explicit getter if needed
    getSnapshot() {
        return TokenMarketDataService.getSnapshot();
    }
};
