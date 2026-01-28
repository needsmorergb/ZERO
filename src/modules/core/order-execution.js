import { Store } from '../store.js';
import { Market } from './market.js';
import { PnlCalculator } from './pnl-calculator.js';
import { Analytics } from './analytics.js';
import { FeatureManager } from '../featureManager.js';
import { Precision } from './precision.js';

export const OrderExecution = {
    async buy(amountSol, strategy = "Trend", tokenInfo = null) {
        const state = Store.state;
        if (!state.settings.enabled) return { success: false, error: "Paper trading disabled" };
        if (amountSol <= 0) return { success: false, error: "Invalid amount" };
        if (amountSol > state.session.balance) return { success: false, error: "Insufficient funds" };

        let price = Market.price || 0.000001;
        let marketCap = Market.marketCap || 0;

        // CRITICAL SANITY CHECK: Detect if price/marketCap are swapped
        // Token prices are usually < $10,000, market caps are usually > $10,000
        if (price > 10000 && marketCap > 0 && marketCap < 10000) {
            console.warn(`[Trading] SWAP DETECTED! Price=${price} MarketCap=${marketCap}. Swapping...`);
            [price, marketCap] = [marketCap, price];
        }

        // FINAL VALIDATION: Reject trade if price is still invalid after swap attempt
        if (price > 10000) {
            console.error(`[Trading] INVALID PRICE: $${price} - refusing to execute trade`);
            return { success: false, error: `Price data invalid ($${price.toFixed(2)}). Wait for chart to load.` };
        }

        const solUsd = PnlCalculator.getSolPrice();
        const usdAmount = Precision.sol(amountSol) * solUsd;
        const tokenQty = Precision.tokenQty(usdAmount / price);

        // Use passed token info or fallback
        const symbol = tokenInfo?.symbol || 'SOL';
        const mint = tokenInfo?.mint || 'So111...';

        console.log(`[Trading] BUY: ${amountSol} SOL → ${tokenQty.toFixed(2)} ${symbol} @ $${price} | SOL=$${solUsd} | MC=$${marketCap}`);

        state.session.balance -= amountSol;

        const posKey = mint;
        if (!state.positions[posKey]) {
            state.positions[posKey] = {
                tokenQty: 0,
                entryPriceUsd: price,
                lastPriceUsd: price,
                symbol: symbol,
                mint: mint,
                entryTs: Date.now(),
                totalSolSpent: 0
            };
        }

        const pos = state.positions[posKey];

        const oldQty = pos.tokenQty;
        const totalQty = Precision.tokenQty(pos.tokenQty + tokenQty);

        pos.tokenQty = totalQty;
        pos.entryPriceUsd = Precision.weightedAvg(pos.entryPriceUsd, oldQty, price, tokenQty);
        pos.lastPriceUsd = Precision.usdPrice(price);
        pos.totalSolSpent = Precision.sol(pos.totalSolSpent + amountSol);

        const tradeId = `trade_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const trade = {
            id: tradeId,
            ts: Date.now(),
            side: "BUY",
            symbol,
            mint,
            solAmount: amountSol,
            tokenQty,
            priceUsd: price,
            marketCap,
            strategy: FeatureManager.resolveFlags(state, 'STRATEGY_TAGGING').interactive ? (strategy || "Trend") : "Trend",
            mode: state.settings.tradingMode || 'paper'
        };

        if (!state.trades) state.trades = {};
        state.trades[tradeId] = trade;

        if (!state.session.trades) state.session.trades = [];
        state.session.trades.push(tradeId);

        // Run Discipline Check
        Analytics.calculateDiscipline(trade, state);

        // Draw Marker via Bridge
        window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");

        await Store.saveImmediate();
        return { success: true, trade, position: pos };
    },

    async sell(pct = 100, strategy = "Trend", tokenInfo = null) {
        const state = Store.state;
        if (!state.settings.enabled) return { success: false, error: "Paper trading disabled" };

        let currentPrice = Market.price || 0;
        if (currentPrice <= 0) return { success: false, error: "No price data" };

        // VALIDATION: Reject if price is clearly wrong (market cap value)
        if (currentPrice > 10000) {
            console.error(`[Trading] INVALID PRICE for SELL: $${currentPrice}`);
            return { success: false, error: `Price data invalid ($${currentPrice.toFixed(2)}). Wait for chart to load.` };
        }

        const symbol = tokenInfo?.symbol || 'SOL';
        const mint = tokenInfo?.mint || 'So111...';
        const posKey = mint;

        console.log(`[Trading] Executing SELL ${pct}% of ${symbol} (${mint}) @ $${currentPrice}`);

        const position = state.positions[posKey];
        if (!position || position.tokenQty <= 0) return { success: false, error: "No position" };

        const qtyToSell = Precision.tokenQty(position.tokenQty * (pct / 100));
        if (qtyToSell <= 0) return { success: false, error: "Invalid qty" };

        const solUsd = PnlCalculator.getSolPrice();
        const proceedsUsd = Precision.tokenQty(qtyToSell) * Precision.usdPrice(currentPrice);
        const solReceived = Precision.sol(proceedsUsd / solUsd);

        const solSpentPortion = Precision.sol(position.totalSolSpent * (qtyToSell / position.tokenQty));
        const realizedPnlSol = Precision.sol(solReceived - solSpentPortion);

        position.tokenQty = Precision.tokenQty(position.tokenQty - qtyToSell);
        position.totalSolSpent = Precision.sol(Math.max(0, position.totalSolSpent - solSpentPortion));

        state.session.balance = Precision.sol(state.session.balance + solReceived);
        state.session.realized = Precision.sol(state.session.realized + realizedPnlSol);

        if (position.tokenQty < 0.000001) delete state.positions[posKey];

        const tradeId = `trade_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const trade = {
            id: tradeId,
            ts: Date.now(),
            side: "SELL",
            symbol,
            mint,
            pct,
            solAmount: solReceived,
            tokenQty: qtyToSell,
            priceUsd: currentPrice,
            marketCap: Market.marketCap || 0,
            realizedPnlSol,
            strategy: strategy || "Unknown",
            mode: state.settings.tradingMode || 'paper'
        };

        if (!state.trades) state.trades = {};
        state.trades[tradeId] = trade;

        if (!state.session.trades) state.session.trades = [];
        state.session.trades.push(tradeId);

        Analytics.calculateDiscipline(trade, state);
        Analytics.updateStreaks(trade, state);

        // Draw Marker via Bridge
        window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");

        await Store.saveImmediate();
        return { success: true, trade };
    },

    async tagTrade(tradeId, updates) {
        const state = Store.state;
        if (!state.trades || !state.trades[tradeId]) return false;

        Object.assign(state.trades[tradeId], updates);
        await Store.save();
        return true;
    }
};
