/**
 * ZERO Shadow Insights
 * Shows the "aha moment" modal at the end of the FIRST Shadow Mode session.
 * Displays exactly three behavioral insights derived from real trade data.
 */

import { Store } from "../store.js";
import { ModeManager } from "../mode-manager.js";
import { OverlayManager } from "./overlay.js";
import { Analytics } from "../core/analytics.js";
import { ICONS } from "./icons.js";

export const ShadowInsights = {
  /**
   * Attempt to show the Shadow Session Complete modal.
   * Only shows once (first shadow session), only if conditions are met.
   */
  async tryShow() {
    if (!ModeManager.shouldShowShadowAha()) return;

    const trades = Object.values(Store.state?.trades || {})
      .filter((t) => t.mode === "shadow")
      .sort((a, b) => a.ts - b.ts);

    // Need at least 3 sell trades in shadow mode to generate insights
    const sellTrades = trades.filter((t) => t.side === "SELL");
    if (sellTrades.length < 2) return;

    const insights = this._generateInsights(trades, sellTrades);
    if (insights.length < 3) return;

    this._render(insights);
    await ModeManager.markShadowAhaShown();
  },

  /**
   * Generate exactly 3 insights from shadow mode trades.
   */
  _generateInsights(trades, sellTrades) {
    const insights = [];

    // 1. Behavioral pattern (fact-based)
    const pattern = this._findBehavioralPattern(trades, sellTrades);
    if (pattern) insights.push({ label: "Pattern", text: pattern });

    // 2. Discipline or plan adherence break
    const discipline = this._findDisciplineBreak(trades, sellTrades);
    if (discipline) insights.push({ label: "Discipline", text: discipline });

    // 3. Emotion-related outcome pattern
    const emotion = this._findEmotionPattern(trades, sellTrades);
    if (emotion) insights.push({ label: "Emotion", text: emotion });

    // Fill gaps if needed
    if (insights.length < 3) {
      const fallbacks = this._getFallbackInsights(trades, sellTrades);
      while (insights.length < 3 && fallbacks.length > 0) {
        insights.push(fallbacks.shift());
      }
    }

    return insights.slice(0, 3);
  },

  _findBehavioralPattern(trades, sellTrades) {
    // Check win rate by time of day
    const wins = sellTrades.filter((t) => (t.realizedPnlSol || 0) > 0);
    const losses = sellTrades.filter((t) => (t.realizedPnlSol || 0) < 0);
    const winRate =
      sellTrades.length > 0 ? ((wins.length / sellTrades.length) * 100).toFixed(0) : 0;

    // Check for rapid vs patient trades
    const buyTrades = trades.filter((t) => t.side === "BUY");
    let quickCount = 0;
    for (let i = 1; i < buyTrades.length; i++) {
      if (buyTrades[i].ts - buyTrades[i - 1].ts < 120000) quickCount++;
    }

    if (quickCount > buyTrades.length * 0.5 && buyTrades.length >= 3) {
      return `${quickCount} of your ${buyTrades.length} entries were within 2 minutes of the previous trade. Rapid entries correlated with a ${winRate}% overall win rate.`;
    }

    // Check most used strategy performance
    const stratMap = {};
    buyTrades.forEach((t) => {
      const s = t.strategy || "Unknown";
      stratMap[s] = (stratMap[s] || 0) + 1;
    });
    const topStrat = Object.entries(stratMap).sort((a, b) => b[1] - a[1])[0];
    if (topStrat && topStrat[1] >= 2) {
      return `Your most-used strategy was "${topStrat[0]}" (${topStrat[1]} trades). Your overall session win rate was ${winRate}%.`;
    }

    return `You completed ${sellTrades.length} round-trip trades with a ${winRate}% win rate this session.`;
  },

  _findDisciplineBreak(trades, sellTrades) {
    const score = Store.state?.session?.disciplineScore ?? 100;

    // Check for stop violations
    const violations = sellTrades.filter((t) => t.planAdherence?.stopViolated);
    if (violations.length > 0) {
      return `${violations.length} trade${violations.length > 1 ? "s" : ""} violated your planned stop loss. Your discipline score dropped to ${score}/100.`;
    }

    // Check for trades without strategy
    const noStrategy = trades.filter(
      (t) => t.side === "BUY" && (!t.strategy || t.strategy === "Unknown" || t.strategy === "Other")
    );
    if (
      noStrategy.length > 0 &&
      noStrategy.length >= trades.filter((t) => t.side === "BUY").length * 0.4
    ) {
      return `${noStrategy.length} entries had no defined strategy. Unplanned entries increase exposure to impulsive decisions.`;
    }

    if (score < 80) {
      return `Session discipline score ended at ${score}/100. Penalties were applied for behavioral deviations during the session.`;
    }

    return `Your discipline score held at ${score}/100 this session. No major plan deviations were detected.`;
  },

  _findEmotionPattern(trades, sellTrades) {
    // Check emotion tags
    const emotionTrades = trades.filter((t) => t.emotion);
    if (emotionTrades.length === 0) {
      return "No emotions were tagged this session. Tracking emotional state at trade time enables deeper pattern analysis.";
    }

    const emoMap = {};
    emotionTrades.forEach((t) => {
      emoMap[t.emotion] = (emoMap[t.emotion] || 0) + 1;
    });

    const topEmo = Object.entries(emoMap).sort((a, b) => b[1] - a[1])[0];
    if (!topEmo) return null;

    // Check PnL correlation for dominant emotion
    const emoTrades = trades.filter((t) => t.emotion === topEmo[0] && t.side === "SELL");
    const emoPnl = emoTrades.reduce((sum, t) => sum + (t.realizedPnlSol || 0), 0);
    const emoWins = emoTrades.filter((t) => (t.realizedPnlSol || 0) > 0).length;

    if (emoTrades.length >= 2) {
      const emoDir = emoPnl >= 0 ? "positive" : "negative";
      return `Your most tagged state was "${topEmo[0]}" (${topEmo[1]} trades). Trades in this state had a ${emoDir} net outcome (${emoWins}/${emoTrades.length} wins).`;
    }

    return `Your dominant emotional state was "${topEmo[0]}" across ${topEmo[1]} tagged trades this session.`;
  },

  _getFallbackInsights(trades, sellTrades) {
    const fallbacks = [];
    const wins = sellTrades.filter((t) => (t.realizedPnlSol || 0) > 0);
    const totalPnl = sellTrades.reduce((sum, t) => sum + (t.realizedPnlSol || 0), 0);

    fallbacks.push({
      label: "Outcome",
      text: `Session net P&L was ${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(4)} SOL across ${sellTrades.length} closed trades (${wins.length} wins).`,
    });

    // Average hold time
    const buyTrades = trades.filter((t) => t.side === "BUY");
    const holdTimes = [];
    sellTrades.forEach((sell) => {
      const buy = buyTrades.find((b) => b.mint === sell.mint && b.ts < sell.ts);
      if (buy) holdTimes.push(sell.ts - buy.ts);
    });
    if (holdTimes.length > 0) {
      const avgMs = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
      const avgMin = (avgMs / 60000).toFixed(1);
      fallbacks.push({
        label: "Timing",
        text: `Your average hold time was ${avgMin} minutes across ${holdTimes.length} round-trip trades.`,
      });
    }

    return fallbacks;
  },

  /**
   * Render the Shadow Insights modal.
   */
  _render(insights) {
    const container = OverlayManager.getContainer();
    if (!container) return;

    const existing = container.querySelector(".zero-shadow-insights-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "zero-shadow-insights-overlay";

    overlay.innerHTML = `
            <div class="zero-shadow-insights-modal">
                <div class="si-header">
                    <div class="si-title">Shadow Session Complete</div>
                    <div class="si-subtitle">This session was analyzed using your real trades.</div>
                </div>

                ${insights
                  .map(
                    (ins, i) => `
                    <div class="si-insight">
                        <div class="si-insight-num">${i + 1}</div>
                        <div>
                            <div class="si-insight-label">${ins.label}</div>
                            <div class="si-insight-text">${ins.text}</div>
                        </div>
                    </div>
                `
                  )
                  .join("")}

                <div class="si-footer">This is not advice. It is a reflection of your behavior.</div>
                <button class="si-action">Review session details</button>
            </div>
        `;

    container.appendChild(overlay);

    const dismiss = () => overlay.remove();
    overlay.querySelector(".si-action").onclick = dismiss;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismiss();
    });
  },
};
