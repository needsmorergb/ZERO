import { FeatureManager } from '../featureManager.js';
export const Analytics = {
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

    calculateDiscipline(trade, state) {
        const flags = FeatureManager.resolveFlags(state, 'DISCIPLINE_SCORING');
        if (!flags.enabled) return { score: state.session.disciplineScore || 100, penalty: 0, reasons: [] };

        // Base score: 100
        // Penalties are cumulative
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;

        let penalty = 0;
        let reasons = [];

        // 1. FOMO Check (Freq < 60s)
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
        if (trade.side === "BUY") {
            const currentBal = state.session.balance + trade.solSize;
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
    },

    updateStreaks(trade, state) {
        // Only update streaks on SELL trades
        if (trade.side !== 'SELL') return;

        const pnl = trade.realizedPnlSol || 0;

        if (pnl > 0) {
            // Win
            state.session.winStreak = (state.session.winStreak || 0) + 1;
            state.session.lossStreak = 0;
            console.log(`[ZERØ] Win! +${pnl.toFixed(4)} SOL. Win streak: ${state.session.winStreak}`);
        } else if (pnl < 0) {
            // Loss
            state.session.lossStreak = (state.session.lossStreak || 0) + 1;
            state.session.winStreak = 0;
            console.log(`[ZERØ] Loss. ${pnl.toFixed(4)} SOL. Loss streak: ${state.session.lossStreak}`);
        }
    },

    getProfessorDebrief(state) {
        const score = state.session.disciplineScore !== undefined ? state.session.disciplineScore : 100;
        const stats = this.analyzeRecentTrades(state) || { winRate: 0, style: 'balanced' };

        let critique = "Keep your discipline score high to trade like a pro.";

        if (score < 70) {
            critique = "You're trading emotionally. Stop, breathe, and stick to your strategy.";
        } else if (stats.winRate > 60 && score >= 90) {
            critique = "Excellent execution. You're trading with professional-grade discipline.";
        } else if (stats.style === 'scalper' && score < 90) {
            critique = "Scalping requires perfect discipline. Watch your sizing.";
        } else if (stats.totalTrades >= 3 && stats.winRate < 40) {
            critique = "Market conditions are tough. Focus on high-conviction setups only.";
        }

        return { score, critique };
    },

    generateXShareText(state) {
        const trades = Object.values(state.trades || {});
        const sellTrades = trades.filter(t => t.side === 'SELL');

        // Calculate stats
        const wins = sellTrades.filter(t => (t.realizedPnlSol || 0) > 0).length;
        const losses = sellTrades.filter(t => (t.realizedPnlSol || 0) < 0).length;
        const totalPnl = state.session.realized || 0;
        const winRate = sellTrades.length > 0 ? ((wins / sellTrades.length) * 100).toFixed(0) : 0;
        const disciplineScore = state.session.disciplineScore || 100;

        // Get streak info
        const winStreak = state.session.winStreak || 0;
        const lossStreak = state.session.lossStreak || 0;
        const currentStreak = winStreak > 0 ? `${winStreak}W` : (lossStreak > 0 ? `${lossStreak}L` : '0');

        // Format PNL
        const pnlFormatted = totalPnl >= 0 ? `+${totalPnl.toFixed(3)}` : totalPnl.toFixed(3);
        const pnlEmoji = totalPnl >= 0 ? '📈' : '📉';

        // Generate viral-style post
        let text = `🎯 ZERØ Trading Session Complete\n\n`;
        text += `${pnlEmoji} P&L: ${pnlFormatted} SOL\n`;
        text += `📊 Win Rate: ${winRate}%\n`;
        text += `🎲 Trades: ${wins}W / ${losses}L\n`;
        text += `🔥 Streak: ${currentStreak}\n`;
        text += `🧠 Discipline: ${disciplineScore}/100\n\n`;

        // Add context based on performance
        if (winRate >= 70) {
            text += `Crushing it today! 💪\n\n`;
        } else if (winRate >= 50) {
            text += `Staying profitable 📊\n\n`;
        } else if (sellTrades.length >= 3) {
            text += `Learning and improving 📚\n\n`;
        }

        text += `Paper trading with ZERØ on Solana\n`;
        text += `#Solana #PaperTrading #Crypto`;

        return text;
    }
};
