import { Store } from "../store.js";
import { OverlayManager } from "./overlay.js";
import { Analytics, EVENT_CATEGORIES } from "../core/analytics.js";
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

.replay-header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
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

.replay-subtitle {
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
    padding-left: 30px;
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
    flex-shrink: 0;
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

.replay-equity-section {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.replay-equity-section .dash-section-label {
    font-size: 9px;
    font-weight: 700;
    color: #3f4a5a;
    letter-spacing: 1.2px;
    margin-bottom: 8px;
}

#replay-equity-canvas {
    width: 100%;
    height: 120px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
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

.replay-timeline::-webkit-scrollbar { width: 4px; }
.replay-timeline::-webkit-scrollbar-track { background: transparent; }
.replay-timeline::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }

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
    cursor: pointer;
    border-radius: 6px;
}

.timeline-event:hover {
    background: rgba(255, 255, 255, 0.02);
    margin: 0 -8px;
    padding: 12px 8px;
}

.timeline-event.selected {
    background: rgba(139, 92, 246, 0.08);
    margin: 0 -8px;
    padding: 12px 8px;
    border-color: rgba(139, 92, 246, 0.15);
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

.replay-detail-drawer {
    padding: 12px 20px;
    background: rgba(139, 92, 246, 0.04);
    border-top: 1px solid rgba(139, 92, 246, 0.1);
    border-bottom: 1px solid rgba(139, 92, 246, 0.1);
}

.replay-detail-drawer .detail-title {
    font-size: 11px;
    font-weight: 700;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

.replay-detail-drawer .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
}

.replay-detail-drawer .detail-item {
    font-size: 11px;
}

.replay-detail-drawer .detail-item .dk {
    color: #64748b;
    margin-bottom: 2px;
}

.replay-detail-drawer .detail-item .dv {
    color: #e2e8f0;
    font-weight: 600;
}

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

.replay-mode-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
}

