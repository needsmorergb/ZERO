import { Store } from '../store.js';
import { Market } from './market.js';

export const Trading = {

    // --- Utils ---
    getSolPrice() {
        // Fallback: assume $200 if we can't find it
        // TODO: Implement cleaner scrape
        return Market.price > 10 ? Market.price : 200;
    },

    fmtSol(n) {
        if (!Number.isFinite(n)) return "0.0000";
        return n.toFixed(4);
    },

    getUnrealizedPnl(state) {
        let totalUnrealized = 0;
        const solUsd = this.getSolPrice();

        Object.values(state.positions || {}).forEach(pos => {
            const currentPrice = Market.price || pos.lastPriceUsd;
            const valueUsd = pos.tokenQty * currentPrice;
            const valueSol = valueUsd / solUsd;
            const pnl = valueSol - pos.totalSolSpent;
            // console.log(`[PNL] ${pos.symbol}: ${valueSol} - ${pos.totalSolSpent} = ${pnl}`);
            totalUnrealized += pnl;
        });
        return totalUnrealized;
    },

    analyzeRecentTrades(state) {
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        if (trades.length === 0) return null;

        const recentTrades = trades.slice(-10);

        let wins = 0, losses = 0;
        let totalHoldTimeMs = 0;
        let totalPnlSol = 0;
        let avgEntryMc = 0, avgExitMc = 0;
        let entryMcCount = 0, exitMcCount = 0;
        let quickFlips = 0;
        let longHolds = 0;

        for (const trade of recentTrades) {
            const pnl = trade.realizedPnlSol || 0;
            if (pnl > 0) wins++;
            else if (pnl < 0) losses++;

            totalPnlSol += pnl;

            if (trade.entryTs && trade.ts) {
                const hold = trade.ts - trade.entryTs;
                totalHoldTimeMs += hold;
                if (hold < 60000) quickFlips++;
                if (hold > 600000) longHolds++;
            }

            if (trade.marketCap) { avgExitMc += trade.marketCap; exitMcCount++; }
        }

        const avgHoldTimeSec = recentTrades.length > 0 ? (totalHoldTimeMs / recentTrades.length) / 1000 : 0;
        const winRate = recentTrades.length > 0 ? (wins / recentTrades.length) * 100 : 0;

        let style = 'balanced';
        if (quickFlips > recentTrades.length * 0.6) style = 'scalper';
        else if (longHolds > recentTrades.length * 0.4) style = 'swing';

        return {
            totalTrades: recentTrades.length,
            wins,
            losses,
            winRate: winRate.toFixed(1),
            avgHoldTimeSec,
            style,
            totalPnlSol
        };
    },

    // --- Actions ---

    async buy(amountSol, strategy = "Trend", tokenInfo = null) {
        const state = Store.state;
        if (!state.settings.enabled) return { success: false, error: "Paper trading disabled" };
        if (amountSol <= 0) return { success: false, error: "Invalid amount" };
        if (amountSol > state.session.balance) return { success: false, error: "Insufficient funds" };

        const price = Market.price || 0.000001;
        const marketCap = Market.marketCap || 0;
        const solUsd = this.getSolPrice();
        const usdAmount = amountSol * solUsd;
        const tokenQty = usdAmount / price;

        // Use passed token info or fallback (should be passed from HUD)
        const symbol = tokenInfo?.symbol || 'SOL';
        const mint = tokenInfo?.mint || 'So111...';

        console.log(`[Trading] Executing BUY ${amountSol} SOL of ${symbol} (${mint}) @ $${price} (MC: ${marketCap})`);

        state.session.balance -= amountSol;

        const posKey = mint; // Use mint as key if possible, else symbol for stability
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
            strategy: strategy || "Unknown",
            mode: state.settings.tradingMode || 'paper'
        };

        if (!state.trades) state.trades = {};
        state.trades[tradeId] = trade;

        if (!state.session.trades) state.session.trades = [];
        state.session.trades.push(tradeId);

        // Run Discipline Check
        this.calculateDiscipline(trade, state);

        // Draw Marker via Bridge
        window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");

        await Store.save();
        return { success: true, trade, position: pos };
    },

    async sell(pct = 100, strategy = "Trend", tokenInfo = null) {
        const state = Store.state;
        const currentPrice = Market.price || 0;
        if (currentPrice <= 0) return { success: false, error: "No price data" };

        const symbol = tokenInfo?.symbol || 'SOL';
        const mint = tokenInfo?.mint || 'So111...';
        const posKey = mint;

        console.log(`[Trading] Executing SELL ${pct}% of ${symbol} (${mint}) @ $${currentPrice}`);

        const position = state.positions[posKey];
        if (!position || position.tokenQty <= 0) return { success: false, error: "No position" };

        const qtyToSell = position.tokenQty * (pct / 100);
        if (qtyToSell <= 0) return { success: false, error: "Invalid qty" };

        const solUsd = this.getSolPrice();
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

        this.calculateDiscipline(trade, state);

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

    // --- Analysis ---
    calculateDiscipline(trade, state) {
        // Base score: 100
        // Penalties are cumulative
        // This function recalculates the SESSION score based on the latest trade violation.
        // But for simplicity, we treat it as a running score that gets dinged.

        // 1. FOMO Check (Freq < 60s)
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;

        let penalty = 0;
        let reasons = [];

        if (prevTrade && (trade.ts - prevTrade.ts < 60000)) {
            penalty += 10;
            reasons.push("FOMO (Rapid logic)");
        }

        // 2. Strategy Check
        if (!trade.strategy || trade.strategy === 'Unknown' || trade.strategy === 'Other') {
            penalty += 5;
            reasons.push("No Strategy");
        }

        // 3. Oversize Check (> 50% of Balance)
        // Note: trade.solSize is not fully accurate for buy vs sell, handled logic in caller usually
        // For BUY: trade.solSize is relevant. For SELL: trade.solSize is proceeds.
        // We really care about Entry Size.
        if (trade.side === "BUY") {
            const currentBal = state.session.balance + trade.solSize; // Revert to pre-trade balance for check
            if (trade.solSize > (currentBal * 0.5)) {
                penalty += 20;
                reasons.push("Oversizing (>50%)");
            }
        }

        // Apply
        let score = (state.session.disciplineScore !== undefined) ? state.session.disciplineScore : 100;
        score = Math.max(0, score - penalty);
        state.session.disciplineScore = score;

        if (penalty > 0) {
            console.log(`[DISCIPLINE] Score -${penalty} (${reasons.join(', ')})`);
        }

        return { score, penalty, reasons };
    }
};
