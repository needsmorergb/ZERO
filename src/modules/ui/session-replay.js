import { Store } from "../store.js";
import { OverlayManager } from "./overlay.js";
import { Analytics } from "../core/analytics.js";
import { FeatureManager } from "../featureManager.js";
import { ICONS } from "./icons.js";

export const SESSION_REPLAY_CSS = `
.replay-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.replay-modal {
    background: linear-gradient(145deg, #0d1117, #161b22);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    width: 800px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
}

.replay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    background: rgba(139, 92, 246, 0.05);
}

.replay-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 800;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.replay-title svg {
    width: 20px;
    height: 20px;
}

.replay-close {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.replay-close:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
}

.replay-stats {
    display: flex;
    gap: 20px;
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.replay-stat {
    text-align: center;
}

.replay-stat .k {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.replay-stat .v {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
}

.replay-filters {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-wrap: wrap;
}

.filter-btn {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: #64748b;
}

.filter-btn:hover {
    background: rgba(255, 255, 255, 0.05);
}

.filter-btn.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: #a78bfa;
}

.filter-btn.trade { --accent: #14b8a6; }
.filter-btn.alert { --accent: #ef4444; }
.filter-btn.discipline { --accent: #f59e0b; }
.filter-btn.milestone { --accent: #10b981; }

.filter-btn.active.trade { background: rgba(20, 184, 166, 0.2); border-color: rgba(20, 184, 166, 0.5); color: #14b8a6; }
.filter-btn.active.alert { background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); color: #ef4444; }
.filter-btn.active.discipline { background: rgba(245, 158, 11, 0.2); border-color: rgba(245, 158, 11, 0.5); color: #f59e0b; }
.filter-btn.active.milestone { background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.5); color: #10b981; }

.replay-timeline {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
}

.timeline-empty {
    text-align: center;
    padding: 40px 20px;
    color: #64748b;
}

.timeline-empty svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
}

.timeline-event {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    transition: background 0.2s;
}

.timeline-event:hover {
    background: rgba(255, 255, 255, 0.02);
    margin: 0 -20px;
    padding: 12px 20px;
}

.timeline-event:last-child {
    border-bottom: none;
}

.event-time {
    flex-shrink: 0;
    width: 60px;
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
}

.event-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.event-icon.trade { background: rgba(20, 184, 166, 0.15); color: #14b8a6; }
.event-icon.alert { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.event-icon.discipline { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.event-icon.milestone { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.event-icon.system { background: rgba(99, 102, 241, 0.15); color: #6366f1; }

.event-content {
    flex: 1;
    min-width: 0;
}

.event-type {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.event-type.trade { color: #14b8a6; }
.event-type.alert { color: #ef4444; }
.event-type.discipline { color: #f59e0b; }
.event-type.milestone { color: #10b981; }
.event-type.system { color: #6366f1; }

.event-message {
    font-size: 13px;
    color: #e2e8f0;
    line-height: 1.4;
}

.event-data {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    flex-wrap: wrap;
}

.event-tag {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
}

.event-tag.win { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.event-tag.loss { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.replay-footer {
    padding: 12px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
}

.replay-count {
    font-size: 11px;
    color: #64748b;
}

.replay-elite-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #a78bfa;
    font-weight: 700;
    text-transform: uppercase;
}

.locked-replay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
}

.locked-replay svg {
    width: 64px;
    height: 64px;
    color: #a78bfa;
    margin-bottom: 20px;
}

.locked-replay h3 {
    color: #f8fafc;
    font-size: 18px;
    margin: 0 0 8px;
}

.locked-replay p {
    color: #64748b;
    font-size: 13px;
    margin: 0 0 20px;
    max-width: 300px;
}

.unlock-btn {
    background: linear-gradient(135deg, #8b5cf6, #a78bfa);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.unlock-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(139, 92, 246, 0.3);
}

.replay-equity-section {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.replay-section-label {
    font-size: 9px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 1px;
    margin-bottom: 8px;
    text-transform: uppercase;
}

#replay-equity-canvas {
    width: 100%;
    height: 120px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
}

.replay-subheader {
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
}

.timeline-event.selected {
    background: rgba(139, 92, 246, 0.08);
    border-left: 2px solid #8b5cf6;
    margin: 0 -20px;
    padding: 12px 18px 12px 20px;
}

.timeline-event {
    cursor: pointer;
}

.replay-no-equity {
    padding: 16px 20px;
    text-align: center;
    font-size: 11px;
    color: #475569;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
`;