.replay-mode-badge.paper { color: #14b8a6; }
.replay-mode-badge.shadow { color: #a78bfa; }

.replay-elite-note {
    font-size: 10px;
    color: #475569;
    padding: 8px 20px;
    text-align: center;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
}
`;

export const SessionReplay = {
  isOpen: false,
  activeFilters: ["TRADE", "ALERT", "DISCIPLINE", "MILESTONE"],

  // State for replay
  replaySession: null, // Archived session object (null = current session)
  replayEvents: [], // Resolved events
  replayTradesMap: {}, // Trade ID → trade object
  selectedEventIdx: null, // For equity curve highlight

  open() {
    this.replaySession = null;
    this.selectedEventIdx = null;
    this._resolveCurrentSessionData();
    this.isOpen = true;
    this.render();
  },

  openForSession(archivedSession) {
    if (!archivedSession) return;
    if (archivedSession.status === "active") {
      console.warn("[SessionReplay] Cannot replay active session");
      return;
    }

    this.replaySession = archivedSession;
    this.selectedEventIdx = null;
    this._resolveHistoricalSessionData(archivedSession);
    this.isOpen = true;
    this.render();
  },

  close() {
    this.isOpen = false;
    this.replaySession = null;
    this.replayEvents = [];
    this.replayTradesMap = {};
    this.selectedEventIdx = null;
    const overlay = OverlayManager.getShadowRoot().querySelector(".replay-overlay");
    if (overlay) overlay.remove();
  },

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  },

  // --- Data Resolution ---

  _resolveCurrentSessionData() {
    const state = Store.state;
    this.replayEvents = Analytics.getEventLog(state, { limit: 100 });
    this.replayTradesMap = Store.getActiveTrades() || {};
  },

  _resolveHistoricalSessionData(session) {
    // Use eventSnapshot if available, otherwise reconstruct from trades
    if (session.eventSnapshot && session.eventSnapshot.length > 0) {
      this.replayEvents = session.eventSnapshot;
    } else {
      this.replayEvents = this._reconstructEventsFromTrades(session);
    }

    // Resolve trade objects
    const isShadow = session.mode === "shadow" || session.walletBalance !== undefined;
    const tradesMap = isShadow ? Store.state.shadowTrades : Store.state.trades;
    this.replayTradesMap = {};
    (session.trades || []).forEach((id) => {
      if (tradesMap[id]) this.replayTradesMap[id] = tradesMap[id];
    });
  },

  _reconstructEventsFromTrades(session) {
    const isShadow = session.mode === "shadow" || session.walletBalance !== undefined;
    const tradesMap = isShadow ? Store.state.shadowTrades : Store.state.trades;
    const events = [];

    (session.trades || []).forEach((id) => {
      const t = tradesMap[id];
      if (!t) return;
      const priceStr = t.fillPriceUsd ? `$${t.fillPriceUsd.toFixed(6)}` : "?";
      events.push({
        id: `synth_${t.id}`,
        ts: t.ts,
        type: t.side,
        category: "TRADE",
        message: `${t.side} ${t.symbol || "?"} @ ${priceStr}`,
        data: {
          tradeId: t.id,
          symbol: t.symbol,
          realizedPnlSol: t.realizedPnlSol,
          strategy: t.strategy,
          solAmount: t.solAmount,
          fillPriceUsd: t.fillPriceUsd,
        },
      });
    });

    return events.sort((a, b) => a.ts - b.ts);
  },

  // --- Rendering ---

  render() {
    const root = OverlayManager.getShadowRoot();
    let overlay = root.querySelector(".replay-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "replay-overlay";

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
    const session = this.replaySession || Store.getActiveSession();
    const events = this.getFilteredEvents(isElite);
    const eventStats = this._computeEventStats();
    const hasEquityData = (session.equityHistory || []).length >= 2;

    // Session mode label
    const sessionMode = session.mode || (Store.isShadowMode() ? "shadow" : "paper");
    const modeLabel = sessionMode === "shadow" ? "Real trades (observed)" : "Paper session";

    // Session stats
    const sessionPnl = session.realized || 0;
    const tradeCount = (session.trades || []).length;
    const durationMs = (session.endTime || Date.now()) - (session.startTime || Date.now());
    const durationMin = Math.max(1, Math.floor(durationMs / 60000));

    overlay.innerHTML = `
      <div class="replay-modal">
        <div class="replay-header">
          <div class="replay-header-left">
            <div class="replay-title">
              ${ICONS.REPLAY || ICONS.BRAIN}
              <span>Session Replay</span>
            </div>
            <div class="replay-subtitle">${modeLabel}</div>
          </div>
          <button class="replay-close">${ICONS.X}</button>
        </div>

        <div class="replay-stats">
          <div class="replay-stat">
            <div class="k">Duration</div>
            <div class="v">${durationMin}m</div>
          </div>
          <div class="replay-stat">
            <div class="k">Trades</div>
            <div class="v" style="color:#14b8a6;">${tradeCount}</div>
          </div>
          <div class="replay-stat">
            <div class="k">P&L</div>
            <div class="v" style="color:${sessionPnl >= 0 ? "#10b981" : "#ef4444"};">${sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(4)} SOL</div>
          </div>
          <div class="replay-stat">
            <div class="k">Events</div>
            <div class="v">${eventStats.total}</div>
          </div>
        </div>

        ${hasEquityData ? `
        <div class="replay-equity-section">
          <div class="dash-section-label">EQUITY CURVE</div>
          <canvas id="replay-equity-canvas"></canvas>
        </div>
        ` : ""}

        ${isElite ? `
        <div class="replay-filters">
          <button class="filter-btn trade ${this.activeFilters.includes("TRADE") ? "active" : ""}" data-filter="TRADE">
            Trades (${eventStats.trades})
          </button>
          <button class="filter-btn alert ${this.activeFilters.includes("ALERT") ? "active" : ""}" data-filter="ALERT">
            Alerts (${eventStats.alerts})
          </button>
          <button class="filter-btn discipline ${this.activeFilters.includes("DISCIPLINE") ? "active" : ""}" data-filter="DISCIPLINE">
            Discipline (${eventStats.discipline})
          </button>
          <button class="filter-btn milestone ${this.activeFilters.includes("MILESTONE") ? "active" : ""}" data-filter="MILESTONE">
            Milestones (${eventStats.milestones})
          </button>
        </div>
        ` : ""}

        <div class="replay-timeline">
          ${events.length > 0 ? this.renderEvents(events) : this.renderEmpty()}
        </div>

        ${this.selectedEventIdx !== null && isElite ? this.renderDetailDrawer(events) : ""}

        <div class="replay-footer">
          <div class="replay-count">Showing ${events.length} events</div>
          <div class="replay-mode-badge ${sessionMode}">${sessionMode === "shadow" ? "Shadow" : "Paper"}</div>
        </div>

        ${!isElite ? `
        <div class="replay-elite-note">Full timeline with discipline, alerts, and interactive analysis available in Elite</div>
        ` : ""}
      </div>
    `;

    this.bindEvents(overlay);

    // Draw equity curve
    if (hasEquityData) {
      setTimeout(() => this.drawEquityCurve(overlay, session), 100);
    }
  },

  renderEmpty() {
    return `
      <div class="timeline-empty">
        ${ICONS.TARGET}
        <div style="font-size:14px; font-weight:600; margin-bottom:4px;">No events recorded</div>
        <div style="font-size:12px;">This session has no event data for replay.</div>
      </div>
    `;
  },

  renderEvents(events) {
    return events
      .map((event, idx) => {
        const time = new Date(event.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const category = (event.category || "TRADE").toLowerCase();
        const icon = this.getEventIcon(event.category);
        const dataTags = this.renderEventData(event);
        const selectedClass = this.selectedEventIdx === idx ? "selected" : "";

        return `
          <div class="timeline-event ${selectedClass}" data-event-idx="${idx}">
            <div class="event-time">${time}</div>
            <div class="event-icon ${category}">${icon}</div>
            <div class="event-content">
              <div class="event-type ${category}">${event.type}</div>
              <div class="event-message">${event.message}</div>
              ${dataTags ? `<div class="event-data">${dataTags}</div>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  },

  renderEventData(event) {
    const data = event.data || {};
    const tags = [];

    if (data.symbol) tags.push(`<span class="event-tag">${data.symbol}</span>`);
    if (data.strategy && data.strategy !== "MANUAL")
      tags.push(`<span class="event-tag">${data.strategy}</span>`);
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

  renderDetailDrawer(events) {
    const event = events[this.selectedEventIdx];
    if (!event) return "";

    const data = event.data || {};
    let details = "";

    if (data.symbol) {
      details += `<div class="detail-item"><div class="dk">Symbol</div><div class="dv">${data.symbol}</div></div>`;
    }
    if (data.fillPriceUsd) {
      details += `<div class="detail-item"><div class="dk">Price</div><div class="dv">$${data.fillPriceUsd.toFixed(6)}</div></div>`;
    }
    if (data.solAmount) {
      details += `<div class="detail-item"><div class="dk">Amount</div><div class="dv">${data.solAmount.toFixed(4)} SOL</div></div>`;
    }
    if (data.strategy) {
      details += `<div class="detail-item"><div class="dk">Strategy</div><div class="dv">${data.strategy}</div></div>`;
    }
    if (data.realizedPnlSol !== undefined && data.realizedPnlSol !== null) {
      const pnl = data.realizedPnlSol;
      const color = pnl >= 0 ? "#10b981" : "#ef4444";
      details += `<div class="detail-item"><div class="dk">Realized P&L</div><div class="dv" style="color:${color};">${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} SOL</div></div>`;
    }
    if (data.penalty) {
      details += `<div class="detail-item"><div class="dk">Penalty</div><div class="dv" style="color:#f59e0b;">-${data.penalty} pts</div></div>`;
    }

    if (!details) return "";

    return `
      <div class="replay-detail-drawer">
        <div class="detail-title">Event Details</div>
        <div class="detail-grid">${details}</div>
      </div>
    `;
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

  // --- Equity Curve ---

  drawEquityCurve(root, session) {
    const canvas = root.querySelector("#replay-equity-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const history = session.equityHistory || [];
    if (history.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const padding = 16;

    const points = history.map((e) => e.equity);
    const timestamps = history.map((e) => e.ts);
    const min = Math.min(...points) * 0.99;
    const max = Math.max(...points) * 1.01;
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);

    // Draw line
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

    // Draw event markers on curve (Elite only)
    const isElite = FeatureManager.isElite(Store.state);
    if (isElite && this.replayEvents.length > 0) {
      this._drawEventMarkers(ctx, w, h, padding, history, timestamps, min, range);
    }

    // Draw selected event highlight
    if (this.selectedEventIdx !== null && isElite) {
      const events = this.getFilteredEvents(isElite);
      const selectedEvent = events[this.selectedEventIdx];
      if (selectedEvent) {
        this._drawSelectedHighlight(ctx, w, h, padding, history, timestamps, min, range, selectedEvent.ts);
      }
    }
  },

  _drawEventMarkers(ctx, w, h, padding, history, timestamps, min, range) {
    const events = this.replayEvents;
    const tsMin = timestamps[0];
    const tsMax = timestamps[timestamps.length - 1];
    const tsRange = tsMax - tsMin || 1;

    events.forEach((event) => {
      if (event.category !== "DISCIPLINE" && event.category !== "ALERT") return;
      const x = padding + ((event.ts - tsMin) / tsRange) * (w - padding * 2);
      if (x < padding || x > w - padding) return;

      // Find nearest equity point
      let nearestIdx = 0;
      let nearestDist = Infinity;
      timestamps.forEach((ts, i) => {
        const dist = Math.abs(ts - event.ts);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      });

      const y = h - padding - ((history[nearestIdx].equity - min) / range) * (h - padding * 2);
      const color = event.category === "DISCIPLINE" ? "#f59e0b" : "#ef4444";

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  },

  _drawSelectedHighlight(ctx, w, h, padding, history, timestamps, min, range, eventTs) {
    const tsMin = timestamps[0];
    const tsMax = timestamps[timestamps.length - 1];
    const tsRange = tsMax - tsMin || 1;

    const x = padding + ((eventTs - tsMin) / tsRange) * (w - padding * 2);
    if (x < padding || x > w - padding) return;

    // Vertical dotted line
    ctx.beginPath();
    ctx.strokeStyle = "rgba(167, 139, 250, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(x, padding);
    ctx.lineTo(x, h - padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // Circle at nearest equity point
    let nearestIdx = 0;
    let nearestDist = Infinity;
    timestamps.forEach((ts, i) => {
      const dist = Math.abs(ts - eventTs);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    });

    const y = h - padding - ((history[nearestIdx].equity - min) / range) * (h - padding * 2);

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#a78bfa";
    ctx.fill();
    ctx.strokeStyle = "#0d1117";
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  // --- Filtering ---

  getFilteredEvents(isElite) {
    const events = this.replayEvents || [];
    if (!isElite) {
      // Free: only TRADE events
      return events.filter((e) => e.category === "TRADE");
    }
    return events.filter((e) => this.activeFilters.includes(e.category));
  },

  _computeEventStats() {
    const events = this.replayEvents || [];
    return {
      total: events.length,
      trades: events.filter((e) => e.category === "TRADE").length,
      alerts: events.filter((e) => e.category === "ALERT").length,
      discipline: events.filter((e) => e.category === "DISCIPLINE").length,
      milestones: events.filter((e) => e.category === "MILESTONE").length,
    };
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

  selectEvent(idx) {
    this.selectedEventIdx = this.selectedEventIdx === idx ? null : idx;
    this.render();
  },

  // --- Event Bindings ---

  bindEvents(overlay) {
    const closeBtn = overlay.querySelector(".replay-close");
    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) this.close();
    };

    // Filter buttons (Elite only)
    overlay.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.onclick = () => {
        const filter = btn.getAttribute("data-filter");
        this.toggleFilter(filter);
      };
    });

    // Event selection (Elite only)
    const isElite = FeatureManager.isElite(Store.state);
    if (isElite) {
      overlay.querySelectorAll(".timeline-event").forEach((el) => {
        el.onclick = () => {
          const idx = parseInt(el.getAttribute("data-event-idx"), 10);
          if (!isNaN(idx)) this.selectEvent(idx);
        };
      });
    }
  },
};
