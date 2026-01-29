/**
 * Token Market Data Service
 * Primary Source: Dexscreener API
 */

export const TokenMarketDataService = {
    currentMint: null,
    pollInterval: null,
    lastUpdateTs: 0,
    isStale: false,

    // Data State
    data: {
        priceUsd: 0,
        marketCapUsd: 0,
        liquidityUsd: 0,
        symbol: null,
        name: null
    },

    listeners: [],

    init() {
        // No auto-start, waiting for activeMint
    },

    subscribe(callback) {
        this.listeners.push(callback);
    },

    notify() {
        this.listeners.forEach(cb => cb({
            mint: this.currentMint,
            ...this.data,
            isStale: this.isStale,
            ts: this.lastUpdateTs
        }));
    },

    setMint(mint) {
        if (this.currentMint === mint) return;

        this.currentMint = mint;
        this.stopPolling();

        // Reset Data
        this.data = { priceUsd: 0, marketCapUsd: 0, liquidityUsd: 0, symbol: null, name: null };
        this.isStale = false;

        if (mint) {
            console.log(`[MarketData] New Mint: ${mint}. Starting Poll.`);
            this.startPolling();
        } else {
            console.log(`[MarketData] Mint cleared. Stopping Poll.`);
        }
    },

    startPolling() {
        if (this.pollInterval) return;

        // Immediate fetch
        this.fetchData();

        // Poll every 1 second (Fallback range)
        this.pollInterval = setInterval(() => {
            if (this.currentMint) {
                this.fetchData();
                this.checkStale();
            }
        }, 1000);
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    },

    checkStale() {
        // Mark stale if no update for 10 seconds
        if (Date.now() - this.lastUpdateTs > 10000) {
            if (!this.isStale) {
                this.isStale = true;
                console.warn('[MarketData] Data Stale (no update > 10s)');
                this.notify();
            }
        }
    },

    async fetchData() {
        if (!this.currentMint) return;

        try {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${this.currentMint}`;
            // console.log(`[MarketData] Fetching ${url}`);

            // Dexscreener API
            const response = await chrome.runtime.sendMessage({
                type: 'PROXY_FETCH',
                url: url,
                options: { method: 'GET' }
            });

            if (!response.ok) {
                console.warn(`[MarketData] Fetch Failed: ${response.status} ${response.error || ''}`);
                return;
            }

            const json = response.data;
            if (!json || !json.pairs || json.pairs.length === 0) {
                console.warn(`[MarketData] No pairs found for ${this.currentMint}`);
                return;
            }

            // Sort pairs by liquidity to find primary
            const bestPair = json.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

            if (bestPair) {
                const price = parseFloat(bestPair.priceUsd) || 0;
                let mc = bestPair.marketCap || bestPair.fdv || 0;

                this.data = {
                    priceUsd: price,
                    marketCapUsd: mc,
                    liquidityUsd: bestPair.liquidity?.usd || 0,
                    symbol: bestPair.baseToken?.symbol,
                    name: bestPair.baseToken?.name
                };

                this.lastUpdateTs = Date.now();
                this.isStale = false;
                this.notify();

                // Detailed debug for troubleshooting price=0 issues
                // console.log(`[MarketData] ${bestPair.baseToken?.symbol} Price: $${price} MC: $${mc} (Liq: $${bestPair.liquidity?.usd})`);
            } else {
                console.warn(`[MarketData] No best pair found`);
            }

        } catch (e) {
            console.error('[MarketData] Fetch Exception:', e);
        }
    },

    // Public getter for sync access
    getSnapshot() {
        return {
            mint: this.currentMint,
            ...this.data,
            isStale: this.isStale,
            ts: this.lastUpdateTs
        };
    }
};
