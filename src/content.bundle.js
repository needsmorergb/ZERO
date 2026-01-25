(() => {
  // src/modules/store.js
  var EXT_KEY = "sol_paper_trader_v1";
  var DEFAULTS = {
    settings: {
      tier: "free",
      enabled: true,
      buyHudDocked: true,
      pnlDocked: true,
      buyHudPos: { x: 20, y: 120 },
      pnlPos: { x: 20, y: 60 },
      startSol: 10,
      quickBuySols: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
      quickSellPcts: [10, 25, 50, 75, 100],
      strategies: ["Trend", "Breakout", "Reversal", "Scalp", "News", "Other"],
      // Phase 2: Context
      tokenDisplayUsd: false,
      sessionDisplayUsd: false,
      tutorialCompleted: false,
      tradingMode: "paper",
      // 'paper' | 'shadow'
      showProfessor: true
      // Show trade analysis popup
    },
    // Runtime state (not always persisted fully, but structure is here)
    session: {
      balance: 10,
      equity: 10,
      realized: 0,
      trades: [],
      // IDs
      winStreak: 0,
      lossStreak: 0,
      startTime: 0,
      tradeCount: 0,
      disciplineScore: 100
    },
    trades: {},
    // Map ID -> Trade Object { id, strategy, emotion, ... }
    positions: {},
    behavior: {
      tiltFrequency: 0
    },
    schemaVersion: 2,
    version: "1.8.0"
  };
  function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object")
      return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  function isChromeStorageAvailable() {
    try {
      return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
    } catch {
      return false;
    }
  }
  var Store = {
    state: null,
    async load() {
      let timeoutId;
      const loadLogic = new Promise((resolve) => {
        try {
          if (!isChromeStorageAvailable()) {
            this.state = JSON.parse(JSON.stringify(DEFAULTS));
            if (timeoutId)
              clearTimeout(timeoutId);
            resolve(this.state);
            return;
          }
          chrome.storage.local.get([EXT_KEY], (res) => {
            if (timeoutId)
              clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              const msg = chrome.runtime.lastError.message;
              if (msg && !msg.includes("context invalidated")) {
                console.warn("[ZER\xD8] Storage load error:", msg);
              }
              this.state = JSON.parse(JSON.stringify(DEFAULTS));
              resolve(this.state);
              return;
            }
            const saved = res[EXT_KEY];
            if (!saved) {
              this.state = JSON.parse(JSON.stringify(DEFAULTS));
            } else if (!saved.schemaVersion || saved.schemaVersion < 2) {
              console.log("[ZER\xD8] Migrating storage schema v1 -> v2");
              this.state = this.migrateV1toV2(saved);
              this.save();
            } else {
              this.state = deepMerge(DEFAULTS, saved);
            }
            this.validateState();
            resolve(this.state);
          });
        } catch (e) {
          console.error("[ZER\xD8] Storage load exception:", e);
          if (timeoutId)
            clearTimeout(timeoutId);
          resolve(JSON.parse(JSON.stringify(DEFAULTS)));
        }
      });
      const timeout = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn("[ZER\xD8] Storage load timed out, using defaults.");
          if (!this.state)
            this.state = JSON.parse(JSON.stringify(DEFAULTS));
          resolve(this.state);
        }, 1e3);
      });
      return Promise.race([loadLogic, timeout]);
    },
    async save() {
      if (!isChromeStorageAvailable() || !this.state)
        return;
      return new Promise((resolve) => {
        try {
          chrome.storage.local.set({ [EXT_KEY]: this.state }, () => {
            if (chrome.runtime.lastError) {
              const msg = chrome.runtime.lastError.message;
              if (msg && !msg.includes("context invalidated")) {
                console.warn("[ZER\xD8] Storage save error:", msg);
              }
            }
            resolve();
          });
        } catch (e) {
          if (!e.message.includes("context invalidated")) {
            console.error("[ZER\xD8] Storage save exception:", e);
          }
          resolve();
        }
      });
    },
    migrateV1toV2(oldState) {
      const newState = JSON.parse(JSON.stringify(DEFAULTS));
      newState.settings.enabled = oldState.enabled ?? true;
      newState.settings.buyHudDocked = oldState.buyHudDocked ?? true;
      newState.settings.pnlDocked = oldState.pnlDocked ?? true;
      newState.settings.buyHudPos = oldState.buyHudPos ?? { x: 20, y: 120 };
      newState.settings.pnlPos = oldState.pnlPos ?? { x: 20, y: 60 };
      newState.settings.startSol = oldState.startSol ?? 10;
      newState.settings.tutorialCompleted = oldState.tutorialCompleted ?? false;
      newState.session.balance = oldState.cashSol ?? 10;
      newState.session.equity = oldState.equitySol ?? 10;
      newState.session.realized = oldState.realizedSol ?? 0;
      newState.session.winStreak = oldState.winStreak ?? 0;
      newState.session.lossStreak = oldState.lossStreak ?? 0;
      newState.session.disciplineScore = oldState.disciplineScore ?? 100;
      if (Array.isArray(oldState.trades)) {
        oldState.trades.forEach((t, idx) => {
          const id = t.id || `legacy_${idx}_${Date.now()}`;
          newState.trades[id] = t;
          newState.session.trades.push(id);
        });
      }
      newState.positions = oldState.positions || {};
      return newState;
    },
    validateState() {
      if (this.state) {
        this.state.settings.startSol = parseFloat(this.state.settings.startSol) || 10;
      }
    }
  };

  // src/modules/ui/ids.js
  var IDS = {
    banner: "paper-mode-banner",
    pnlHud: "paper-pnl-hud",
    buyHud: "paper-buyhud-root",
    style: "paper-overlay-style"
  };

  // src/modules/ui/common-styles.js
  var COMMON_CSS = `
.zero-inline-icon {
  height: 14px;
  width: 14px;
  vertical-align: -2px;
  margin: 0 1px;
  display: inline-block;
}

/* Global Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

@keyframes streakPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes fadeIn {
  to { opacity: 1; }
}

@keyframes scaleIn {
  to { transform: scale(1); }
}

@keyframes professorFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes professorSlideIn {
  from { transform: translateY(30px) scale(0.9); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
`;

  // src/modules/ui/banner-styles.js
  var BANNER_CSS = `
#${IDS.banner} {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  bottom: auto;
  right: auto;
  height: 36px;
  padding: 0 20px;
  border-radius: 99px;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  pointer-events: auto;
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.3);
  box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#${IDS.banner} .inner {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 12px;
  letter-spacing: 0.3px;
}

#${IDS.banner} .dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 8px rgba(20,184,166,0.5);
}

#${IDS.banner}.disabled .dot {
  background: #475569;
  box-shadow: none;
}

#${IDS.banner} .label {
  color: #14b8a6;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

#${IDS.banner} .state {
  color: #f8fafc;
  font-weight: 600;
}

#${IDS.banner}.disabled .state {
  color: #64748b;
}

#${IDS.banner} .hint {
  color: #64748b;
  font-weight: 500;
}
`;

  // src/modules/ui/pnl-hud-styles.js
  var PNL_HUD_CSS = `
#${IDS.pnlHud} {
  position: fixed;
  z-index: 2147483645;
  width: 720px;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#${IDS.pnlHud}.docked {
  left: 50%;
  transform: translateX(-50%);
  top: 50px;
}

#${IDS.pnlHud}.floating {
  left: 20px;
  top: 60px;
  transform: none;
}

#${IDS.pnlHud} .card {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}

#${IDS.pnlHud} .header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}

#${IDS.pnlHud} .header:active {
  cursor: grabbing;
}

#${IDS.pnlHud} .title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #14b8a6;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

#${IDS.pnlHud} .title .dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
  animation: pulse 2s infinite;
}

#${IDS.pnlHud} .controls {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #64748b;
}

#${IDS.pnlHud} .pillBtn {
  border: 1px solid rgba(20,184,166,0.2);
  background: transparent;
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

#${IDS.pnlHud} .pillBtn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}

#${IDS.pnlHud} .startSol {
  display: flex;
  align-items: center;
  gap: 8px;
}

#${IDS.pnlHud} input.startSolInput {
  width: 70px;
  border: 1px solid rgba(20,184,166,0.2);
  background: #161b22;
  color: #f8fafc;
  padding: 6px 10px;
  border-radius: 6px;
  outline: none;
  font-weight: 600;
  pointer-events: auto;
  cursor: text;
  transition: all 0.2s;
}

#${IDS.pnlHud} input.startSolInput:focus {
  border-color: #14b8a6;
}

#${IDS.pnlHud} .stats {
  display: flex;
  gap: 0;
  padding: 0;
  border-top: 1px solid rgba(20,184,166,0.1);
}

#${IDS.pnlHud} .stat {
  flex: 1;
  background: transparent;
  border: none;
  border-right: 1px solid rgba(20,184,166,0.1);
  border-radius: 0;
  padding: 16px 20px;
  text-align: left;
  transition: background 0.2s;
}

#${IDS.pnlHud} .stat:last-child {
  border-right: none;
}

#${IDS.pnlHud} .stat:hover {
  background: rgba(20,184,166,0.05);
}

#${IDS.pnlHud} .stat .k {
  font-size: 10px;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.pnlHud} .stat .v {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
}

#${IDS.pnlHud} .stat.streak .v {
  font-size: 20px;
  font-weight: 800;
  color: #14b8a6;
}

#${IDS.pnlHud} .stat.streak.loss .v {
  color: #ef4444;
}

#${IDS.pnlHud} .stat.streak.win .v {
  color: #14b8a6;
  animation: streakPulse 1s infinite;
}

#${IDS.pnlHud} .tradeList {
  max-height: 200px;
  overflow: auto;
  border-top: 1px solid rgba(20,184,166,0.1);
}

#${IDS.pnlHud} .tradeRow {
  display: grid;
  grid-template-columns: 70px 70px 50px 100px 80px 70px;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(20,184,166,0.05);
  font-size: 11px;
  color: #e2e8f0;
  align-items: center;
}

#${IDS.pnlHud} .tradeRow:hover {
  background: rgba(20,184,166,0.03);
}

#${IDS.pnlHud} .tradeRow .muted {
  color: #64748b;
}

#${IDS.pnlHud} .tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
}

#${IDS.pnlHud} .tag.buy {
  background: rgba(20,184,166,0.15);
  color: #14b8a6;
}

#${IDS.pnlHud} .tag.sell {
  background: rgba(239,68,68,0.15);
  color: #ef4444;
}

/* Chart trade markers */
.paper-trade-marker {
  position: absolute;
  z-index: 999999;
  pointer-events: none;
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.paper-trade-marker.buy {
  background: rgba(34, 197, 94, 0.9);
  color: white;
  border-bottom: 2px solid #22c55e;
}

.paper-trade-marker.sell {
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border-top: 2px solid #ef4444;
}

.paper-trade-marker::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
}

.paper-trade-marker.buy::after {
  bottom: -12px;
  border-top-color: #22c55e;
}

.paper-trade-marker.sell::after {
  top: -12px;
  border-bottom-color: #ef4444;
}
`;

  // src/modules/ui/buy-hud-styles.js
  var BUY_HUD_CSS = `
#${IDS.buyHud} {
  z-index: 2147483644;
  pointer-events: auto;
  font-size: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#${IDS.buyHud}.floating {
  position: fixed;
  left: auto;
  top: 100px;
  width: 300px;
  max-width: calc(100vw - 24px);
}

#${IDS.buyHud}.docked {
  position: fixed;
  right: 16px;
  top: 320px;
  width: 300px;
  z-index: 2147483645;
}

#${IDS.buyHud} .panel {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}

#${IDS.buyHud}.docked .panel {
  border-radius: 10px;
}

#${IDS.buyHud} .panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}

#${IDS.buyHud} .panelHeader:active {
  cursor: grabbing;
}

#${IDS.buyHud} .panelTitle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: #14b8a6;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.buyHud} .panelTitle .dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
}

#${IDS.buyHud} .panelBtns {
  display: flex;
  align-items: center;
  gap: 8px;
}

#${IDS.buyHud} .btn {
  border: 1px solid rgba(20,184,166,0.2);
  background: transparent;
  color: #94a3b8;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 10px;
  transition: all 0.2s;
  text-transform: uppercase;
}

#${IDS.buyHud} .btn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}

#${IDS.buyHud} .tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
}

#${IDS.buyHud} .tab {
  flex: 1;
  border: 1px solid rgba(20,184,166,0.15);
  background: #161b22;
  color: #94a3b8;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 11px;
  text-align: center;
  transition: all 0.2s;
  text-transform: uppercase;
}

#${IDS.buyHud} .tab.active {
  background: rgba(20,184,166,0.15);
  border-color: #14b8a6;
  color: #14b8a6;
}

#${IDS.buyHud} .tab:hover:not(.active) {
  background: #1c2128;
  border-color: rgba(20,184,166,0.25);
}

#${IDS.buyHud} .body {
  padding: 14px 16px;
}

#${IDS.buyHud} .fieldLabel {
  color: #64748b;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.buyHud} input.field {
  width: 100%;
  border: 1px solid rgba(20,184,166,0.2);
  background: #161b22;
  color: #f8fafc;
  padding: 12px 14px;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

#${IDS.buyHud} input.field:focus {
  border-color: #14b8a6;
}

#${IDS.buyHud} .quickRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

#${IDS.buyHud} .qbtn {
  border: 1px solid rgba(20,184,166,0.15);
  background: #161b22;
  color: #94a3b8;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;
  transition: all 0.2s;
}

#${IDS.buyHud} .qbtn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.3);
  color: #14b8a6;
}

#${IDS.buyHud} .strategyRow {
  margin-top: 12px;
}

#${IDS.buyHud} .strategySelect {
  width: 100%;
  padding: 8px 10px;
  background: #161b22;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 8px;
  color: #f8fafc;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
}

#${IDS.buyHud} .strategySelect:hover {
  border-color: rgba(20,184,166,0.5);
}

#${IDS.buyHud} .strategySelect:focus {
  border-color: #14b8a6;
}

#${IDS.buyHud} .action {
  margin-top: 14px;
  width: 100%;
  border: none;
  background: #14b8a6;
  color: #0d1117;
  padding: 12px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s;
}

#${IDS.buyHud} .action:hover {
  background: #2dd4bf;
}

#${IDS.buyHud} .action.sell {
  background: #ef4444;
  color: white;
}

#${IDS.buyHud} .action.sell:hover {
  background: #f87171;
}

#${IDS.buyHud} .status {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #161b22;
  border: 1px solid rgba(20,184,166,0.1);
  color: #64748b;
  font-weight: 600;
  min-height: 40px;
  font-size: 11px;
}
`;

  // src/modules/ui/modals-styles.js
  var MODALS_CSS = `
/* Confirm Modal */
.confirm-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
}

.confirm-modal {
  background: linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(10,15,30,0.99) 100%);
  border: 1px solid rgba(99,102,241,0.35);
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  font-family: 'Inter', sans-serif;
}

.confirm-modal h3 {
  margin: 0 0 12px 0;
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 700;
}

.confirm-modal p {
  margin: 0 0 20px 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.5;
}

.confirm-modal-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.confirm-modal-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.confirm-modal-btn.cancel {
  background: rgba(100,116,139,0.3);
  color: #94a3b8;
}

.confirm-modal-btn.cancel:hover {
  background: rgba(100,116,139,0.5);
}

.confirm-modal-btn.confirm {
  background: rgba(239,68,68,0.8);
  color: white;
}

.confirm-modal-btn.confirm:hover {
  background: rgba(239,68,68,1);
}

/* Emotion Selector Modal */
.emotion-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
  opacity: 0;
  animation: fadeIn 0.2s forwards;
}

.emotion-modal {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 16px;
  padding: 24px;
  width: 340px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  text-align: center;
  transform: scale(0.9);
  animation: scaleIn 0.2s forwards;
}

.emotion-title {
  color: #14b8a6;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.emotion-subtitle {
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 20px;
}

.emotion-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.emotion-btn {
  background: #161b22;
  border: 1px solid rgba(20,184,166,0.15);
  color: #bdc6d5;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.emotion-btn:hover {
  background: rgba(20,184,166,0.05);
  border-color: rgba(20,184,166,0.3);
  color: #f8fafc;
  transform: translateY(-2px);
}

.emotion-btn.selected {
  background: rgba(20,184,166,0.15);
  border-color: #14b8a6;
  color: #14b8a6;
}

.emotion-skip {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

.emotion-skip:hover {
  color: #94a3b8;
}

/* Settings Modal */
.settings-modal {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 16px;
  padding: 24px;
  width: 320px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8);
  font-family: 'Inter', sans-serif;
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  padding-bottom: 12px;
}

.settings-title {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-close {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 18px;
  transition: color 0.2s;
}

.settings-close:hover {
  color: #f8fafc;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.setting-info {
  flex: 1;
}

.setting-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 2px;
}

.setting-desc {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.3;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #1e293b;
  transition: .3s;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.1);
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #14b8a6;
  border-color: #14b8a6;
}

input:checked + .slider:before {
  transform: translateX(18px);
}
`;

  // src/modules/ui/professor-styles.js
  var PROFESSOR_CSS = `
/* Professor Trade Critique Popup */
.professor-overlay {
  position: fixed;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  animation: professorFadeIn 0.3s ease-out;
}

.professor-overlay * {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.professor-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 500px;
  animation: professorSlideIn 0.4s ease-out;
}

.professor-image {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #6366f1;
  box-shadow: 0 0 30px rgba(99,102,241,0.4);
  margin-bottom: -20px;
  z-index: 1;
}

.professor-bubble {
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 2px solid rgba(99,102,241,0.4);
  border-radius: 20px;
  padding: 25px 30px;
  color: #f1f5f9;
  font-size: 15px;
  line-height: 1.6;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  position: relative;
  text-align: center;
}

.professor-bubble::before {
  content: '';
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  border: 12px solid transparent;
  border-bottom-color: rgba(99,102,241,0.4);
}

.professor-bubble::after {
  content: '';
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  border: 10px solid transparent;
  border-bottom-color: #1e293b;
}

.professor-title {
  font-size: 18px;
  font-weight: 900;
  color: #a5b4fc;
  margin-bottom: 12px;
}

.professor-message {
  margin-bottom: 15px;
  color: #e2e8f0;
}

.professor-stats {
  background: rgba(15,23,42,0.5);
  border-radius: 12px;
  padding: 12px 16px;
  margin: 15px 0;
  font-size: 13px;
  text-align: left;
}

.professor-stats div {
  margin: 4px 0;
  color: #94a3b8;
}

.professor-stats span {
  color: #f1f5f9;
  font-weight: 700;
}

.professor-dismiss {
  margin-top: 15px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  color: white;
  padding: 10px 30px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  transition: all 0.2s;
}

.professor-dismiss:hover {
  background: linear-gradient(135deg, #818cf8, #6366f1);
  transform: scale(1.05);
}
`;

  // src/modules/ui/theme-overrides.js
  var THEME_OVERRIDES_CSS = `
/* Shadow Mode Overrides (Gold/Orange Theme) */
.zero-shadow-mode .slider {
  background-color: #451a03;
}

.zero-shadow-mode input:checked + .slider {
  background-color: #f59e0b;
  border-color: #f59e0b;
}

.zero-shadow-mode #${IDS.pnlHud} .title .dot {
  background: #f59e0b;
  box-shadow: 0 0 10px rgba(245,158,11,0.5);
}

.zero-shadow-mode #${IDS.pnlHud} .title {
  color: #f59e0b;
}

.zero-shadow-mode #${IDS.buyHud} .panelTitle .dot {
  background: #f59e0b;
  box-shadow: 0 0 10px rgba(245,158,11,0.5);
}

.zero-shadow-mode #${IDS.buyHud} .panelTitle {
  color: #f59e0b;
}

.zero-shadow-mode #${IDS.buyHud} .action {
  background: #f59e0b;
  color: #000;
}

.zero-shadow-mode #${IDS.buyHud} .action:hover {
  background: #fbbf24;
}

.zero-shadow-mode #${IDS.banner} .label {
  color: #f59e0b;
}

.zero-shadow-mode #${IDS.banner} .dot {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245,158,11,0.5);
}
`;

  // src/modules/ui/styles.js
  var CSS = COMMON_CSS + BANNER_CSS + PNL_HUD_CSS + BUY_HUD_CSS + MODALS_CSS + PROFESSOR_CSS + THEME_OVERRIDES_CSS;

  // src/modules/ui/overlay.js
  var OverlayManager = {
    shadowHost: null,
    shadowRoot: null,
    init(platformName) {
      this.createShadowRoot();
      this.injectStyles();
      if (platformName === "Padre") {
      }
    },
    getShadowRoot() {
      if (this.shadowRoot && this.shadowHost && this.shadowHost.isConnected) {
        return this.shadowRoot;
      }
      return this.createShadowRoot();
    },
    getContainer() {
      const root = this.getShadowRoot();
      return root.getElementById("paper-shadow-container") || root;
    },
    createShadowRoot() {
      this.shadowHost = document.createElement("paper-trader-host");
      this.shadowHost.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";
      this.shadowRoot = this.shadowHost.attachShadow({ mode: "open" });
      const container = document.createElement("div");
      container.id = "paper-shadow-container";
      container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;";
      this.shadowRoot.appendChild(container);
      document.documentElement.appendChild(this.shadowHost);
      return this.shadowRoot;
    },
    injectStyles() {
      const root = this.getShadowRoot();
      if (root.getElementById(IDS.style))
        return;
      const s = document.createElement("style");
      s.id = IDS.style;
      s.textContent = CSS;
      root.appendChild(s);
    },
    injectPadreOffset() {
      const styleId = "paper-padre-offset-style";
      if (document.getElementById(styleId))
        return;
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
          header, nav, [class*="Header"], [class*="Nav"], .MuiAppBar-root, [style*="sticky"], [style*="fixed"], [data-testid="top-bar"] {
            top: 28px !important;
            margin-top: 28px !important;
          }
          .MuiBox-root[style*="top: 0"], .MuiBox-root[style*="top:0"] {
            top: 28px !important;
          }
          #root, main, [class*="main"], body > div:first-child {
            padding-top: 28px !important;
          }
        `;
      document.head.appendChild(style);
    }
  };

  // src/modules/core/market.js
  var Market = {
    price: 0,
    marketCap: 0,
    lastPriceTs: 0,
    listeners: [],
    init() {
      this.startPolling();
      window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data?.__paper)
          return;
        if (event.data.type === "PRICE_TICK") {
          this.updatePrice(event.data.price);
        }
      });
    },
    subscribe(callback) {
      this.listeners.push(callback);
    },
    startPolling() {
      setInterval(() => {
        if (!window.location.pathname.includes("/trade/"))
          return;
        this.pollDOM();
      }, 1e3);
    },
    pollDOM() {
      let candidates = [];
      const isPadre = window.location.hostname.includes("padre.gg");
      if (isPadre) {
        candidates = Array.from(document.querySelectorAll('h2, span[class*="MuiTypography"], div[class*="MuiTypography"]')).filter((el) => {
          const txt = el.textContent || "";
          return /\d/.test(txt) && !txt.includes("%") && !txt.includes("SOL") && txt.length < 30;
        });
      } else {
        candidates = Array.from(document.querySelectorAll("h1, h2, .price")).filter((el) => /\d/.test(el.textContent) && !el.textContent.includes("%") && el.textContent.length < 30);
      }
      for (const el of candidates) {
        const raw = el.textContent.trim();
        const val = this.parsePriceStr(raw);
        const hasUnit = /[KMB]/.test(raw.toUpperCase());
        if (hasUnit || val > 1e5) {
          if (val > 0)
            this.marketCap = val;
        } else if (val > 0) {
          this.updatePrice(val);
        }
      }
    },
    parsePriceStr(text) {
      if (!text)
        return 0;
      let clean = text.trim();
      const subscriptMap = {
        "\u2080": 0,
        "\u2081": 1,
        "\u2082": 2,
        "\u2083": 3,
        "\u2084": 4,
        "\u2085": 5,
        "\u2086": 6,
        "\u2087": 7,
        "\u2088": 8,
        "\u2089": 9
      };
      let processed = clean.replace(/[$,]/g, "");
      const match = processed.match(/0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
      if (match) {
        const numZeros = subscriptMap[match[1]];
        const digits = match[2];
        processed = "0.0" + "0".repeat(numZeros) + digits;
      }
      let val = parseFloat(processed);
      const low = processed.toLowerCase();
      if (low.includes("k"))
        val *= 1e3;
      else if (low.includes("m"))
        val *= 1e6;
      else if (low.includes("b"))
        val *= 1e9;
      return isNaN(val) ? 0 : val;
    },
    updatePrice(val) {
      if (!val || val <= 1e-12)
        return;
      if (val !== this.price) {
        this.price = val;
        this.lastPriceTs = Date.now();
        this.listeners.forEach((cb) => cb(val));
      }
    }
  };

  // src/modules/ui/banner.js
  var Banner = {
    mountBanner() {
      const root = OverlayManager.getShadowRoot();
      if (!root)
        return;
      let bar = root.getElementById(IDS.banner);
      if (bar)
        return;
      bar = document.createElement("div");
      bar.id = IDS.banner;
      bar.innerHTML = `
            <div class="inner" style="cursor:pointer;" title="Click to toggle ZER\xD8 Mode">
                <div class="dot"></div>
                <div class="label">ZER\xD8 MODE</div>
                <div class="state">ENABLED</div>
                <div class="hint" style="margin-left:8px; opacity:0.5; font-size:11px;">(Paper Trading Overlay)</div>
            </div>
            <div style="position:absolute; right:20px; font-size:10px; color:#334155; pointer-events:none;">v${Store.state?.version || "0.9.1"}</div>
        `;
      bar.addEventListener("click", async () => {
        if (!Store.state)
          return;
        Store.state.settings.enabled = !Store.state.settings.enabled;
        await Store.save();
        if (window.ZeroHUD && window.ZeroHUD.updateAll) {
          window.ZeroHUD.updateAll();
        }
      });
      root.insertBefore(bar, root.firstChild);
    },
    updateBanner() {
      const root = OverlayManager.getShadowRoot();
      const bar = root?.getElementById(IDS.banner);
      if (!bar || !Store.state)
        return;
      const enabled = Store.state.settings.enabled;
      const stateEl = bar.querySelector(".state");
      if (stateEl)
        stateEl.textContent = enabled ? "ENABLED" : "DISABLED";
      bar.classList.toggle("disabled", !enabled);
    }
  };

  // src/modules/core/pnl-calculator.js
  var PnlCalculator = {
    cachedSolPrice: null,
    lastSolPriceFetch: 0,
    priceUpdatePending: false,
    lastPriceSave: 0,
    async getSolPrice() {
      const now = Date.now();
      if (this.cachedSolPrice && now - this.lastSolPriceFetch < 3e4) {
        return this.cachedSolPrice;
      }
      try {
        const response = await fetch("https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112");
        const data = await response.json();
        const solPrice = data?.data?.So11111111111111111111111111111111111111112?.price;
        if (solPrice && solPrice > 0) {
          this.cachedSolPrice = solPrice;
          this.lastSolPriceFetch = now;
          return solPrice;
        }
      } catch (e) {
        console.warn("[ZER\xD8] Failed to fetch SOL price:", e);
      }
      return this.cachedSolPrice || 200;
    },
    fmtSol(n) {
      if (!Number.isFinite(n))
        return "0.0000";
      if (Math.abs(n) < 1 && n !== 0) {
        return n.toFixed(6);
      }
      return n.toFixed(4);
    },
    async getUnrealizedPnl(state, currentTokenMint = null) {
      let totalUnrealized = 0;
      const solUsd = await this.getSolPrice();
      let priceWasUpdated = false;
      const positions = Object.values(state.positions || {});
      positions.forEach((pos) => {
        let currentPrice = pos.lastPriceUsd || pos.entryPriceUsd;
        if (currentTokenMint && pos.mint === currentTokenMint && Market.price > 0) {
          currentPrice = Market.price;
          const oldPrice = pos.lastPriceUsd || pos.entryPriceUsd;
          if (!pos.lastPriceUsd || Math.abs(oldPrice - Market.price) / oldPrice > 1e-3) {
            pos.lastPriceUsd = Market.price;
            priceWasUpdated = true;
          }
        }
        if (!currentPrice || currentPrice <= 0)
          return;
        const valueUsd = pos.tokenQty * currentPrice;
        const valueSol = valueUsd / solUsd;
        const pnl = valueSol - pos.totalSolSpent;
        totalUnrealized += pnl;
      });
      const now = Date.now();
      if (priceWasUpdated && now - this.lastPriceSave > 5e3) {
        this.lastPriceSave = now;
        Store.save();
      }
      return totalUnrealized;
    }
  };

  // src/modules/core/analytics.js
  var Analytics = {
    analyzeRecentTrades(state) {
      const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
      if (trades.length === 0)
        return null;
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
        if (pnl > 0)
          wins++;
        else if (pnl < 0)
          losses++;
        totalPnlSol += pnl;
        if (trade.entryTs && trade.ts) {
          const hold = trade.ts - trade.entryTs;
          totalHoldTimeMs += hold;
          if (hold < 6e4)
            quickFlips++;
          if (hold > 6e5)
            longHolds++;
        }
        if (trade.marketCap) {
          avgExitMc += trade.marketCap;
          exitMcCount++;
        }
      }
      const avgHoldTimeSec = recentTrades.length > 0 ? totalHoldTimeMs / recentTrades.length / 1e3 : 0;
      const winRate = recentTrades.length > 0 ? wins / recentTrades.length * 100 : 0;
      let style = "balanced";
      if (quickFlips > recentTrades.length * 0.6)
        style = "scalper";
      else if (longHolds > recentTrades.length * 0.4)
        style = "swing";
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
      const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
      const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;
      let penalty = 0;
      let reasons = [];
      if (prevTrade && trade.ts - prevTrade.ts < 6e4) {
        penalty += 10;
        reasons.push("FOMO (Rapid logic)");
      }
      if (!trade.strategy || trade.strategy === "Unknown" || trade.strategy === "Other") {
        penalty += 5;
        reasons.push("No Strategy");
      }
      if (trade.side === "BUY") {
        const currentBal = state.session.balance + trade.solSize;
        if (trade.solSize > currentBal * 0.5) {
          penalty += 20;
          reasons.push("Oversizing (>50%)");
        }
      }
      let score = state.session.disciplineScore !== void 0 ? state.session.disciplineScore : 100;
      score = Math.max(0, score - penalty);
      state.session.disciplineScore = score;
      if (penalty > 0) {
        console.log(`[DISCIPLINE] Score -${penalty} (${reasons.join(", ")})`);
      }
      return { score, penalty, reasons };
    },
    updateStreaks(trade, state) {
      if (trade.side !== "SELL")
        return;
      const pnl = trade.realizedPnlSol || 0;
      if (pnl > 0) {
        state.session.winStreak = (state.session.winStreak || 0) + 1;
        state.session.lossStreak = 0;
        console.log(`[ZER\xD8] Win! +${pnl.toFixed(4)} SOL. Win streak: ${state.session.winStreak}`);
      } else if (pnl < 0) {
        state.session.lossStreak = (state.session.lossStreak || 0) + 1;
        state.session.winStreak = 0;
        console.log(`[ZER\xD8] Loss. ${pnl.toFixed(4)} SOL. Loss streak: ${state.session.lossStreak}`);
      }
    }
  };

  // src/modules/core/order-execution.js
  var OrderExecution = {
    async buy(amountSol, strategy = "Trend", tokenInfo = null) {
      const state = Store.state;
      if (!state.settings.enabled)
        return { success: false, error: "Paper trading disabled" };
      if (amountSol <= 0)
        return { success: false, error: "Invalid amount" };
      if (amountSol > state.session.balance)
        return { success: false, error: "Insufficient funds" };
      const price = Market.price || 1e-6;
      const marketCap = Market.marketCap || 0;
      const solUsd = await PnlCalculator.getSolPrice();
      const usdAmount = amountSol * solUsd;
      const tokenQty = usdAmount / price;
      const symbol = tokenInfo?.symbol || "SOL";
      const mint = tokenInfo?.mint || "So111...";
      console.log(`[Trading] Executing BUY ${amountSol} SOL of ${symbol} (${mint}) @ $${price} (MC: ${marketCap})`);
      state.session.balance -= amountSol;
      const posKey = mint;
      if (!state.positions[posKey]) {
        state.positions[posKey] = {
          tokenQty: 0,
          entryPriceUsd: price,
          lastPriceUsd: price,
          symbol,
          mint,
          entryTs: Date.now(),
          totalSolSpent: 0
        };
      }
      const pos = state.positions[posKey];
      const oldValue = pos.tokenQty * pos.entryPriceUsd;
      const newValue = tokenQty * price;
      const totalQty = pos.tokenQty + tokenQty;
      pos.tokenQty = totalQty;
      pos.entryPriceUsd = totalQty > 0 ? (oldValue + newValue) / totalQty : price;
      pos.lastPriceUsd = price;
      pos.totalSolSpent += amountSol;
      const tradeId = `trade_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
      const trade = {
        id: tradeId,
        ts: Date.now(),
        side: "BUY",
        symbol,
        mint,
        solAmount: amountSol,
        tokenQty,
        priceUsd: price,
        marketCap,
        strategy: strategy || "Unknown",
        mode: state.settings.tradingMode || "paper"
      };
      if (!state.trades)
        state.trades = {};
      state.trades[tradeId] = trade;
      if (!state.session.trades)
        state.session.trades = [];
      state.session.trades.push(tradeId);
      Analytics.calculateDiscipline(trade, state);
      window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");
      await Store.save();
      return { success: true, trade, position: pos };
    },
    async sell(pct = 100, strategy = "Trend", tokenInfo = null) {
      const state = Store.state;
      const currentPrice = Market.price || 0;
      if (currentPrice <= 0)
        return { success: false, error: "No price data" };
      const symbol = tokenInfo?.symbol || "SOL";
      const mint = tokenInfo?.mint || "So111...";
      const posKey = mint;
      console.log(`[Trading] Executing SELL ${pct}% of ${symbol} (${mint}) @ $${currentPrice}`);
      const position = state.positions[posKey];
      if (!position || position.tokenQty <= 0)
        return { success: false, error: "No position" };
      const qtyToSell = position.tokenQty * (pct / 100);
      if (qtyToSell <= 0)
        return { success: false, error: "Invalid qty" };
      const solUsd = await PnlCalculator.getSolPrice();
      const proceedsUsd = qtyToSell * currentPrice;
      const solReceived = proceedsUsd / solUsd;
      const solSpentPortion = position.totalSolSpent * (qtyToSell / position.tokenQty);
      const realizedPnlSol = solReceived - solSpentPortion;
      position.tokenQty -= qtyToSell;
      position.totalSolSpent = Math.max(0, position.totalSolSpent - solSpentPortion);
      state.session.balance += solReceived;
      state.session.realized += realizedPnlSol;
      if (position.tokenQty < 1e-6)
        delete state.positions[posKey];
      const tradeId = `trade_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
      const trade = {
        id: tradeId,
        ts: Date.now(),
        side: "SELL",
        symbol,
        mint,
        pct,
        solAmount: solReceived,
        tokenQty: qtyToSell,
        priceUsd: currentPrice,
        marketCap: Market.marketCap || 0,
        realizedPnlSol,
        strategy: strategy || "Unknown",
        mode: state.settings.tradingMode || "paper"
      };
      if (!state.trades)
        state.trades = {};
      state.trades[tradeId] = trade;
      if (!state.session.trades)
        state.session.trades = [];
      state.session.trades.push(tradeId);
      Analytics.calculateDiscipline(trade, state);
      Analytics.updateStreaks(trade, state);
      window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");
      await Store.save();
      return { success: true, trade };
    },
    async tagTrade(tradeId, updates) {
      const state = Store.state;
      if (!state.trades || !state.trades[tradeId])
        return false;
      Object.assign(state.trades[tradeId], updates);
      await Store.save();
      return true;
    }
  };

  // src/modules/core/trading.js
  var Trading = {
    // PnL Calculator methods
    getSolPrice: () => PnlCalculator.getSolPrice(),
    fmtSol: (n) => PnlCalculator.fmtSol(n),
    getUnrealizedPnl: (state, currentTokenMint) => PnlCalculator.getUnrealizedPnl(state, currentTokenMint),
    // Analytics methods
    analyzeRecentTrades: (state) => Analytics.analyzeRecentTrades(state),
    calculateDiscipline: (trade, state) => Analytics.calculateDiscipline(trade, state),
    updateStreaks: (trade, state) => Analytics.updateStreaks(trade, state),
    // Order Execution methods
    buy: (amountSol, strategy, tokenInfo) => OrderExecution.buy(amountSol, strategy, tokenInfo),
    sell: (pct, strategy, tokenInfo) => OrderExecution.sell(pct, strategy, tokenInfo),
    tagTrade: (tradeId, updates) => OrderExecution.tagTrade(tradeId, updates)
  };

  // src/modules/ui/token-detector.js
  var TokenDetector = {
    getCurrentToken() {
      let symbol = "SOL";
      let mint = "So11111111111111111111111111111111111111112";
      try {
        const url = window.location.href;
        const mintMatch = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
        if (mintMatch) {
          const candidate = mintMatch[mintMatch.length - 1];
          if (candidate && candidate.length > 30) {
            mint = candidate;
          }
        }
        const title = document.title;
        const titleParts = title.trim().split(/[\s|/]+/);
        if (titleParts.length > 0) {
          let first = titleParts[0].toUpperCase();
          const generics = ["PADRE", "TERMINAL", "AXIOM", "SOLANA", "TRADE", "DEX", "CHART"];
          if (!generics.includes(first) && first.length < 15 && first.length > 1) {
            symbol = first;
          }
        }
        if (symbol === "SOL" || symbol === "TERMINAL" || symbol.includes("SEARCH")) {
          const tickerSpans = document.querySelectorAll('span[class*="css-1oo1vsz"]');
          for (const s of tickerSpans) {
            const txt = s.textContent.trim().toUpperCase();
            const bad = ["PADRE", "TERMINAL", "AXIOM", "SOLANA", "TRADE", "DEX", "CHART", "SEARCH BY NAME OR CA..."];
            if (txt && !bad.includes(txt) && txt.length < 15 && txt.length > 1) {
              symbol = txt;
              break;
            }
          }
          if (symbol === "SOL" || symbol.includes("SEARCH")) {
            const spans = document.querySelectorAll("span, div");
            for (const s of spans) {
              const t = s.textContent.trim();
              if (t.includes("/") && t.includes("SOL") && t.length < 20) {
                const potential = t.split("/")[0].trim().toUpperCase();
                if (potential.length > 1 && potential.length < 10) {
                  symbol = potential;
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[TokenDetector] Token scrape failed", e);
      }
      return { symbol, mint };
    }
  };

  // src/modules/ui/pnl-hud.js
  function px(n) {
    return n + "px";
  }
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  var PnlHud = {
    mountPnlHud(makeDraggable) {
      const container = OverlayManager.getContainer();
      const rootId = IDS.pnlHud;
      let root = container.querySelector("#" + rootId);
      if (!Store.state.settings.enabled) {
        if (root)
          root.style.display = "none";
        return;
      }
      if (root)
        root.style.display = "";
      let isNew = false;
      if (!root) {
        isNew = true;
        root = document.createElement("div");
        root.id = rootId;
        root.className = Store.state.settings.pnlDocked ? "docked" : "floating";
        if (!Store.state.settings.pnlDocked) {
          root.style.left = px(Store.state.settings.pnlPos.x);
          root.style.top = px(Store.state.settings.pnlPos.y);
        }
        container.appendChild(root);
        this.bindPnlEvents(root);
      }
      const CURRENT_UI_VERSION = "1.8.0";
      const renderedVersion = root.dataset.uiVersion;
      if (isNew || renderedVersion !== CURRENT_UI_VERSION) {
        this.renderPnlHudContent(root, makeDraggable);
        root.dataset.uiVersion = CURRENT_UI_VERSION;
      }
    },
    renderPnlHudContent(root, makeDraggable) {
      root.innerHTML = `
            <div class="card">
              <div class="header">
                <div class="title"><span class="dot"></span> ZER\xD8 PNL <span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);">TOKEN</span></div>
                <div class="controls">
                  <div class="startSol">
                    <span style="font-weight:700;color:rgba(203,213,225,0.92);">Start SOL</span>
                    <input class="startSolInput" type="text" inputmode="decimal" />
                  </div>
                  <button class="pillBtn" data-act="trades">Trades</button>
                  <button class="pillBtn" data-act="reset" style="color:#ef4444;">Reset</button>
                  <button class="pillBtn" data-act="settings" style="padding:6px 8px;">\u2699</button>
                  <button class="pillBtn" data-act="dock">Dock</button>
                </div>
              </div>
              <div class="stats">
                <div class="stat" style="cursor:pointer;" data-act="toggleTokenUnit">
                    <div class="k">UNREALIZED P&L <span data-k="tokenUnit" style="opacity:0.6;font-size:9px;">SOL</span></div>
                    <div class="v" data-k="tokenValue">0.0000</div>
                </div>
                <div class="stat">
                    <div class="k">BALANCE</div>
                    <div class="v" data-k="balance">0.0000 SOL</div>
                </div>
                <div class="stat" style="cursor:pointer;" data-act="toggleSessionUnit">
                    <div class="k">SESSION P&L <span data-k="pnlUnit" style="opacity:0.6;font-size:9px;">SOL</span></div>
                    <div class="v" data-k="pnl" style="color:#10b981;">+0.0000 SOL</div>
                </div>
                <div class="stat streak">
                    <div class="k">WIN STREAK</div>
                    <div class="v" data-k="streak">0</div>
                </div>
                <div class="stat discipline">
                    <div class="k">DISCIPLINE</div>
                    <div class="v" data-k="discipline">100</div>
                </div>
              </div>
              <div class="tradeList" style="display:none;"></div>
            </div>
         `;
      this.bindPnlDrag(root, makeDraggable);
      const inp = root.querySelector(".startSolInput");
      if (inp) {
        inp.addEventListener("change", async () => {
          const v = parseFloat(inp.value);
          if (v > 0) {
            if ((Store.state.session.trades || []).length === 0) {
              Store.state.session.balance = v;
              Store.state.session.equity = v;
            }
            Store.state.settings.startSol = v;
            await Store.save();
            this.updatePnlHud();
          }
        });
      }
    },
    bindPnlDrag(root, makeDraggable) {
      const header = root.querySelector(".header");
      if (!header || !makeDraggable)
        return;
      makeDraggable(header, (dx, dy) => {
        if (Store.state.settings.pnlDocked)
          return;
        const s = Store.state.settings;
        s.pnlPos.x = clamp(s.pnlPos.x + dx, 0, window.innerWidth - 40);
        s.pnlPos.y = clamp(s.pnlPos.y + dy, 34, window.innerHeight - 40);
        root.style.left = px(s.pnlPos.x);
        root.style.top = px(s.pnlPos.y);
      }, async () => {
        if (!Store.state.settings.pnlDocked)
          await Store.save();
      });
    },
    bindPnlEvents(root) {
      root.addEventListener("click", async (e) => {
        const t = e.target;
        if (t.matches("input, label"))
          return;
        const actEl = t.closest("[data-act]");
        if (!actEl)
          return;
        const act = actEl.getAttribute("data-act");
        e.preventDefault();
        e.stopPropagation();
        if (act === "dock") {
          Store.state.settings.pnlDocked = !Store.state.settings.pnlDocked;
          await Store.save();
          this.updatePnlHud();
        }
        if (act === "reset") {
          this.showResetModal();
        }
        if (act === "trades") {
          const list = root.querySelector(".tradeList");
          if (list) {
            list.style.display = list.style.display === "none" ? "block" : "none";
            this.updateTradeList(list);
          }
        }
        if (act === "toggleTokenUnit") {
          Store.state.settings.tokenDisplayUsd = !Store.state.settings.tokenDisplayUsd;
          await Store.save();
          this.updatePnlHud();
        }
        if (act === "toggleSessionUnit") {
          Store.state.settings.sessionDisplayUsd = !Store.state.settings.sessionDisplayUsd;
          await Store.save();
          this.updatePnlHud();
        }
        if (act === "settings") {
          this.showSettingsModal();
        }
      });
    },
    async updatePnlHud() {
      const root = OverlayManager.getContainer().querySelector("#" + IDS.pnlHud);
      if (!root || !Store.state)
        return;
      root.className = Store.state.settings.pnlDocked ? "docked" : "floating";
      if (!Store.state.settings.pnlDocked) {
        root.style.left = px(Store.state.settings.pnlPos.x);
        root.style.top = px(Store.state.settings.pnlPos.y);
        root.style.transform = "none";
      } else {
        root.style.left = "";
        root.style.top = "";
      }
      const s = Store.state;
      const currentToken = TokenDetector.getCurrentToken();
      const unrealized = await Trading.getUnrealizedPnl(s, currentToken.mint);
      const inp = root.querySelector(".startSolInput");
      if (document.activeElement !== inp)
        inp.value = s.settings.startSol;
      root.querySelector('[data-k="balance"]').textContent = `${Trading.fmtSol(s.session.balance)} SOL`;
      const tokenValueEl = root.querySelector('[data-k="tokenValue"]');
      if (tokenValueEl) {
        tokenValueEl.textContent = (unrealized >= 0 ? "+" : "") + Trading.fmtSol(unrealized);
        tokenValueEl.style.color = unrealized >= 0 ? "#10b981" : "#ef4444";
      }
      const realized = s.session.realized || 0;
      const totalPnl = realized + unrealized;
      const pnlEl = root.querySelector('[data-k="pnl"]');
      pnlEl.textContent = (totalPnl >= 0 ? "+" : "") + Trading.fmtSol(totalPnl) + " SOL";
      pnlEl.style.color = totalPnl >= 0 ? "#10b981" : "#ef4444";
      const streakEl = root.querySelector('[data-k="streak"]');
      const winStreak = s.session.winStreak || 0;
      const lossStreak = s.session.lossStreak || 0;
      if (lossStreak > 0) {
        streakEl.textContent = "-" + lossStreak;
        streakEl.parentElement.className = "stat streak loss";
      } else {
        streakEl.textContent = winStreak;
        streakEl.parentElement.className = winStreak > 0 ? "stat streak win" : "stat streak";
      }
      const discEl = root.querySelector('[data-k="discipline"]');
      if (discEl) {
        const score = s.session.disciplineScore !== void 0 ? s.session.disciplineScore : 100;
        discEl.textContent = score;
        let color = "#94a3b8";
        if (score >= 90)
          color = "#10b981";
        else if (score < 70)
          color = "#ef4444";
        else if (score < 90)
          color = "#f59e0b";
        discEl.style.color = color;
      }
    },
    showResetModal() {
      const overlay = document.createElement("div");
      overlay.className = "confirm-modal-overlay";
      overlay.innerHTML = `
            <div class="confirm-modal">
                <h3>Reset Session?</h3>
                <p>Clear all history and restore balance?</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">Reset</button>
                </div>
            </div>
        `;
      OverlayManager.getContainer().appendChild(overlay);
      overlay.querySelector(".cancel").onclick = () => overlay.remove();
      overlay.querySelector(".confirm").onclick = async () => {
        Store.state.session.balance = Store.state.settings.startSol;
        Store.state.session.realized = 0;
        Store.state.session.winStreak = 0;
        Store.state.session.lossStreak = 0;
        Store.state.session.trades = [];
        Store.state.trades = {};
        Store.state.positions = {};
        await Store.save();
        if (window.ZeroHUD && window.ZeroHUD.updateAll) {
          window.ZeroHUD.updateAll();
        }
        overlay.remove();
      };
    },
    showSettingsModal() {
      const overlay = document.createElement("div");
      overlay.className = "confirm-modal-overlay";
      const isShadow = Store.state.settings.tradingMode === "shadow";
      overlay.innerHTML = `
            <div class="settings-modal">
                <div class="settings-header">
                    <div class="settings-title">
                        <span>\u2699\uFE0F</span> Settings
                    </div>
                    <button class="settings-close">\xD7</button>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">Shadow Real Mode</div>
                        <div class="setting-desc">Tag trades as "Real" for journaling. Changes UI theme.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="toggle-shadow" ${isShadow ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="setting-row" style="opacity:0.5; pointer-events:none;">
                    <div class="setting-info">
                        <div class="setting-name">Discipline Score</div>
                        <div class="setting-desc">Track rule adherence (Coming Soon).</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox">
                        <span class="slider"></span>
                    </label>
                </div>

                <div style="margin-top:20px; text-align:center; font-size:11px; color:#64748b;">
                    ZER\xD8 v${Store.state.version || "0.9.9"}
                </div>
            </div>
        `;
      OverlayManager.getContainer().appendChild(overlay);
      const close = () => {
        overlay.remove();
        if (window.ZeroHUD && window.ZeroHUD.updateAll) {
          window.ZeroHUD.updateAll();
        }
      };
      overlay.querySelector(".settings-close").onclick = close;
      const bg = overlay;
      bg.addEventListener("click", (e) => {
        if (e.target === bg)
          close();
      });
      const shadowToggle = overlay.querySelector("#toggle-shadow");
      shadowToggle.onchange = async (e) => {
        const val = e.target.checked;
        Store.state.settings.tradingMode = val ? "shadow" : "paper";
        await Store.save();
        const container = OverlayManager.getContainer();
        if (val)
          container.classList.add("zero-shadow-mode");
        else
          container.classList.remove("zero-shadow-mode");
      };
    },
    updateTradeList(container) {
      const trades = Store.state.session.trades || [];
      const tradeObjs = trades.map((id) => Store.state.trades[id]).filter((t) => t).reverse();
      let html = "";
      tradeObjs.forEach((t) => {
        const isBuy = t.side === "BUY";
        let valStr = "";
        let pnlClass = "muted";
        if (isBuy) {
          valStr = `${t.solAmount?.toFixed(3) || "0.1"} SOL`;
        } else {
          const isWin = (t.realizedPnlSol || 0) > 0;
          pnlClass = isWin ? "buy" : t.realizedPnlSol < 0 ? "sell" : "muted";
          valStr = (t.realizedPnlSol ? (t.realizedPnlSol > 0 ? "+" : "") + t.realizedPnlSol.toFixed(4) : "0.00") + " SOL";
        }
        html += `
                <div class="tradeRow">
                    <div class="muted" style="font-size:9px;">${new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    <div class="tag ${t.side.toLowerCase()}">${t.side}</div>
                    <div style="flex:1;">${t.symbol}</div>
                    <div class="${pnlClass}">${valStr}</div>
                </div>
            `;
      });
      container.innerHTML = html || '<div style="padding:10px;color:#64748b;text-align:center;">No trades yet</div>';
    }
  };

  // src/modules/ui/buy-hud.js
  function px2(n) {
    return n + "px";
  }
  function clamp2(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  var BuyHud = {
    // UI State
    buyHudTab: "buy",
    buyHudEdit: false,
    mountBuyHud(makeDraggable) {
      const container = OverlayManager.getContainer();
      const rootId = IDS.buyHud;
      let root = container.querySelector("#" + rootId);
      if (!Store.state.settings.enabled) {
        if (root)
          root.style.display = "none";
        return;
      }
      if (root)
        root.style.display = "";
      if (!root) {
        root = document.createElement("div");
        root.id = rootId;
        root.className = Store.state.settings.buyHudDocked ? "docked" : "floating";
        if (!Store.state.settings.buyHudDocked) {
          const safeX = window.innerWidth - 340;
          root.style.left = px2(safeX > 0 ? safeX : 20);
          root.style.top = "100px";
          root.style.right = "auto";
        }
        container.appendChild(root);
        this.renderBuyHudContent(root, makeDraggable);
        this.setupBuyHudInteractions(root);
      }
      this.renderBuyHudContent(root, makeDraggable);
    },
    renderBuyHudContent(root, makeDraggable) {
      const isBuy = this.buyHudTab === "buy";
      const actionText = isBuy ? "ZER\xD8 BUY" : "ZER\xD8 SELL";
      const actionClass = isBuy ? "action" : "action sell";
      const label = isBuy ? "Amount (SOL)" : "Amount (%)";
      root.innerHTML = `
            <div class="panel">
                <div class="panelHeader">
                    <div class="panelTitle"><span class="dot"></span> ZER\xD8 TRADE</div>
                    <div class="panelBtns">
                        <button class="btn" data-act="edit">${this.buyHudEdit ? "Done" : "Edit"}</button>
                        <button class="btn" data-act="dock">${Store.state.settings.buyHudDocked ? "Float" : "Dock"}</button>
                    </div>
                </div>
                <div class="tabs">
                    <div class="tab ${isBuy ? "active" : ""}" data-act="tab-buy">Buy</div>
                    <div class="tab ${!isBuy ? "active" : ""}" data-act="tab-sell">Sell</div>
                </div>
                <div class="body">
                    <div class="fieldLabel">${label}</div>
                    <input class="field" type="text" inputmode="decimal" data-k="field" placeholder="0.0">

                    <div class="quickRow">
                        ${this.renderQuickButtons(isBuy)}
                    </div>

                    ${isBuy ? `
                    <div class="strategyRow">
                         <div class="fieldLabel">Context / Strategy</div>
                         <select class="strategySelect" data-k="strategy">
                            ${(Store.state.settings.strategies || ["Trend"]).map((s) => `<option value="${s}">${s}</option>`).join("")}
                         </select>
                    </div>
                    ` : ""}

                    <button class="${actionClass}" data-act="action">${actionText}</button>
                    <div class="status" data-k="status">Ready to trade</div>
                </div>
            </div>
        `;
      this.bindHeaderDrag(root, makeDraggable);
    },
    renderQuickButtons(isBuy) {
      const values = isBuy ? Store.state.settings.quickBuySols : Store.state.settings.quickSellPcts;
      return values.map((v) => `
            <button class="qbtn" data-act="quick" data-val="${v}">${v}${isBuy ? " SOL" : "%"}</button>
        `).join("");
    },
    bindHeaderDrag(root, makeDraggable) {
      const header = root.querySelector(".panelHeader");
      if (!header || !makeDraggable)
        return;
      makeDraggable(header, (dx, dy) => {
        if (Store.state.settings.buyHudDocked)
          return;
        const s = Store.state.settings;
        if (!s.buyHudPos) {
          const rect = root.getBoundingClientRect();
          s.buyHudPos = { x: rect.left, y: rect.top };
        }
        s.buyHudPos.x = clamp2(s.buyHudPos.x + dx, 0, window.innerWidth - 300);
        s.buyHudPos.y = clamp2(s.buyHudPos.y + dy, 34, window.innerHeight - 300);
        root.style.setProperty("left", px2(s.buyHudPos.x), "important");
        root.style.setProperty("top", px2(s.buyHudPos.y), "important");
        root.style.setProperty("right", "auto", "important");
      }, async () => {
        if (!Store.state.settings.buyHudDocked)
          await Store.save();
      });
    },
    setupBuyHudInteractions(root) {
      root.addEventListener("click", async (e) => {
        const t = e.target;
        if (t.matches("input") || t.matches("select"))
          return;
        const actEl = t.closest("[data-act]");
        if (!actEl)
          return;
        const act = actEl.getAttribute("data-act");
        e.preventDefault();
        if (act === "dock") {
          Store.state.settings.buyHudDocked = !Store.state.settings.buyHudDocked;
          await Store.save();
          this.updateBuyHud();
        }
        if (act === "tab-buy") {
          this.buyHudTab = "buy";
          this.mountBuyHud();
        }
        if (act === "tab-sell") {
          this.buyHudTab = "sell";
          this.mountBuyHud();
        }
        if (act === "quick") {
          const val = actEl.getAttribute("data-val");
          const field = root.querySelector('input[data-k="field"]');
          if (field)
            field.value = val;
        }
        if (act === "action") {
          const field = root.querySelector('input[data-k="field"]');
          const val = parseFloat(field?.value || "0");
          const status = root.querySelector('[data-k="status"]');
          const strategyEl = root.querySelector('select[data-k="strategy"]');
          const strategy = strategyEl ? strategyEl.value : "Trend";
          if (val <= 0) {
            if (status)
              status.textContent = "Invalid amount";
            return;
          }
          status.textContent = "Executing...";
          const tokenInfo = TokenDetector.getCurrentToken();
          let res;
          try {
            if (this.buyHudTab === "buy") {
              res = await Trading.buy(val, strategy, tokenInfo);
            } else {
              res = await Trading.sell(val, strategy, tokenInfo);
            }
          } catch (err) {
            status.textContent = "Error: " + err.message;
            status.style.color = "#ef4444";
            return;
          }
          if (res && res.success) {
            status.textContent = "Trade executed!";
            field.value = "";
            if (window.ZeroHUD && window.ZeroHUD.updateAll) {
              window.ZeroHUD.updateAll();
            }
            setTimeout(() => {
              this.showEmotionSelector(res.trade.id);
            }, 500);
          } else {
            status.textContent = res.error || "Error executing trade";
            status.style.color = "#ef4444";
          }
        }
        if (act === "edit") {
          this.buyHudEdit = !this.buyHudEdit;
          this.mountBuyHud();
        }
      });
    },
    showEmotionSelector(tradeId) {
      if (Store.state.settings.showJournal === false)
        return;
      const container = OverlayManager.getContainer();
      const existing = container.querySelector(".emotion-modal-overlay");
      if (existing)
        existing.remove();
      const overlay = document.createElement("div");
      overlay.className = "emotion-modal-overlay";
      overlay.style.position = "fixed";
      overlay.style.zIndex = "2147483647";
      overlay.style.background = "transparent";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.pointerEvents = "none";
      overlay.style.display = "flex";
      overlay.style.flexDirection = "column";
      overlay.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const emotions = [
        { id: "calm", label: "Calm", icon: "\u{1F60C}" },
        { id: "anxious", label: "Anxious", icon: "\u{1F628}" },
        { id: "excited", label: "Excited", icon: "\u{1F929}" },
        { id: "angry", label: "Angry/Rev", icon: "\u{1F621}" },
        { id: "bored", label: "Bored", icon: "\u{1F971}" },
        { id: "confident", label: "Confident", icon: "\u{1F60E}" }
      ];
      overlay.innerHTML = `
            <div class="emotion-modal" style="position:absolute; pointer-events:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(20,184,166,0.2); width:320px;">
                <div class="emotion-title">TRADE EXECUTED</div>
                <div class="emotion-subtitle">How are you feeling right now?</div>
                <div class="emotion-grid">
                    ${emotions.map((e) => `
                        <button class="emotion-btn" data-emo="${e.id}">
                            <span>${e.icon}</span> ${e.label}
                        </button>
                    `).join("")}
                </div>
                <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; gap:10px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                     <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#64748b; cursor:pointer;">
                        <input type="checkbox" class="journal-opt-out"> Don't show again
                    </label>
                    <button class="emotion-skip" style="font-size:11px; padding:4px 8px; background:transparent; border:none; color:#94a3b8; cursor:pointer;">Skip</button>
                </div>
            </div>
        `;
      const buyHud = container.querySelector("#" + IDS.buyHud);
      const modal = overlay.querySelector(".emotion-modal");
      if (buyHud) {
        const rect = buyHud.getBoundingClientRect();
        modal.style.top = rect.bottom + 12 + "px";
        modal.style.left = rect.left + "px";
      } else {
        modal.style.top = "100px";
        modal.style.left = "50%";
        modal.style.transform = "translateX(-50%)";
      }
      container.appendChild(overlay);
      const close = async () => {
        if (overlay.querySelector(".journal-opt-out").checked) {
          Store.state.settings.showJournal = false;
          await Store.save();
        }
        overlay.remove();
      };
      overlay.querySelectorAll(".emotion-btn").forEach((btn) => {
        btn.onclick = async () => {
          const emo = btn.getAttribute("data-emo");
          await Trading.tagTrade(tradeId, { emotion: emo });
          close();
        };
      });
      overlay.querySelector(".emotion-skip").onclick = close;
    },
    updateBuyHud() {
      const root = OverlayManager.getContainer().querySelector("#" + IDS.buyHud);
      if (!root || !Store.state)
        return;
      root.className = Store.state.settings.buyHudDocked ? "docked" : "floating";
      if (!Store.state.settings.buyHudDocked) {
        const p = Store.state.settings.buyHudPos;
        if (p) {
          const maxX = window.innerWidth - 300;
          const safeX = clamp2(p.x, 0, maxX > 0 ? maxX : 0);
          root.style.setProperty("left", px2(safeX), "important");
          root.style.setProperty("top", px2(p.y), "important");
          root.style.setProperty("right", "auto", "important");
        } else {
          const safeX = window.innerWidth - 340;
          root.style.setProperty("left", px2(safeX > 0 ? safeX : 20), "important");
          root.style.setProperty("top", "100px", "important");
          root.style.setProperty("right", "auto", "important");
        }
      } else {
        root.style.left = "";
        root.style.top = "";
        root.style.right = "";
      }
    }
  };

  // src/modules/ui/hud.js
  var HUD = {
    renderScheduled: false,
    lastRenderAt: 0,
    async init() {
      window.ZeroHUD = this;
      this.renderAll();
      window.addEventListener("resize", () => this.scheduleRender());
      if (Store.state.trades) {
        const trades = Object.values(Store.state.trades);
        setTimeout(() => {
          window.postMessage({ __paper: true, type: "PAPER_DRAW_ALL", trades }, "*");
        }, 2e3);
      }
      Market.subscribe(async () => {
        await PnlHud.updatePnlHud();
      });
    },
    scheduleRender() {
      if (this.renderScheduled)
        return;
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        this.renderAll();
        this.renderScheduled = false;
        this.lastRenderAt = Date.now();
      });
    },
    renderAll() {
      if (!Store.state)
        return;
      Banner.mountBanner();
      PnlHud.mountPnlHud(this.makeDraggable.bind(this));
      BuyHud.mountBuyHud(this.makeDraggable.bind(this));
      this.updateAll();
    },
    async updateAll() {
      if (Store.state && Store.state.settings) {
        const container = OverlayManager.getContainer();
        if (Store.state.settings.tradingMode === "shadow") {
          container.classList.add("zero-shadow-mode");
        } else {
          container.classList.remove("zero-shadow-mode");
        }
      }
      Banner.updateBanner();
      await PnlHud.updatePnlHud();
      BuyHud.updateBuyHud();
    },
    // Shared utility for making elements draggable
    makeDraggable(handle, onMove, onStop) {
      if (!handle)
        return;
      let dragging = false;
      let startX = 0, startY = 0;
      const down = (e) => {
        if (e.button !== 0)
          return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      };
      const move = (e) => {
        if (!dragging)
          return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;
        onMove(dx, dy);
        e.preventDefault();
      };
      const up = () => {
        dragging = false;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        if (onStop)
          onStop();
      };
      handle.addEventListener("mousedown", down);
    }
  };

  // src/content.boot.js
  (async () => {
    "use strict";
    console.log("%c ZER\xD8 v1.7.1 (Final Polish: Marker Stack Fix)", "color: #ef4444; font-weight: bold; font-size: 14px;");
    const PLATFORM = {
      isAxiom: window.location.hostname.includes("axiom.trade"),
      isPadre: window.location.hostname.includes("padre.gg"),
      name: window.location.hostname.includes("axiom.trade") ? "Axiom" : "Padre"
    };
    try {
      console.log("[ZER\xD8] Loading Store...");
      const state = await Store.load();
      if (!state)
        throw new Error("Store state is null");
      if (!state.settings.enabled) {
        console.log("[ZER\xD8] Force-enabling for Beta test...");
        state.settings.enabled = true;
        await Store.save();
      }
      console.log("[ZER\xD8] Store loaded:", state.settings?.enabled ? "Enabled" : "Disabled");
    } catch (e) {
      console.error("[ZER\xD8] Store Load Failed:", e);
    }
    try {
      console.log("[ZER\xD8] Init Overlay...");
      OverlayManager.init(PLATFORM.name);
    } catch (e) {
      console.error("[ZER\xD8] Overlay Init Failed:", e);
    }
    try {
      console.log("[ZER\xD8] Init Market...");
      Market.init();
    } catch (e) {
      console.error("[ZER\xD8] Market Init Failed:", e);
    }
    try {
      console.log("[ZER\xD8] Init HUD...");
      await HUD.init();
    } catch (e) {
      console.error("[ZER\xD8] HUD Init Failed:", e);
    }
    console.log("[ZER\xD8] Boot sequence finished.");
  })();
})();
