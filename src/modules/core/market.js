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

    init() {
        console.log('[Market] Initializing API-Driven Market Service');

        // 1. Subscribe to Data Service (API Polling - Fallback)
        TokenMarketDataService.subscribe((data) => {
            // Only use API data if we haven't had a real-time tick in the last 2 seconds
            const now = Date.now();
            if (this.lastSource && this.lastSource !== 'api' && (now - this.lastTickTs < 2000)) {
                // Keep MC and Liquidity even if price is ignored
                this.marketCap = data.marketCapUsd;
                this.liquidity = data.liquidityUsd;
                return;
            }

            this.price = data.priceUsd;
            this.marketCap = data.marketCapUsd;
            this.liquidity = data.liquidityUsd;
            this.currentSymbol = data.symbol;
            this.priceIsFresh = !data.isStale;
            this.lastSource = 'api';

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
