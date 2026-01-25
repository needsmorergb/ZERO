import { Market } from './market.js';
import { Store } from '../store.js';

export const PnlCalculator = {
    cachedSolPrice: null,
    lastSolPriceFetch: 0,
    priceUpdatePending: false,
    lastPriceSave: 0,

    async getSolPrice() {
        const now = Date.now();
        // Cache for 30 seconds
        if (this.cachedSolPrice && (now - this.lastSolPriceFetch) < 30000) {
            return this.cachedSolPrice;
        }

        try {
            // Try to fetch real SOL price from Jupiter API
            const response = await fetch('https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112');
            const data = await response.json();
            const solPrice = data?.data?.So11111111111111111111111111111111111111112?.price;

            if (solPrice && solPrice > 0) {
                this.cachedSolPrice = solPrice;
                this.lastSolPriceFetch = now;
                return solPrice;
            }
        } catch (e) {
            console.warn('[ZERØ] Failed to fetch SOL price:', e);
        }

        // Fallback to cached or default
        return this.cachedSolPrice || 200;
    },

    fmtSol(n) {
        if (!Number.isFinite(n)) return "0.0000";
        // Use more precision for values < 1
        if (Math.abs(n) < 1 && n !== 0) {
            return n.toFixed(6);
        }
        return n.toFixed(4);
    },

    async getUnrealizedPnl(state, currentTokenMint = null) {
        let totalUnrealized = 0;
        const solUsd = await this.getSolPrice();
        let priceWasUpdated = false;

        const positions = Object.values(state.positions || {});

        positions.forEach(pos => {
            let currentPrice = pos.lastPriceUsd || pos.entryPriceUsd;

            // If we're viewing this token's page, use the live price
            if (currentTokenMint && pos.mint === currentTokenMint && Market.price > 0) {
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
