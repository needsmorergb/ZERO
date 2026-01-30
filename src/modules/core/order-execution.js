import { Market } from './market.js';
import { PnlCalculator } from './pnl-calculator.js';
import { Store } from '../store.js';
import { Analytics } from './analytics.js';

export const OrderExecution = {

    // ENTRY Action
    // tokenInfo arg matches existing UI signature but we rely on Market.currentMint for truth
    async buy(solAmount, strategy = 'MANUAL', tokenInfo = null, tradePlan = null) {

        const state = Store.state;
        const mint = Market.currentMint;
        const priceUsd = Market.price;
        const symbol = Market.currentSymbol || 'UNKNOWN';

        if (!mint) return { success: false, error: "No active token context" };
        if (solAmount <= 0) return { success: false, error: "Invalid SOL amount" };
        if (priceUsd <= 0) return { success: false, error: `Market Data Unavailable (Price: ${priceUsd})` };

        // Diagnostic: log price source at trade time
        const tickAge = Date.now() - Market.lastTickTs;
        console.log(`[EXEC] BUY DIAG: price=$${priceUsd}, mcap=$${Market.marketCap}, source=${Market.lastSource}, tickAge=${tickAge}ms`);

        // PnL Logic
        const solUsd = PnlCalculator.getSolPrice();
        const buyUsd = solAmount * solUsd;
        const qtyDelta = buyUsd / priceUsd;

        // Init position if new
        if (!state.positions[mint]) {
            state.positions[mint] = {
                mint,
                symbol,
                qtyTokens: 0,
                costBasisUsd: 0,
                avgCostUsdPerToken: 0,
                realizedPnlUsd: 0,
                totalSolSpent: 0, // Legacy tracking
                entryMarketCapUsdReference: null,
                lastMarkPriceUsd: priceUsd,
                ts: Date.now()
            };
        }

        const pos = state.positions[mint];

        // Update WAC
        pos.qtyTokens += qtyDelta;
        pos.costBasisUsd += buyUsd;
        pos.totalSolSpent += solAmount; // Legacy
        pos.avgCostUsdPerToken = pos.qtyTokens > 0 ? pos.costBasisUsd / pos.qtyTokens : 0;

        // Set Reference MC if first time
        if (pos.entryMarketCapUsdReference === null && Market.marketCap > 0) {
            pos.entryMarketCapUsdReference = Market.marketCap;
        }

        console.log(`[EXEC] BUY ${symbol}: +${qtyDelta.toFixed(2)} ($${buyUsd.toFixed(2)}) @ $${priceUsd}`);

        const fillData = {
            side: 'BUY',
            mint,
            symbol,
            solAmount,
            usdNotional: buyUsd,
            qtyTokensDelta: qtyDelta,
            fillPriceUsd: priceUsd,
            marketCapUsdAtFill: Market.marketCap,
            priceSource: Market.lastSource || 'unknown',
            strategy,
            tradePlan // Store if provided
        };

        const fillId = this.recordFill(state, fillData);

        // Deduct SOL from session balance
        state.session.balance -= solAmount;

        await Store.save();
        return { success: true, message: `Bought ${symbol}`, trade: { id: fillId } };
    },

    // EXIT Action
    async sell(percent, strategy = 'MANUAL', tokenInfo = null) {
        const state = Store.state;
        const mint = Market.currentMint;
        const priceUsd = Market.price;
        const symbol = Market.currentSymbol || 'UNKNOWN';

        if (!mint) return { success: false, error: "No active token context" };
        if (!state.positions[mint] || state.positions[mint].qtyTokens <= 0) return { success: false, error: "No open position" };

        const pos = state.positions[mint];

        // Diagnostic: log price source and position state at sell time
        const tickAge = Date.now() - Market.lastTickTs;
        console.log(`[EXEC] SELL DIAG: price=$${priceUsd}, mcap=$${Market.marketCap}, source=${Market.lastSource}, tickAge=${tickAge}ms`);
        console.log(`[EXEC] SELL DIAG: avgCost=$${pos.avgCostUsdPerToken}, qty=${pos.qtyTokens}, costBasis=$${pos.costBasisUsd}`);

        // Percent defaults to 100
        const pct = (percent === undefined || percent === null) ? 100 : Math.min(Math.max(percent, 0), 100);

        // qtyDelta = clamp(qty * pct/100, 0, qty)
        const rawDelta = pos.qtyTokens * (pct / 100);
        const qtyDelta = Math.min(rawDelta, pos.qtyTokens);

        if (qtyDelta <= 0) return { success: false, error: "Zero quantity exit" };

        const proceedsUsd = qtyDelta * priceUsd;

        // WAC Close Math
        // costRemovedUsd = qtyDelta * avgCostUsdPerToken
        // realizedPnlUsd += proceedsUsd - costRemovedUsd

        const costRemovedUsd = qtyDelta * pos.avgCostUsdPerToken;
        const pnlEventUsd = proceedsUsd - costRemovedUsd;

        pos.realizedPnlUsd += pnlEventUsd;
        pos.qtyTokens -= qtyDelta;
        pos.costBasisUsd -= costRemovedUsd;

        // Legacy SOL tracking adjustment (Approximate)
        const solUsd = PnlCalculator.getSolPrice();
        pos.totalSolSpent -= (costRemovedUsd / solUsd);

        if (pos.qtyTokens < 0.000001) {
            // Close Position
            pos.qtyTokens = 0;
            pos.costBasisUsd = 0;
            pos.avgCostUsdPerToken = 0;
            pos.entryMarketCapUsdReference = null;
        }

        console.log(`[EXEC] SELL ${symbol}: -${qtyDelta.toFixed(2)} ($${proceedsUsd.toFixed(2)}) PnL: $${pnlEventUsd.toFixed(2)}`);

        // Convert to SOL for session tracking
        const proceedsSol = proceedsUsd / solUsd;
        const pnlEventSol = pnlEventUsd / solUsd;

        const fillData = {
            side: 'SELL',
            mint,
            symbol,
            percent: pct,
            qtyTokensDelta: -qtyDelta,
            proceedsUsd,
            fillPriceUsd: priceUsd,
            marketCapUsdAtFill: Market.marketCap,
            priceSource: Market.lastSource || 'unknown',
            strategy,
            realizedPnlSol: pnlEventSol
        };

        const fillId = this.recordFill(state, fillData);

        // Update session balance (add back SOL proceeds from sale)
        state.session.balance += proceedsSol;

        // Track realized PnL in session
        state.session.realized = (state.session.realized || 0) + pnlEventSol;

        // Update win/loss streaks via Analytics
        try {
            Analytics.updateStreaks({ side: 'SELL', realizedPnlSol: pnlEventSol }, state);
        } catch (e) { /* Analytics should not block trade recording */ }

        await Store.save();
        return { success: true, message: `Sold ${pct}% ${symbol}`, trade: { id: fillId } };
    },

    // Tagging (Emotion/Notes)
    async tagTrade(tradeId, updates) {
        const state = Store.state;
        const fill = state.fills ? state.fills.find(f => f.id === tradeId) : null;
        if (fill) {
            Object.assign(fill, updates);
            await Store.save();
            return true;
        }
        return false;
    },

    recordFill(state, fillData) {
        if (!state.fills) state.fills = [];
        if (!state.trades) state.trades = {};
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const fill = {
            id,
            ts: Date.now(),
            ...fillData
        };
        state.fills.unshift(fill);
        state.trades[id] = fill;

        // Track in session
        if (state.session) {
            if (!state.session.trades) state.session.trades = [];
            state.session.trades.push(id);
            state.session.tradeCount = (state.session.tradeCount || 0) + 1;
        }

        // Cap history (e.g. 500)
        if (state.fills.length > 500) state.fills.pop();
        return id;
    }
};
