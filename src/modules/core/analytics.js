import { Store } from "../store.js";
import { FeatureManager } from "../featureManager.js";
import { Market } from "./market.js";
import { CoachingFeedback } from "./coaching-feedback.js";

// Event Categories
export const EVENT_CATEGORIES = {
  TRADE: "TRADE",
  ALERT: "ALERT",
  DISCIPLINE: "DISCIPLINE",
  SYSTEM: "SYSTEM",
  MILESTONE: "MILESTONE",
};

export const Analytics = {
  // --- Mode-aware state resolver ---
  _resolve(state) {
    const isReal = Store.isRealTradingMode();
    return {
      session: isReal ? state.shadowSession : state.session,
      trades: isReal ? state.shadowTrades : state.trades,
      positions: isReal ? state.shadowPositions : state.positions,
      behavior: isReal ? state.shadowBehavior : state.behavior,
      eventLog: isReal ? state.shadowEventLog : state.eventLog,
      isRealTrading: isReal,
    };
  },

  // ==========================================
  // PERSISTENT EVENT LOGGING
  // ==========================================

  logEvent(state, type, category, message, data = {}) {
    const { eventLog } = this._resolve(state);
    if (!eventLog) return;

    const event = {
      id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ts: Date.now(),
      type,
      category,
      message,
      data,
    };

    eventLog.push(event);

    // Keep only last 100 events
    if (eventLog.length > 100) {
      eventLog.splice(0, eventLog.length - 100);
    }

    console.log(`[EVENT LOG] [${category}] ${type}: ${message}`);
    return event;
  },

  logTradeEvent(state, trade) {
    const pnlText = trade.realizedPnlSol
      ? `P&L: ${trade.realizedPnlSol > 0 ? "+" : ""}${trade.realizedPnlSol.toFixed(4)} SOL`
      : `Size: ${trade.solAmount.toFixed(4)} SOL`;

    const message = `${trade.side} ${trade.symbol} @ $${trade.priceUsd?.toFixed(6) || "N/A"} | ${pnlText}`;

    this.logEvent(state, trade.side, EVENT_CATEGORIES.TRADE, message, {
      tradeId: trade.id,
      symbol: trade.symbol,
      priceUsd: trade.priceUsd,
      solAmount: trade.solAmount,
      realizedPnlSol: trade.realizedPnlSol,
      strategy: trade.strategy,
      riskDefined: trade.riskDefined,
    });
  },

  logDisciplineEvent(state, score, penalty, reasons) {
    if (penalty <= 0) return;

    const message = `Discipline -${penalty} pts: ${reasons.join(", ")}`;
    this.logEvent(state, "PENALTY", EVENT_CATEGORIES.DISCIPLINE, message, {
      score,
      penalty,
      reasons,
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
    const { eventLog } = this._resolve(state);
    let events = eventLog || [];

    if (category) {
      events = events.filter((e) => e.category === category);
    }

    // Sort by timestamp descending (most recent first)
    events = events.sort((a, b) => b.ts - a.ts);

    return events.slice(offset, offset + limit);
  },

  getEventStats(state) {
    const { eventLog } = this._resolve(state);
    const events = eventLog || [];
    const stats = {
      total: events.length,
      trades: events.filter((e) => e.category === EVENT_CATEGORIES.TRADE).length,
      alerts: events.filter((e) => e.category === EVENT_CATEGORIES.ALERT).length,
      disciplineEvents: events.filter((e) => e.category === EVENT_CATEGORIES.DISCIPLINE).length,
      milestones: events.filter((e) => e.category === EVENT_CATEGORIES.MILESTONE).length,
    };
    return stats;
  },

  analyzeRecentTrades(state) {
    const { trades: tradesMap } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    if (trades.length === 0) return null;

    const recentTrades = trades.slice(-10);

    let wins = 0,
      losses = 0;
    const totalHoldTimeMs = 0;
    let totalPnlSol = 0;
    let avgEntryMc = 0,
      avgExitMc = 0;
    let entryMcCount = 0,
      exitMcCount = 0;
    const quickFlips = 0;
    const longHolds = 0;

    for (const trade of recentTrades) {
      const pnl = trade.realizedPnlSol || 0;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;

      totalPnlSol += pnl;

      if (trade.marketCap) {
        avgExitMc += trade.marketCap;
        exitMcCount++;
      }
    }

    const winRate = recentTrades.length > 0 ? (wins / recentTrades.length) * 100 : 0;

    // Advanced Metrics
    const grossProfits = recentTrades.reduce(
      (sum, t) => sum + Math.max(0, t.realizedPnlSol || 0),
      0
    );
    const grossLosses = Math.abs(
      recentTrades.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0)
    );
    const profitFactor =
      grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : grossProfits > 0 ? "MAX" : "0.00";

    // Max Drawdown (Last 10 trades)
    let peak = 0,
      maxDd = 0,
      currentBal = 0;
    recentTrades.forEach((t) => {
      currentBal += t.realizedPnlSol || 0;
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
      totalPnlSol,
    };
  },

  calculateDiscipline(trade, state) {
    const { session, trades: tradesMap } = this._resolve(state);
    const flags = FeatureManager.resolveFlags(state, "DISCIPLINE_SCORING");
    if (!flags.enabled) return { score: session.disciplineScore || 100, penalty: 0, reasons: [] };

    // Base score: 100
    // Penalties are cumulative
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;

    let penalty = 0;
    const reasons = [];

    // 1. FOMO Check (Freq < 60s)
    if (prevTrade && trade.ts - prevTrade.ts < 60000) {
      penalty += 10;
      reasons.push("FOMO (Rapid logic)");
    }

    // 2. Strategy Check
    if (!trade.strategy || trade.strategy === "Unknown" || trade.strategy === "Other") {
      penalty += 5;
      reasons.push("No Strategy");
    }

    // 3. Oversize Check (> 50% of Balance)
    if (trade.side === "BUY") {
      const currentBal = session.balance + trade.solSize;
      if (trade.solSize > currentBal * 0.5) {
        penalty += 20;
        reasons.push("Oversizing (>50%)");
      }

      // 4. No Trade Plan (Elite feature - only penalize if feature is available)
      const planFlags = FeatureManager.resolveFlags(state, "TRADE_PLAN");
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
    let score = session.disciplineScore !== undefined ? session.disciplineScore : 100;
    score = Math.max(0, score - penalty);
    session.disciplineScore = score;

    if (penalty > 0) {
      console.log(`[DISCIPLINE] Score -${penalty} (${reasons.join(", ")})`);
      this.logDisciplineEvent(state, score, penalty, reasons);
    }

    return { score, penalty, reasons };
  },

  // Check if trade exit adhered to the original plan
  checkPlanAdherence(sellTrade, state) {
    let penalty = 0;
    const reasons = [];

    // Find the corresponding BUY trade for this position
    const { trades: tradesMap } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    const buyTrade = trades.find(
      (t) => t.side === "BUY" && t.mint === sellTrade.mint && t.ts < sellTrade.ts && t.riskDefined
    );

    if (!buyTrade || !buyTrade.plannedStop) return { penalty: 0, reasons: [] };

    const exitPrice = sellTrade.priceUsd;
    const plannedStop = buyTrade.plannedStop;
    const plannedTarget = buyTrade.plannedTarget;
    const entryPrice = buyTrade.priceUsd;

    // Stop Violation: Sold below the planned stop (didn't honor stop)
    // This means the trader held through the stop and then sold at an even worse price
    if (exitPrice < plannedStop && sellTrade.realizedPnlSol < 0) {
      const violationPct = (((plannedStop - exitPrice) / plannedStop) * 100).toFixed(1);
      penalty += 15;
      reasons.push(`Stop Violated (-${violationPct}% below stop)`);
    }

    // Early Exit: Sold significantly before target while in profit
    // Only flag if they had a target and exited way below it while still profitable
    if (plannedTarget && exitPrice < plannedTarget && sellTrade.realizedPnlSol > 0) {
      const targetDistance = ((plannedTarget - exitPrice) / plannedTarget) * 100;
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
      hitTarget: plannedTarget && exitPrice >= plannedTarget,
    };

    return { penalty, reasons };
  },

  // Calculate R-Multiple for a trade (requires defined risk)
  calculateRMultiple(sellTrade, state) {
    const { trades: tradesMap } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    const buyTrade = trades.find(
      (t) => t.side === "BUY" && t.mint === sellTrade.mint && t.ts < sellTrade.ts && t.riskDefined
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
      pnlPerUnit,
    };
  },

  updateStreaks(trade, state) {
    // Only update streaks on SELL trades
    if (trade.side !== "SELL") return;

    const { session } = this._resolve(state);
    const pnl = trade.realizedPnlSol || 0;

    if (pnl > 0) {
      // Win
      session.winStreak = (session.winStreak || 0) + 1;
      session.lossStreak = 0;
      console.log(`[ZERØ] Win! +${pnl.toFixed(4)} SOL. Win streak: ${session.winStreak}`);
    } else if (pnl < 0) {
      // Loss
      session.lossStreak = (session.lossStreak || 0) + 1;
      session.winStreak = 0;
      console.log(`[ZERØ] Loss. ${pnl.toFixed(4)} SOL. Loss streak: ${session.lossStreak}`);
    }

    // Equity Snapshot
    if (!session.equityHistory) session.equityHistory = [];
    session.equityHistory.push({
      ts: Date.now(),
      equity: session.balance + (session.realized || 0),
    });
    if (session.equityHistory.length > 50) session.equityHistory.shift();

    this.detectTilt(trade, state);
    this.detectFomo(trade, state);
    this.detectPanicSell(trade, state);
    this.detectSunkCost(trade, state);
    this.detectStrategyDrift(trade, state);
    this.monitorMarketRegime(state);
    this.updateProfile(state);

    // Live Trade Coaching - record outcome to update confidence scores
    CoachingFeedback.recordOutcome(trade);
  },

  monitorMarketRegime(state) {
    const flags = FeatureManager.resolveFlags(state, "ADVANCED_COACHING");
    if (!flags.enabled) return;

    const ctx = Market.context;
    if (!ctx) return;

    const vol = ctx.vol24h;
    const chg = Math.abs(ctx.priceChange24h);

    // 1. Choppy / Low Vol Warning
    if (vol < 500000 && Date.now() - (state.lastRegimeAlert || 0) > 3600000) {
      this.addAlert(
        state,
        "MARKET_REGIME",
        "LOW VOLUME: Liquidity is thin ($<500k). Slippage may be high."
      );
      state.lastRegimeAlert = Date.now();
    }

    // 2. High Volatility Warning
    if (chg > 50 && Date.now() - (state.lastRegimeAlert || 0) > 3600000) {
      this.addAlert(
        state,
        "MARKET_REGIME",
        "HIGH VOLATILITY: 24h change is >50%. Expect rapid swings."
      );
      state.lastRegimeAlert = Date.now();
    }
  },

  detectTilt(trade, state) {
    const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
    if (!flags.enabled) return;

    const { session, behavior } = this._resolve(state);
    const lossStreak = session.lossStreak || 0;
    if (lossStreak >= 3) {
      this.addAlert(state, "TILT", `TILT DETECTED: ${lossStreak} Losses in a row. Take a break.`);
      behavior.tiltFrequency = (behavior.tiltFrequency || 0) + 1;
    }
  },

  detectSunkCost(trade, state) {
    if (trade.side !== "BUY") return;
    const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
    if (!flags.enabled) return;

    const { positions, behavior } = this._resolve(state);
    const pos = positions[trade.mint];
    if (pos && (pos.pnlSol || 0) < 0) {
      this.addAlert(
        state,
        "SUNK_COST",
        "SUNK COST: Averaging down into a losing position increases risk."
      );
      behavior.sunkCostFrequency = (behavior.sunkCostFrequency || 0) + 1;
    }
  },

  detectOvertrading(state) {
    const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
    if (!flags.enabled) return;

    const { session, trades: tradesMap, behavior } = this._resolve(state);

    // RATE LIMIT: 5-min cooldown matches the detection window
    // so the same set of trades can't re-trigger the alert
    if (behavior.lastOvertradingAlertTs && Date.now() - behavior.lastOvertradingAlertTs < 300000) {
      return;
    }

    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);

    if (trades.length < 5) return;

    const last5 = trades.slice(-5);
    const timeSpan = last5[4].ts - last5[0].ts;
    const timeSinceLast = Date.now() - last5[4].ts;

    // 5 trades in less than 5 minutes
    // AND the last trade must be recent (within last 5 minutes)
    if (timeSpan < 300000 && timeSinceLast < 300000) {
      console.log(
        `[ZERØ ALERT] Overtrading Detected: 5 trades in ${(timeSpan / 1000).toFixed(1)}s`,
        last5.map((t) => t.id)
      );
      this.addAlert(
        state,
        "VELOCITY",
        "OVERTRADING: You're trading too fast. Stop and evaluate setups."
      );
      behavior.overtradingFrequency = (behavior.overtradingFrequency || 0) + 1;
      behavior.lastOvertradingAlertTs = Date.now();
    }
  },

  monitorProfitOverstay(state) {
    const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
    if (!flags.enabled) return;

    const { positions, behavior } = this._resolve(state);

    Object.values(positions).forEach((pos) => {
      if ((pos.qtyTokens || 0) <= 0) return; // skip closed positions

      const pnlPct = pos.pnlPct || 0;
      const peakPct = pos.peakPnlPct !== undefined ? pos.peakPnlPct : 0;

      // If it was up > 10% and now it's < 0%
      if (peakPct > 10 && pnlPct < 0) {
        if (!pos.alertedGreenToRed) {
          this.addAlert(
            state,
            "PROFIT_NEGLECT",
            `GREEN-TO-RED: ${pos.symbol} was up 10%+. Don't let winners die.`
          );
          pos.alertedGreenToRed = true;
          behavior.profitNeglectFrequency = (behavior.profitNeglectFrequency || 0) + 1;
        }
      }
    });
  },

  detectStrategyDrift(trade, state) {
    if (trade.side !== "BUY") return;
    const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
    if (!flags.enabled) return;

    const { trades: tradesMap, behavior } = this._resolve(state);

    if (trade.strategy === "Unknown" || trade.strategy === "Other") {
      const trades = Object.values(tradesMap || {});
      const profitableStrategies = trades
        .filter((t) => (t.realizedPnlSol || 0) > 0 && t.strategy !== "Unknown")
        .map((t) => t.strategy);

      if (profitableStrategies.length >= 3) {
        this.addAlert(
          state,
          "DRIFT",
          "STRATEGY DRIFT: Playing 'Unknown' instead of your winning setups."
        );
        behavior.strategyDriftFrequency = (behavior.strategyDriftFrequency || 0) + 1;
      }
    }
  },

  detectFomo(trade, state) {
    if (trade.side !== "BUY") return;
    const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION"); // Use Tilt Detection as proxy for behavioral
    if (!flags.enabled) return;

    const { trades: tradesMap, behavior } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;

    // FOMO: Rapid buy after a loss or without strategy at potentially high MC
    if (
      prevTrade &&
      trade.ts - prevTrade.ts < 30000 &&
      prevTrade.side === "SELL" &&
      (prevTrade.realizedPnlSol || 0) < 0
    ) {
      this.addAlert(state, "FOMO", "FOMO ALERT: Revenge trading detected.");
      behavior.fomoTrades = (behavior.fomoTrades || 0) + 1;
    }
  },

  detectPanicSell(trade, state) {
    if (trade.side !== "SELL") return;
    const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
    if (!flags.enabled) return;

    const { behavior } = this._resolve(state);

    // Panic Sell: Sell shortly after a price dip if not at target
    // For now, simple time-based check after entry
    if (trade.entryTs && trade.ts - trade.entryTs < 45000 && (trade.realizedPnlSol || 0) < 0) {
      this.addAlert(state, "PANIC", "PANIC SELL: You're cutting too early. Trust your stops.");
      behavior.panicSells = (behavior.panicSells || 0) + 1;
    }
  },

  addAlert(state, type, message) {
    const { session } = this._resolve(state);
    if (!session.activeAlerts) session.activeAlerts = [];
    const alert = { type, message, ts: Date.now() };
    session.activeAlerts.push(alert);

    // Keep only last 3 alerts (for active display)
    if (session.activeAlerts.length > 3) session.activeAlerts.shift();

    // Log to persistent event log
    this.logAlertEvent(state, type, message);

    console.log(`[ELITE ALERT] ${type}: ${message}`);
  },

  updateProfile(state) {
    const { behavior: b } = this._resolve(state);
    const totalMistakes = (b.tiltFrequency || 0) + (b.fomoTrades || 0) + (b.panicSells || 0);

    if (totalMistakes === 0) b.profile = "Disciplined";
    else if (b.tiltFrequency > 2) b.profile = "Emotional";
    else if (b.fomoTrades > 2) b.profile = "Impulsive";
    else if (b.panicSells > 2) b.profile = "Hesitant";
    else b.profile = "Improving";
  },

  getProfessorDebrief(state) {
    const { session } = this._resolve(state);
    const score = session.disciplineScore !== undefined ? session.disciplineScore : 100;
    const stats = this.analyzeRecentTrades(state) || { winRate: 0, style: "balanced" };

    let critique = "Keep your discipline score high to trade like a pro.";

    if (score < 70) {
      critique = "You're trading emotionally. Stop, breathe, and stick to your strategy.";
    } else if (stats.winRate > 60 && score >= 90) {
      critique = "Excellent execution. You're trading with professional-grade discipline.";
    } else if (stats.style === "scalper" && score < 90) {
      critique = "Scalping requires perfect discipline. Watch your sizing.";
    } else if (stats.totalTrades >= 3 && stats.winRate < 40) {
      critique = "Market conditions are tough. Focus on high-conviction setups only.";
    }

    return { score, critique };
  },

  generateXShareText(state) {
    const mode = state.settings?.tradingMode || "paper";
    const { trades: tradesMap, session } = this._resolve(state);
    const trades = Object.values(tradesMap || {});
    const sellTrades = trades.filter((t) => t.side === "SELL");

    // Calculate stats
    const wins = sellTrades.filter((t) => (t.realizedPnlSol || 0) > 0).length;
    const losses = sellTrades.filter((t) => (t.realizedPnlSol || 0) < 0).length;
    const totalPnl = session.realized || 0;
    const winRate = sellTrades.length > 0 ? ((wins / sellTrades.length) * 100).toFixed(0) : 0;
    const disciplineScore = session.disciplineScore || 100;

    // Get streak info
    const winStreak = session.winStreak || 0;
    const lossStreak = session.lossStreak || 0;
    const currentStreak = winStreak > 0 ? `${winStreak}W` : lossStreak > 0 ? `${lossStreak}L` : "0";

    // Format PNL
    const pnlFormatted = totalPnl >= 0 ? `+${totalPnl.toFixed(3)}` : totalPnl.toFixed(3);
    const pnlTag = totalPnl >= 0 ? "[PROFIT]" : "[DRAWDOWN]";

    // Generate post
    let text = `ZERO Trading Session Complete\n\n`;
    text += `${pnlTag} P&L: ${pnlFormatted} SOL\n`;
    text += `WIN RATE: ${winRate}%\n`;
    text += `HISTORY: ${wins}W / ${losses}L\n`;
    text += `STREAK: ${currentStreak}\n`;
    text += `DISCIPLINE: ${disciplineScore}/100\n\n`;

    // Mode-aware share copy (no emoji)
    if (mode === "shadow") {
      text += `Real trades analyzed using ZERO's advanced behavioral analysis.\n`;
    } else if (mode === "analysis") {
      text += `Real trades observed and reviewed with ZERO.\n`;
    } else {
      text += `Paper trading session tracked with ZERO.\n`;
    }

    text += `https://get-zero.xyz\n\n`;
    text += `#Solana #PaperTrading #Crypto`;

    return text;
  },

  /**
   * Analyze trades filtered by source category.
   * source: 'paper' | 'real' | 'all'
   */
  analyzeTradesBySource(state, source) {
    const { trades: tradesMap } = this._resolve(state);
    const allTrades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    let trades;
    if (source === "paper") {
      trades = allTrades.filter((t) => t.mode === "paper" || !t.mode);
    } else if (source === "real") {
      trades = allTrades.filter((t) => t.mode === "analysis" || t.mode === "shadow");
    } else {
      trades = allTrades;
    }

    if (trades.length === 0) return null;
    const recentTrades = trades.slice(-10);

    let wins = 0,
      losses = 0;
    let totalPnlSol = 0;

    for (const trade of recentTrades) {
      const pnl = trade.realizedPnlSol || 0;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
      totalPnlSol += pnl;
    }

    const winRate = recentTrades.length > 0 ? (wins / recentTrades.length) * 100 : 0;
    const grossProfits = recentTrades.reduce(
      (sum, t) => sum + Math.max(0, t.realizedPnlSol || 0),
      0
    );
    const grossLosses = Math.abs(
      recentTrades.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0)
    );
    const profitFactor =
      grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : grossProfits > 0 ? "MAX" : "0.00";

    let peak = 0,
      maxDd = 0,
      currentBal = 0;
    recentTrades.forEach((t) => {
      currentBal += t.realizedPnlSol || 0;
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
      totalPnlSol,
      source,
    };
  },

  // ==========================================
  // EXPORT FUNCTIONALITY
  // ==========================================

  exportToCSV(state) {
    const { trades: tradesMap } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    if (trades.length === 0) return null;

    // CSV Header
    const headers = [
      "Trade ID",
      "Timestamp",
      "Side",
      "Symbol",
      "Token Mint",
      "SOL Amount",
      "Token Qty",
      "Price USD",
      "Market Cap",
      "Realized PnL (SOL)",
      "Strategy",
      "Emotion",
      "Mode",
      "Planned Stop",
      "Planned Target",
      "Risk Defined",
      "Entry Thesis",
    ];

    const rows = trades.map((t) => [
      t.id,
      new Date(t.ts).toISOString(),
      t.side,
      t.symbol || "",
      t.mint || "",
      t.solAmount?.toFixed(6) || "",
      t.qtyTokens?.toFixed(6) || "",
      t.priceUsd?.toFixed(8) || "",
      t.marketCap?.toFixed(2) || "",
      t.realizedPnlSol?.toFixed(6) || "",
      t.strategy || "",
      t.emotion || "",
      t.mode || "paper",
      t.plannedStop?.toFixed(8) || "",
      t.plannedTarget?.toFixed(8) || "",
      t.riskDefined ? "Yes" : "No",
      `"${(t.entryThesis || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return csvContent;
  },

  exportToJSON(state) {
    const { trades: tradesMap, session, behavior } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: state.version || "1.0.0",
      session: {
        balance: session.balance,
        equity: session.equity,
        realized: session.realized,
        winStreak: session.winStreak,
        lossStreak: session.lossStreak,
        disciplineScore: session.disciplineScore,
        tradeCount: trades.length,
      },
      behavior: {
        profile: behavior.profile,
        tiltFrequency: behavior.tiltFrequency,
        fomoTrades: behavior.fomoTrades,
        panicSells: behavior.panicSells,
        sunkCostFrequency: behavior.sunkCostFrequency,
        overtradingFrequency: behavior.overtradingFrequency,
        profitNeglectFrequency: behavior.profitNeglectFrequency,
      },
      analytics: this.analyzeRecentTrades(state),
      trades: trades.map((t) => ({
        id: t.id,
        timestamp: new Date(t.ts).toISOString(),
        side: t.side,
        symbol: t.symbol,
        mint: t.mint,
        solAmount: t.solAmount,
        qtyTokens: t.qtyTokens,
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
          riskDefined: t.riskDefined,
        },
        planAdherence: t.planAdherence || null,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  },

  downloadExport(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
      console.warn("[Export] No trades to export");
      return false;
    }
    const filename = `zero_trades_${new Date().toISOString().split("T")[0]}.csv`;
    this.downloadExport(csv, filename, "text/csv;charset=utf-8;");
    return true;
  },

  exportSessionAsJSON(state) {
    const json = this.exportToJSON(state);
    const filename = `zero_session_${new Date().toISOString().split("T")[0]}.json`;
    this.downloadExport(json, filename, "application/json");
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
  // ==========================================
  // PERSONAL TRADER PROFILE (ELITE)
  // ==========================================

  /**
   * Generate a comprehensive trader profile based on historical data
   * Analyzes: Best strategies, worst conditions, optimal session length, best time of day
   */
  generateTraderProfile(state) {
    const { trades: tradesMap } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);

    if (trades.length < 10) {
      return {
        ready: false,
        message: "Need 10+ trades to generate your profile",
        tradesNeeded: 10 - trades.length,
      };
    }

    const sellTrades = trades.filter((t) => t.side === "SELL");
    const buyTrades = trades.filter((t) => t.side === "BUY");

    return {
      ready: true,
      generatedAt: Date.now(),
      tradeCount: trades.length,
      bestStrategies: this._analyzeBestStrategies(buyTrades, sellTrades, trades),
      worstConditions: this._analyzeWorstConditions(trades, state),
      optimalSessionLength: this._analyzeOptimalSessionLength(trades, state),
      bestTimeOfDay: this._analyzeBestTimeOfDay(sellTrades),
      tradingStyle: this._determineTradingStyle(trades),
      riskProfile: this._analyzeRiskProfile(buyTrades, state),
      emotionalPatterns: this._analyzeEmotionalPatterns(trades, state),
    };
  },

  _analyzeBestStrategies(buyTrades, sellTrades, allTrades) {
    const strategyStats = {};

    // Group by strategy
    buyTrades.forEach((buy) => {
      const strat = buy.strategy || "Unknown";
      if (!strategyStats[strat]) {
        strategyStats[strat] = { count: 0, wins: 0, totalPnl: 0, avgHoldTime: 0, trades: [] };
      }
      strategyStats[strat].count++;
      strategyStats[strat].trades.push(buy);
    });

    // Match sells to calculate P&L
    sellTrades.forEach((sell) => {
      const matchingBuy = allTrades.find(
        (t) => t.side === "BUY" && t.mint === sell.mint && t.ts < sell.ts
      );
      if (matchingBuy) {
        const strat = matchingBuy.strategy || "Unknown";
        if (strategyStats[strat]) {
          const pnl = sell.realizedPnlSol || 0;
          strategyStats[strat].totalPnl += pnl;
          if (pnl > 0) strategyStats[strat].wins++;
          strategyStats[strat].avgHoldTime += sell.ts - matchingBuy.ts;
        }
      }
    });

    // Calculate metrics
    const results = Object.entries(strategyStats)
      .filter(([_, s]) => s.count >= 2) // Need at least 2 trades
      .map(([name, s]) => ({
        name,
        count: s.count,
        winRate: s.count > 0 ? ((s.wins / s.count) * 100).toFixed(1) : 0,
        totalPnl: s.totalPnl,
        avgPnl: s.count > 0 ? s.totalPnl / s.count : 0,
        avgHoldTime: s.wins > 0 ? Math.round(s.avgHoldTime / s.wins / 60000) : 0, // in minutes
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl);

    return {
      top: results.slice(0, 3),
      worst: results
        .filter((s) => s.totalPnl < 0)
        .sort((a, b) => a.totalPnl - b.totalPnl)
        .slice(0, 2),
      mostUsed: results.sort((a, b) => b.count - a.count)[0] || null,
    };
  },

  _analyzeWorstConditions(trades, state) {
    const conditions = [];

    // 1. Performance after losses
    let afterLossWins = 0,
      afterLossTotal = 0;
    for (let i = 1; i < trades.length; i++) {
      if (trades[i - 1].side === "SELL" && (trades[i - 1].realizedPnlSol || 0) < 0) {
        afterLossTotal++;
        if (trades[i].side === "SELL" && (trades[i].realizedPnlSol || 0) > 0) {
          afterLossWins++;
        }
      }
    }
    if (afterLossTotal >= 3) {
      const afterLossWinRate = ((afterLossWins / afterLossTotal) * 100).toFixed(0);
      if (afterLossWinRate < 40) {
        conditions.push({
          type: "AFTER_LOSS",
          label: "After Losing Trades",
          severity: "high",
          stat: `${afterLossWinRate}% win rate`,
          advice: "Take a 5-minute break after losses before your next trade.",
        });
      }
    }

    // 2. Rapid trading performance
    let rapidWins = 0,
      rapidTotal = 0;
    for (let i = 1; i < trades.length; i++) {
      if (trades[i].ts - trades[i - 1].ts < 120000) {
        // Within 2 minutes
        rapidTotal++;
        if (trades[i].side === "SELL" && (trades[i].realizedPnlSol || 0) > 0) {
          rapidWins++;
        }
      }
    }
    if (rapidTotal >= 3) {
      const rapidWinRate = ((rapidWins / rapidTotal) * 100).toFixed(0);
      if (rapidWinRate < 35) {
        conditions.push({
          type: "RAPID_TRADING",
          label: "Rapid-Fire Trading",
          severity: "high",
          stat: `${rapidWinRate}% win rate`,
          advice: "Slow down. Wait at least 2 minutes between trades.",
        });
      }
    }

    // 3. Large position performance
    const avgSize =
      trades.filter((t) => t.side === "BUY").reduce((sum, t) => sum + (t.solAmount || 0), 0) /
      trades.filter((t) => t.side === "BUY").length;
    let largeWins = 0,
      largeTotal = 0;
    trades
      .filter((t) => t.side === "SELL")
      .forEach((t) => {
        const matchingBuy = trades.find(
          (b) => b.side === "BUY" && b.mint === t.mint && b.ts < t.ts
        );
        if (matchingBuy && matchingBuy.solAmount > avgSize * 1.5) {
          largeTotal++;
          if ((t.realizedPnlSol || 0) > 0) largeWins++;
        }
      });
    if (largeTotal >= 2) {
      const largeWinRate = ((largeWins / largeTotal) * 100).toFixed(0);
      if (largeWinRate < 40) {
        conditions.push({
          type: "LARGE_POSITIONS",
          label: "Oversized Positions",
          severity: "medium",
          stat: `${largeWinRate}% win rate`,
          advice: "Your large trades underperform. Stick to consistent sizing.",
        });
      }
    }

    // 4. Late session performance (last hour)
    const sessionTrades = this._groupBySession(trades, state);
    let lateWins = 0,
      lateTotal = 0;
    sessionTrades.forEach((session) => {
      if (session.length < 5) return;
      const sessionStart = session[0].ts;
      const lateThreshold = sessionStart + 60 * 60 * 1000; // 1 hour in
      session
        .filter((t) => t.ts > lateThreshold && t.side === "SELL")
        .forEach((t) => {
          lateTotal++;
          if ((t.realizedPnlSol || 0) > 0) lateWins++;
        });
    });
    if (lateTotal >= 3) {
      const lateWinRate = ((lateWins / lateTotal) * 100).toFixed(0);
      if (lateWinRate < 35) {
        conditions.push({
          type: "LATE_SESSION",
          label: "Extended Sessions",
          severity: "medium",
          stat: `${lateWinRate}% win rate`,
          advice: "Your performance drops after 1 hour. Consider shorter sessions.",
        });
      }
    }

    return conditions.sort(
      (a, b) => (b.severity === "high" ? 1 : 0) - (a.severity === "high" ? 1 : 0)
    );
  },

  _analyzeOptimalSessionLength(trades, state) {
    const sessionTrades = this._groupBySession(trades, state);
    if (sessionTrades.length < 2) {
      return { optimal: null, message: "Need more session data" };
    }

    const sessionPerformance = sessionTrades.map((session) => {
      const duration =
        session.length > 0 ? (session[session.length - 1].ts - session[0].ts) / 60000 : 0;
      const sells = session.filter((t) => t.side === "SELL");
      const pnl = sells.reduce((sum, t) => sum + (t.realizedPnlSol || 0), 0);
      const wins = sells.filter((t) => (t.realizedPnlSol || 0) > 0).length;
      const winRate = sells.length > 0 ? (wins / sells.length) * 100 : 0;

      return { duration, pnl, winRate, tradeCount: session.length };
    });

    // Find optimal duration bucket
    const buckets = {
      short: { range: "< 30 min", sessions: [], avgPnl: 0, avgWinRate: 0 },
      medium: { range: "30-60 min", sessions: [], avgPnl: 0, avgWinRate: 0 },
      long: { range: "60-120 min", sessions: [], avgPnl: 0, avgWinRate: 0 },
      extended: { range: "> 120 min", sessions: [], avgPnl: 0, avgWinRate: 0 },
    };

    sessionPerformance.forEach((s) => {
      if (s.duration < 30) buckets.short.sessions.push(s);
      else if (s.duration < 60) buckets.medium.sessions.push(s);
      else if (s.duration < 120) buckets.long.sessions.push(s);
      else buckets.extended.sessions.push(s);
    });

    Object.values(buckets).forEach((b) => {
      if (b.sessions.length > 0) {
        b.avgPnl = b.sessions.reduce((sum, s) => sum + s.pnl, 0) / b.sessions.length;
        b.avgWinRate = b.sessions.reduce((sum, s) => sum + s.winRate, 0) / b.sessions.length;
      }
    });

    const best = Object.entries(buckets)
      .filter(([_, b]) => b.sessions.length >= 1)
      .sort((a, b) => b[1].avgPnl - a[1].avgPnl)[0];

    return {
      optimal: best ? best[1].range : null,
      bestPnl: best ? best[1].avgPnl.toFixed(4) : 0,
      bestWinRate: best ? best[1].avgWinRate.toFixed(1) : 0,
      buckets: Object.fromEntries(
        Object.entries(buckets).map(([k, v]) => [
          k,
          {
            range: v.range,
            count: v.sessions.length,
            avgPnl: v.avgPnl.toFixed(4),
            avgWinRate: v.avgWinRate.toFixed(1),
          },
        ])
      ),
    };
  },

  _analyzeBestTimeOfDay(sellTrades) {
    if (sellTrades.length < 5) {
      return { best: null, message: "Need more trades" };
    }

    const timeSlots = {
      morning: { range: "6AM-12PM", wins: 0, total: 0, pnl: 0 },
      afternoon: { range: "12PM-6PM", wins: 0, total: 0, pnl: 0 },
      evening: { range: "6PM-12AM", wins: 0, total: 0, pnl: 0 },
      night: { range: "12AM-6AM", wins: 0, total: 0, pnl: 0 },
    };

    sellTrades.forEach((t) => {
      const hour = new Date(t.ts).getHours();
      let slot;
      if (hour >= 6 && hour < 12) slot = "morning";
      else if (hour >= 12 && hour < 18) slot = "afternoon";
      else if (hour >= 18 && hour < 24) slot = "evening";
      else slot = "night";

      timeSlots[slot].total++;
      timeSlots[slot].pnl += t.realizedPnlSol || 0;
      if ((t.realizedPnlSol || 0) > 0) timeSlots[slot].wins++;
    });

    const results = Object.entries(timeSlots)
      .filter(([_, s]) => s.total >= 2)
      .map(([name, s]) => ({
        name,
        range: s.range,
        winRate: s.total > 0 ? ((s.wins / s.total) * 100).toFixed(1) : 0,
        pnl: s.pnl,
        count: s.total,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    return {
      best: results[0] || null,
      worst: results[results.length - 1] || null,
      breakdown: results,
    };
  },

  _determineTradingStyle(trades) {
    const sellTrades = trades.filter((t) => t.side === "SELL");
    if (sellTrades.length < 5) return { style: "Unknown", description: "Need more data" };

    // Calculate average hold time
    let totalHoldTime = 0,
      holdCount = 0;
    sellTrades.forEach((sell) => {
      const buy = trades.find((t) => t.side === "BUY" && t.mint === sell.mint && t.ts < sell.ts);
      if (buy) {
        totalHoldTime += sell.ts - buy.ts;
        holdCount++;
      }
    });
    const avgHoldMinutes = holdCount > 0 ? totalHoldTime / holdCount / 60000 : 0;

    // Determine style
    if (avgHoldMinutes < 5) {
      return {
        style: "Scalper",
        description: "Quick in-and-out trades, high frequency",
        avgHold: avgHoldMinutes.toFixed(1),
      };
    } else if (avgHoldMinutes < 30) {
      return {
        style: "Day Trader",
        description: "Short-term positions, momentum focused",
        avgHold: avgHoldMinutes.toFixed(1),
      };
    } else if (avgHoldMinutes < 120) {
      return {
        style: "Swing Trader",
        description: "Medium holds, trend following",
        avgHold: avgHoldMinutes.toFixed(1),
      };
    } else {
      return {
        style: "Position Trader",
        description: "Long holds, conviction plays",
        avgHold: avgHoldMinutes.toFixed(1),
      };
    }
  },

  _analyzeRiskProfile(buyTrades, state) {
    if (buyTrades.length < 3) return { profile: "Unknown", avgRisk: 0 };

    const { session } = this._resolve(state);
    const startSol = session.balance || state.settings?.startSol || 10;
    const riskPcts = buyTrades.map((t) => (t.solAmount / startSol) * 100);
    const avgRisk = riskPcts.reduce((a, b) => a + b, 0) / riskPcts.length;
    const maxRisk = Math.max(...riskPcts);
    const plansUsed = buyTrades.filter((t) => t.riskDefined).length;
    const planRate = ((plansUsed / buyTrades.length) * 100).toFixed(0);

    let profile;
    if (avgRisk < 5) profile = "Conservative";
    else if (avgRisk < 15) profile = "Moderate";
    else if (avgRisk < 30) profile = "Aggressive";
    else profile = "High Risk";

    return {
      profile,
      avgRisk: avgRisk.toFixed(1),
      maxRisk: maxRisk.toFixed(1),
      planUsageRate: planRate,
      plansUsed,
    };
  },

  _analyzeEmotionalPatterns(trades, state) {
    const { behavior } = this._resolve(state);
    const patterns = [];

    if ((behavior.fomoTrades || 0) > 2) {
      patterns.push({
        type: "FOMO",
        frequency: behavior.fomoTrades,
        advice: "Wait 60 seconds before entering after seeing green candles.",
      });
    }
    if ((behavior.panicSells || 0) > 2) {
      patterns.push({
        type: "Panic Selling",
        frequency: behavior.panicSells,
        advice: "Set stop losses in advance and trust them.",
      });
    }
    if ((behavior.tiltFrequency || 0) > 1) {
      patterns.push({
        type: "Tilt Trading",
        frequency: behavior.tiltFrequency,
        advice: "Take a mandatory break after 3 consecutive losses.",
      });
    }
    if ((behavior.sunkCostFrequency || 0) > 1) {
      patterns.push({
        type: "Sunk Cost Bias",
        frequency: behavior.sunkCostFrequency,
        advice: "Never average down more than once per position.",
      });
    }

    return patterns;
  },

  _groupBySession(trades, state) {
    // Group trades into sessions (gap of > 30 mins = new session)
    const sessions = [];
    let currentSession = [];
    const SESSION_GAP = 30 * 60 * 1000; // 30 minutes

    trades.forEach((trade, i) => {
      if (i === 0) {
        currentSession.push(trade);
      } else if (trade.ts - trades[i - 1].ts > SESSION_GAP) {
        if (currentSession.length > 0) sessions.push(currentSession);
        currentSession = [trade];
      } else {
        currentSession.push(trade);
      }
    });
    if (currentSession.length > 0) sessions.push(currentSession);

    return sessions;
  },

  // ==========================================
  // CROSS-MODE TRADE FILTERING
  // ==========================================

  /**
   * Merge paper + shadow trades and filter by mode category.
   * modeFilter: 'paper' | 'real' | 'all'
   * Returns filtered trades as an object (same shape as trades map).
   */
  _getFilteredTradesMap(state, modeFilter) {
    const paperTrades = state.trades || {};
    const shadowTrades = state.shadowTrades || {};
    const merged = Object.assign({}, paperTrades, shadowTrades);

    if (modeFilter === "all") return merged;

    const filtered = {};
    for (const [id, trade] of Object.entries(merged)) {
      if (modeFilter === "paper") {
        if (trade.mode === "paper" || trade.mode === undefined) {
          filtered[id] = trade;
        }
      } else if (modeFilter === "real") {
        if (trade.mode === "analysis" || trade.mode === "shadow") {
          filtered[id] = trade;
        }
      }
    }
    return filtered;
  },

  // ==========================================
  // TIME-OF-DAY ANALYSIS
  // ==========================================

  /**
   * Analyze trade performance by hour of day (0-23, local time).
   * modeFilter: 'paper' | 'real' | 'all'
   */
  analyzeTimeOfDay(state, modeFilter) {
    const tradesMap = this._getFilteredTradesMap(state, modeFilter || "all");
    const sellTrades = Object.values(tradesMap).filter((t) => t.side === "SELL");

    // Initialize 24 buckets
    const buckets = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({ hour: h, netPnl: 0, wins: 0, losses: 0, count: 0 });
    }

    for (const trade of sellTrades) {
      const hour = new Date(trade.ts).getHours();
      const pnl = trade.realizedPnlSol || 0;
      buckets[hour].count++;
      buckets[hour].netPnl += pnl;
      if (pnl > 0) buckets[hour].wins++;
      else if (pnl < 0) buckets[hour].losses++;
    }

    // Top 3 hours by netPnl where count >= 5
    const qualifying = buckets.filter((b) => b.count >= 5);
    const topHours = qualifying
      .slice()
      .sort((a, b) => b.netPnl - a.netPnl)
      .slice(0, 3);

    return {
      buckets,
      topHours,
      hasEnoughData: qualifying.length >= 1,
    };
  },

  // ==========================================
  // MARKET CAP BUCKET ANALYSIS
  // ==========================================

  /**
   * Analyze trade performance by market cap at fill.
   * modeFilter: 'paper' | 'real' | 'all'
   */
  analyzeMarketCapBuckets(state, modeFilter) {
    const tradesMap = this._getFilteredTradesMap(state, modeFilter || "all");
    const sellTrades = Object.values(tradesMap).filter(
      (t) => t.side === "SELL" && t.marketCapUsdAtFill > 0
    );

    const ranges = [
      { label: "<1M", max: 1e6 },
      { label: "1-5M", max: 5e6 },
      { label: "5-20M", max: 20e6 },
      { label: "20-100M", max: 100e6 },
      { label: ">100M", max: Infinity },
    ];

    const buckets = ranges.map((r) => ({
      label: r.label,
      max: r.max,
      netPnl: 0,
      wins: 0,
      losses: 0,
      count: 0,
      winRate: 0,
    }));

    for (const trade of sellTrades) {
      const mc = trade.marketCapUsdAtFill;
      for (const bucket of buckets) {
        if (mc <= bucket.max) {
          const pnl = trade.realizedPnlSol || 0;
          bucket.count++;
          bucket.netPnl += pnl;
          if (pnl > 0) bucket.wins++;
          else if (pnl < 0) bucket.losses++;
          break;
        }
      }
    }

    // Calculate win rates
    for (const bucket of buckets) {
      bucket.winRate = bucket.count > 0 ? ((bucket.wins / bucket.count) * 100) : 0;
    }

    // Clean up internal max field before returning
    const result = buckets.map(({ label, netPnl, wins, losses, count, winRate }) => ({
      label, netPnl, wins, losses, count, winRate,
    }));

    return {
      buckets: result,
      hasData: sellTrades.length > 0,
    };
  },

  // ==========================================
  // PLAN ADHERENCE ANALYSIS
  // ==========================================

  /**
   * Analyze how well the trader followed their trade plans.
   * Uses active trades (mode-aware via Store).
   */
  analyzePlanAdherence(state) {
    const tradesMap = Store.getActiveTrades() || {};
    const sellTrades = Object.values(tradesMap).filter(
      (t) => t.side === "SELL" && t.planAdherence
    );

    let totalPlanned = sellTrades.length;
    let stopsRespected = 0;
    let totalStops = 0;
    let targetsHit = 0;
    let totalTargets = 0;

    for (const trade of sellTrades) {
      const pa = trade.planAdherence;
      if (pa.plannedStop !== undefined && pa.plannedStop !== null) {
        totalStops++;
        if (!pa.stopViolated) stopsRespected++;
      }
      if (pa.plannedTarget !== undefined && pa.plannedTarget !== null) {
        totalTargets++;
        if (pa.hitTarget) targetsHit++;
      }
    }

    return {
      totalPlanned,
      stopsRespected,
      totalStops,
      targetsHit,
      totalTargets,
    };
  },

  // ==========================================
  // EMOTION BREAKDOWN ANALYSIS
  // ==========================================

  /**
   * Analyze trade performance grouped by emotion tag.
   * Uses active trades (mode-aware via Store).
   */
  analyzeEmotionBreakdown(state) {
    const tradesMap = Store.getActiveTrades() || {};
    const sellTrades = Object.values(tradesMap).filter(
      (t) => t.side === "SELL" && t.emotion
    );

    const emotionMap = {};
    for (const trade of sellTrades) {
      const tag = trade.emotion;
      if (!emotionMap[tag]) {
        emotionMap[tag] = { tag, count: 0, netPnl: 0, wins: 0, losses: 0, winRate: 0 };
      }
      const entry = emotionMap[tag];
      const pnl = trade.realizedPnlSol || 0;
      entry.count++;
      entry.netPnl += pnl;
      if (pnl > 0) entry.wins++;
      else if (pnl < 0) entry.losses++;
    }

    const emotions = Object.values(emotionMap);
    for (const e of emotions) {
      e.winRate = e.count > 0 ? ((e.wins / e.count) * 100) : 0;
    }

    return {
      emotions,
      hasData: emotions.length > 0,
    };
  },

  // ==========================================
  // SESSION REPLAY — TRADE LOOKUP
  // ==========================================

  /**
   * Get trades for a specific session (current or historical/archived).
   * Looks up trade IDs in both paper and shadow trades.
   * Returns array sorted by timestamp ascending.
   */
  getTradesForSession(state, session) {
    if (!session || !Array.isArray(session.trades) || session.trades.length === 0) {
      return [];
    }

    const paperTrades = state.trades || {};
    const shadowTrades = state.shadowTrades || {};
    const results = [];

    for (const id of session.trades) {
      const trade = paperTrades[id] || shadowTrades[id];
      if (trade) results.push(trade);
    }

    results.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return results;
  },

  calculateConsistencyScore(state) {
    const { trades: tradesMap } = this._resolve(state);
    const trades = Object.values(tradesMap || {}).sort((a, b) => a.ts - b.ts);
    if (trades.length < 5) {
      return { score: null, message: "Need 5+ trades for consistency score", breakdown: null };
    }

    const breakdown = {
      winRateStability: 0,
      sizingConsistency: 0,
      frequencyStability: 0,
      strategyFocus: 0,
    };

    // 1. Win Rate Stability (25 pts)
    // Calculate rolling 5-trade win rates and measure variance
    const sellTrades = trades.filter((t) => t.side === "SELL");
    if (sellTrades.length >= 5) {
      const windowSize = Math.min(5, Math.floor(sellTrades.length / 2));
      const rollingWinRates = [];

      for (let i = windowSize; i <= sellTrades.length; i++) {
        const window = sellTrades.slice(i - windowSize, i);
        const wins = window.filter((t) => (t.realizedPnlSol || 0) > 0).length;
        rollingWinRates.push(wins / windowSize);
      }

      if (rollingWinRates.length > 1) {
        const avg = rollingWinRates.reduce((a, b) => a + b, 0) / rollingWinRates.length;
        const variance =
          rollingWinRates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) /
          rollingWinRates.length;
        const stdDev = Math.sqrt(variance);
        // Lower stdDev = more stable = higher score
        breakdown.winRateStability = Math.max(0, 25 - stdDev * 100);
      } else {
        breakdown.winRateStability = 20; // Not enough data
      }
    } else {
      breakdown.winRateStability = 15; // Minimal data
    }

    // 2. Position Sizing Consistency (25 pts)
    // Measure variance in SOL amounts
    const buyTrades = trades.filter((t) => t.side === "BUY");
    if (buyTrades.length >= 3) {
      const sizes = buyTrades.map((t) => t.solAmount);
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const variance = sizes.reduce((sum, s) => sum + Math.pow(s - avgSize, 2), 0) / sizes.length;
      const cv = Math.sqrt(variance) / avgSize; // Coefficient of variation
      // Lower CV = more consistent sizing
      breakdown.sizingConsistency = Math.max(0, 25 - cv * 25);
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
      const variance =
        intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
      const cv = Math.sqrt(variance) / avgInterval;
      // Lower CV = more consistent timing
      breakdown.frequencyStability = Math.max(0, 25 - cv * 12.5);
    } else {
      breakdown.frequencyStability = 15;
    }

    // 4. Strategy Focus (25 pts)
    // % of trades using top 2 strategies
    const strategyCounts = {};
    buyTrades.forEach((t) => {
      const strat = t.strategy || "Unknown";
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

    let message = "";
    if (score >= 80) message = "Highly consistent trading patterns";
    else if (score >= 60) message = "Good consistency, minor variations";
    else if (score >= 40) message = "Moderate consistency, room for improvement";
    else message = "Inconsistent patterns detected";

    return {
      score,
      message,
      breakdown: {
        winRateStability: Math.round(breakdown.winRateStability),
        sizingConsistency: Math.round(breakdown.sizingConsistency),
        frequencyStability: Math.round(breakdown.frequencyStability),
        strategyFocus: Math.round(breakdown.strategyFocus),
      },
    };
  },
};
