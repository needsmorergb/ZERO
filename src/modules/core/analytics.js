import { Store } from '../store.js';
import { FeatureManager } from '../featureManager.js';
import { Market } from './market.js';

// Event Categories
export const EVENT_CATEGORIES = {
    TRADE: 'TRADE',
    ALERT: 'ALERT',
    DISCIPLINE: 'DISCIPLINE',
    SYSTEM: 'SYSTEM',
    MILESTONE: 'MILESTONE'
};

export const Analytics = {
    // ==========================================
    // PERSISTENT EVENT LOGGING
    // ==========================================

    logEvent(state, type, category, message, data = {}) {
        if (!state.eventLog) state.eventLog = [];

        const event = {
            id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            ts: Date.now(),
            type,
            category,
            message,
            data
        };

        state.eventLog.push(event);

        // Keep only last 100 events
        if (state.eventLog.length > 100) {
            state.eventLog = state.eventLog.slice(-100);
        }

        console.log(`[EVENT LOG] [${category}] ${type}: ${message}`);
        return event;
    },

    logTradeEvent(state, trade) {
        const pnlText = trade.realizedPnlSol
            ? `P&L: ${trade.realizedPnlSol > 0 ? '+' : ''}${trade.realizedPnlSol.toFixed(4)} SOL`
            : `Size: ${trade.solAmount.toFixed(4)} SOL`;

        const message = `${trade.side} ${trade.symbol} @ $${trade.priceUsd?.toFixed(6) || 'N/A'} | ${pnlText}`;

        this.logEvent(state, trade.side, EVENT_CATEGORIES.TRADE, message, {
            tradeId: trade.id,
            symbol: trade.symbol,
            priceUsd: trade.priceUsd,
            solAmount: trade.solAmount,
            realizedPnlSol: trade.realizedPnlSol,
            strategy: trade.strategy,
            riskDefined: trade.riskDefined
        });
    },

    logDisciplineEvent(state, score, penalty, reasons) {
        if (penalty <= 0) return;

        const message = `Discipline -${penalty} pts: ${reasons.join(', ')}`;
        this.logEvent(state, 'PENALTY', EVENT_CATEGORIES.DISCIPLINE, message, {
            score,
            penalty,
            reasons
        });
    },

    logAlertEvent(state, alertType, message) {
        this.logEvent(state, alertType, EVENT_CATEGORIES.ALERT, message, { alertType });
    },

    logMilestone(state, type, message, data = {}) {
        this.logEvent(state, type, EVENT_CATEGORIES.MILESTONE, message, data);
    },

    getEventLog(state, options = {}) {
        const { category, limit = 50, offset = 0 } = options;
        let events = state.eventLog || [];

        if (category) {
            events = events.filter(e => e.category === category);
        }

        // Sort by timestamp descending (most recent first)
        events = events.sort((a, b) => b.ts - a.ts);

        return events.slice(offset, offset + limit);
    },

    getEventStats(state) {
        const events = state.eventLog || [];
        const stats = {
            total: events.length,
            trades: events.filter(e => e.category === EVENT_CATEGORIES.TRADE).length,
            alerts: events.filter(e => e.category === EVENT_CATEGORIES.ALERT).length,
            disciplineEvents: events.filter(e => e.category === EVENT_CATEGORIES.DISCIPLINE).length,
            milestones: events.filter(e => e.category === EVENT_CATEGORIES.MILESTONE).length
        };
        return stats;
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

            // 4. No Trade Plan (PRO feature - only penalize if feature is available)
            const planFlags = FeatureManager.resolveFlags(state, 'TRADE_PLAN');
            if (planFlags.interactive && !trade.riskDefined) {
                penalty += 5;
                reasons.push("No Stop Loss Defined");
            }
        }

        // 5. Plan vs Actual - Stop Violation Check (on SELL trades)
        if (trade.side === "SELL") {
            const result = this.checkPlanAdherence(trade, state);
            if (result.penalty > 0) {
                penalty += result.penalty;
                reasons.push(...result.reasons);
            }
        }

        // Apply
        let score = (state.session.disciplineScore !== undefined) ? state.session.disciplineScore : 100;
        score = Math.max(0, score - penalty);
        state.session.disciplineScore = score;

        if (penalty > 0) {
            console.log(`[DISCIPLINE] Score -${penalty} (${reasons.join(', ')})`);
            this.logDisciplineEvent(state, score, penalty, reasons);
        }

        return { score, penalty, reasons };
    },

    // Check if trade exit adhered to the original plan
    checkPlanAdherence(sellTrade, state) {
        let penalty = 0;
        const reasons = [];

        // Find the corresponding BUY trade for this position
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        const buyTrade = trades.find(t =>
            t.side === 'BUY' &&
            t.mint === sellTrade.mint &&
            t.ts < sellTrade.ts &&
            t.riskDefined
        );

        if (!buyTrade || !buyTrade.plannedStop) return { penalty: 0, reasons: [] };

        const exitPrice = sellTrade.priceUsd;
        const plannedStop = buyTrade.plannedStop;
        const plannedTarget = buyTrade.plannedTarget;
        const entryPrice = buyTrade.priceUsd;

        // Stop Violation: Sold below the planned stop (didn't honor stop)
        // This means the trader held through the stop and then sold at an even worse price
        if (exitPrice < plannedStop && sellTrade.realizedPnlSol < 0) {
            const violationPct = ((plannedStop - exitPrice) / plannedStop * 100).toFixed(1);
            penalty += 15;
            reasons.push(`Stop Violated (-${violationPct}% below stop)`);
        }

        // Early Exit: Sold significantly before target while in profit
        // Only flag if they had a target and exited way below it while still profitable
        if (plannedTarget && exitPrice < plannedTarget && sellTrade.realizedPnlSol > 0) {
            const targetDistance = ((plannedTarget - exitPrice) / plannedTarget * 100);
            // Only penalize if they left more than 30% of the target on the table
            if (targetDistance > 30) {
                penalty += 5;
                reasons.push("Early Exit (Left >30% gains)");
            }
        }

        // Store adherence data on the sell trade for analytics
        sellTrade.planAdherence = {
            hadPlan: true,
            plannedStop,
            plannedTarget,
            entryPrice,
            exitPrice,
            stopViolated: exitPrice < plannedStop && sellTrade.realizedPnlSol < 0,
            hitTarget: plannedTarget && exitPrice >= plannedTarget
        };

        return { penalty, reasons };
    },

    // Calculate R-Multiple for a trade (requires defined risk)
    calculateRMultiple(sellTrade, state) {
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        const buyTrade = trades.find(t =>
            t.side === 'BUY' &&
            t.mint === sellTrade.mint &&
            t.ts < sellTrade.ts &&
            t.riskDefined
        );

        if (!buyTrade || !buyTrade.plannedStop) return null;

        const entryPrice = buyTrade.priceUsd;
        const exitPrice = sellTrade.priceUsd;
        const stopPrice = buyTrade.plannedStop;

        // Risk per unit = entry - stop
        const riskPerUnit = entryPrice - stopPrice;
        if (riskPerUnit <= 0) return null; // Invalid stop (above entry)

        // P&L per unit = exit - entry
        const pnlPerUnit = exitPrice - entryPrice;

        // R-Multiple = P&L / Risk
        const rMultiple = pnlPerUnit / riskPerUnit;

        return {
            rMultiple: parseFloat(rMultiple.toFixed(2)),
            entryPrice,
            exitPrice,
            stopPrice,
            riskPerUnit,
            pnlPerUnit
        };
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
        this.monitorMarketRegime(state);
        this.updateProfile(state);
    },

    monitorMarketRegime(state) {
        const flags = FeatureManager.resolveFlags(state, 'ADVANCED_COACHING');
        if (!flags.enabled) return;

        const ctx = Market.context;
        if (!ctx) return;

        const vol = ctx.vol24h;
        const chg = Math.abs(ctx.priceChange24h);

        // 1. Choppy / Low Vol Warning
        if (vol < 500000 && Date.now() - (state.lastRegimeAlert || 0) > 3600000) {
            this.addAlert(state, 'MARKET_REGIME', "📉 LOW VOLUME: Liquidity is thin ($<500k). Slippage may be high.");
            state.lastRegimeAlert = Date.now();
        }

        // 2. High Volatility Warning
        if (chg > 50 && Date.now() - (state.lastRegimeAlert || 0) > 3600000) {
            this.addAlert(state, 'MARKET_REGIME', "⚠️ HIGH VOLATILITY: 24h change is >50%. Expect rapid swings.");
            state.lastRegimeAlert = Date.now();
        }
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

        // Keep only last 3 alerts (for active display)
        if (state.session.activeAlerts.length > 3) state.session.activeAlerts.shift();

        // Log to persistent event log
        this.logAlertEvent(state, type, message);

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
        const pnlTag = totalPnl >= 0 ? '[PROFIT]' : '[DRAWDOWN]';

        // Generate viral-style post
        let text = `ZERØ Trading Session Complete\n\n`;
        text += `${pnlTag} P&L: ${pnlFormatted} SOL\n`;
        text += `WIN RATE: ${winRate}%\n`;
        text += `HISTORY: ${wins}W / ${losses}L\n`;
        text += `STREAK: ${currentStreak}\n`;
        text += `DISCIPLINE: ${disciplineScore}/100\n\n`;

        // Add context based on performance
        if (winRate >= 70) {
            text += `Systematic Excellence. 💪\n\n`;
        } else if (winRate >= 50) {
            text += `Disciplined Execution. 📊\n\n`;
        } else if (sellTrades.length >= 3) {
            text += `Baseline Established. 📚\n\n`;
        }

        text += `Paper trading with ZERØ on Solana\n`;
        text += `#Solana #PaperTrading #Crypto`;

        return text;
    },

    // ==========================================
    // EXPORT FUNCTIONALITY
    // ==========================================

    exportToCSV(state) {
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        if (trades.length === 0) return null;

        // CSV Header
        const headers = [
            'Trade ID',
            'Timestamp',
            'Side',
            'Symbol',
            'Token Mint',
            'SOL Amount',
            'Token Qty',
            'Price USD',
            'Market Cap',
            'Realized PnL (SOL)',
            'Strategy',
            'Emotion',
            'Mode',
            'Planned Stop',
            'Planned Target',
            'Risk Defined',
            'Entry Thesis'
        ];

        const rows = trades.map(t => [
            t.id,
            new Date(t.ts).toISOString(),
            t.side,
            t.symbol || '',
            t.mint || '',
            t.solAmount?.toFixed(6) || '',
            t.tokenQty?.toFixed(6) || '',
            t.priceUsd?.toFixed(8) || '',
            t.marketCap?.toFixed(2) || '',
            t.realizedPnlSol?.toFixed(6) || '',
            t.strategy || '',
            t.emotion || '',
            t.mode || 'paper',
            t.plannedStop?.toFixed(8) || '',
            t.plannedTarget?.toFixed(8) || '',
            t.riskDefined ? 'Yes' : 'No',
            `"${(t.entryThesis || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        return csvContent;
    },

    exportToJSON(state) {
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        const session = state.session || {};
        const behavior = state.behavior || {};

        const exportData = {
            exportedAt: new Date().toISOString(),
            version: state.version || '1.0.0',
            session: {
                balance: session.balance,
                equity: session.equity,
                realized: session.realized,
                winStreak: session.winStreak,
                lossStreak: session.lossStreak,
                disciplineScore: session.disciplineScore,
                tradeCount: trades.length
            },
            behavior: {
                profile: behavior.profile,
                tiltFrequency: behavior.tiltFrequency,
                fomoTrades: behavior.fomoTrades,
                panicSells: behavior.panicSells,
                sunkCostFrequency: behavior.sunkCostFrequency,
                overtradingFrequency: behavior.overtradingFrequency,
                profitNeglectFrequency: behavior.profitNeglectFrequency
            },
            analytics: this.analyzeRecentTrades(state),
            trades: trades.map(t => ({
                id: t.id,
                timestamp: new Date(t.ts).toISOString(),
                side: t.side,
                symbol: t.symbol,
                mint: t.mint,
                solAmount: t.solAmount,
                tokenQty: t.tokenQty,
                priceUsd: t.priceUsd,
                marketCap: t.marketCap,
                realizedPnlSol: t.realizedPnlSol,
                strategy: t.strategy,
                emotion: t.emotion,
                mode: t.mode,
                tradePlan: {
                    plannedStop: t.plannedStop,
                    plannedTarget: t.plannedTarget,
                    entryThesis: t.entryThesis,
                    riskDefined: t.riskDefined
                },
                planAdherence: t.planAdherence || null
            }))
        };

        return JSON.stringify(exportData, null, 2);
    },

    downloadExport(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    exportTradesAsCSV(state) {
        const csv = this.exportToCSV(state);
        if (!csv) {
            console.warn('[Export] No trades to export');
            return false;
        }
        const filename = `zero_trades_${new Date().toISOString().split('T')[0]}.csv`;
        this.downloadExport(csv, filename, 'text/csv;charset=utf-8;');
        return true;
    },

    exportSessionAsJSON(state) {
        const json = this.exportToJSON(state);
        const filename = `zero_session_${new Date().toISOString().split('T')[0]}.json`;
        this.downloadExport(json, filename, 'application/json');
        return true;
    },

    // ==========================================
    // CONSISTENCY SCORE
    // ==========================================

    /**
     * Calculate Consistency Score (0-100)
     * Measures:
     * - Win Rate Stability (variance in rolling win rate)
     * - Position Sizing Consistency (variance in trade sizes)
     * - Trade Frequency Stability (time between trades)
     * - Strategy Focus (% of trades using top 2 strategies)
     */
    calculateConsistencyScore(state) {
        const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
        if (trades.length < 5) {
            return { score: null, message: 'Need 5+ trades for consistency score', breakdown: null };
        }

        const breakdown = {
            winRateStability: 0,
            sizingConsistency: 0,
            frequencyStability: 0,
            strategyFocus: 0
        };

        // 1. Win Rate Stability (25 pts)
        // Calculate rolling 5-trade win rates and measure variance
        const sellTrades = trades.filter(t => t.side === 'SELL');
        if (sellTrades.length >= 5) {
            const windowSize = Math.min(5, Math.floor(sellTrades.length / 2));
            const rollingWinRates = [];

            for (let i = windowSize; i <= sellTrades.length; i++) {
                const window = sellTrades.slice(i - windowSize, i);
                const wins = window.filter(t => (t.realizedPnlSol || 0) > 0).length;
                rollingWinRates.push(wins / windowSize);
            }

            if (rollingWinRates.length > 1) {
                const avg = rollingWinRates.reduce((a, b) => a + b, 0) / rollingWinRates.length;
                const variance = rollingWinRates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rollingWinRates.length;
                const stdDev = Math.sqrt(variance);
                // Lower stdDev = more stable = higher score
                breakdown.winRateStability = Math.max(0, 25 - (stdDev * 100));
            } else {
                breakdown.winRateStability = 20; // Not enough data
            }
        } else {
            breakdown.winRateStability = 15; // Minimal data
        }

        // 2. Position Sizing Consistency (25 pts)
        // Measure variance in SOL amounts
        const buyTrades = trades.filter(t => t.side === 'BUY');
        if (buyTrades.length >= 3) {
            const sizes = buyTrades.map(t => t.solAmount);
            const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
            const variance = sizes.reduce((sum, s) => sum + Math.pow(s - avgSize, 2), 0) / sizes.length;
            const cv = Math.sqrt(variance) / avgSize; // Coefficient of variation
            // Lower CV = more consistent sizing
            breakdown.sizingConsistency = Math.max(0, 25 - (cv * 25));
        } else {
            breakdown.sizingConsistency = 15;
        }

        // 3. Trade Frequency Stability (25 pts)
        // Measure variance in time between trades
        if (trades.length >= 4) {
            const intervals = [];
            for (let i = 1; i < trades.length; i++) {
                intervals.push(trades[i].ts - trades[i - 1].ts);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
            const cv = Math.sqrt(variance) / avgInterval;
            // Lower CV = more consistent timing
            breakdown.frequencyStability = Math.max(0, 25 - (cv * 12.5));
        } else {
            breakdown.frequencyStability = 15;
        }

        // 4. Strategy Focus (25 pts)
        // % of trades using top 2 strategies
        const strategyCounts = {};
        buyTrades.forEach(t => {
            const strat = t.strategy || 'Unknown';
            strategyCounts[strat] = (strategyCounts[strat] || 0) + 1;
        });

        const sortedStrategies = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1]);
        const top2Count = sortedStrategies.slice(0, 2).reduce((sum, [_, count]) => sum + count, 0);
        const focusRatio = buyTrades.length > 0 ? top2Count / buyTrades.length : 0;
        breakdown.strategyFocus = focusRatio * 25;

        // Calculate total score
        const score = Math.round(
            breakdown.winRateStability +
            breakdown.sizingConsistency +
            breakdown.frequencyStability +
            breakdown.strategyFocus
        );

        let message = '';
        if (score >= 80) message = 'Highly consistent trading patterns';
        else if (score >= 60) message = 'Good consistency, minor variations';
        else if (score >= 40) message = 'Moderate consistency, room for improvement';
        else message = 'Inconsistent patterns detected';

        return {
            score,
            message,
            breakdown: {
                winRateStability: Math.round(breakdown.winRateStability),
                sizingConsistency: Math.round(breakdown.sizingConsistency),
                frequencyStability: Math.round(breakdown.frequencyStability),
                strategyFocus: Math.round(breakdown.strategyFocus)
            }
        };
    }
};
