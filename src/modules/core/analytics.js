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

            if (trade.marketCap) { avgExitMc += trade.marketCap; exitMcCount++; }
        }

        const winRate = recentTrades.length > 0 ? (wins / recentTrades.length) * 100 : 0;

        // Advanced Metrics
        const grossProfits = recentTrades.reduce((sum, t) => sum + Math.max(0, t.realizedPnlSol || 0), 0);
        const grossLosses = Math.abs(recentTrades.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0));
        const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : grossProfits > 0 ? "MAX" : "0.00";

        // Max Drawdown (Last 10 trades)
        let peak = 0, maxDd = 0, currentBal = 0;
        recentTrades.forEach(t => {
            currentBal += (t.realizedPnlSol || 0);
            if (currentBal > peak) peak = currentBal;
            const dd = peak - currentBal;
            if (dd > maxDd) maxDd = dd;
        });

        return {
            totalTrades: recentTrades.length,
            wins,
            losses,
            winRate: winRate.toFixed(1),
            profitFactor,
            maxDrawdown: maxDd.toFixed(4),
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

        // Equity Snapshot
        if (!state.session.equityHistory) state.session.equityHistory = [];
        state.session.equityHistory.push({
            ts: Date.now(),
            equity: state.session.balance + (state.session.realized || 0)
        });
        if (state.session.equityHistory.length > 50) state.session.equityHistory.shift();

        this.detectTilt(trade, state);
        this.detectFomo(trade, state);
        this.detectPanicSell(trade, state);
        this.detectSunkCost(trade, state);
        this.detectStrategyDrift(trade, state);
        this.updateProfile(state);
    },

    detectTilt(trade, state) {
        const flags = FeatureManager.resolveFlags(state, 'TILT_DETECTION');
        if (!flags.enabled) return;

        const lossStreak = state.session.lossStreak || 0;
        if (lossStreak >= 3) {
            this.addAlert(state, 'TILT', `⚠️ TILT DETECTED: ${lossStreak} Losses in a row. Take a break.`);
            state.behavior.tiltFrequency = (state.behavior.tiltFrequency || 0) + 1;
        }
    },

    detectSunkCost(trade, state) {
        if (trade.side !== 'BUY') return;
        const flags = FeatureManager.resolveFlags(state, 'TILT_DETECTION');
        if (!flags.enabled) return;

        const pos = state.positions[trade.mint];
        if (pos && (pos.pnlSol || 0) < 0) {
            this.addAlert(state, 'SUNK_COST', "📉 SUNK COST: Averaging down into a losing position increases risk.");
            state.behavior.sunkCostFrequency = (state.behavior.sunkCostFrequency || 0) + 1;
        }
    },

    detectOvertrading(state) {
        const flags = FeatureManager.resolveFlags(state, 'TILT_DETECTION');
        if (!flags.enabled) return;

        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        if (trades.length < 5) return;

        const last5 = trades.slice(-5);
        const timeSpan = last5[4].ts - last5[0].ts;

        // 5 trades in less than 5 minutes
        if (timeSpan < 300000) {
            this.addAlert(state, 'VELOCITY', "⚠️ OVERTRADING: You're trading too fast. Stop and evaluate setups.");
            state.behavior.overtradingFrequency = (state.behavior.overtradingFrequency || 0) + 1;
        }
    },

    monitorProfitOverstay(state) {
        const flags = FeatureManager.resolveFlags(state, 'TILT_DETECTION');
        if (!flags.enabled) return;

        Object.values(state.positions).forEach(pos => {
            const pnlPct = pos.pnlPct || 0;
            const peakPct = (pos.peakPnlPct !== undefined) ? pos.peakPnlPct : 0;

            // If it was up > 10% and now it's < 0%
            if (peakPct > 10 && pnlPct < 0) {
                if (!pos.alertedGreenToRed) {
                    this.addAlert(state, 'PROFIT_NEGLECT', `🍏 GREEN-TO-RED: ${pos.symbol} was up 10%+. Don't let winners die.`);
                    pos.alertedGreenToRed = true;
                    state.behavior.profitNeglectFrequency = (state.behavior.profitNeglectFrequency || 0) + 1;
                }
            }
        });
    },

    detectStrategyDrift(trade, state) {
        if (trade.side !== 'BUY') return;
        const flags = FeatureManager.resolveFlags(state, 'TILT_DETECTION');
        if (!flags.enabled) return;

        if (trade.strategy === 'Unknown' || trade.strategy === 'Other') {
            const trades = Object.values(state.trades || {});
            const profitableStrategies = trades
                .filter(t => (t.realizedPnlSol || 0) > 0 && t.strategy !== 'Unknown')
                .map(t => t.strategy);

            if (profitableStrategies.length >= 3) {
                this.addAlert(state, 'DRIFT', "🕵️ STRATEGY DRIFT: Playing 'Unknown' instead of your winning setups.");
                state.behavior.strategyDriftFrequency = (state.behavior.strategyDriftFrequency || 0) + 1;
            }
        }
    },

    detectFomo(trade, state) {
        if (trade.side !== 'BUY') return;
        const flags = FeatureManager.resolveFlags(state, 'TILT_DETECTION'); // Use Tilt Detection as proxy for behavioral
        if (!flags.enabled) return;

        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;

        // FOMO: Rapid buy after a loss or without strategy at potentially high MC
        if (prevTrade && (trade.ts - prevTrade.ts < 30000) && prevTrade.side === 'SELL' && (prevTrade.realizedPnlSol || 0) < 0) {
            this.addAlert(state, 'FOMO', "🚨 FOMO ALERT: Revenge trading detected.");
            state.behavior.fomoTrades = (state.behavior.fomoTrades || 0) + 1;
        }
    },

    detectPanicSell(trade, state) {
        if (trade.side !== 'SELL') return;
        const flags = FeatureManager.resolveFlags(state, 'TILT_DETECTION');
        if (!flags.enabled) return;

        // Panic Sell: Sell shortly after a price dip if not at target
        // For now, simple time-based check after entry
        if (trade.entryTs && (trade.ts - trade.entryTs < 45000) && (trade.realizedPnlSol || 0) < 0) {
            this.addAlert(state, 'PANIC', "😱 PANIC SELL: You're cutting too early. Trust your stops.");
            state.behavior.panicSells = (state.behavior.panicSells || 0) + 1;
        }
    },

    addAlert(state, type, message) {
        if (!state.session.activeAlerts) state.session.activeAlerts = [];
        const alert = { type, message, ts: Date.now() };
        state.session.activeAlerts.push(alert);

        // Keep only last 3 alerts
        if (state.session.activeAlerts.length > 3) state.session.activeAlerts.shift();

        console.log(`[ELITE ALERT] ${type}: ${message}`);
    },

    updateProfile(state) {
        const b = state.behavior;
        const totalMistakes = (b.tiltFrequency || 0) + (b.fomoTrades || 0) + (b.panicSells || 0);

        if (totalMistakes === 0) b.profile = 'Disciplined';
        else if (b.tiltFrequency > 2) b.profile = 'Emotional';
        else if (b.fomoTrades > 2) b.profile = 'Impulsive';
        else if (b.panicSells > 2) b.profile = 'Hesitant';
        else b.profile = 'Improving';
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
