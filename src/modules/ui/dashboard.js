import { Store } from "../store.js";
import { OverlayManager } from "./overlay.js";
import { Analytics } from "../core/analytics.js";
import { FeatureManager } from "../featureManager.js";
import { DASHBOARD_CSS } from "./dashboard-styles.js";
import { Market } from "../core/market.js";
import { renderEliteLockedCard } from "./elite-helpers.js";
import { SessionReplay } from "./session-replay.js";
import { ICONS } from "./icons.js";

export const Dashboard = {
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
    const overlay = OverlayManager.getShadowRoot().querySelector(".paper-dashboard-overlay");
    if (overlay) overlay.remove();
  },

  computeSessionStats(state) {
    const session = Store.getActiveSession();
    const tradesMap = Store.getActiveTrades();
    const sessionTradeIds = session.trades || [];
    const allSessionTrades = sessionTradeIds
      .map((id) => tradesMap[id])
      .filter(Boolean)
      .sort((a, b) => a.ts - b.ts);

    // Exits: SELL, EXIT, or any trade with realizedPnlSol
    const exits = allSessionTrades.filter(
      (t) => t.side === "SELL" || t.side === "EXIT" || t.realizedPnlSol !== undefined
    );

    const wins = exits.filter((t) => (t.realizedPnlSol || 0) > 0).length;
    const losses = exits.filter((t) => (t.realizedPnlSol || 0) < 0).length;
    const winRate = exits.length > 0 ? (wins / exits.length) * 100 : 0;

    // Profit Factor
    const grossProfits = exits.reduce((sum, t) => sum + Math.max(0, t.realizedPnlSol || 0), 0);
    const grossLosses = Math.abs(
      exits.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0)
    );
    const profitFactor =
      grossLosses > 0 ? grossProfits / grossLosses : grossProfits > 0 ? Infinity : 0;

    // Max Drawdown
    let peak = 0,
      maxDd = 0,
      runningBal = 0;
    exits.forEach((t) => {
      runningBal += t.realizedPnlSol || 0;
      if (runningBal > peak) peak = runningBal;
      const dd = peak - runningBal;
      if (dd > maxDd) maxDd = dd;
    });

    // Worst trade
    let worstTradePnl = 0;
    exits.forEach((t) => {
      const pnl = t.realizedPnlSol || 0;
      if (pnl < worstTradePnl) worstTradePnl = pnl;
    });

    // Longest streaks
    let maxWinStreak = 0,
      maxLossStreak = 0;
    let curWin = 0,
      curLoss = 0;
    exits.forEach((t) => {
      const pnl = t.realizedPnlSol || 0;
      if (pnl > 0) {
        curWin++;
        curLoss = 0;
        if (curWin > maxWinStreak) maxWinStreak = curWin;
      } else if (pnl < 0) {
        curLoss++;
        curWin = 0;
        if (curLoss > maxLossStreak) maxLossStreak = curLoss;
      }
    });

    // Avg trade P&L
    const avgPnl =
      exits.length > 0
        ? exits.reduce((sum, t) => sum + (t.realizedPnlSol || 0), 0) / exits.length
        : 0;

    // Session P&L
    const sessionPnl = session.realized || 0;
    const isShadow = Store.isShadowMode();
    const positions = Store.getActivePositions();
    const totalInvestedSol = Object.values(positions || {}).reduce(
      (sum, pos) => sum + (pos.totalSolSpent || 0),
      0
    );
    const startSol = isShadow
      ? totalInvestedSol || session.balance || 1
      : state.settings.startSol || 10;
    const sessionPnlPct = startSol > 0 ? (sessionPnl / startSol) * 100 : 0;

    // Duration
    const startTime = session.startTime || Date.now();
    const endTime = session.endTime || Date.now();
    const durationMs = endTime - startTime;
    const durationMin = Math.floor(durationMs / 60000);
    const durationHr = Math.floor(durationMin / 60);
    const durationRemMin = durationMin % 60;

    let durationStr;
    if (durationHr > 0) {
      durationStr = `${durationHr}h ${durationRemMin}m`;
    } else {
      durationStr = `${durationMin}m`;
    }

    const endTimeStr = new Date(endTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      totalTrades: allSessionTrades.length,
      exitCount: exits.length,
      wins,
      losses,
      winRate,
      profitFactor,
      maxDrawdown: maxDd,
      worstTradePnl,
      maxWinStreak,
      maxLossStreak,
      avgPnl,
      sessionPnl,
      sessionPnlPct,
      durationStr,
      endTimeStr,
      hasExits: exits.length > 0,
    };
  },

  computeEliteAnalysis(state) {
    const session = Store.getActiveSession();
    const tradesMap = Store.getActiveTrades();
    const tradeIds = session.trades || [];
    const allTrades = tradeIds.map((id) => tradesMap[id]).filter(Boolean).sort((a, b) => a.ts - b.ts);
    const buyTrades = allTrades.filter((t) => t.side === "BUY");
    const sellTrades = allTrades.filter((t) => t.side === "SELL");

    // Consistency score
    let consistencyScore = null;
    try {
      if (typeof Analytics.calculateConsistencyScore === "function") {
        consistencyScore = Analytics.calculateConsistencyScore(state);
      }
    } catch (e) { /* optional */ }

    // Plan adherence
    const plansUsed = buyTrades.filter((t) => t.riskDefined || t.tradePlan).length;
    const plansUsedPct = buyTrades.length > 0 ? Math.round((plansUsed / buyTrades.length) * 100) : 0;
    const stopViolations = sellTrades.filter((t) => t.planAdherence?.stopViolated).length;
    const targetHits = sellTrades.filter((t) => t.planAdherence?.hitTarget).length;

    // Trade pacing
    const intervals = [];
    for (let i = 1; i < allTrades.length; i++) {
      intervals.push(allTrades[i].ts - allTrades[i - 1].ts);
    }
    const avgInterval = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 0;
    const avgPacingMin = Math.round(avgInterval / 60000);

    // Emotion breakdown
    const emotionMap = {};
    allTrades.forEach((t) => {
      if (t.emotion) {
        if (!emotionMap[t.emotion]) emotionMap[t.emotion] = { count: 0, pnl: 0, wins: 0, losses: 0 };
        emotionMap[t.emotion].count++;
        if (t.side === "SELL") {
          const pnl = t.realizedPnlSol || 0;
          emotionMap[t.emotion].pnl += pnl;
          if (pnl > 0) emotionMap[t.emotion].wins++;
          else if (pnl < 0) emotionMap[t.emotion].losses++;
        }
      }
    });

    return {
      consistencyScore,
      plansUsedPct,
      stopViolations,
      targetHits,
      avgPacingMin,
      emotionMap,
    };
  },

  renderEliteAnalysis(state, isElite, behavior) {
    if (!isElite) {
      return `
        <div class="dash-elite-grid">
          ${renderEliteLockedCard("Consistency Score", "Track how steadily you trade across sessions.")}
          ${renderEliteLockedCard("Plan Adherence", "See how often you follow your stops and targets.")}
          ${renderEliteLockedCard("Emotion Breakdown", "Understand which emotions lead to wins vs losses.")}
        </div>
      `;
    }

    const ea = this.computeEliteAnalysis(state);
    const session = Store.getActiveSession();

    let html = "";

    // Session Quality
    html += `<div class="dash-elite-subsection-label">SESSION QUALITY</div>`;
    html += `<div class="dash-elite-grid">
      <div class="dash-metric-card">
        <div class="dash-metric-k">Discipline Score</div>
        <div class="dash-metric-v" style="color:#8b5cf6;">${session.disciplineScore || 100}</div>
      </div>`;
    if (ea.consistencyScore !== null) {
      html += `<div class="dash-metric-card">
        <div class="dash-metric-k">Consistency</div>
        <div class="dash-metric-v" style="color:#8b5cf6;">${typeof ea.consistencyScore === "number" ? ea.consistencyScore.toFixed(0) : "\u2014"}/100</div>
      </div>`;
    }
    html += `<div class="dash-metric-card">
      <div class="dash-metric-k">Behavior Profile</div>
      <div class="dash-metric-v" style="color:#8b5cf6;">${behavior?.profile || "Disciplined"}</div>
    </div>`;
    html += `<div class="dash-metric-card">
      <div class="dash-metric-k">Trade Pacing</div>
      <div class="dash-metric-v" style="color:#818cf8;">${ea.avgPacingMin > 0 ? ea.avgPacingMin + "m avg" : "\u2014"}</div>
    </div>`;
    html += `</div>`;

    // Plan Adherence
    html += `<div class="dash-elite-subsection-label">PLAN ADHERENCE</div>`;
    html += `<div class="dash-elite-grid">
      <div class="dash-metric-card">
        <div class="dash-metric-k">Plans Used</div>
        <div class="dash-metric-v" style="color:#818cf8;">${ea.plansUsedPct}%</div>
      </div>
      <div class="dash-metric-card">
        <div class="dash-metric-k">Stop Violations</div>
        <div class="dash-metric-v loss">${ea.stopViolations}</div>
      </div>
      <div class="dash-metric-card">
        <div class="dash-metric-k">Targets Hit</div>
        <div class="dash-metric-v win">${ea.targetHits}</div>
      </div>
    </div>`;

    // Emotion Breakdown
    const emotions = Object.entries(ea.emotionMap);
    if (emotions.length > 0) {
      html += `<div class="dash-elite-subsection-label">EMOTION BREAKDOWN</div>`;
      html += `<table class="dash-emotion-table">
        <tr><th>Emotion</th><th>Trades</th><th>Net P&L</th></tr>`;
      emotions.forEach(([emo, data]) => {
        const pnlClass = data.pnl >= 0 ? "win" : "loss";
        html += `<tr>
          <td>${emo}</td>
          <td>${data.count}</td>
          <td class="${pnlClass}">${data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(4)} SOL</td>
        </tr>`;
      });
      html += `</table>`;
    }

    return html;
  },

  renderSessionHistory() {
    const history = Store.getActiveSessionHistory() || [];
    if (history.length === 0) {
      return `<div class="dash-history-empty">No completed sessions yet.</div>`;
    }

    const tradesMap = Store.getActiveTrades() || {};

    return history
      .slice()
      .reverse()
      .map((sess, reverseIdx) => {
        const realIdx = history.length - 1 - reverseIdx;
        const date = new Date(sess.startTime || 0);
        const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" }) +
          " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        const tradeCount = (sess.trades || []).length;
        const durationMs = (sess.endTime || sess.startTime || 0) - (sess.startTime || 0);
        const durationMin = Math.max(1, Math.floor(durationMs / 60000));

        const pnl = sess.realized || 0;
        const pnlClass = pnl >= 0 ? "win" : "loss";
        const pnlStr = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}`;

        return `
          <div class="dash-history-row">
            <div class="dash-history-date">${dateStr}</div>
            <div class="dash-history-meta">${tradeCount} trades \u00B7 ${durationMin}m</div>
            <div class="dash-history-pnl ${pnlClass}">${pnlStr}</div>
            <button class="dash-history-replay" data-history-idx="${realIdx}">
              ${ICONS.REPLAY} Replay
            </button>
          </div>
        `;
      })
      .join("");
  },

  render() {
    const root = OverlayManager.getShadowRoot();
    let overlay = root.querySelector(".paper-dashboard-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "paper-dashboard-overlay";

      if (!root.getElementById("paper-dashboard-styles")) {
        const style = document.createElement("style");
        style.id = "paper-dashboard-styles";
        style.textContent = DASHBOARD_CSS;
        root.appendChild(style);
      }

      root.appendChild(overlay);
    }

    const state = Store.state;
    const session = Store.getActiveSession();
    const behavior = Store.getActiveBehavior();
    const stats = this.computeSessionStats(state);
    const hasEquityData = (session.equityHistory || []).length >= 2;

    // Formatting helpers
    const pnlSign = stats.sessionPnl >= 0 ? "+" : "";
    const pnlClass = stats.sessionPnl >= 0 ? "win" : "loss";
    const pnlPctStr = `${stats.sessionPnlPct >= 0 ? "+" : ""}${stats.sessionPnlPct.toFixed(1)}%`;

    const fmtPnl = (v) => {
      if (!Number.isFinite(v) || v === 0) return "\u2014";
      return `${v >= 0 ? "+" : ""}${v.toFixed(4)} SOL`;
    };

    const fmtPf = (v) => {
      if (v === 0) return "\u2014";
      if (v === Infinity) return "\u221E";
      return v.toFixed(2);
    };

    const isEmpty = stats.totalTrades === 0;
    const isElite = FeatureManager.isElite(state);
    const hasTrades = (session.trades || []).length > 0;

    // Subtext based on trading mode
    const subtext =
      state.settings.tradingMode === "shadow" ? "Real trades analyzed" : "Paper session results";

    overlay.innerHTML = `
            <div class="paper-dashboard-modal">
                <div class="dash-header">
                    <div>
                        <div class="dash-title">Session Summary</div>
                        <div class="dash-subtitle">${subtext}</div>
                    </div>
                    <button class="dash-close" id="dashboard-close-btn">\u2715</button>
                </div>
                <div class="dash-scroll">
                    <div class="dash-hero ${isEmpty ? "" : pnlClass + "-bg"}">
                        <div class="dash-hero-label">SESSION RESULT</div>
                        ${
                          isEmpty
                            ? `<div class="dash-hero-value" style="color:#64748b;">No trades in this session</div>
                               <div class="dash-hero-meta">Duration ${stats.durationStr}</div>`
                            : `<div class="dash-hero-value ${pnlClass}">${pnlSign}${stats.sessionPnl.toFixed(4)} SOL</div>
                               <div class="dash-hero-pct ${pnlClass}">${pnlPctStr}</div>
                               <div class="dash-hero-meta">Duration ${stats.durationStr} \u00B7 ${stats.endTimeStr}</div>`
                        }
                    </div>

                    ${
                      !isEmpty
                        ? `
                    <div class="dash-metrics-row">
                        <div>
                            <div class="dash-group-label">TRADE QUALITY</div>
                            <div class="dash-metric-pair">
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Win Rate</div>
                                    <div class="dash-metric-v ${stats.hasExits && stats.winRate >= 50 ? "win" : stats.hasExits && stats.winRate < 50 ? "loss" : ""}">${stats.hasExits ? stats.winRate.toFixed(1) + "%" : "\u2014"}</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Profit Factor</div>
                                    <div class="dash-metric-v" style="color:#818cf8;">${stats.hasExits ? fmtPf(stats.profitFactor) : "\u2014"}</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="dash-group-label">RISK EXPOSURE</div>
                            <div class="dash-metric-pair">
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Max Drawdown</div>
                                    <div class="dash-metric-v loss">${stats.maxDrawdown > 0 ? "-" + stats.maxDrawdown.toFixed(4) + " SOL" : "\u2014"}</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Worst Trade</div>
                                    <div class="dash-metric-v loss">${stats.worstTradePnl < 0 ? stats.worstTradePnl.toFixed(4) + " SOL" : "\u2014"}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    `
                        : ""
                    }

                    ${
                      hasEquityData
                        ? `
                    <div class="dash-card dash-equity-section">
                        <div class="dash-section-label">EQUITY CURVE</div>
                        <canvas id="equity-canvas"></canvas>
                    </div>
                    `
                        : ""
                    }

                    <div class="dash-bottom-row">
                        <div class="dash-card dash-facts">
                            <div class="dash-section-label">SESSION FACTS</div>
                            <div class="dash-facts-grid">
                                <div class="dash-fact"><span class="dash-fact-k">Trades taken</span><span class="dash-fact-v">${stats.totalTrades}</span></div>
                                ${
                                  stats.hasExits
                                    ? `
                                <div class="dash-fact"><span class="dash-fact-k">Wins / Losses</span><span class="dash-fact-v">${stats.wins} / ${stats.losses}</span></div>
                                ${stats.maxWinStreak > 0 ? `<div class="dash-fact"><span class="dash-fact-k">Best win streak</span><span class="dash-fact-v win">${stats.maxWinStreak}</span></div>` : ""}
                                ${stats.maxLossStreak > 0 ? `<div class="dash-fact"><span class="dash-fact-k">Worst loss streak</span><span class="dash-fact-v loss">${stats.maxLossStreak}</span></div>` : ""}
                                <div class="dash-fact"><span class="dash-fact-k">Avg trade P&L</span><span class="dash-fact-v ${stats.avgPnl >= 0 ? "win" : "loss"}">${fmtPnl(stats.avgPnl)}</span></div>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                        <div class="dash-card dash-notes">
                            <div class="dash-section-label">SESSION NOTES</div>
                            <textarea class="dash-notes-input" id="dash-session-notes" maxlength="280" placeholder="Add a note about this session...">${session.notes || ""}</textarea>
                            <div class="dash-notes-footer">
                                <span class="dash-notes-count" id="dash-notes-count">${(session.notes || "").length}/280</span>
                                <button class="dash-notes-save" id="dash-notes-save">Save note</button>
                            </div>
                        </div>
                    </div>

                    ${hasTrades ? `
                    <div class="dash-replay-section">
                        <button class="dash-replay-btn" id="dashboard-replay-btn">
                            ${ICONS.REPLAY} Replay session
                        </button>
                    </div>
                    ` : ""}

                    <div class="dash-share-section">
                        <button class="dash-share-btn" id="dashboard-share-btn">
                            <span style="font-size:16px;">\uD835\uDD4F</span>
                            <span>Share session summary</span>
                        </button>
                        <div class="dash-share-sub">Includes paper session stats only</div>
                    </div>

                    <div class="dash-elite-section">
                        <div class="dash-elite-toggle" id="dash-elite-toggle">
                            <div class="dash-elite-toggle-left">
                                <span class="dash-section-label" style="margin-bottom:0;">ELITE ANALYSIS</span>
                                <span class="dash-elite-badge">Elite</span>
                            </div>
                            <span class="dash-elite-chevron" id="dash-elite-chevron">\u25B8</span>
                        </div>
                        <div class="dash-elite-content" id="dash-elite-content" style="display:none;">
                            ${this.renderEliteAnalysis(state, isElite, behavior)}
                        </div>
                    </div>

                    <div class="dash-history-section">
                        <div class="dash-history-toggle" id="dash-history-toggle">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="dash-section-label" style="margin-bottom:0;">SESSION HISTORY</span>
                            </div>
                            <span class="dash-history-chevron" id="dash-history-chevron">\u25B8</span>
                        </div>
                        <div class="dash-history-content" id="dash-history-content" style="display:none;">
                            ${this.renderSessionHistory()}
                        </div>
                    </div>
                </div>
            </div>
        `;

    // Event bindings
    const self = this;

    const closeBtn = overlay.querySelector("#dashboard-close-btn");
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

    // Share button
    const shareBtn = overlay.querySelector("#dashboard-share-btn");
    if (shareBtn) {
      shareBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = Analytics.generateXShareText(state);
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
      };
    }

    // Replay session button
    const replayBtn = overlay.querySelector("#dashboard-replay-btn");
    if (replayBtn) {
      replayBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        self.close();
        if (session.status === "completed") {
          SessionReplay.openForSession(session);
        } else {
          SessionReplay.open();
        }
      };
    }

    // Session notes
    const notesInput = overlay.querySelector("#dash-session-notes");
    const notesCount = overlay.querySelector("#dash-notes-count");
    const notesSave = overlay.querySelector("#dash-notes-save");

    if (notesInput) {
      notesInput.addEventListener("input", () => {
        if (notesCount) notesCount.textContent = `${notesInput.value.length}/280`;
      });

      notesInput.addEventListener("blur", async () => {
        session.notes = notesInput.value.slice(0, 280);
        await Store.save();
      });
    }

    if (notesSave) {
      notesSave.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        session.notes = notesInput.value.slice(0, 280);
        await Store.save();
        notesSave.textContent = "Saved";
        notesSave.style.color = "#10b981";
        setTimeout(() => {
          notesSave.textContent = "Save note";
          notesSave.style.color = "";
        }, 1500);
      });
    }

    // Elite insights toggle
    const eliteToggle = overlay.querySelector("#dash-elite-toggle");
    const eliteContent = overlay.querySelector("#dash-elite-content");
    const eliteChevron = overlay.querySelector("#dash-elite-chevron");
    if (eliteToggle && eliteContent) {
      eliteToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = eliteContent.style.display !== "none";
        eliteContent.style.display = open ? "none" : "block";
        if (eliteChevron) eliteChevron.textContent = open ? "\u25B8" : "\u25BE";
      });
    }

    // Session History toggle
    const historyToggle = overlay.querySelector("#dash-history-toggle");
    const historyContent = overlay.querySelector("#dash-history-content");
    const historyChevron = overlay.querySelector("#dash-history-chevron");
    if (historyToggle && historyContent) {
      historyToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = historyContent.style.display !== "none";
        historyContent.style.display = open ? "none" : "block";
        if (historyChevron) historyChevron.textContent = open ? "\u25B8" : "\u25BE";
      });
    }

    // Session History replay buttons
    overlay.querySelectorAll(".dash-history-replay").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-history-idx"), 10);
        const history = Store.getActiveSessionHistory() || [];
        const targetSession = history[idx];
        if (targetSession) {
          self.close();
          SessionReplay.openForSession(targetSession);
        }
      });
    });

    // Draw equity curve if data exists
    if (hasEquityData) {
      setTimeout(() => this.drawEquityCurve(overlay, state), 100);
    }
  },

  drawEquityCurve(root, state) {
    const canvas = root.querySelector("#equity-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const session = Store.getActiveSession();
    const history = session.equityHistory || [];
    if (history.length < 2) return;

    // Resize for DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const padding = 16;

    const points = history.map((e) => e.equity);
    const min = Math.min(...points) * 0.99;
    const max = Math.max(...points) * 1.01;
    const range = max - min;

    ctx.clearRect(0, 0, w, h);

    // Line
    ctx.beginPath();
    ctx.strokeStyle = "#14b8a6";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    history.forEach((entry, i) => {
      const x = padding + (i / (history.length - 1)) * (w - padding * 2);
      const y = h - padding - ((entry.equity - min) / range) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(20, 184, 166, 0.15)");
    grad.addColorStop(1, "rgba(20, 184, 166, 0)");
    ctx.lineTo(w - padding, h - padding);
    ctx.lineTo(padding, h - padding);
    ctx.fillStyle = grad;
    ctx.fill();
  },
};
