// Import sub-modules
import { PnlCalculator } from './pnl-calculator.js';
import { Analytics } from './analytics.js';
import { OrderExecution } from './order-execution.js';

// Export unified Trading object with all methods
export const Trading = {
    // PnL Calculator methods
    getSolPrice: () => PnlCalculator.getSolPrice(),
    fmtSol: (n) => PnlCalculator.fmtSol(n),
    getUnrealizedPnl: (state, currentTokenMint) => PnlCalculator.getUnrealizedPnl(state, currentTokenMint),

    // Analytics methods
    analyzeRecentTrades: (state) => Analytics.analyzeRecentTrades(state),
    calculateDiscipline: (trade, state) => Analytics.calculateDiscipline(trade, state),
    updateStreaks: (trade, state) => Analytics.updateStreaks(trade, state),

    // Order Execution methods
    buy: (amountSol, strategy, tokenInfo) => OrderExecution.buy(amountSol, strategy, tokenInfo),
    sell: (pct, strategy, tokenInfo) => OrderExecution.sell(pct, strategy, tokenInfo),
    tagTrade: (tradeId, updates) => OrderExecution.tagTrade(tradeId, updates)
};
