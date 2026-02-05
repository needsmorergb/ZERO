/**
 * Live Trade Coaching Evaluator
 *
 * Pre-trade trigger evaluation engine that surfaces calm, data-driven
 * coaching alerts when the trader's edge is at risk.
 *
 * Constraints:
 * - No AI/API calls - deterministic messaging only
 * - No trade blocking - user always has agency
 * - No new telemetry - uses existing analytics data
 */

import { Store } from '../store.js';
import { FeatureManager } from '../featureManager.js';
import { Analytics } from './analytics.js';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getTradesInWindow(state, windowMs) {
    const now = Date.now();
    const trades = Object.values(state.trades || {})
        .filter(t => t.mode === (state.settings?.tradingMode || 'paper'))
        .filter(t => (now - t.ts) < windowMs)
        .sort((a, b) => a.ts - b.ts);
    return trades;
}

function getOverallWinRate(state) {
    const trades = Object.values(state.trades || {})
        .filter(t => t.mode === (state.settings?.tradingMode || 'paper'))
        .filter(t => t.side === 'SELL');

    if (trades.length < 5) return null;

    const wins = trades.filter(t => (t.realizedPnlSol || 0) > 0).length;
    return ((wins / trades.length) * 100).toFixed(0);
}

function getRapidTradeWinRate(state) {
    const trades = Object.values(state.trades || {})
        .filter(t => t.mode === (state.settings?.tradingMode || 'paper'))
        .sort((a, b) => a.ts - b.ts);

    let rapidSells = [];
    for (let i = 1; i < trades.length; i++) {
        if (trades[i].ts - trades[i - 1].ts < 60000) { // Within 60s
            if (trades[i].side === 'SELL') {
                rapidSells.push(trades[i]);
            }
        }
    }

    if (rapidSells.length < 3) return null;

    const wins = rapidSells.filter(t => (t.realizedPnlSol || 0) > 0).length;
    return ((wins / rapidSells.length) * 100).toFixed(0);
}

function getAveragePositionSize(state) {
    const buyTrades = Object.values(state.trades || {})
        .filter(t => t.mode === (state.settings?.tradingMode || 'paper'))
        .filter(t => t.side === 'BUY');

    if (buyTrades.length < 3) return 10; // Default 10%

    const startSol = state.settings?.startSol || 10;
    const sizes = buyTrades.map(t => (t.solAmount / startSol) * 100);
    return sizes.reduce((a, b) => a + b, 0) / sizes.length;
}

function getAverageSessionPnl(state) {
    const history = state.sessionHistory || [];
    if (history.length < 2) return 0.5; // Default to 0.5 SOL

    const pnls = history.map(s => s.realized || 0).filter(p => p > 0);
    if (pnls.length === 0) return 0.5;

    return pnls.reduce((a, b) => a + b, 0) / pnls.length;
}

function parseOptimalMax(optimalRange) {
    // Parse "30-60 min" -> 60, "< 30 min" -> 30, "> 120 min" -> 180
    if (!optimalRange) return 60;
    if (optimalRange.includes('<')) return 30;
    if (optimalRange.includes('>')) return 180;
    const match = optimalRange.match(/(\d+)-(\d+)/);
    if (match) return parseInt(match[2], 10);
    return 60;
}

function getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 24) return 'evening';
    return 'night';
}

function findStrategyWinRate(strategyStats, strategy) {
    if (!strategyStats?.top) return null;
    const found = strategyStats.top.find(s => s.name === strategy);
    return found ? parseFloat(found.winRate) : null;
}

function hasMinimumData(state) {
    const trades = Object.values(state.trades || {})
        .filter(t => t.mode === (state.settings?.tradingMode || 'paper'));
    return trades.length >= 10;
}

// ==========================================
// TRIGGER DEFINITIONS
// ==========================================

