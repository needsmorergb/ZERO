import { Market } from './market.js';
import { Store } from '../store.js';
import { Precision } from './precision.js';

export const PnlCalculator = {
    cachedSolPrice: 200, // Default fallback
    lastValidSolPrice: null, // Stores last successful API fetch
    lastSolPriceFetch: 0,
    priceUpdateInterval: null,
    lastPriceSave: 0,

    // Initialize price fetching on load
    init() {
        // Fetch immediately on init
        this.fetchSolPriceBackground();

        // Then fetch every 10 seconds in background
        if (!this.priceUpdateInterval) {
            this.priceUpdateInterval = setInterval(() => {
                this.fetchSolPriceBackground();
            }, 10000);
        }
    },

    // Background fetch - never blocks, updates cache silently
    async fetchSolPriceBackground() {
        console.log('[PNL] Fetching SOL price from CoinGecko...');

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'PROXY_FETCH',
                url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
                options: { method: 'GET' }
            });

            if (!response.ok) throw new Error(response.statusText || response.error || 'Fetch failed');
            const data = response.data;
            const solPrice = data?.solana?.usd;

            // VALIDATION: SOL price should be between $10-$3000 (reasonable range)
            if (solPrice && solPrice > 10 && solPrice < 3000) {
                this.cachedSolPrice = solPrice;
                this.lastValidSolPrice = solPrice; // Store as valid fallback
                this.lastSolPriceFetch = Date.now();
                console.log(`[PNL] ✓ SOL price: $${solPrice.toFixed(2)} (CoinGecko)`);
                return;
            } else if (solPrice) {
                console.error(`[PNL] ✗ Invalid SOL price from CoinGecko: $${solPrice} (expected $50-$500)`);
            }
        } catch (e) {
            console.error(`[PNL] ✗ CoinGecko failed: ${e.message}`);
        }

        // Fallback to last valid price if available, otherwise use $140
        if (this.lastValidSolPrice) {
            console.warn(`[PNL] Using last valid price: $${this.lastValidSolPrice.toFixed(2)}`);
            this.cachedSolPrice = this.lastValidSolPrice;
        } else {
            console.error(`[PNL] ✗ No valid price available. Using safe default $140`);
            this.cachedSolPrice = 140;
        }
    },

    // Always returns immediately - never blocks on fetch
    getSolPrice() {
        return this.cachedSolPrice;
    },

    fmtSol(n) {
        if (!Number.isFinite(n)) return "0.0000";
        // Use more precision for values < 1
        if (Math.abs(n) < 1 && n !== 0) {
            return n.toFixed(9);
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
                    console.log(`[PNL] Updating ${pos.symbol} price: $${oldPrice.toFixed(8)} → $${Market.price.toFixed(8)}`);
                    pos.lastPriceUsd = Market.price;
                    priceWasUpdated = true;
                }
            }

            if (!currentPrice || currentPrice <= 0) return;

            const valueUsd = Precision.tokenQty(pos.tokenQty) * Precision.usdPrice(currentPrice);
            const valueSol = Precision.sol(valueUsd / solUsd);
            const pnl = Precision.sol(valueSol - pos.totalSolSpent);
            const pnlPct = Precision.pct((pnl / pos.totalSolSpent) * 100);

            // Track Peak PNL Pct for Profit Overstay detection
            if (pos.peakPnlPct === undefined || pnlPct > pos.peakPnlPct) {
                pos.peakPnlPct = pnlPct;
            }

            pos.pnlPct = pnlPct; // Store current pct for analytics

            console.log(`[PNL] ${pos.symbol}: qty=${pos.tokenQty.toFixed(2)}, price=$${currentPrice.toFixed(6)}, pnl=${pnl.toFixed(4)} SOL (${pnlPct.toFixed(1)}%)`);

            totalUnrealized += pnl;
        });

        // Elite Phase 10: Trigger background monitors
        const { Analytics } = require('./analytics.js');
        Analytics.monitorProfitOverstay(state);
        Analytics.detectOvertrading(state);

        // Debounced save - only save if price changed and it's been >5 seconds since last save
        const now = Date.now();
        if (priceWasUpdated && (now - this.lastPriceSave) > 5000) {
            this.lastPriceSave = now;
            Store.save();
        }

        return totalUnrealized;
    }
};
