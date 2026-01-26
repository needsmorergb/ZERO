import { Store } from '../store.js';
import { Market } from './market.js';
import { PnlCalculator } from './pnl-calculator.js';
import { Analytics } from './analytics.js';
import { FeatureManager } from '../featureManager.js';

export const OrderExecution = {
    async buy(amountSol, strategy = "Trend", tokenInfo = null, tradePlan = null) {
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
        const usdAmount = amountSol * solUsd;
        const tokenQty = usdAmount / price;

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

        const oldValue = pos.tokenQty * pos.entryPriceUsd;
        const newValue = tokenQty * price;
        const totalQty = pos.tokenQty + tokenQty;

        pos.tokenQty = totalQty;
        pos.entryPriceUsd = totalQty > 0 ? (oldValue + newValue) / totalQty : price;
        pos.lastPriceUsd = price;
        pos.totalSolSpent += amountSol;

        const tradeId = `trade_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // Extract trade plan if provided
        const plan = tradePlan || {};

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
            mode: state.settings.tradingMode || 'paper',
            // Trade Plan (PRO feature)
            plannedStop: plan.plannedStop || null,
            plannedTarget: plan.plannedTarget || null,
            entryThesis: plan.entryThesis || '',
            riskDefined: plan.riskDefined || false
        };

        if (!state.trades) state.trades = {};
        state.trades[tradeId] = trade;

        if (!state.session.trades) state.session.trades = [];
        state.session.trades.push(tradeId);

        // Run Discipline Check
        Analytics.calculateDiscipline(trade, state);

        // Log trade event
        Analytics.logTradeEvent(state, trade);

        // Check for milestones
        this.checkMilestones(trade, state);

        // Draw Marker via Bridge
        window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");

        await Store.save();
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

        const qtyToSell = position.tokenQty * (pct / 100);
        if (qtyToSell <= 0) return { success: false, error: "Invalid qty" };

        const solUsd = PnlCalculator.getSolPrice();
        const proceedsUsd = qtyToSell * currentPrice;
        const solReceived = proceedsUsd / solUsd;

        const solSpentPortion = position.totalSolSpent * (qtyToSell / position.tokenQty);
        const realizedPnlSol = solReceived - solSpentPortion;

        position.tokenQty -= qtyToSell;
        position.totalSolSpent = Math.max(0, position.totalSolSpent - solSpentPortion);

        state.session.balance += solReceived;
        state.session.realized += realizedPnlSol;

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

        // Log trade event
        Analytics.logTradeEvent(state, trade);

        // Check for milestones
        this.checkMilestones(trade, state);

        // Draw Marker via Bridge
        window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");

        await Store.save();
        return { success: true, trade };
    },

    async tagTrade(tradeId, updates) {
        const state = Store.state;
        if (!state.trades || !state.trades[tradeId]) return false;

        Object.assign(state.trades[tradeId], updates);
        await Store.save();
        return true;
    },

    checkMilestones(trade, state) {
        const tradeCount = Object.keys(state.trades || {}).length;
        const sellTrades = Object.values(state.trades || {}).filter(t => t.side === 'SELL');
        const wins = sellTrades.filter(t => (t.realizedPnlSol || 0) > 0).length;

        // Trade count milestones
        if (tradeCount === 1) {
            Analytics.logMilestone(state, 'FIRST_TRADE', 'First trade executed! Welcome to ZERØ.', { tradeCount });
        } else if (tradeCount === 10) {
            Analytics.logMilestone(state, 'TRADE_10', '10 trades completed. Building your baseline.', { tradeCount });
        } else if (tradeCount === 50) {
            Analytics.logMilestone(state, 'TRADE_50', '50 trades! You have a solid trading history.', { tradeCount });
        } else if (tradeCount === 100) {
            Analytics.logMilestone(state, 'TRADE_100', '100 trades milestone! Veteran status unlocked.', { tradeCount });
        }

        // Win streak milestones
        const winStreak = state.session.winStreak || 0;
        if (winStreak === 5) {
            Analytics.logMilestone(state, 'WIN_STREAK_5', '5 wins in a row! Keep the discipline.', { winStreak });
        } else if (winStreak === 10) {
            Analytics.logMilestone(state, 'WIN_STREAK_10', '10 consecutive wins! Elite performance.', { winStreak });
        }

        // Equity milestones
        const startSol = state.settings.startSol || 10;
        const currentEquity = state.session.balance + (state.session.realized || 0);
        const equityMultiple = currentEquity / startSol;

        if (equityMultiple >= 2 && !state._milestone_2x) {
            Analytics.logMilestone(state, 'EQUITY_2X', 'Portfolio doubled! 2x achieved.', { equityMultiple: equityMultiple.toFixed(2) });
            state._milestone_2x = true;
        } else if (equityMultiple >= 3 && !state._milestone_3x) {
            Analytics.logMilestone(state, 'EQUITY_3X', 'Portfolio tripled! 3x achieved.', { equityMultiple: equityMultiple.toFixed(2) });
            state._milestone_3x = true;
        } else if (equityMultiple >= 5 && !state._milestone_5x) {
            Analytics.logMilestone(state, 'EQUITY_5X', 'Portfolio 5x! Legendary.', { equityMultiple: equityMultiple.toFixed(2) });
            state._milestone_5x = true;
        }
    }
};
