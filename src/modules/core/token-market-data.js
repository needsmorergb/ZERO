/**
 * Token Market Data Service
 * Primary Source: Dexscreener API
 */

export const TokenMarketDataService = {
    currentMint: null,
    pollInterval: null,
    lastUpdateTs: 0,
    isStale: false,
    dexHasData: true, // Track if DexScreener has data for current mint

    // Data State
    data: {
        priceUsd: 0,
        marketCapUsd: 0,
        liquidityUsd: 0,
        symbol: null,
        name: null,
        info: null
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
        this.data = { priceUsd: 0, marketCapUsd: 0, liquidityUsd: 0, symbol: null, name: null, info: null };
        this.isStale = false;
        this.dexHasData = true; // Reset on mint change

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

        // Poll every 500ms for responsive price updates
        this.pollInterval = setInterval(() => {
            if (this.currentMint) {
                this.fetchData();
                this.checkStale();
            }
        }, 500);
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
            // Skip DexScreener if it previously returned no data for this mint
            if (this.dexHasData) {
                const url = `https://api.dexscreener.com/latest/dex/tokens/${this.currentMint}`;

                const response = await chrome.runtime.sendMessage({
                    type: 'PROXY_FETCH',
                    url: url,
                    options: { method: 'GET' }
                });

                if (response.ok && response.data?.pairs?.length > 0) {
                    const bestPair = response.data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

                    if (bestPair) {
                        const price = parseFloat(bestPair.priceUsd) || 0;
                        let mc = bestPair.marketCap || bestPair.fdv || 0;

                        this.data = {
                            priceUsd: price,
                            marketCapUsd: mc,
                            liquidityUsd: bestPair.liquidity?.usd || 0,
                            symbol: bestPair.baseToken?.symbol,
                            name: bestPair.baseToken?.name,
                            info: bestPair.info || null
                        };

                        this.lastUpdateTs = Date.now();
                        this.isStale = false;
                        this.notify();
                        return;
                    }
                }

                // DexScreener has no data — skip it on future polls for this mint
                this.dexHasData = false;
                console.log(`[MarketData] DexScreener has no data — switching to Jupiter only`);
            }

            // Jupiter Price API (primary for pump.fun tokens)
            await this.fetchJupiterFallback();

        } catch (e) {
            console.error('[MarketData] Fetch Exception:', e);
        }
    },

    async fetchJupiterFallback() {
        if (!this.currentMint) return;

        try {
            // Jupiter v3 lite endpoint (free, no API key required)
            const jupUrl = `https://lite-api.jup.ag/price/v3?ids=${this.currentMint}`;
            const jupResponse = await chrome.runtime.sendMessage({
                type: 'PROXY_FETCH',
                url: jupUrl,
                options: { method: 'GET' }
            });

            // v3 response format: { "mint": { "usdPrice": number, ... } }
            if (jupResponse.ok && jupResponse.data?.[this.currentMint]) {
                const jupData = jupResponse.data[this.currentMint];
                const price = parseFloat(jupData.usdPrice) || 0;
                if (price > 0) {
                    console.log(`[MarketData] Jupiter Price: $${price} for ${this.currentMint}`);
                    this.data = {
                        priceUsd: price,
                        marketCapUsd: this.data.marketCapUsd || 0,
                        liquidityUsd: this.data.liquidityUsd || 0,
                        symbol: this.data.symbol,
                        name: this.data.name,
                        info: this.data.info || null
                    };

                    this.lastUpdateTs = Date.now();
                    this.isStale = false;
                    this.notify();
                    return;
                }
            }

            console.warn(`[MarketData] No pairs found for ${this.currentMint}`);
        } catch (e) {
            console.warn('[MarketData] Jupiter fallback failed:', e);
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
