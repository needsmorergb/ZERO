import { Market } from './market.js';
import { Store } from '../store.js';

export const PnlCalculator = {
    cachedSolPrice: 200, // Default fallback
    lastSolPriceFetch: 0,
    priceUpdateInterval: null,
    lastPriceSave: 0,

    // Initialize price fetching on load
    init() {
        // Fetch immediately on init
        this.fetchSolPriceBackground();

        // Then fetch every 60 seconds in background
        if (!this.priceUpdateInterval) {
            this.priceUpdateInterval = setInterval(() => {
                this.fetchSolPriceBackground();
            }, 60000);
        }
    },

    // Background fetch - never blocks, updates cache silently
    async fetchSolPriceBackground() {
        console.log('[PNL] Fetching SOL price...');

        // Try Jupiter first
        try {
            const response = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112', {
                signal: AbortSignal.timeout(3000)
            });
            const data = await response.json();
            const solPrice = data?.data?.So11111111111111111111111111111111111111112?.price;

            if (solPrice && solPrice > 0) {
                this.cachedSolPrice = solPrice;
                this.lastSolPriceFetch = Date.now();
                console.log(`[PNL] ✓ SOL price from Jupiter: $${solPrice.toFixed(2)}`);
                return;
            }
        } catch (e) {
            console.warn(`[PNL] Jupiter failed (${e.message}), trying CoinGecko...`);
        }

        // Fallback to CoinGecko
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
                signal: AbortSignal.timeout(3000)
            });
            const data = await response.json();
            const solPrice = data?.solana?.usd;

            // VALIDATION: SOL price should be between $50-$500 (reasonable range)
            if (solPrice && solPrice > 50 && solPrice < 500) {
                this.cachedSolPrice = solPrice;
                this.lastSolPriceFetch = Date.now();
                console.log(`[PNL] ✓ SOL price from CoinGecko: $${solPrice.toFixed(2)}`);
                return;
            } else if (solPrice) {
                console.error(`[PNL] CoinGecko returned invalid SOL price: $${solPrice} (expected $50-$500)`);
            }
        } catch (e) {
            console.error(`[PNL] ✗ CoinGecko failed: ${e.message}`);
        }

        // Use hardcoded reasonable default if all APIs fail
        console.error(`[PNL] ✗ All APIs failed. Using safe default $140`);
        this.cachedSolPrice = 140;
    },

    // Always returns immediately - never blocks on fetch
    getSolPrice() {
        return this.cachedSolPrice;
    },

    fmtSol(n) {
        if (!Number.isFinite(n)) return "0.0000";
        // Use more precision for values < 1
        if (Math.abs(n) < 1 && n !== 0) {
            return n.toFixed(6);
        }
        return n.toFixed(4);
    },

    getUnrealizedPnl(state, currentTokenMint = null) {
        let totalUnrealized = 0;
        const solUsd = this.getSolPrice();
        let priceWasUpdated = false;

        const positions = Object.values(state.positions || {});

        console.log(`[PNL] Calculating for ${positions.length} position(s), SOL=$${solUsd.toFixed(2)}`);

        positions.forEach(pos => {
            // CORRUPTION DETECTION: Delete positions with invalid data
            const reasons = [];
            if (pos.entryPriceUsd > 10000) reasons.push(`entryPrice=$${pos.entryPriceUsd.toFixed(0)}`);
            if (pos.lastPriceUsd > 10000) reasons.push(`lastPrice=$${pos.lastPriceUsd.toFixed(0)}`);
            if (pos.tokenQty > 100000) reasons.push(`qty=${pos.tokenQty.toFixed(0)}`);
            if (pos.totalSolSpent < 0.00001) reasons.push(`spent=${pos.totalSolSpent.toFixed(6)}`);

            if (reasons.length > 0) {
                console.error(`[PNL] ✗ DELETING CORRUPTED ${pos.symbol}: ${reasons.join(', ')}`);
                delete state.positions[pos.mint];
                priceWasUpdated = true;
                return; // Skip this position
            }

            let currentPrice = pos.lastPriceUsd || pos.entryPriceUsd;

            // If we're viewing this token's page, use the live price
            if (currentTokenMint && pos.mint === currentTokenMint && Market.price > 0 && Market.price < 10000) {
                currentPrice = Market.price;
                // Update position's cached price for future calculations
                const oldPrice = pos.lastPriceUsd || pos.entryPriceUsd;
                if (!pos.lastPriceUsd || Math.abs(oldPrice - Market.price) / oldPrice > 0.001) {
                    pos.lastPriceUsd = Market.price;
                    priceWasUpdated = true;
                }
            }

            if (!currentPrice || currentPrice <= 0) return;

            const valueUsd = pos.tokenQty * currentPrice;
            const valueSol = valueUsd / solUsd;
            const pnl = valueSol - pos.totalSolSpent;

            console.log(`[PNL] ${pos.symbol}: qty=${pos.tokenQty.toFixed(2)}, price=$${currentPrice.toFixed(6)}, value=${valueSol.toFixed(4)} SOL, spent=${pos.totalSolSpent.toFixed(4)} SOL, pnl=${pnl.toFixed(4)} SOL`);

            totalUnrealized += pnl;
        });

        // Debounced save - only save if price changed and it's been >5 seconds since last save
        const now = Date.now();
        if (priceWasUpdated && (now - this.lastPriceSave) > 5000) {
            this.lastPriceSave = now;
            Store.save();
        }

        return totalUnrealized;
    }
};
