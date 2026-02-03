import { Store } from "../store.js";
import { OverlayManager } from "./overlay.js";
import { FeatureManager, TEASED_FEATURES } from "../featureManager.js";
import { renderEliteLockedCard } from "./elite-helpers.js";
import { ICONS } from "./icons.js";

const INSIGHTS_CSS = `
.insights-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #f8fafc;
    pointer-events: auto;
}

.insights-modal {
    width: 520px;
    max-width: 95vw;
    max-height: 85vh;
    background: #0f1218;
    border: 1px solid rgba(139, 92, 246, 0.12);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px -16px rgba(0, 0, 0, 0.7);
}

.insights-header {
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}

.insights-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.insights-header-icon {
    color: #8b5cf6;
    display: flex;
    align-items: center;
}

.insights-title {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
}

.insights-subtitle {
    font-size: 11px;
    color: #475569;
    margin-top: 2px;
    font-weight: 500;
}

.insights-close {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #64748b;
    font-size: 13px;
    cursor: pointer;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    line-height: 1;
}

.insights-close:hover {
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
}

.insights-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px 24px;
}

.insights-scroll::-webkit-scrollbar { width: 4px; }
.insights-scroll::-webkit-scrollbar-track { background: transparent; }
.insights-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }

.insights-intro {
    font-size: 12px;
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 20px;
    padding: 14px 16px;
    background: rgba(139, 92, 246, 0.04);
    border: 1px solid rgba(139, 92, 246, 0.08);
    border-radius: 10px;
}

.insights-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.insights-section-label {
    font-size: 9px;
    font-weight: 700;
    color: #3f4a5a;
    letter-spacing: 1.2px;
    margin-bottom: 8px;
    margin-top: 16px;
}

.insights-section-label:first-child {
    margin-top: 0;
}

.insights-elite-card {
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.025);
    border-radius: 10px;
    padding: 14px 16px;
}

.insights-elite-card-title {
    font-size: 12px;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 4px;
}

.insights-elite-card-value {
    font-size: 20px;
    font-weight: 800;
    color: #8b5cf6;
}

.insights-elite-card-desc {
    font-size: 11px;
    color: #64748b;
    margin-top: 4px;
}

.insights-nodata {
    font-size: 12px;
    color: #475569;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    text-align: center;
}

.insights-disclaimer {
    font-size: 10px;
    color: #334155;
    text-align: center;
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
}
`;