const TRIGGERS = {
    RAPID_TRADES: {
        id: 'rapid_trades',
        evaluate: (context, state) => {
            const recentTrades = getTradesInWindow(state, 2 * 60 * 1000); // 2 min window
            if (recentTrades.length < 3) return null;

            const historicalWinRate = getOverallWinRate(state);
            const rapidWinRate = getRapidTradeWinRate(state);

            // Need both stats to show personalized message
            if (!historicalWinRate || !rapidWinRate) {
                return {
                    triggerId: 'rapid_trades',
                    severity: 70,
                    confidence: state.coachingHistory?.rapid_trades?.confidence || 0.5,
                    data: { recentCount: recentTrades.length, historicalWinRate: null, rapidWinRate: null }
                };
            }

            return {
                triggerId: 'rapid_trades',
                severity: 70,
                confidence: state.coachingHistory?.rapid_trades?.confidence || 0.5,
                data: { recentCount: recentTrades.length, historicalWinRate, rapidWinRate }
            };
        },
        getMessage: (data, isElite) => {
            if (!isElite || !data.historicalWinRate || !data.rapidWinRate) {
                return {
                    main: "Rapid trading pattern detected.\nThis behavior historically underperforms.",
                    footer: "Upgrade to Elite to view personalized coaching."
                };
            }
            return {
                main: `Your last ${data.recentCount} trades were placed in under 2 minutes.\nWhen entries cluster this tightly, your win rate drops from ${data.historicalWinRate}% to ${data.rapidWinRate}%.\nConsider spacing the next entry.`
            };
        }
    },

    STRATEGY_DRIFT: {
        id: 'strategy_drift',
        evaluate: (context, state) => {
            const { strategy } = context;
            if (!strategy || strategy === 'Unknown' || strategy === 'Other') return null;

            const trades = Object.values(state.trades || {})
                .filter(t => t.mode === (state.settings?.tradingMode || 'paper'))
                .sort((a, b) => a.ts - b.ts);

            const buyTrades = trades.filter(t => t.side === 'BUY');
            const sellTrades = trades.filter(t => t.side === 'SELL');

            if (buyTrades.length < 5 || sellTrades.length < 5) return null;

            const strategyStats = Analytics._analyzeBestStrategies(buyTrades, sellTrades, trades);
            if (!strategyStats?.top?.[0]) return null;

            const bestStrategy = strategyStats.top[0];
            const currentStrategyWR = findStrategyWinRate(strategyStats, strategy);

            // Only alert if current strategy is significantly worse than best
            if (currentStrategyWR === null) return null;
            if (currentStrategyWR >= parseFloat(bestStrategy.winRate) - 15) return null;

            return {
                triggerId: 'strategy_drift',
                severity: 50,
                confidence: state.coachingHistory?.strategy_drift?.confidence || 0.5,
                data: {
                    currentStrategy: strategy,
                    currentWR: currentStrategyWR,
                    bestStrategy: bestStrategy.name,
                    bestWR: bestStrategy.winRate
                }
            };
        },
        getMessage: (data, isElite) => {
            if (!isElite) {
                return {
                    main: "Strategy alignment alert.\nYour selected approach has lower historical performance.",
                    footer: "Upgrade to Elite to view personalized coaching."
                };
            }
            return {
                main: `This session favors your ${data.bestStrategy} strategy (${data.bestWR}% WR).\nYour ${data.currentStrategy} setup is currently ${data.currentWR}%.\nEdge appears stronger when you stay aligned.`
            };
        }
    },

    SESSION_FATIGUE: {
        id: 'session_fatigue',
        evaluate: (context, state) => {
            const sessionStart = state.session?.startTime || Date.now();
            const sessionMinutes = (Date.now() - sessionStart) / 60000;

            // Don't alert until at least 60 minutes
            if (sessionMinutes < 60) return null;

            const trades = Object.values(state.trades || {})
                .filter(t => t.mode === (state.settings?.tradingMode || 'paper'))
                .sort((a, b) => a.ts - b.ts);

            if (trades.length < 10) return null;

            const optimalLength = Analytics._analyzeOptimalSessionLength(trades, state);
            if (!optimalLength?.optimal) return null;

            const optimalMax = parseOptimalMax(optimalLength.optimal);
            if (sessionMinutes <= optimalMax) return null;

            return {
                triggerId: 'session_fatigue',
                severity: 60,
                confidence: state.coachingHistory?.session_fatigue?.confidence || 0.5,
                data: { currentMinutes: Math.round(sessionMinutes), optimalMax }
            };
        },
        getMessage: (data, isElite) => {
            if (!isElite) {
                return {
                    main: "Extended session detected.\nPerformance typically declines in longer sessions.",
                    footer: "Upgrade to Elite to view personalized coaching."
                };
            }
            return {
                main: `You've been active for ${data.currentMinutes} minutes.\nHistorically, performance declines after ~${data.optimalMax} minutes.\nThis is where discipline matters most.`
            };
        }
    },

    OVERSIZED_POSITION: {
        id: 'oversized_position',
        evaluate: (context, state) => {
            const { solAmount, side } = context;
            if (side !== 'BUY' || !solAmount) return null;

            const balance = state.session?.balance || 0;
            if (balance <= 0) return null;

            const positionPct = (solAmount / balance) * 100;
            const avgPositionPct = getAveragePositionSize(state);

            // Only alert if position is 2x+ larger than average AND > 15%
            if (positionPct <= avgPositionPct * 2 || positionPct < 15) return null;

            return {
                triggerId: 'oversized_position',
                severity: 80,
                confidence: state.coachingHistory?.oversized_position?.confidence || 0.5,
                data: { positionPct: Math.round(positionPct), avgPct: Math.round(avgPositionPct) }
            };
        },
        getMessage: (data, isElite) => {
            if (!isElite) {
                return {
                    main: "Position size exceeds typical range.\nThis carries elevated drawdown exposure.",
                    footer: "Upgrade to Elite to view personalized coaching."
                };
            }
            return {
                main: `This position represents ${data.positionPct}% of your balance.\nYour average profitable risk is ~${data.avgPct}%.\nThis entry carries elevated drawdown exposure.`
            };
        }
    },

    POOR_TIME_OF_DAY: {
        id: 'poor_time_of_day',
        evaluate: (context, state) => {
            const trades = Object.values(state.trades || {})
                .filter(t => t.mode === (state.settings?.tradingMode || 'paper'))
                .filter(t => t.side === 'SELL');

            if (trades.length < 10) return null;

            const timeAnalysis = Analytics._analyzeBestTimeOfDay(trades);
            if (!timeAnalysis?.worst || !timeAnalysis?.best) return null;

            const currentHour = new Date().getHours();
            const currentSlot = getTimeSlot(currentHour);

            // Only alert if current time matches worst slot
            if (currentSlot !== timeAnalysis.worst.name) return null;

            // Only alert if worst slot is actually bad (< 40% win rate)
            if (parseFloat(timeAnalysis.worst.winRate) > 40) return null;

            return {
                triggerId: 'poor_time_of_day',
                severity: 40,
                confidence: state.coachingHistory?.poor_time_of_day?.confidence || 0.5,
                data: {
                    currentSlot: timeAnalysis.worst.range,
                    winRate: timeAnalysis.worst.winRate,
                    bestSlot: timeAnalysis.best.range,
                    bestWinRate: timeAnalysis.best.winRate
                }
            };
        },
        getMessage: (data, isElite) => {
            if (!isElite) {
                return {
                    main: "Trading outside optimal hours.\nLiquidity conditions may be suboptimal.",
                    footer: "Upgrade to Elite to view personalized coaching."
                };
            }
            return {
                main: `This trade falls outside your strongest trading window.\n${data.currentSlot} sessions average ${data.winRate}% win rate.\nYour best window is ${data.bestSlot} (${data.bestWinRate}%).`
            };
        }
    },

    LOSS_STREAK: {
        id: 'loss_streak',
        evaluate: (context, state) => {
            const lossStreak = state.session?.lossStreak || 0;
            if (lossStreak < 2) return null;

            return {
                triggerId: 'loss_streak',
                severity: 65,
                confidence: state.coachingHistory?.loss_streak?.confidence || 0.5,
                data: { streakLength: lossStreak }
            };
        },
        getMessage: (data, isElite) => {
            if (!isElite) {
                return {
                    main: "Consecutive losses detected.\nTrades after this pattern historically underperform.",
                    footer: "Upgrade to Elite to view personalized coaching."
                };
            }
            return {
                main: `${data.streakLength} consecutive losses detected.\nTrades placed immediately after this pattern historically underperform.\nA short pause tends to preserve session equity.`
            };
        }
    },

    PROFIT_GIVEBACK: {
        id: 'profit_giveback',
        evaluate: (context, state) => {
            const currentPnl = state.session?.realized || 0;
            if (currentPnl <= 0) return null;

            const avgSessionPnl = getAverageSessionPnl(state);
            if (currentPnl <= avgSessionPnl) return null;

            return {
                triggerId: 'profit_giveback',
                severity: 55,
                confidence: state.coachingHistory?.profit_giveback?.confidence || 0.5,
                data: { currentPnl: currentPnl.toFixed(2), avgPnl: avgSessionPnl.toFixed(2) }
            };
        },
        getMessage: (data, isElite) => {
            if (!isElite) {
                return {
                    main: "Session profit exceeds historical average.\nThis level often precedes profit giveback.",
                    footer: "Upgrade to Elite to view personalized coaching."
                };
            }
            return {
                main: `You're up +${data.currentPnl} SOL this session.\nYour average session close is +${data.avgPnl} SOL.\nThis level often precedes profit giveback.`
            };
        }
    }
};