export const SessionReplay = {
  isOpen: false,
  activeFilters: ["TRADE", "ALERT", "DISCIPLINE", "MILESTONE"],
  _targetSessionId: null,
  _selectedEventIdx: -1,

  open(sessionId) {
    this._targetSessionId = sessionId || null;
    this._selectedEventIdx = -1;
    this.isOpen = true;
    this.render();
  },

  close() {
    this.isOpen = false;
    this._targetSessionId = null;
    this._selectedEventIdx = -1;
    const overlay = OverlayManager.getShadowRoot().querySelector(".replay-overlay");
    if (overlay) overlay.remove();
  },

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  },

  _resolveSession() {
    const state = Store.state;
    if (!this._targetSessionId) {
      // Current active session
      return {
        session: Store.getActiveSession(),
        trades: null,
        isHistorical: false,
      };
    }
    // Search both history arrays
    const allHistory = [
      ...(state.sessionHistory || []),
      ...(state.shadowSessionHistory || []),
    ];
    const session = allHistory.find((s) => s.id === this._targetSessionId);
    if (!session) {
      return { session: Store.getActiveSession(), trades: null, isHistorical: false };
    }

    // Resolve trades for historical session
    const tradeIds = session.trades || [];
    const allTrades = { ...(state.trades || {}), ...(state.shadowTrades || {}) };
    const trades = tradeIds
      .map((id) => allTrades[id])
      .filter(Boolean)
      .sort((a, b) => a.ts - b.ts);

    return { session, trades, isHistorical: true };
  },

  _getModeLabel(session, trades) {
    // Check the first trade's mode field
    const firstTrade = trades && trades.length > 0 ? trades[0] : null;
    if (firstTrade) {
      if (firstTrade.mode === "shadow" || firstTrade.mode === "analysis") {
        return "Real trades (observed)";
      }
    }
    return "Paper session";
  },

  _getSessionDuration(session) {
    if (!session || !session.startTime) return 0;
    const endTime = session.endTime || Date.now();
    return Math.floor((endTime - session.startTime) / 60000);
  },

  render() {
    const root = OverlayManager.getShadowRoot();
    let overlay = root.querySelector(".replay-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "replay-overlay";

      // Inject styles
      if (!root.getElementById("replay-styles")) {
        const style = document.createElement("style");
        style.id = "replay-styles";
        style.textContent = SESSION_REPLAY_CSS;
        root.appendChild(style);
      }

      root.appendChild(overlay);
    }

    const state = Store.state;
    const isElite = FeatureManager.isElite(state);
    const { session, trades, isHistorical } = this._resolveSession();
    const modeLabel = this._getModeLabel(session, trades);
    const duration = isHistorical ? this._getSessionDuration(session) : Store.getSessionDuration();

    // Build event stats from resolved events
    const events = this.getFilteredEvents(state, { session, trades, isHistorical, isElite });
    const allEvents = this._getAllEvents(state, { session, trades, isHistorical });
    const eventStats = this._computeEventStats(allEvents, isElite);

    // Equity curve availability
    const hasEquity = session.equityHistory && session.equityHistory.length >= 2;

    // Build filter buttons — hide discipline and alert for non-elite
    let filterButtons = `
      <button class="filter-btn trade ${this.activeFilters.includes("TRADE") ? "active" : ""}" data-filter="TRADE">
        Trades (${eventStats.trades})
      </button>`;
    if (isElite) {
      filterButtons += `
        <button class="filter-btn alert ${this.activeFilters.includes("ALERT") ? "active" : ""}" data-filter="ALERT">
          Alerts (${eventStats.alerts})
        </button>
        <button class="filter-btn discipline ${this.activeFilters.includes("DISCIPLINE") ? "active" : ""}" data-filter="DISCIPLINE">
          Discipline (${eventStats.disciplineEvents})
        </button>`;
    }
    filterButtons += `
      <button class="filter-btn milestone ${this.activeFilters.includes("MILESTONE") ? "active" : ""}" data-filter="MILESTONE">
        Milestones (${eventStats.milestones})
      </button>`;

    overlay.innerHTML = `
      <div class="replay-modal">
        <div class="replay-header">
          <div>
            <div class="replay-title">
              ${ICONS.BRAIN}
              <span>Session Replay</span>
            </div>
            <div class="replay-subheader">${modeLabel}</div>
          </div>
          <button class="replay-close">${ICONS.X}</button>
        </div>

        <div class="replay-stats">
          <div class="replay-stat">
            <div class="k">Session ID</div>
            <div class="v" style="font-size:11px; color:#a78bfa;">${session.id ? session.id.split("_")[1] : "--"}</div>
          </div>
          <div class="replay-stat">
            <div class="k">Duration</div>
            <div class="v">${duration} min</div>
          </div>
          <div class="replay-stat">
            <div class="k">Total Events</div>
            <div class="v">${eventStats.total}</div>
          </div>
          <div class="replay-stat">
            <div class="k">Trades</div>
            <div class="v" style="color:#14b8a6;">${eventStats.trades}</div>
          </div>
          ${isElite ? `
          <div class="replay-stat">
            <div class="k">Alerts</div>
            <div class="v" style="color:#ef4444;">${eventStats.alerts}</div>
          </div>
          <div class="replay-stat">
            <div class="k">Discipline</div>
            <div class="v" style="color:#f59e0b;">${eventStats.disciplineEvents}</div>
          </div>` : ""}
        </div>

        ${hasEquity ? `
        <div class="replay-equity-section">
          <div class="replay-section-label">EQUITY CURVE</div>
          <canvas id="replay-equity-canvas"></canvas>
        </div>` : `
        <div class="replay-no-equity">No equity data for this session</div>`}

        <div class="replay-filters">
          ${filterButtons}
        </div>

        <div class="replay-timeline">
          ${events.length > 0 ? this.renderEvents(events) : this.renderEmpty()}
        </div>

        <div class="replay-footer">
          <div class="replay-count">Showing ${events.length} of ${eventStats.total} events</div>
          ${isElite ? `<div class="replay-elite-badge">${ICONS.BRAIN} ELITE</div>` : ""}
        </div>
      </div>`;

    this.bindEvents(overlay);

    // Draw equity curve after DOM is ready
    if (hasEquity) {
      setTimeout(() => this.drawEquityCurve(overlay, session), 100);
    }
  },

  renderEmpty() {
    return `
      <div class="timeline-empty">
        ${ICONS.TARGET}
        <div style="font-size:14px; font-weight:600; margin-bottom:4px;">No events yet</div>
        <div style="font-size:12px;">Start trading to build your session timeline</div>
      </div>`;
  },

  renderEvents(events) {
    return events
      .map((event, index) => {
        const time = new Date(event.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const category = event.category.toLowerCase();
        const icon = this.getEventIcon(event.category);
        const dataTags = this.renderEventData(event);
        const selectedClass = this._selectedEventIdx === index ? " selected" : "";

        return `
          <div class="timeline-event${selectedClass}" data-idx="${index}">
            <div class="event-time">${time}</div>
            <div class="event-icon ${category}">${icon}</div>
            <div class="event-content">
              <div class="event-type ${category}">${event.type}</div>
              <div class="event-message">${event.message}</div>
              ${dataTags ? `<div class="event-data">${dataTags}</div>` : ""}
            </div>
          </div>`;
      })
      .join("");
  },

  renderEventData(event) {
    const data = event.data || {};
    const tags = [];

    if (data.symbol) tags.push(`<span class="event-tag">${data.symbol}</span>`);
    if (data.strategy) tags.push(`<span class="event-tag">${data.strategy}</span>`);
    if (data.realizedPnlSol !== undefined && data.realizedPnlSol !== null) {
      const pnl = data.realizedPnlSol;
      const cls = pnl >= 0 ? "win" : "loss";
      tags.push(
        `<span class="event-tag ${cls}">${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} SOL</span>`
      );
    }
    if (data.penalty) tags.push(`<span class="event-tag">-${data.penalty} pts</span>`);
    if (data.winStreak) tags.push(`<span class="event-tag win">${data.winStreak}W Streak</span>`);
    if (data.tradeCount) tags.push(`<span class="event-tag">${data.tradeCount} trades</span>`);

    return tags.join("");
  },

  getEventIcon(category) {
    switch (category) {
      case "TRADE":
        return ICONS.TARGET;
      case "ALERT":
        return ICONS.TILT;
      case "DISCIPLINE":
        return ICONS.BRAIN;
      case "MILESTONE":
        return ICONS.WIN;
      default:
        return ICONS.ZERO;
    }
  },

  /** Get all events (unfiltered) for stats computation */
  _getAllEvents(state, { session, trades, isHistorical }) {
    if (isHistorical && trades) {
      return this._reconstructEventsFromTrades(trades);
    }
    return Analytics.getEventLog(state, { limit: 100 });
  },

  /** Compute event stats, respecting elite gating */
  _computeEventStats(allEvents, isElite) {
    const stats = {
      total: 0,
      trades: 0,
      alerts: 0,
      disciplineEvents: 0,
      milestones: 0,
    };
    for (const e of allEvents) {
      if (e.category === "TRADE") stats.trades++;
      else if (e.category === "ALERT") stats.alerts++;
      else if (e.category === "DISCIPLINE") stats.disciplineEvents++;
      else if (e.category === "MILESTONE") stats.milestones++;
    }
    // Total visible events depends on elite status
    if (isElite) {
      stats.total = stats.trades + stats.alerts + stats.disciplineEvents + stats.milestones;
    } else {
      stats.total = stats.trades + stats.milestones;
    }
    return stats;
  },

  /** Reconstruct timeline events from a trades array (for historical sessions) */
  _reconstructEventsFromTrades(trades) {
    return trades.map((trade) => {
      const pnlText = trade.realizedPnlSol
        ? `P&L: ${trade.realizedPnlSol > 0 ? "+" : ""}${trade.realizedPnlSol.toFixed(4)} SOL`
        : `Size: ${(trade.solAmount || 0).toFixed(4)} SOL`;
      const message = `${trade.side} ${trade.symbol || "?"} @ $${trade.priceUsd?.toFixed(6) || "N/A"} | ${pnlText}`;

      return {
        id: trade.id,
        ts: trade.ts,
        type: trade.side,
        category: "TRADE",
        message,
        data: {
          tradeId: trade.id,
          symbol: trade.symbol,
          priceUsd: trade.priceUsd,
          solAmount: trade.solAmount,
          realizedPnlSol: trade.realizedPnlSol,
          strategy: trade.strategy,
        },
      };
    });
  },

  getFilteredEvents(state, { session, trades, isHistorical, isElite } = {}) {
    let allEvents;
    if (isHistorical && trades) {
      allEvents = this._reconstructEventsFromTrades(trades);
    } else {
      allEvents = Analytics.getEventLog(state, { limit: 100 });
    }

    // Filter by active filters
    let filtered = allEvents.filter((e) => this.activeFilters.includes(e.category));

    // Non-elite: remove DISCIPLINE and ALERT categories
    if (!isElite) {
      filtered = filtered.filter(
        (e) => e.category !== "DISCIPLINE" && e.category !== "ALERT"
      );
    }

    return filtered;
  },

  toggleFilter(category) {
    const idx = this.activeFilters.indexOf(category);
    if (idx > -1) {
      this.activeFilters.splice(idx, 1);
    } else {
      this.activeFilters.push(category);
    }
    this.render();
  },

  drawEquityCurve(root, session) {
    const canvas = root.querySelector("#replay-equity-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
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
    const range = max - min || 1;

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

    // Draw selected event marker
    if (this._selectedEventIdx >= 0) {
      const overlay = root.querySelector(".replay-overlay") || root;
      const selectedEl = overlay.querySelector(`.timeline-event[data-idx="${this._selectedEventIdx}"]`);
      if (selectedEl) {
        // Get the event timestamp from the rendered events
        const state = Store.state;
        const isElite = FeatureManager.isElite(state);
        const { session: sess, trades, isHistorical } = this._resolveSession();
        const events = this.getFilteredEvents(state, { session: sess, trades, isHistorical, isElite });
        const selectedEvent = events[this._selectedEventIdx];

        if (selectedEvent && selectedEvent.ts) {
          // Find the closest equity point by timestamp
          let closestIdx = 0;
          let closestDist = Infinity;
          history.forEach((pt, i) => {
            const dist = Math.abs(pt.ts - selectedEvent.ts);
            if (dist < closestDist) {
              closestDist = dist;
              closestIdx = i;
            }
          });

          const markerX = padding + (closestIdx / (history.length - 1)) * (w - padding * 2);

          // Vertical dashed purple line
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "#8b5cf6";
          ctx.lineWidth = 1;
          ctx.moveTo(markerX, padding);
          ctx.lineTo(markerX, h - padding);
          ctx.stroke();
          ctx.setLineDash([]);

          // Small dot at intersection
          const markerY =
            h - padding - ((history[closestIdx].equity - min) / range) * (h - padding * 2);
          ctx.beginPath();
          ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#8b5cf6";
          ctx.fill();
        }
      }
    }
  },

  bindEvents(overlay) {
    const closeBtn = overlay.querySelector(".replay-close");
    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) this.close();
    };

    overlay.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.onclick = () => {
        const filter = btn.getAttribute("data-filter");
        this.toggleFilter(filter);
      };
    });

    // Event click handlers for equity highlighting
    overlay.querySelectorAll(".timeline-event").forEach((el) => {
      el.onclick = (e) => {
        // Don't trigger on filter button clicks
        if (e.target.closest(".filter-btn")) return;

        const idx = parseInt(el.getAttribute("data-idx"), 10);
        if (isNaN(idx)) return;

        // Toggle selection
        if (this._selectedEventIdx === idx) {
          this._selectedEventIdx = -1;
        } else {
          this._selectedEventIdx = idx;
        }

        // Update selected class
        overlay.querySelectorAll(".timeline-event").forEach((ev) => {
          ev.classList.remove("selected");
        });
        if (this._selectedEventIdx >= 0) {
          const selectedEl = overlay.querySelector(
            `.timeline-event[data-idx="${this._selectedEventIdx}"]`
          );
          if (selectedEl) selectedEl.classList.add("selected");
        }

        // Redraw equity curve
        const { session } = this._resolveSession();
        if (session.equityHistory && session.equityHistory.length >= 2) {
          this.drawEquityCurve(overlay, session);
        }
      };
    });
  },
};
