import { Store } from '../store.js';

export const PositionPriceManager = {
    updateInterval: null,
    lastUpdate: 0,

    init() {
        console.log('[PositionPrices] Initializing background price updates...');

        // Fetch prices for all positions every 15 seconds
        this.updateInterval = setInterval(() => {
            this.updateAllPositionPrices();
        }, 15000);

        // Initial fetch
        this.updateAllPositionPrices();
    },

    async updateAllPositionPrices() {
        const state = Store.state;
        if (!state) return;

        // Use mode-aware positions
        const positions = Store.getActivePositions();
        if (!positions) return;

        const mints = Object.keys(positions);
        if (mints.length === 0) return;

        console.log(`[PositionPrices] Updating ${mints.length} position(s)...`);

        // Batch fetch prices (DexScreener supports up to 30 tokens)
        const batchSize = 30;
        for (let i = 0; i < mints.length; i += batchSize) {
            const batch = mints.slice(i, i + batchSize);
            await this.fetchBatchPrices(batch, positions);
        }

        this.lastUpdate = Date.now();
    },

    async fetchBatchPrices(mints, positions) {
        try {
            // DexScreener batch API: /tokens/:mint1,:mint2,:mint3
            const mintsStr = mints.join(',');
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintsStr}`, {
                signal: AbortSignal.timeout(8000)
            });
            const data = await response.json();

            if (!data.pairs) {
                console.warn('[PositionPrices] No pairs returned from DexScreener');
                return;
            }

            // Update each position with fresh price
            mints.forEach(mint => {
                const position = positions[mint];
                if (!position) return;

                // Find the most liquid pair for this token
                const pairs = data.pairs.filter(p =>
                    p.baseToken.address.toLowerCase() === mint.toLowerCase()
                );

                if (pairs.length === 0) return;

                // Sort by liquidity, take highest
                pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
                const bestPair = pairs[0];
                const price = parseFloat(bestPair.priceUsd);

                if (price && price > 0 && price < 10000) {
                    position.lastPriceUsd = price;
                    position.lastPriceUpdate = Date.now();
                    console.log(`[PositionPrices] ${position.symbol}: $${price.toFixed(8)}`);
                }
            });

            // Save updated prices (will be handled by debounced save in PNL calculator)
            // Don't save immediately here to avoid storage thrashing

        } catch (e) {
            console.error(`[PositionPrices] Batch fetch failed: ${e.message}`);
        }
    },

    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        console.log('[PositionPrices] Cleanup complete');
    }
};