// ==========================================
// MAIN EVALUATOR
// ==========================================

export const CoachingEvaluator = {
    /**
     * Evaluates all triggers and returns the highest-severity alert (if any)
     * @param {Object} context - { side, solAmount, strategy, mint, pct }
     * @param {Object} state - Full store state
     * @returns {Object|null} - { triggerId, severity, message, confidence } or null
     */
    evaluate(context, state) {
        // Skip if in analysis mode (no trades executed)
        if (state.settings?.tradingMode === 'analysis') return null;

        // Skip if insufficient historical data
        if (!hasMinimumData(state)) return null;

        const isElite = FeatureManager.isElite(state);
        const results = [];

        for (const trigger of Object.values(TRIGGERS)) {
            try {
                const result = trigger.evaluate(context, state);
                if (result && result.severity > 0) {
                    // Check confidence threshold (skip if user handles this well)
                    if (result.confidence < 0.3) continue;

                    // Check cooldown (don't spam same trigger)
                    if (this.isOnCooldown(state, result.triggerId)) continue;

                    // Check if user paused this trigger
                    if (this.isPaused(state, result.triggerId)) continue;

                    const message = trigger.getMessage(result.data, isElite);
                    results.push({ ...result, message });
                }
            } catch (e) {
                console.warn(`[Coaching] Trigger ${trigger.id} failed:`, e);
            }
        }

        if (results.length === 0) return null;

        // Return highest severity only
        results.sort((a, b) => b.severity - a.severity);
        return results[0];
    },

    /**
     * Check if trigger is on cooldown (prevent spam)
     * 5 minute cooldown per trigger
     */
    isOnCooldown(state, triggerId) {
        const lastShown = state.coachingHistory?.[triggerId]?.lastShownAt || 0;
        const cooldownMs = 5 * 60 * 1000; // 5 minutes
        return (Date.now() - lastShown) < cooldownMs;
    },

    /**
     * Check if user has paused this trigger
     */
    isPaused(state, triggerId) {
        const pausedUntil = state.coachingHistory?.[triggerId]?.pausedUntil || 0;
        return Date.now() < pausedUntil;
    }
};