export const Insights = {
  isOpen: false,

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  },

  open() {
    this.isOpen = true;
    this.render();
  },

  close() {
    this.isOpen = false;
    const root = OverlayManager.getShadowRoot();
    const overlay = root.querySelector(".insights-overlay");
    if (overlay) overlay.remove();
  },

  render() {
    const root = OverlayManager.getShadowRoot();
    let overlay = root.querySelector(".insights-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "insights-overlay";

      if (!root.getElementById("insights-styles")) {
        const style = document.createElement("style");
        style.id = "insights-styles";
        style.textContent = INSIGHTS_CSS;
        root.appendChild(style);
      }

      root.appendChild(overlay);
    }

    const state = Store.state;
    const isElite = FeatureManager.isElite(state);

    overlay.innerHTML = `
            <div class="insights-modal">
                <div class="insights-header">
                    <div class="insights-header-left">
                        <div class="insights-header-icon">${ICONS.BRAIN}</div>
                        <div>
                            <div class="insights-title">Advanced Insights</div>
                            <div class="insights-subtitle">${isElite ? "Behavioral analytics & patterns" : "Available in Elite"}</div>
                        </div>
                    </div>
                    <button class="insights-close" id="insights-close-btn">\u2715</button>
                </div>
                <div class="insights-scroll">
                    ${isElite ? this.renderEliteContent(state) : this.renderFreeContent()}
                    <div class="insights-disclaimer">Based on your recorded sessions. Not financial advice.</div>
                </div>
            </div>
        `;

    // Event bindings
    const self = this;
    const closeBtn = overlay.querySelector("#insights-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        self.close();
      });
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) self.close();
    };
  },

  renderFreeContent() {
    const categories = [
      {
        label: "BEHAVIORAL ANALYSIS",
        features: ["ELITE_TILT_DETECTION", "ELITE_EMOTION_ANALYTICS", "ELITE_TRADER_PROFILE"],
      },
      {
        label: "TRADE INTELLIGENCE",
        features: ["ELITE_DISCIPLINE", "ELITE_STRATEGY_ANALYTICS", "ELITE_RISK_METRICS"],
      },
      {
        label: "SESSION & CONTEXT",
        features: [
          "ELITE_SESSION_REPLAY",
          "ELITE_AI_DEBRIEF",
          "ELITE_MARKET_CONTEXT",
          "ELITE_TRADE_PLAN",
          "ELITE_TIME_ANALYSIS",
          "ELITE_MARKETCAP_ANALYSIS",
        ],
      },
    ];

    const featureMap = {};
    TEASED_FEATURES.ELITE.forEach((f) => {
      featureMap[f.id] = f;
    });

    let html = `
            <div class="insights-intro">
                Advanced Insights reveals why your results happen — not just what happened.
                Behavioral patterns, discipline tracking, and cross-session analytics help you identify
                and break costly habits.
            </div>
        `;

    categories.forEach((cat) => {
      html += `<div class="insights-section-label">${cat.label}</div>`;
      html += `<div class="insights-grid">`;
      cat.features.forEach((fId) => {
        const f = featureMap[fId];
        if (f) html += renderEliteLockedCard(f.name, f.desc);
      });
      html += `</div>`;
    });

    return html;
  },

  renderEliteContent(state) {
    const session = Store.getActiveSession();
    const behavior = Store.getActiveBehavior();

    let html = "";

    // Existing: Session Overview
    html += `
      <div class="insights-section-label">SESSION OVERVIEW</div>
      <div class="insights-grid">
        <div class="insights-elite-card">
          <div class="insights-elite-card-title">Discipline Score</div>
          <div class="insights-elite-card-value">${session.disciplineScore || 100}</div>
          <div class="insights-elite-card-desc">How well you followed your trading rules this session.</div>
        </div>
        <div class="insights-elite-card">
          <div class="insights-elite-card-title">Behavior Profile</div>
          <div class="insights-elite-card-value">${behavior.profile || "Disciplined"}</div>
          <div class="insights-elite-card-desc">Your current trading behavior classification.</div>
        </div>
      </div>
    `;

    // Existing: Behavioral Patterns
    html += `
      <div class="insights-section-label">BEHAVIORAL PATTERNS</div>
      <div class="insights-grid">
        <div class="insights-elite-card">
          <div class="insights-elite-card-title">Tilt Events</div>
          <div class="insights-elite-card-value">${behavior.tiltFrequency || 0}</div>
        </div>
        <div class="insights-elite-card">
          <div class="insights-elite-card-title">FOMO Trades</div>
          <div class="insights-elite-card-value">${behavior.fomoTrades || 0}</div>
        </div>
        <div class="insights-elite-card">
          <div class="insights-elite-card-title">Panic Sells</div>
          <div class="insights-elite-card-value">${behavior.panicSells || 0}</div>
        </div>
      </div>
    `;

    // New: Best Session Times (hour-of-day)
    html += this._renderTimeOfDaySection(state);

    // New: Performance by Market Cap
    html += this._renderMarketCapSection(state);

    return html;
  },

  // --- Time-of-Day Analysis ---

  _computeTimeOfDayAnalysis(state) {
    const tradesMap = Store.getActiveTrades() || {};
    const allTrades = Object.values(tradesMap);
    const sellTrades = allTrades.filter((t) => t.side === "SELL");

    // Bucket by hour (local time)
    const hourBuckets = {};
    for (let h = 0; h < 24; h++) {
      hourBuckets[h] = { wins: 0, losses: 0, pnl: 0, total: 0 };
    }

    sellTrades.forEach((t) => {
      const hour = new Date(t.ts).getHours();
      hourBuckets[hour].total++;
      hourBuckets[hour].pnl += t.realizedPnlSol || 0;
      if ((t.realizedPnlSol || 0) > 0) hourBuckets[hour].wins++;
      else if ((t.realizedPnlSol || 0) < 0) hourBuckets[hour].losses++;
    });

    // Filter: require >= 5 trades per hour bucket
    const qualified = Object.entries(hourBuckets)
      .filter(([_, b]) => b.total >= 5)
      .map(([hour, b]) => ({
        hour: parseInt(hour, 10),
        total: b.total,
        winRate: b.total > 0 ? ((b.wins / b.total) * 100).toFixed(0) : "0",
        pnl: b.pnl,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    return qualified;
  },

  _renderTimeOfDaySection(state) {
    const timeAnalysis = this._computeTimeOfDayAnalysis(state);

    let html = `<div class="insights-section-label">BEST SESSION TIMES</div>`;

    if (timeAnalysis.length === 0) {
      html += `<div class="insights-nodata">Not enough data yet. Complete more sessions to unlock time-of-day analysis.</div>`;
      return html;
    }

    html += `<div class="insights-grid">`;
    timeAnalysis.slice(0, 3).forEach((slot) => {
      const hourStr = `${String(slot.hour).padStart(2, "0")}:00 \u2013 ${String((slot.hour + 1) % 24).padStart(2, "0")}:00`;
      const pnlSign = slot.pnl >= 0 ? "+" : "";
      html += `
        <div class="insights-elite-card">
          <div class="insights-elite-card-title">${hourStr}</div>
          <div class="insights-elite-card-value">${slot.winRate}% win rate</div>
          <div class="insights-elite-card-desc">${slot.total} trades, ${pnlSign}${slot.pnl.toFixed(4)} SOL net</div>
        </div>
      `;
    });
    html += `</div>`;

    return html;
  },

  // --- Market Cap Bucket Analysis ---

  _computeMarketCapAnalysis(state) {
    const tradesMap = Store.getActiveTrades() || {};
    const sellTrades = Object.values(tradesMap).filter((t) => t.side === "SELL");

    const buckets = [
      { label: "< $1M", min: 0, max: 1_000_000, wins: 0, losses: 0, pnl: 0, count: 0 },
      { label: "$1M \u2013 $5M", min: 1_000_000, max: 5_000_000, wins: 0, losses: 0, pnl: 0, count: 0 },
      { label: "$5M \u2013 $20M", min: 5_000_000, max: 20_000_000, wins: 0, losses: 0, pnl: 0, count: 0 },
      { label: "$20M \u2013 $100M", min: 20_000_000, max: 100_000_000, wins: 0, losses: 0, pnl: 0, count: 0 },
      { label: "> $100M", min: 100_000_000, max: Infinity, wins: 0, losses: 0, pnl: 0, count: 0 },
    ];

    let hasMarketCapData = false;

    sellTrades.forEach((t) => {
      const mc = t.marketCapUsdAtFill;
      if (!mc || mc <= 0) return;
      hasMarketCapData = true;

      for (const bucket of buckets) {
        if (mc >= bucket.min && mc < bucket.max) {
          bucket.count++;
          bucket.pnl += t.realizedPnlSol || 0;
          if ((t.realizedPnlSol || 0) > 0) bucket.wins++;
          else if ((t.realizedPnlSol || 0) < 0) bucket.losses++;
          break;
        }
      }
    });

    if (!hasMarketCapData) return null;

    return buckets.filter((b) => b.count > 0);
  },

  _renderMarketCapSection(state) {
    const mcAnalysis = this._computeMarketCapAnalysis(state);

    let html = `<div class="insights-section-label">PERFORMANCE BY MARKET CAP</div>`;

    if (!mcAnalysis) {
      html += `<div class="insights-nodata">Market cap insights will appear once market cap data is available for your trades.</div>`;
      return html;
    }

    html += `<div class="insights-grid">`;
    mcAnalysis.forEach((bucket) => {
      const winRate = bucket.count > 0 ? ((bucket.wins / bucket.count) * 100).toFixed(0) : "0";
      const pnlSign = bucket.pnl >= 0 ? "+" : "";
      html += `
        <div class="insights-elite-card">
          <div class="insights-elite-card-title">${bucket.label}</div>
          <div class="insights-elite-card-value">${winRate}% win rate</div>
          <div class="insights-elite-card-desc">${bucket.count} trades, ${pnlSign}${bucket.pnl.toFixed(4)} SOL net</div>
        </div>
      `;
    });
    html += `</div>`;

    return html;
  },
};
