(() => {
  // src/content.source.js
  (() => {
    "use strict";
    const PLATFORM = {
      isAxiom: window.location.hostname.includes("axiom.trade"),
      isPadre: window.location.hostname.includes("padre.gg"),
      name: window.location.hostname.includes("axiom.trade") ? "Axiom" : "Padre"
    };
    let hasInitialized = false;
    function isOnTradePage() {
      return window.location.pathname.includes("/trade/");
    }
    const EXT = {
      KEY: "sol_paper_trader_v1",
      VERSION: "0.1.0",
      DEBUG: true,
      // Enable for debugging P&L issues
      PLATFORM: PLATFORM.name
    };
    const log = (...m) => EXT.DEBUG && console.log("%cpaper:Padre v51-Brand", "color: #ff0; font-weight: bold", ...m);
    const DEFAULTS = {
      enabled: true,
      buyHudDocked: true,
      pnlDocked: true,
      buyHudPos: { x: 20, y: 120 },
      pnlPos: { x: 20, y: 60 },
      startSol: 10,
      quickBuySols: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
      quickSellPcts: [10, 25, 50, 75, 100],
      cashSol: 10,
      equitySol: 10,
      realizedSol: 0,
      positions: {},
      trades: [],
      winStreak: 0,
      lossStreak: 0,
      // Track consecutive losses for Professor triggers
      lastPortfolioMultiplier: 1,
      // Track achieved portfolio multipliers (2x, 3x, etc)
      tokenDisplayUsd: false,
      // Toggle for Unrealized P&L display
      sessionDisplayUsd: false,
      // Toggle for Session P&L display
      // Bad habit tracking state
      lastBuyTs: 0,
      // Timestamp of last buy (for revenge trade detection)
      lastSellTs: 0,
      // Timestamp of last sell
      lastSellPnl: 0,
      // P&L of last sell (for revenge trade detection)
      recentBuyTimestamps: [],
      // Array of recent buy timestamps (for FOMO detection)
      sessionTradeCount: 0,
      // Count of trades this session (for overtrading)
      sessionStartTs: 0
      // When this trading session started
    };
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    function nowLocalTimeString(ts) {
      try {
        return new Date(ts).toLocaleTimeString([], { hour12: false });
      } catch {
        return "";
      }
    }
    function safeParseFloat(v) {
      const n = Number.parseFloat(String(v).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    }
    function safeParseInt(v) {
      const n = Number.parseInt(String(v).trim(), 10);
      return Number.isFinite(n) ? n : 0;
    }
    function fmtSol(n) {
      if (!Number.isFinite(n))
        return "0.0000";
      return n.toFixed(4);
    }
    function isChromeStorageAvailable() {
      try {
        return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
      } catch {
        return false;
      }
    }
    function storageGet(key) {
      return new Promise((resolve) => {
        if (!isChromeStorageAvailable())
          return resolve(void 0);
        chrome.storage.local.get([key], (res) => resolve(res[key]));
      });
    }
    function storageSet(obj) {
      return new Promise((resolve) => {
        if (!isChromeStorageAvailable())
          return resolve();
        chrome.storage.local.set(obj, () => resolve());
      });
    }
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
    const IDS = {
      banner: "paper-mode-banner",
      pnlHud: "paper-pnl-hud",
      buyHud: "paper-buyhud-root",
      style: "paper-overlay-style"
    };
    const CSS = `
.zero-inline-icon { height:14px; width:14px; vertical-align:-2px; margin:0 1px; display:inline-block; }
#${IDS.banner}{
  position:fixed; left:0; right:0; top:0;
  height:44px;
  z-index:2147483646;
  display:flex; align-items:center; justify-content:center;
  user-select:none;
  pointer-events:auto;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.15);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${IDS.banner} .inner{ display:flex; align-items:center; gap:24px; font-size:12px; letter-spacing:0.3px; }
#${IDS.banner} .dot{ width:8px;height:8px;border-radius:999px; background: #14b8a6; box-shadow: 0 0 8px rgba(20,184,166,0.5); }
#${IDS.banner}.disabled .dot{ background: #475569; box-shadow: none; }
#${IDS.banner} .label{ color: #14b8a6; font-weight:700; text-transform: uppercase; letter-spacing: 1px; }
#${IDS.banner} .state{ color: #f8fafc; font-weight:600; }
#${IDS.banner}.disabled .state{ color: #64748b; }
#${IDS.banner} .hint{ color: #64748b; font-weight:500; }

#${IDS.pnlHud}{
  position: fixed;
  z-index: 2147483645;
  width: 720px;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${IDS.pnlHud}.docked{ left: 50%; transform: translateX(-50%); top: 50px; }
#${IDS.pnlHud}.floating{ left: 20px; top: 60px; transform: none; }
#${IDS.pnlHud} .card{
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}
#${IDS.pnlHud} .header{
  display:flex; align-items:center; justify-content:space-between;
  padding: 14px 20px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}
#${IDS.pnlHud} .header:active{ cursor: grabbing; }
#${IDS.pnlHud} .title{
  display:flex; align-items:center; gap:10px;
  font-size: 13px; font-weight: 700;
  color: #14b8a6;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
#${IDS.pnlHud} .title .dot{ 
  width:10px;height:10px;border-radius:999px; 
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.9)} }
#${IDS.pnlHud} .controls{ display:flex; align-items:center; gap:12px; font-size: 11px; color: #64748b; }
#${IDS.pnlHud} .stat.streak .v { font-size:20px; font-weight:800; color: #14b8a6; }
#${IDS.pnlHud} .stat.streak.loss .v { color:#ef4444; }
#${IDS.pnlHud} .stat.streak.win .v { color:#14b8a6; animation: streakPulse 1s infinite; }
@keyframes streakPulse { 0%{transform:scale(1);} 50%{transform:scale(1.05);} 100%{transform:scale(1);} }
#${IDS.pnlHud} .pillBtn{
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
#${IDS.pnlHud} .pillBtn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}
#${IDS.pnlHud} .startSol{ display:flex; align-items:center; gap:8px; }
#${IDS.pnlHud} input.startSolInput{
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
#${IDS.pnlHud} input.startSolInput:focus{
  border-color: #14b8a6;
}
#${IDS.pnlHud} .stats{ display:flex; gap:0; padding: 0; border-top: 1px solid rgba(20,184,166,0.1); }
#${IDS.pnlHud} .stat{
  flex:1;
  background: transparent;
  border: none;
  border-right: 1px solid rgba(20,184,166,0.1);
  border-radius: 0;
  padding: 16px 20px;
  text-align: left;
  transition: background 0.2s;
}
#${IDS.pnlHud} .stat:last-child{ border-right: none; }
#${IDS.pnlHud} .stat:hover{ background: rgba(20,184,166,0.05); }
#${IDS.pnlHud} .stat .k{ 
  font-size: 10px; 
  color: #64748b; 
  margin-bottom: 4px; 
  font-weight: 600; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
}
#${IDS.pnlHud} .stat .v{ 
  font-size: 16px; 
  font-weight: 700; 
  color: #f8fafc;
}
#${IDS.pnlHud} .tradeList{ max-height: 200px; overflow: auto; border-top: 1px solid rgba(20,184,166,0.1); }
#${IDS.pnlHud} .tradeRow{
  display:grid;
  grid-template-columns: 70px 70px 50px 100px 80px 70px;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(20,184,166,0.05);
  font-size: 11px;
  color: #e2e8f0;
  align-items: center;
}
#${IDS.pnlHud} .tradeRow:hover{ background: rgba(20,184,166,0.03); }
#${IDS.pnlHud} .tradeRow .muted{ color: #64748b; }
#${IDS.pnlHud} .tag{
  display:inline-flex; align-items:center; justify-content:center;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
}
#${IDS.pnlHud} .tag.buy{ 
  background: rgba(20,184,166,0.15);
  color: #14b8a6;
}
#${IDS.pnlHud} .tag.sell{ 
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

/* Custom confirm modal (replaces window.confirm which is blocked in shadow DOM) */
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

#${IDS.buyHud}{ z-index: 2147483644; pointer-events: auto; font-size: 12px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
#${IDS.buyHud}.floating{ position: fixed; right: 18px; top: 100px; width: 300px; max-width: calc(100vw - 24px); }
#${IDS.buyHud}.docked{ position: fixed; right: 16px; top: 320px; width: 300px; z-index: 2147483645; }
#${IDS.buyHud} .panel{
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}
#${IDS.buyHud}.docked .panel{ border-radius: 10px; }
#${IDS.buyHud} .panelHeader{
  display:flex; align-items:center; justify-content:space-between;
  padding: 12px 16px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}
#${IDS.buyHud} .panelHeader:active{ cursor: grabbing; }
#${IDS.buyHud} .panelTitle{ 
  display:flex; align-items:center; gap:10px; 
  font-weight: 700; 
  color: #14b8a6; 
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
#${IDS.buyHud} .panelTitle .dot{ 
  width:10px;height:10px;border-radius:999px; 
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
}
#${IDS.buyHud} .panelBtns{ display:flex; align-items:center; gap:8px; }
#${IDS.buyHud} .btn{
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
#${IDS.buyHud} .btn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}
#${IDS.buyHud} .tabs{ display:flex; gap:8px; padding: 12px 16px 0; }
#${IDS.buyHud} .tab{
  flex:1;
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
#${IDS.buyHud} .tab.active{ 
  background: rgba(20,184,166,0.15); 
  border-color: #14b8a6; 
  color: #14b8a6;
}
#${IDS.buyHud} .tab:hover:not(.active){ 
  background: #1c2128;
  border-color: rgba(20,184,166,0.25);
}
#${IDS.buyHud} .body{ padding: 14px 16px; }
#${IDS.buyHud} .fieldLabel{ 
  color: #64748b; 
  font-weight: 600; 
  margin-bottom: 8px; 
  font-size: 10px; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
}
#${IDS.buyHud} input.field{
  width:100%;
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
#${IDS.buyHud} input.field:focus{ 
  border-color: #14b8a6;
}
#${IDS.buyHud} .quickRow{ display:flex; flex-wrap:wrap; gap:8px; margin-top: 12px; }
#${IDS.buyHud} .qbtn{
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
#${IDS.buyHud} .qbtn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.3);
  color: #14b8a6;
}
#${IDS.buyHud} .action{
  margin-top: 14px;
  width:100%;
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
#${IDS.buyHud} .action:hover{ 
  background: #2dd4bf;
}
#${IDS.buyHud} .action.sell{ 
  background: #ef4444;
  color: white;
}
#${IDS.buyHud} .action.sell:hover{ 
  background: #f87171;
}
#${IDS.buyHud} .status{
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

/* Professor Trade Critique Popup */
.professor-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  animation: professorFadeIn 0.3s ease-out;
  pointer-events: auto;
}
.professor-overlay * {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
@keyframes professorFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.professor-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 500px;
  animation: professorSlideIn 0.4s ease-out;
}
@keyframes professorSlideIn {
  from { transform: translateY(30px) scale(0.9); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
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
    let STATE = deepMerge(DEFAULTS, {});
    let tradePanelDockHost = null;
    let booted = false;
    let observer = null;
    let renderScheduled = false;
    let lastRenderAt = 0;
    let suppressObserver = false;
    let shadowHost = null;
    let shadowRoot = null;
    function getShadowRoot() {
      if (shadowRoot && shadowHost && shadowHost.isConnected) {
        return shadowRoot;
      }
      shadowHost = document.createElement("paper-trader-host");
      shadowHost.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";
      shadowRoot = shadowHost.attachShadow({ mode: "open" });
      const container = document.createElement("div");
      container.id = "paper-shadow-container";
      container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;";
      shadowRoot.appendChild(container);
      document.documentElement.appendChild(shadowHost);
      log("Shadow DOM created for React isolation");
      return shadowRoot;
    }
    function getShadowContainer() {
      const root = getShadowRoot();
      return root.getElementById("paper-shadow-container") || root;
    }
    async function loadState() {
      const saved = await storageGet(EXT.KEY);
      STATE = deepMerge(DEFAULTS, saved || {});
      STATE.startSol = safeParseFloat(STATE.startSol) || DEFAULTS.startSol;
      if (!Number.isFinite(STATE.cashSol))
        STATE.cashSol = STATE.startSol;
      if (!Number.isFinite(STATE.equitySol))
        STATE.equitySol = STATE.cashSol;
    }
    async function saveState() {
      await storageSet({ [EXT.KEY]: STATE });
    }
    function ensureStyle() {
      const root = getShadowRoot();
      if (root.getElementById(IDS.style))
        return;
      const s = document.createElement("style");
      s.id = IDS.style;
      s.textContent = CSS;
      root.appendChild(s);
    }
    function injectPadreHeaderOffset() {
      if (!PLATFORM.isPadre)
        return;
      const styleId = "paper-padre-offset-style";
      if (document.getElementById(styleId))
        return;
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
      /* Push down Padre's fixed/sticky header elements */
      /* Use top specifically for sticky/fixed elements */
      header, nav, [class*="Header"], [class*="Nav"], .MuiAppBar-root, [style*="sticky"], [style*="fixed"], [data-testid="top-bar"] {
        top: 28px !important;
        margin-top: 28px !important;
      }
      /* Specifically target Padre's MuiBox root header if sticky/absolute */
      .MuiBox-root[style*="top: 0"], .MuiBox-root[style*="top:0"] {
        top: 28px !important;
      }
      
      /* Also push down the main content */
      #root, main, [class*="main"], body > div:first-child {
        padding-top: 28px !important;
      }
    `;
      document.head.appendChild(style);
      log("Padre header offset CSS injected");
    }
    function findBestAppFontFamily() {
      try {
        if (document.body) {
          const bf = getComputedStyle(document.body).fontFamily;
          if (bf && bf !== "inherit")
            return bf;
        }
      } catch {
      }
      const rootCandidates = [
        document.querySelector("#root"),
        document.querySelector("[data-testid]"),
        document.querySelector("main"),
        document.querySelector("header")
      ].filter(Boolean);
      for (const el of rootCandidates) {
        try {
          const ff = getComputedStyle(el).fontFamily;
          if (ff && ff !== "inherit")
            return ff;
        } catch {
        }
      }
      try {
        const els = Array.from(document.querySelectorAll("button, input, span, div")).filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 20 && r.height > 10 && r.top >= 0 && r.left >= 0 && r.top < window.innerHeight;
        }).slice(0, 40);
        for (const el of els) {
          const ff = getComputedStyle(el).fontFamily;
          if (ff && ff !== "inherit")
            return ff;
        }
      } catch {
      }
      return "";
    }
    function applyOverlayFontFamily() {
      if (PLATFORM.isPadre)
        return;
      const ff = findBestAppFontFamily();
      if (!ff)
        return;
      const nodes = [
        document.getElementById(IDS.banner),
        document.getElementById(IDS.pnlHud),
        document.getElementById(IDS.buyHud)
      ].filter(Boolean);
      for (const n of nodes)
        n.style.fontFamily = ff;
    }
    function ensureBodyOffsetForBanner() {
      if (!document.body)
        return;
      const h = 28;
      const body = document.body;
      const prev = body.getAttribute("data-paper-prev-padding-top");
      if (!prev) {
        body.setAttribute("data-paper-prev-padding-top", getComputedStyle(body).paddingTop || "0px");
      }
      const cur = safeParseFloat(getComputedStyle(body).paddingTop);
      if (cur < h)
        body.style.paddingTop = `${h}px`;
      if (PLATFORM.isPadre) {
        const padreHeader = document.querySelector("header") || document.querySelector("nav") || document.querySelector('[class*="Header"]') || document.querySelector('[class*="header"]');
        if (padreHeader) {
          const style = getComputedStyle(padreHeader);
          if (style.position === "fixed" || style.position === "sticky") {
            const currentTop = safeParseFloat(style.top);
            if (currentTop < h) {
              padreHeader.style.top = `${h}px`;
            }
          }
        }
        const mainContent = document.querySelector("#root") || document.querySelector('[class*="main"]') || document.querySelector("main");
        if (mainContent) {
          const prevMargin = mainContent.getAttribute("data-paper-prev-margin-top");
          if (!prevMargin) {
            mainContent.setAttribute("data-paper-prev-margin-top", getComputedStyle(mainContent).marginTop || "0px");
          }
          const curMargin = safeParseFloat(getComputedStyle(mainContent).marginTop);
          if (curMargin < h) {
            mainContent.style.marginTop = `${h}px`;
          }
        }
      }
    }
    function mountBanner() {
      const container = getShadowContainer();
      if (getShadowRoot().getElementById(IDS.banner)) {
        updateBanner();
        return;
      }
      const bar = document.createElement("div");
      bar.id = IDS.banner;
      bar.style.pointerEvents = "auto";
      bar.innerHTML = `
      <div class="inner" title="Click to toggle ZER\xD8 mode">
        <div class="dot"></div>
        <div class="label">ZER\xD8 MODE</div>
        <div class="state">ENABLED</div>
        <div class="hint">Click to toggle</div>
      </div>
    `;
      bar.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        STATE.enabled = !STATE.enabled;
        await saveState();
        updateBanner();
        scheduleRender();
      });
      container.appendChild(bar);
      updateBanner();
    }
    function updateBanner() {
      const bar = getShadowRoot().getElementById(IDS.banner);
      if (!bar)
        return;
      const stateEl = bar.querySelector(".state");
      if (stateEl)
        stateEl.textContent = STATE.enabled ? "ENABLED" : "DISABLED";
      bar.classList.toggle("disabled", !STATE.enabled);
    }
    function makeDraggable(handleEl, onMove, onStop) {
      let dragging = false;
      let sx = 0, sy = 0;
      const down = (e) => {
        if (e.button !== void 0 && e.button !== 0)
          return;
        dragging = true;
        sx = e.clientX;
        sy = e.clientY;
        e.preventDefault();
        e.stopPropagation();
        window.addEventListener("mousemove", move, true);
        window.addEventListener("mouseup", up, true);
      };
      const move = (e) => {
        if (!dragging)
          return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        sx = e.clientX;
        sy = e.clientY;
        onMove(dx, dy);
        e.preventDefault();
        e.stopPropagation();
      };
      const up = async (e) => {
        if (!dragging)
          return;
        dragging = false;
        window.removeEventListener("mousemove", move, true);
        window.removeEventListener("mouseup", up, true);
        if (onStop)
          await onStop();
        e.preventDefault();
        e.stopPropagation();
      };
      handleEl.addEventListener("mousedown", down);
    }
    function findTradePanelDockHost() {
      const btns = Array.from(document.querySelectorAll("button")).filter((b) => {
        const t = (b.textContent || "").trim();
        return /^Buy\s+/i.test(t) || /^Sell\s+/i.test(t);
      });
      let best = null;
      let bestScore = 0;
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        if (r.width < 140 || r.height < 28)
          continue;
        const rightBias = r.left > window.innerWidth * 0.55 ? 1 : 0;
        const score = r.width * r.height + rightBias * 1e4;
        if (score > bestScore) {
          bestScore = score;
          best = b;
        }
      }
      if (!best)
        return null;
      let host = best.closest("div");
      for (let i = 0; i < 8 && host; i++) {
        const hasInput = host.querySelector("input") != null;
        const hasManyBtns = host.querySelectorAll("button").length >= 4;
        const rr = host.getBoundingClientRect();
        const okSize = rr.width >= 260 && rr.width <= 520 && rr.height >= 220;
        if (hasInput && hasManyBtns && okSize)
          return host;
        host = host.parentElement;
      }
      return best.parentElement || null;
    }
    function escapeHtml(s) {
      return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }
    function getStableToken() {
      let mint = null;
      let symbol = null;
      try {
        const url = location.href;
        const m = url.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (m)
          mint = m[1];
      } catch {
      }
      try {
        const caNodes = Array.from(document.querySelectorAll("div, span, a")).filter((n) => (n.textContent || "").includes("CA:")).slice(0, 8);
        for (const n of caNodes) {
          const t = (n.textContent || "").trim();
          const mm = t.match(/CA:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
          if (mm) {
            mint = mm[1];
            break;
          }
        }
      } catch {
      }
      try {
        const title = document.title;
        if (title && (title.includes("Padre") || title.includes("Terminal"))) {
          const parts = title.split("|");
          if (parts.length >= 1) {
            let name = parts[0].trim();
            name = name.replace(/\s*[↓↑]\s*\$[\d,.]+[KMB]?\s*$/i, "").trim();
            if (name && name.length > 0 && name.length <= 20) {
              symbol = name;
              log("Symbol from title (cleaned):", symbol);
            }
          }
        }
      } catch {
      }
      if (!symbol) {
        try {
          const h1 = document.querySelector("h1");
          if (h1) {
            const t = (h1.textContent || "").trim();
            const cleanT = t.replace("/SOL", "").replace("Price", "").trim();
            if (cleanT && cleanT.length > 1 && cleanT.length <= 12)
              symbol = cleanT;
          }
        } catch {
        }
      }
      if (!symbol) {
        try {
          const btn = document.querySelector('button[aria-label="Change symbol"]');
          if (btn) {
            const text = (btn.textContent || "").trim();
            if (text) {
              const clean = text.split("/")[0].trim();
              if (clean && clean.length > 0) {
                symbol = clean;
                log("Symbol from button:", symbol);
              }
            }
          }
        } catch {
        }
      }
      if (!symbol)
        symbol = "TOKEN";
      return mint ? { mint, symbol } : { mint: null, symbol };
    }
    function getMarketCap() {
      let mc = null;
      try {
        if (PLATFORM.isPadre) {
          const title = document.title || "";
          const titleMatch = title.match(/\$([[\d,.]+)\s*([KMB])/i);
          if (titleMatch) {
            mc = parseMcString(titleMatch[1], titleMatch[2]);
            log("[getMarketCap] From title:", mc, `(${title})`);
            return mc;
          }
          const mcElements = Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2, h1, span, div")).filter((el) => {
            if (el.closest("paper-trader-host"))
              return false;
            if (el.closest('[id*="paper"]'))
              return false;
            if (el.closest('[class*="paper"]'))
              return false;
            if (el.closest('[class*="ticker"]'))
              return false;
            if (el.closest('[class*="Ticker"]'))
              return false;
            if (el.closest('[class*="trending"]'))
              return false;
            if (el.closest('[class*="Trending"]'))
              return false;
            if (el.closest('[class*="scroll"]'))
              return false;
            if (el.closest('[class*="marquee"]'))
              return false;
            const rect = el.getBoundingClientRect();
            if (rect.height < 12 || rect.width < 30)
              return false;
            if (rect.top < 50)
              return false;
            const text = el.textContent || "";
            return /^\s*\$[\d,.]+[KMB]\s*$/i.test(text) || /\$[\d.]+[KMB]/i.test(text);
          });
          for (const el of mcElements) {
            const text = el.textContent || "";
            const match = text.match(/\$?([\d,.]+)\s*([KMB])/i);
            if (match) {
              mc = parseMcString(match[1], match[2]);
              log("[getMarketCap] From DOM element:", mc, `("${text.trim()}")`);
              return mc;
            }
          }
        } else {
          const bodyText = document.body.innerText;
          const mcMatch = bodyText.match(/\$?([\d,.]+)\s*([KMB])\s+Price/i);
          if (mcMatch) {
            mc = parseMcString(mcMatch[1], mcMatch[2]);
            log("[getMarketCap] From Axiom body:", mc);
            return mc;
          }
        }
      } catch (e) {
        log("MC Error", e);
      }
      log("[getMarketCap] No MC found, returning 0");
      return mc || 0;
    }
    function parseMcString(numStr, unitStr) {
      let num = parseFloat(numStr.replace(/,/g, ""));
      const unit = unitStr.toUpperCase();
      if (unit === "K")
        num *= 1e3;
      if (unit === "M")
        num *= 1e6;
      if (unit === "B")
        num *= 1e9;
      return num;
    }
    function getSolPrice() {
      if (STATE.solPrice && Date.now() - (STATE.solPriceTs || 0) < 1e4) {
        return STATE.solPrice;
      }
      let price = null;
      const solImages = Array.from(document.querySelectorAll("img")).filter((img) => {
        const src = (img.src || "").toLowerCase();
        const alt = (img.alt || "").toLowerCase();
        return (src.includes("solana") || src.includes("sol.") || src.includes("/sol") || alt.includes("sol") || alt.includes("solana")) && img.clientWidth < 50 && img.clientWidth > 8;
      });
      for (const img of solImages) {
        let parent = img.parentElement;
        for (let i = 0; i < 3 && parent && !price; i++) {
          const text = parent.textContent || "";
          const priceMatch = text.match(/\$(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/);
          if (priceMatch) {
            const val = parseFloat(priceMatch[1].replace(/,/g, ""));
            if (!isNaN(val) && val > 0) {
              price = val;
              log("[getSolPrice] Found near SOL icon:", val);
              break;
            }
          }
          parent = parent.parentElement;
        }
        if (price)
          break;
      }
      if (!price) {
        const footerSelectors = 'footer, [class*="footer"], [class*="Footer"], [class*="bottom"], [class*="Bottom"], [class*="status"]';
        const footerElements = document.querySelectorAll(footerSelectors);
        for (const footer of footerElements) {
          const text = (footer.textContent || "").toLowerCase();
          if (text.includes("sol")) {
            const priceMatch = footer.textContent.match(/\$(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/);
            if (priceMatch) {
              const val = parseFloat(priceMatch[1].replace(/,/g, ""));
              if (!isNaN(val) && val > 0) {
                price = val;
                log("[getSolPrice] Found in footer:", val);
                break;
              }
            }
          }
        }
      }
      if (!price) {
        const allText = document.body.innerText;
        const solPriceMatch = allText.match(/SOL[:\s]*\$(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/i) || allText.match(/\$(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)\s*SOL/i);
        if (solPriceMatch) {
          const val = parseFloat(solPriceMatch[1].replace(/,/g, ""));
          if (!isNaN(val) && val > 0) {
            price = val;
            log("[getSolPrice] Found SOL price pattern:", val);
          }
        }
      }
      if (price) {
        STATE.solPrice = price;
        STATE.solPriceTs = Date.now();
        log("[getSolPrice] Using detected price:", price);
        return price;
      }
      const fallback = STATE.solPrice || 200;
      log("[getSolPrice] Using fallback:", fallback);
      return fallback;
    }
    function mountPnlHud() {
      const shadowRt = getShadowRoot();
      const container = getShadowContainer();
      let root = shadowRt.getElementById(IDS.pnlHud);
      if (!STATE.enabled) {
        if (root)
          root.style.display = "none";
        return;
      }
      if (root)
        root.style.display = "";
      if (!root) {
        root = document.createElement("div");
        root.id = IDS.pnlHud;
        root.style.pointerEvents = "auto";
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
        </div>
          <div class="tradeList" style="display:none;"></div>
        </div>
      `;
        container.appendChild(root);
        const header = root.querySelector(".header");
        makeDraggable(
          header,
          (dx, dy) => {
            if (STATE.pnlDocked)
              return;
            STATE.pnlPos.x += dx;
            STATE.pnlPos.y += dy;
            STATE.pnlPos.x = clamp(STATE.pnlPos.x, 0, window.innerWidth - 40);
            STATE.pnlPos.y = clamp(STATE.pnlPos.y, 34, window.innerHeight - 40);
            root.style.left = `${STATE.pnlPos.x}px`;
            root.style.top = `${STATE.pnlPos.y}px`;
          },
          async () => {
            if (!STATE.pnlDocked)
              await saveState();
          }
        );
        root.addEventListener("click", async (e) => {
          const t = e.target;
          if (t.matches && t.matches("input, textarea, label, .startSolInput"))
            return;
          const actEl = t.closest("[data-act]");
          const act = actEl?.getAttribute("data-act");
          log("PNL HUD click:", t.tagName, t.className, "act:", act);
          if (!(t instanceof HTMLElement))
            return;
          if (act === "dock") {
            STATE.pnlDocked = !STATE.pnlDocked;
            await saveState();
            if (PLATFORM.isPadre) {
              renderAll();
            } else {
              scheduleRender();
            }
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (act === "trades") {
            const list = root.querySelector(".tradeList");
            if (list) {
              list.style.display = list.style.display === "none" ? "block" : "none";
              updateTradeList(list);
            }
            e.preventDefault();
            e.stopPropagation();
          }
          if (act === "reset") {
            log("Reset button clicked, showing custom modal");
            const overlay = document.createElement("div");
            overlay.className = "confirm-modal-overlay";
            overlay.innerHTML = `
            <div class="confirm-modal">
              <h3>Reset Session?</h3>
              <p>This will clear all realized P&L, trade history, and active positions. Your Start SOL balance will be restored.</p>
              <div class="confirm-modal-buttons">
                <button class="confirm-modal-btn cancel">Cancel</button>
                <button class="confirm-modal-btn confirm">Reset</button>
              </div>
            </div>
          `;
            getShadowRoot().appendChild(overlay);
            const removeModal = () => overlay.remove();
            const btnCancel = overlay.querySelector(".cancel");
            btnCancel.addEventListener("click", (ev) => {
              ev.stopPropagation();
              removeModal();
            });
            const btnConfirm = overlay.querySelector(".confirm");
            btnConfirm.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              log("Reset confirmed via custom modal");
              STATE.cashSol = STATE.startSol;
              STATE.realizedSol = 0;
              STATE.positions = {};
              STATE.trades = [];
              await saveState();
              updatePnlHud();
              const list = root.querySelector(".tradeList");
              if (list)
                updateTradeList(list);
              removeModal();
            });
            overlay.addEventListener("click", (ev) => {
              if (ev.target === overlay) {
                ev.stopPropagation();
                removeModal();
              }
            });
            e.preventDefault();
            e.stopPropagation();
          }
          if (act === "toggleTokenUnit") {
            STATE.tokenDisplayUsd = !STATE.tokenDisplayUsd;
            await saveState();
            updatePnlHud();
            e.preventDefault();
            e.stopPropagation();
          }
          if (act === "toggleSessionUnit") {
            STATE.sessionDisplayUsd = !STATE.sessionDisplayUsd;
            await saveState();
            updatePnlHud();
            e.preventDefault();
            e.stopPropagation();
          }
        });
        const startInput = root.querySelector("input.startSolInput");
        if (startInput) {
          startInput.value = String(STATE.startSol);
          startInput.addEventListener("change", async () => {
            const v = safeParseFloat(startInput.value);
            if (v > 0) {
              const hadAnyTrades = (STATE.trades || []).length > 0;
              STATE.startSol = v;
              if (!hadAnyTrades) {
                STATE.cashSol = v;
                STATE.equitySol = v;
                STATE.realizedSol = 0;
                STATE.positions = {};
                STATE.trades = [];
              }
              await saveState();
              updatePnlHud();
            } else {
              startInput.value = String(STATE.startSol);
            }
          });
        }
      }
      root.className = STATE.pnlDocked ? "docked" : "floating";
      if (!STATE.pnlDocked) {
        root.style.left = `${clamp(STATE.pnlPos.x, 0, window.innerWidth - 40)}px`;
        root.style.top = `${clamp(STATE.pnlPos.y, 34, window.innerHeight - 40)}px`;
        root.style.transform = "none";
      } else {
        root.style.left = "";
        root.style.top = "";
      }
    }
    function calcUnrealizedSol() {
      let totalUnrealizedSol = 0;
      const posMap = STATE.positions || {};
      const currentMC = getMarketCap();
      for (const p of Object.values(posMap)) {
        if (!p || !p.tokenQty || p.tokenQty <= 0)
          continue;
        const totalSolSpent = Number(p.totalSolSpent || 0);
        const entryMC = Number(p.entryMarketCap || 0);
        if (currentMC > 0 && entryMC > 0 && totalSolSpent > 0) {
          const mcRatio = currentMC / entryMC;
          const currentValueSol = totalSolSpent * mcRatio;
          const unrealizedPnl = currentValueSol - totalSolSpent;
          log("[calcUnrealizedSol] MC Ratio method:", {
            entryMC: entryMC.toFixed(0),
            currentMC: currentMC.toFixed(0),
            mcRatio: mcRatio.toFixed(4),
            totalSolSpent: totalSolSpent.toFixed(4),
            currentValueSol: currentValueSol.toFixed(4),
            unrealizedPnl: unrealizedPnl.toFixed(4)
          });
          totalUnrealizedSol += unrealizedPnl;
          continue;
        }
        const tokenQty = Number(p.tokenQty || 0);
        const lastPriceUsd = Number(p.lastPriceUsd || 0);
        const solUsdPrice = getSolPrice();
        if (lastPriceUsd > 0 && tokenQty > 0 && totalSolSpent > 0) {
          const currentValueUsd = tokenQty * lastPriceUsd;
          const currentValueSol = currentValueUsd / solUsdPrice;
          const unrealizedPnl = currentValueSol - totalSolSpent;
          log("[calcUnrealizedSol] Price method (fallback):", {
            tokenQty: tokenQty.toFixed(2),
            lastPriceUsd: lastPriceUsd.toFixed(10),
            currentValueSol: currentValueSol.toFixed(4),
            totalSolSpent: totalSolSpent.toFixed(4),
            unrealizedPnl: unrealizedPnl.toFixed(4)
          });
          totalUnrealizedSol += unrealizedPnl;
        }
      }
      return totalUnrealizedSol;
    }
    function analyzeRecentTrades() {
      const trades = STATE.trades || [];
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
        if (trade.pnlSol > 0)
          wins++;
        else
          losses++;
        totalPnlSol += trade.pnlSol || 0;
        if (trade.entryTs && trade.exitTs) {
          const holdTime = trade.exitTs - trade.entryTs;
          totalHoldTimeMs += holdTime;
          if (holdTime < 6e4)
            quickFlips++;
          if (holdTime > 6e5)
            longHolds++;
        }
        if (trade.entryMc) {
          avgEntryMc += trade.entryMc;
          entryMcCount++;
        }
        if (trade.exitMc) {
          avgExitMc += trade.exitMc;
          exitMcCount++;
        }
      }
      const avgHoldTimeSec = recentTrades.length > 0 ? totalHoldTimeMs / recentTrades.length / 1e3 : 0;
      avgEntryMc = entryMcCount > 0 ? avgEntryMc / entryMcCount : 0;
      avgExitMc = exitMcCount > 0 ? avgExitMc / exitMcCount : 0;
      const winRate = recentTrades.length > 0 ? wins / recentTrades.length * 100 : 0;
      let style = "balanced";
      if (quickFlips > recentTrades.length * 0.6)
        style = "scalper";
      else if (longHolds > recentTrades.length * 0.4)
        style = "swing";
      else if (avgEntryMc < 1e5)
        style = "degen";
      else if (avgEntryMc > 5e5)
        style = "conservative";
      return {
        totalTrades: recentTrades.length,
        wins,
        losses,
        winRate: winRate.toFixed(1),
        avgHoldTimeSec,
        avgEntryMc,
        avgExitMc,
        totalPnlSol,
        style,
        quickFlips,
        longHolds
      };
    }
    function showProfessorCritique(trigger, value) {
      const analysis = analyzeRecentTrades();
      const container = getShadowContainer();
      if (!container)
        return;
      const professorImgUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL("src/professor.png") : "";
      const style = analysis?.style || "balanced";
      const styleTips = {
        scalper: [
          "\u{1F4A1} Tip: Scalping works best in high-volume markets. Watch those fees!",
          "\u{1F4A1} Tip: Consider setting a 5-trade limit per hour to avoid overtrading.",
          "\u{1F4A1} Tip: Quick flips need quick reflexes. Always have an exit plan!"
        ],
        swing: [
          "\u{1F4A1} Tip: Setting a trailing stop can protect your swing trade profits.",
          "\u{1F4A1} Tip: Patient hands make the most gains. Trust your analysis!",
          "\u{1F4A1} Tip: Consider scaling out in 25% chunks to lock in profits."
        ],
        degen: [
          "\u{1F4A1} Tip: Micro-caps are fun but size down! Never risk more than 5% on a single play.",
          "\u{1F4A1} Tip: In degen territory, the first green candle is often the exit signal.",
          "\u{1F4A1} Tip: Set a hard stop at -50%. Live to degen another day!"
        ],
        conservative: [
          "\u{1F4A1} Tip: Your conservative style keeps you in the game. Consider a small moon bag!",
          "\u{1F4A1} Tip: Larger caps mean smaller moves. Patience is your superpower.",
          "\u{1F4A1} Tip: Consider allocating 10% to higher-risk plays for balance."
        ],
        balanced: [
          "\u{1F4A1} Tip: Your balanced approach is sustainable. Keep mixing risk levels!",
          "\u{1F4A1} Tip: Track your best-performing market cap range and lean into it.",
          "\u{1F4A1} Tip: Journal your winners - patterns emerge over time!"
        ]
      };
      const getRandomTip = () => {
        const tips = styleTips[style] || styleTips.balanced;
        return tips[Math.floor(Math.random() * tips.length)];
      };
      let title, message;
      const currentEquity = STATE.cashSol + calcUnrealizedSol() + (STATE.realizedSol || 0);
      if (trigger === "portfolio_multiplier") {
        const multiplier = value;
        const startSol = STATE.startSol || 10;
        if (multiplier === 2) {
          title = "\u{1F389} PORTFOLIO DOUBLED!";
          const messages = [
            `You turned ${startSol} SOL into ${currentEquity.toFixed(2)} SOL! That's 2x gains!`,
            `DOUBLED! From ${startSol} to ${currentEquity.toFixed(2)} SOL. This is what smart trading looks like!`,
            `2X ACHIEVED! You've officially doubled your paper port. Time to lock in some gains?`
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        } else if (multiplier === 3) {
          title = "\u{1F680} 3X PORTFOLIO!";
          const messages = [
            `INCREDIBLE! Your ${startSol} SOL is now ${currentEquity.toFixed(2)} SOL!`,
            `3X GAINS! You're trading like a pro. Consider taking 50% off to secure profits!`,
            `Triple your money! This is rare air - protect these gains!`
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        } else {
          title = `\u{1F525} ${multiplier}X PORTFOLIO!`;
          const messages = [
            `${multiplier}X GAINS! From ${startSol} to ${currentEquity.toFixed(2)} SOL! You're on FIRE!`,
            `LEGENDARY! ${multiplier}x returns! But remember - pigs get slaughtered. Take profits!`,
            `${multiplier}X! You're trading at god-tier levels. Don't give it all back!`
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        }
        message += "\n\n" + getRandomTip();
      } else if (trigger === "win_streak") {
        const streak = value;
        if (streak === 5) {
          title = "\u{1F525} 5 Win Streak!";
          const messages = [
            "5 wins in a row! You're finding your rhythm. The market is speaking and you're listening!",
            "Halfway to legendary! Your entries are on point. Keep that discipline!",
            "FIVE straight wins! Your style is clicking. Ride this wave but don't get cocky!"
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        } else if (streak === 10) {
          title = "\u{1F3C6} 10 Win Streak!";
          const messages = [
            "10-win streak! You're reading the market like a book!",
            "DOUBLE DIGITS! Your patience and timing are elite. This is what consistent profitability looks like!",
            "TEN straight winners! You've earned legendary status. But the market humbles everyone eventually..."
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        } else if (streak === 15) {
          title = "\u{1F451} 15 Win Streak!";
          const messages = [
            "15 STRAIGHT WINS?! You've unlocked god mode! But remember, every streak ends eventually.",
            "FIFTEEN! This is insane discipline. You're trading at a level most only dream of!",
            "15 wins in a row! The market bows to you. Stay humble, stay hungry!"
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        } else {
          title = `\u{1F31F} ${streak} Win Streak!`;
          const messages = [
            `${streak} consecutive wins! You've transcended normal trading. Absolute legend status!`,
            `${streak} WINS?! This is historic. Screenshot this moment!`,
            `${streak} straight! At this point, you're teaching the market lessons!`
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        }
        message += "\n\n" + getRandomTip();
      } else if (trigger === "loss_streak") {
        const streak = value;
        if (streak === 3) {
          title = "\u26A0\uFE0F 3 Loss Streak";
          const messages = [
            "3 losses in a row. Time to step back and analyze your entries. The market is giving you feedback!",
            "Tough run! Consider reducing size until you find your groove again. Protect your capital!",
            "Three straight losses. Take a breath - revenge trading only makes it worse."
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        } else if (streak === 5) {
          title = "\u{1F6D1} 5 Loss Streak";
          const messages = [
            "5 straight losses. The market is telling you something - are you listening?",
            "This is where discipline matters most. Don't revenge trade! Step away if needed.",
            "FIVE losses. Time for a break. Review your trades, find the pattern, then come back stronger."
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        } else {
          title = `\u{1F630} ${streak} Loss Streak`;
          const messages = [
            `${streak} losses... This is painful but not permanent. Take a serious break and reset mentally.`,
            `${streak} in a row. The market is ruthless. Reduce size dramatically or pause entirely.`,
            `${streak} straight losses. Every trader has these moments. Your response defines you!`
          ];
          message = messages[Math.floor(Math.random() * messages.length)];
        }
        const lossAdvice = {
          scalper: "As a scalper, consider slowing down. Fewer trades can mean better trades.",
          swing: "Your swing style means each loss hurts more. Tighten those stop losses!",
          degen: "Degen plays have high variance. This streak might just be the nature of the game.",
          conservative: "Even with safe plays, streaks happen. Your risk management will save you!",
          balanced: "Bad streaks happen to everyone. Review and adjust, don't abandon your strategy."
        };
        message += "\n\n" + (lossAdvice[style] || lossAdvice.balanced);
      } else if (trigger === "quick_exit_loss") {
        const holdSec = Math.round(value / 1e3);
        title = "\u26A1 Panic Sell Detected";
        const messages = [
          `You exited after only ${holdSec} seconds with a loss. Panic selling rarely pays off!`,
          `${holdSec} second hold time? That's not trading, that's gambling! Give positions time to breathe.`,
          `Lightning-fast exit into a loss. Ask yourself: Did the thesis change, or did you just panic?`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: Set a minimum hold time (like 2-3 minutes) before allowing yourself to exit.";
      } else if (trigger === "fomo_buying") {
        title = "\u{1F3C3} FOMO Detected!";
        const messages = [
          `${value} buys in under 2 minutes? Slow down! FOMO is the #1 account killer.`,
          `Rapid-fire buying detected! Each trade should be deliberate, not reactive.`,
          `You're buying faster than you're thinking. Take a breath between entries!`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: Wait 30 seconds between trades. If you still want in after that, it's probably okay.";
      } else if (trigger === "revenge_trade") {
        const secSinceLoss = Math.round(value / 1e3);
        title = "\u{1F624} Revenge Trade Alert!";
        const messages = [
          `Buying ${secSinceLoss}s after a loss? That's revenge trading - the fastest way to blow up!`,
          `I see you jumping back in immediately after losing. This rarely ends well!`,
          `Revenge trading detected! The market doesn't care about your last loss.`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: After a loss, take a 5-minute break. Walk away from the screen.";
      } else if (trigger === "overtrading") {
        title = "\u{1F4CA} Overtrading Warning";
        const messages = [
          `${value} trades this session! Quality over quantity - each trade has fees and risk.`,
          `Are you trading or just clicking buttons? ${value} trades is a lot!`,
          `${value} trades already. The best traders often make fewer, more calculated moves.`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: Set a daily trade limit (like 5-10) and stick to it.";
      } else if (trigger === "paper_hands") {
        const pctLoss = Math.abs(value).toFixed(1);
        title = "\u{1F9FB} Paper Hands Warning";
        const messages = [
          `Exiting at just -${pctLoss}%? Successful traders give positions room to breathe!`,
          `A ${pctLoss}% dip scared you out? Volatility is normal - set wider stops!`,
          `Sold at -${pctLoss}%... This could have easily recovered. Patience is profit!`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: Define your max loss BEFORE entering (like -20%) and stick to it.";
      } else if (trigger === "pump_chaser") {
        title = "\u{1F3A2} Pump Chaser Alert";
        const messages = [
          `You bought into an already-pumped token and got dumped on. Classic pump chase!`,
          `Chasing green candles = buying someone else's bags. Entry timing matters!`,
          `This token had already run up significantly before your entry. Let the FOMO go!`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: Look for tokens with consolidation, not tokens mid-pump.";
      } else if (trigger === "averaging_down") {
        const pctDown = Math.abs(value).toFixed(1);
        title = "\u26A0\uFE0F Averaging Down Alert";
        const messages = [
          `Adding to a position that's -${pctDown}% down? Averaging down works until it doesn't!`,
          `Buying more of a loser at -${pctDown}%... Are you doubling down on a bad thesis?`,
          `Adding to a red position. Make sure you're not just hoping for a recovery!`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: Only average into winners. Cut losers, add to winners.";
      } else if (trigger === "gains_given_back") {
        const maxGain = value.maxGain?.toFixed(1) || "??";
        const finalLoss = Math.abs(value.finalLoss || 0).toFixed(1);
        title = "\u{1F4B8} Gains Given Back!";
        const messages = [
          `You were up +${maxGain}% and let it turn into -${finalLoss}%! Set trailing stops!`,
          `From +${maxGain}% to -${finalLoss}%... That's a painful round trip. Take profits earlier!`,
          `Max gain was +${maxGain}% but you held until -${finalLoss}%. Greed kills!`
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
        message += "\n\n\u{1F4A1} Tip: Once up 20%+, set a trailing stop or take partial profits.";
      } else if (trigger === "achievement") {
        title = "\u{1F3C6} Incredible Achievement!";
        const achievementMessages = [
          "Remarkable! A 10-win streak shows true discipline. You've mastered the art of knowing when to take profits!",
          "Outstanding work, trader! Your consistency is legendary. Keep that winning momentum going!",
          "Phenomenal streak! You're reading the market like a pro. Remember, the key is sustainable success!"
        ];
        message = achievementMessages[Math.floor(Math.random() * achievementMessages.length)];
        message += "\n\n" + getRandomTip();
      } else {
        title = "\u{1F4CA} Trade Analysis";
        const lossMessages = {
          scalper: [
            "I see you're a fast trader! Quick flips can be profitable, but watch out for overtrading fees eating into gains.",
            "Speed is your game! Consider adding a cooldown between trades to avoid emotional decisions.",
            "Rapid-fire trading detected! Remember, sometimes the best trade is no trade at all."
          ],
          swing: [
            "You like to hold positions. Make sure you're setting proper stop losses to protect those gains!",
            "Patient trader, I see! Consider taking partial profits along the way to lock in gains.",
            "Long holds can be rewarding, but don't let winners turn into losers. Set exit targets!"
          ],
          degen: [
            "Low market cap plays are high risk! Consider sizing down on these volatile micro-caps.",
            "I see you like the small caps! Exciting, but remember - most of these go to zero. Size wisely!",
            "Degen mode activated! Just remember, it's okay to take profits on the way up."
          ],
          conservative: [
            "You trade safer market caps. Good discipline! But sometimes a bit of risk brings reward.",
            "Conservative approach noted. Consider allocating a small portion to higher-risk plays.",
            "Steady trading style! Your risk management is solid. Keep building those consistent gains."
          ],
          balanced: [
            "Your streak ended, but that's part of the game. Review what made this trade different.",
            "Every loss is a lesson! Look at your entry timing and market conditions.",
            "The market humbled you today. Take a moment to analyze before the next trade."
          ]
        };
        const styleMessages = lossMessages[style] || lossMessages.balanced;
        message = styleMessages[Math.floor(Math.random() * styleMessages.length)];
        if (value > 0) {
          message = `Your ${value}-win streak has ended. ` + message;
        }
      }
      let statsHtml = "";
      if (analysis && analysis.totalTrades > 0) {
        const formatMc = (mc) => {
          if (mc >= 1e6)
            return `$${(mc / 1e6).toFixed(1)}M`;
          if (mc >= 1e3)
            return `$${(mc / 1e3).toFixed(0)}K`;
          return `$${mc.toFixed(0)}`;
        };
        const formatTime = (sec) => {
          if (sec >= 3600)
            return `${(sec / 3600).toFixed(1)}h`;
          if (sec >= 60)
            return `${(sec / 60).toFixed(1)}m`;
          return `${sec.toFixed(0)}s`;
        };
        statsHtml = `
        <div class="professor-stats">
          <div>\u{1F4C8} Win Rate: <span>${analysis.winRate}%</span> (${analysis.wins}W / ${analysis.losses}L)</div>
          <div>\u23F1\uFE0F Avg Hold Time: <span>${formatTime(analysis.avgHoldTimeSec)}</span></div>
          ${analysis.avgEntryMc > 0 ? `<div>\u{1F3AF} Avg Entry MC: <span>${formatMc(analysis.avgEntryMc)}</span></div>` : ""}
          <div>\u{1F4B0} Session P&L: <span style="color:${analysis.totalPnlSol >= 0 ? "#10b981" : "#ef4444"}">${analysis.totalPnlSol >= 0 ? "+" : ""}${analysis.totalPnlSol.toFixed(4)} SOL</span></div>
          <div>\u{1F3AE} Style: <span>${analysis.style.charAt(0).toUpperCase() + analysis.style.slice(1)}</span></div>
        </div>
      `;
      }
      const overlay = document.createElement("div");
      overlay.className = "professor-overlay";
      overlay.innerHTML = `
      <div class="professor-container">
        ${professorImgUrl ? `<img class="professor-image" src="${professorImgUrl}" alt="Professor">` : ""}
        <div class="professor-bubble">
          <div class="professor-title">${title}</div>
          <div class="professor-message">${message.replace(/\n/g, "<br>")}</div>
          ${statsHtml}
          <button class="professor-dismiss">Got it!</button>
        </div>
      </div>
    `;
      container.appendChild(overlay);
      overlay.querySelector(".professor-dismiss").addEventListener("click", () => {
        overlay.style.animation = "professorFadeIn 0.2s ease-out reverse";
        setTimeout(() => overlay.remove(), 200);
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.style.animation = "professorFadeIn 0.2s ease-out reverse";
          setTimeout(() => overlay.remove(), 200);
        }
      });
      log("Professor critique shown:", trigger, value);
    }
    function updatePnlHud() {
      const root = getShadowRoot().getElementById(IDS.pnlHud);
      if (!root)
        return;
      const unrealized = calcUnrealizedSol();
      const realized = Number(STATE.realizedSol || 0);
      const cash = Number(STATE.cashSol || 0);
      const solUsdPrice = getSolPrice();
      const safeUnrl = unrealized;
      const balance = cash;
      const totalPnl = safeUnrl + realized;
      log("[updatePnlHud] P&L Breakdown:", {
        startSol: STATE.startSol,
        cashSol: cash.toFixed(4),
        unrealizedPnl: safeUnrl.toFixed(4),
        realizedPnl: realized.toFixed(4),
        sessionPnl: totalPnl.toFixed(4),
        solUsdPrice
      });
      let tokenValueSol = 0;
      let tokenValueUsd = 0;
      for (const pos of Object.values(STATE.positions || {})) {
        if (pos && pos.tokenQty > 0 && pos.lastPriceUsd > 0) {
          const valueUsd = pos.tokenQty * pos.lastPriceUsd;
          tokenValueUsd += valueUsd;
          tokenValueSol += valueUsd / solUsdPrice;
        }
      }
      const balanceEl = root.querySelector('[data-k="balance"]');
      if (balanceEl)
        balanceEl.textContent = `${fmtSol(balance)} SOL`;
      let unrealizedPct = 0;
      const currentMC = getMarketCap();
      for (const p of Object.values(STATE.positions || {})) {
        if (p && p.tokenQty > 0 && p.entryMarketCap > 0 && currentMC > 0) {
          unrealizedPct = (currentMC / p.entryMarketCap - 1) * 100;
          break;
        }
      }
      const tokenValueEl = root.querySelector('[data-k="tokenValue"]');
      const tokenUnitEl = root.querySelector('[data-k="tokenUnit"]');
      if (tokenValueEl) {
        const sign = safeUnrl >= 0 ? "+" : "";
        const pctSign = unrealizedPct >= 0 ? "+" : "";
        const pctStr = unrealizedPct !== 0 ? ` (${pctSign}${unrealizedPct.toFixed(1)}%)` : "";
        if (STATE.tokenDisplayUsd) {
          const unrealizedUsd = safeUnrl * solUsdPrice;
          tokenValueEl.textContent = `${sign}$${Math.abs(unrealizedUsd).toFixed(2)}${pctStr}`;
          if (tokenUnitEl)
            tokenUnitEl.textContent = "USD";
        } else {
          const solStr = Math.abs(safeUnrl).toFixed(3);
          tokenValueEl.textContent = `${sign}${solStr} SOL${pctStr}`;
          if (tokenUnitEl)
            tokenUnitEl.textContent = "SOL";
        }
        tokenValueEl.style.color = safeUnrl >= 0 ? "#10b981" : "#ef4444";
      }
      const pnlEl = root.querySelector('[data-k="pnl"]');
      const pnlUnitEl = root.querySelector('[data-k="pnlUnit"]');
      if (pnlEl) {
        const sign = totalPnl >= 0 ? "+" : "";
        if (STATE.sessionDisplayUsd) {
          const pnlUsd = totalPnl * solUsdPrice;
          pnlEl.textContent = `${sign}$${Math.abs(pnlUsd).toFixed(2)}`;
          if (pnlUnitEl)
            pnlUnitEl.textContent = "USD";
        } else {
          pnlEl.textContent = `${sign}${fmtSol(totalPnl)} SOL`;
          if (pnlUnitEl)
            pnlUnitEl.textContent = "SOL";
        }
        pnlEl.style.color = totalPnl >= 0 ? "#10b981" : "#ef4444";
      }
      const streakEl = root.querySelector(".stat.streak");
      const streakValEl = root.querySelector('[data-k="streak"]');
      if (streakEl && streakValEl) {
        const streak = STATE.winStreak || 0;
        streakValEl.textContent = streak;
        streakEl.classList.remove("win", "loss");
        if (streak > 0) {
          streakEl.classList.add("win");
        } else if (streak === 0 && STATE.lastTradeWasLoss) {
          streakEl.classList.add("loss");
          setTimeout(() => streakEl.classList.remove("loss"), 2e3);
          STATE.lastTradeWasLoss = false;
        }
      }
      const tokenLabel = root.querySelector('[data-k="tokenSymbol"]');
      if (tokenLabel) {
        const sym = getStableToken()?.symbol;
        if (sym && sym !== "TOKEN")
          tokenLabel.textContent = sym;
      }
      const list = root.querySelector(".tradeList");
      if (list && list.style.display !== "none")
        updateTradeList(list);
    }
    function updateTradeList(listEl) {
      const rows = (STATE.trades || []).slice().reverse().slice(0, 50);
      if (rows.length === 0) {
        listEl.innerHTML = `<div style="padding:12px;color:rgba(148,163,184,0.9);font-weight:700;">No trades yet</div>`;
        return;
      }
      listEl.innerHTML = rows.map((t) => {
        const side = t.side === "SELL" ? "sell" : "buy";
        const sideLabel = t.side === "SELL" ? "SELL" : "BUY";
        const time = nowLocalTimeString(t.ts);
        const ticker = t.symbol || "TOKEN";
        const size = t.side === "SELL" ? `${Number(t.tokenQty || 0).toFixed(2)} tok` : `${fmtSol(Number(t.solSize || 0))} SOL`;
        const price = t.priceUsd ? `$${Number(t.priceUsd).toFixed(6)}` : "";
        const formatMC = (mc2) => {
          if (!mc2)
            return "-";
          if (mc2 >= 1e6)
            return `$${(mc2 / 1e6).toFixed(1)}M`;
          if (mc2 >= 1e3)
            return `$${(mc2 / 1e3).toFixed(0)}K`;
          return `$${mc2.toFixed(0)}`;
        };
        const mc = formatMC(t.marketCap);
        return `
          <div class="tradeRow">
            <div class="muted">${escapeHtml(time)}</div>
            <div style="font-weight:700;">${escapeHtml(ticker)}</div>
            <div><span class="tag ${side}">${sideLabel}</span></div>
            <div>${escapeHtml(size)}</div>
            <div>${escapeHtml(price)}</div>
            <div style="color:#94a3b8;">${mc}</div>
          </div>
          `;
      }).join("");
    }
    function handlePriceTick(msg) {
      if (!msg || !msg.price)
        return;
      const price = Number(msg.price);
      if (!Number.isFinite(price) || price <= 0)
        return;
      let updated = false;
      for (const key of Object.keys(STATE.positions || {})) {
        const pos = STATE.positions[key];
        if (pos && pos.tokenQty > 0) {
          pos.lastPriceUsd = price;
          pos.lastPriceTs = Date.now();
          updated = true;
        }
      }
      if (updated) {
        updatePnlHud();
      }
    }
    function createTradeMarker(side, price, amount, marketCap, timestamp) {
      if (!PLATFORM.isPadre) {
        log("Trade markers only supported on Padre (TradingView)");
        return;
      }
      const ts = timestamp || Date.now();
      log("Sending TRADE_EXECUTED message to page-bridge:", { side, price, marketCap, ts });
      window.postMessage({
        __paper: true,
        type: "TRADE_EXECUTED",
        side: side.toLowerCase(),
        price,
        marketCap,
        timestamp: ts
      }, "*");
    }
    function renderTradeMarkers() {
      if (!PLATFORM.isPadre || !STATE.trades || STATE.trades.length === 0)
        return;
      const currentMint = getCurrentTokenMint();
      if (!currentMint) {
        log("renderTradeMarkers: No current token mint found");
        return;
      }
      const tokenTrades = STATE.trades.filter((t) => t.mint === currentMint);
      log("renderTradeMarkers: Found", tokenTrades.length, "trades for", currentMint);
      tokenTrades.forEach((trade) => {
        const ts = Math.floor(trade.ts / 1e3);
        createTradeMarker(
          trade.side.toLowerCase(),
          trade.priceUsd,
          trade.solSize,
          trade.marketCap,
          ts
        );
      });
    }
    function getCurrentTokenMint() {
      const urlMatch = window.location.pathname.match(/\/([A-Za-z0-9]{32,})/);
      if (urlMatch)
        return urlMatch[1];
      const stable = getStableToken();
      return stable?.mint || null;
    }
    function waitForTvWidget(callback, delayMs = 5e3) {
      if (!PLATFORM.isPadre)
        return;
      log("Waiting", delayMs, "ms for TradingView widget to initialize...");
      setTimeout(() => {
        log("Rendering stored trade markers via page-bridge");
        callback();
      }, delayMs);
    }
    function sendContextToBridge() {
      const stable = getStableToken();
      window.postMessage({
        __paper: true,
        type: "PAPER_SET_CONTEXT",
        mint: stable?.mint || null,
        symbol: stable?.symbol || "TOKEN"
      }, "*");
    }
    let BUYHUD_TAB = "buy";
    let BUYHUD_EDIT = false;
    function mountBuyHud() {
      const shadowRt = getShadowRoot();
      const container = getShadowContainer();
      let root = shadowRt.getElementById(IDS.buyHud);
      if (!STATE.enabled) {
        if (root)
          root.style.display = "none";
        return;
      }
      if (root)
        root.style.display = "";
      if (!root) {
        root = document.createElement("div");
        root.id = IDS.buyHud;
        root.style.pointerEvents = "auto";
        root.innerHTML = `
          <div class="panel">
          <div class="panelHeader">
            <div class="panelTitle"><span class="dot"></span> ZER\xD8</div>
            <div class="panelBtns">
              <button class="btn" data-act="dock">Dock</button>
              <button class="btn" data-act="edit">Edit</button>
            </div>
          </div>
          <div class="tabs">
            <button class="tab active" data-tab="buy">BUY</button>
            <button class="tab" data-tab="sell">SELL</button>
          </div>
          <div class="body">
            <div class="fieldLabel" data-k="label">Buy Amount (SOL)</div>
            <input class="field" data-k="field" type="text" inputmode="decimal" placeholder="e.g. 0.25" />
            <div class="quickRow" data-k="quick"></div>
            <button class="action" data-act="action">ZER\xD8 Buy TOKEN</button>
            <div class="status" data-k="status"></div>
          </div>
        </div>
          `;
        container.appendChild(root);
        const header = root.querySelector(".panelHeader");
        makeDraggable(
          header,
          (dx, dy) => {
            if (STATE.buyHudDocked)
              return;
            STATE.buyHudPos.x += dx;
            STATE.buyHudPos.y += dy;
            STATE.buyHudPos.x = clamp(STATE.buyHudPos.x, 0, window.innerWidth - 100);
            STATE.buyHudPos.y = clamp(STATE.buyHudPos.y, 34, window.innerHeight - 80);
            root.style.left = `${STATE.buyHudPos.x}px`;
            root.style.right = "auto";
            root.style.top = `${STATE.buyHudPos.y}px`;
          },
          async () => {
            if (!STATE.buyHudDocked)
              await saveState();
          }
        );
        root.addEventListener("click", async (e) => {
          const el = e.target;
          if (!(el instanceof HTMLElement))
            return;
          const act = el.getAttribute("data-act");
          const tab = el.getAttribute("data-tab");
          if (tab) {
            BUYHUD_TAB = tab === "sell" ? "sell" : "buy";
            updateBuyHud();
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (act === "dock") {
            STATE.buyHudDocked = !STATE.buyHudDocked;
            await saveState();
            if (PLATFORM.isPadre) {
              renderAll();
            } else {
              scheduleRender();
            }
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (act === "edit") {
            BUYHUD_EDIT = !BUYHUD_EDIT;
            updateBuyHud();
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (act === "action") {
            if (!STATE.enabled) {
              const status = root.querySelector('[data-k="status"]');
              if (status)
                status.textContent = "ZER\xD8 mode is disabled. Click the banner to enable.";
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            const field = root.querySelector('input[data-k="field"]');
            const inputVal = field ? field.value.trim() : "";
            if (!inputVal) {
              const status = root.querySelector('[data-k="status"]');
              if (status)
                status.textContent = "Please enter an amount.";
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            const stable = getStableToken();
            const symbol = stable?.symbol || "TOKEN";
            const mint = stable?.mint || null;
            const getCurrentPrice = () => {
              const parseSubscriptPrice = (text) => {
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
                const match = text.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
                if (match) {
                  const extraZeros = subscriptMap[match[1]];
                  const digits = match[2];
                  const priceStr = "0." + "0".repeat(extraZeros + 1) + digits;
                  const price = parseFloat(priceStr);
                  log("Parsed subscript price:", text, "\u2192", price);
                  return price;
                }
                const stdMatch = text.match(/\$([\d.]+)/);
                if (stdMatch) {
                  const price = parseFloat(stdMatch[1]);
                  if (price > 0 && price < 1) {
                    log("Parsed standard price:", price);
                    return price;
                  }
                }
                return null;
              };
              const priceElements = Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2, p.MuiTypography-body1")).filter((el2) => {
                const text = el2.textContent || "";
                return /\$[\d.]+/.test(text) || /\$0\.0[₀₁₂₃₄₅₆₇₈₉]/.test(text);
              });
              for (const el2 of priceElements) {
                const price = parseSubscriptPrice(el2.textContent || "");
                if (price && price > 1e-7 && price < 10) {
                  return price;
                }
              }
              const posKey = mint || symbol;
              if (STATE.positions[posKey]?.lastPriceUsd) {
                log("DOM scraping failed, using cached price:", STATE.positions[posKey].lastPriceUsd);
                return STATE.positions[posKey].lastPriceUsd;
              }
              return 1e-3;
            };
            if (BUYHUD_TAB === "buy") {
              const solAmount = safeParseFloat(inputVal);
              if (solAmount <= 0 || solAmount > STATE.cashSol) {
                const status2 = root.querySelector('[data-k="status"]');
                if (status2) {
                  status2.textContent = solAmount <= 0 ? "Invalid amount." : `Insufficient cash. Available: ${fmtSol(STATE.cashSol)} SOL`;
                }
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              const posKey = mint || symbol;
              const currentPriceUsd = getCurrentPrice();
              const marketCap = getMarketCap();
              const solUsdPrice = getSolPrice();
              const usdAmount = solAmount * solUsdPrice;
              const tokenQty = usdAmount / currentPriceUsd;
              STATE.cashSol -= solAmount;
              if (!STATE.positions[posKey]) {
                STATE.positions[posKey] = {
                  tokenQty: 0,
                  entryPriceUsd: currentPriceUsd,
                  lastPriceUsd: currentPriceUsd,
                  symbol,
                  mint,
                  entryTs: Date.now(),
                  // For trade timing analysis
                  entryMarketCap: marketCap,
                  // For market cap analysis
                  // V51: Track SOL-denominated cost basis for accurate P&L
                  totalSolSpent: 0,
                  // Will be set below
                  // Store implied supply to derive precise price from MC later
                  // ImpliedSupply = MC / Price
                  impliedSupply: marketCap > 0 && currentPriceUsd > 0 ? marketCap / currentPriceUsd : 0
                };
              }
              const pos = STATE.positions[posKey];
              const oldValue = (pos.tokenQty || 0) * (pos.entryPriceUsd || currentPriceUsd);
              const newValue = tokenQty * currentPriceUsd;
              const totalQty = (pos.tokenQty || 0) + tokenQty;
              const oldSolSpent = pos.totalSolSpent || 0;
              const oldEntryMC = pos.entryMarketCap || marketCap;
              const weightedEntryMC = oldSolSpent > 0 ? (oldSolSpent * oldEntryMC + solAmount * marketCap) / (oldSolSpent + solAmount) : marketCap;
              pos.tokenQty = totalQty;
              pos.entryPriceUsd = totalQty > 0 ? (oldValue + newValue) / totalQty : currentPriceUsd;
              pos.lastPriceUsd = currentPriceUsd;
              pos.entryMarketCap = weightedEntryMC;
              pos.totalSolSpent = (pos.totalSolSpent || 0) + solAmount;
              log("[v51 BUY] Added", solAmount, "SOL. Total:", pos.totalSolSpent, "Weighted Entry MC:", weightedEntryMC);
              if (!STATE.trades)
                STATE.trades = [];
              STATE.trades.push({
                ts: Date.now(),
                side: "BUY",
                symbol,
                mint,
                solSize: solAmount,
                tokenQty,
                priceUsd: currentPriceUsd,
                marketCap
              });
              await saveState();
              updatePnlHud();
              createTradeMarker("buy", currentPriceUsd, solAmount, marketCap);
              log("Buy executed:", {
                symbol,
                solAmount,
                tokenQty,
                currentPriceUsd,
                entryPriceUsd: pos.entryPriceUsd,
                position: pos
              });
              const now = Date.now();
              if (!STATE.recentBuyTimestamps)
                STATE.recentBuyTimestamps = [];
              STATE.recentBuyTimestamps.push(now);
              STATE.recentBuyTimestamps = STATE.recentBuyTimestamps.filter((ts) => now - ts < 12e4);
              if (STATE.recentBuyTimestamps.length >= 3) {
                setTimeout(() => showProfessorCritique("fomo_buying", STATE.recentBuyTimestamps.length), 500);
                STATE.recentBuyTimestamps = [now];
              }
              const lastSellTs = STATE.lastSellTs || 0;
              const lastSellPnl = STATE.lastSellPnl || 0;
              if (lastSellPnl < 0 && now - lastSellTs < 3e4) {
                setTimeout(() => showProfessorCritique("revenge_trade", now - lastSellTs), 700);
              }
              if (oldSolSpent > 0 && marketCap < oldEntryMC) {
                const pctDown = (marketCap / oldEntryMC - 1) * 100;
                if (pctDown < -5) {
                  setTimeout(() => showProfessorCritique("averaging_down", pctDown), 900);
                }
              }
              STATE.sessionTradeCount = (STATE.sessionTradeCount || 0) + 1;
              if (!STATE.sessionStartTs)
                STATE.sessionStartTs = now;
              if (STATE.sessionTradeCount >= 10 && STATE.sessionTradeCount % 5 === 0) {
                setTimeout(() => showProfessorCritique("overtrading", STATE.sessionTradeCount), 1100);
              }
              STATE.lastBuyTs = now;
              await saveState();
              const status = root.querySelector('[data-k="status"]');
              if (status)
                status.textContent = `\u2713 Bought ${tokenQty.toFixed(2)} ${symbol} @ $${currentPriceUsd.toFixed(6)}`;
              if (field)
                field.value = "";
            } else {
              const sellPct = safeParseFloat(inputVal);
              if (sellPct <= 0 || sellPct > 100) {
                const status2 = root.querySelector('[data-k="status"]');
                if (status2)
                  status2.textContent = "Invalid percentage (0-100).";
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              const posKey = mint || symbol;
              const pos = STATE.positions[posKey];
              if (!pos || !pos.tokenQty || pos.tokenQty <= 0) {
                const status2 = root.querySelector('[data-k="status"]');
                if (status2)
                  status2.textContent = `No position in ${symbol} to sell.`;
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              const sellQty = pos.tokenQty * sellPct / 100;
              const currentPriceUsd = getCurrentPrice();
              const entryPriceUsd = pos.entryPriceUsd || currentPriceUsd;
              const proceedsUsd = sellQty * currentPriceUsd;
              const solUsdPrice = getSolPrice();
              const solReceived = proceedsUsd / solUsdPrice;
              const totalQtyBeforeSell = pos.tokenQty;
              const totalSolSpent = pos.totalSolSpent || 0;
              const solSpentPortion = totalQtyBeforeSell > 0 ? totalSolSpent * (sellQty / totalQtyBeforeSell) : 0;
              const realizedPnlSol = solReceived - solSpentPortion;
              log("[v51 SELL] Sell Qty:", sellQty, "of", totalQtyBeforeSell, "tokens");
              log("[v51 SELL] Total SOL Spent:", totalSolSpent, "Portion sold:", solSpentPortion);
              log("[v51 SELL] SOL Received:", solReceived, "P&L SOL:", realizedPnlSol);
              pos.totalSolSpent = Math.max(0, totalSolSpent - solSpentPortion);
              STATE.cashSol += solReceived;
              STATE.realizedSol = (STATE.realizedSol || 0) + realizedPnlSol;
              const previousWinStreak = STATE.winStreak || 0;
              const previousLossStreak = STATE.lossStreak || 0;
              if (realizedPnlSol > 0) {
                STATE.winStreak = previousWinStreak + 1;
                STATE.lossStreak = 0;
                STATE.lastTradeWasLoss = false;
                if (STATE.winStreak % 5 === 0) {
                  setTimeout(() => showProfessorCritique("win_streak", STATE.winStreak), 500);
                }
              } else {
                STATE.lossStreak = previousLossStreak + 1;
                STATE.winStreak = 0;
                STATE.lastTradeWasLoss = true;
                if (STATE.lossStreak === 3 || STATE.lossStreak === 5 || STATE.lossStreak > 5 && STATE.lossStreak % 5 === 0) {
                  setTimeout(() => showProfessorCritique("loss_streak", STATE.lossStreak), 500);
                }
                if (previousWinStreak >= 3) {
                  setTimeout(() => showProfessorCritique("loss", previousWinStreak), 800);
                }
              }
              const currentEquity = STATE.cashSol + calcUnrealizedSol() + (STATE.realizedSol || 0);
              const startSol = STATE.startSol || 10;
              const currentMultiplier = Math.floor(currentEquity / startSol);
              const lastMultiplier = STATE.lastPortfolioMultiplier || 1;
              if (currentMultiplier >= 2 && currentMultiplier > lastMultiplier) {
                STATE.lastPortfolioMultiplier = currentMultiplier;
                setTimeout(() => showProfessorCritique("portfolio_multiplier", currentMultiplier), 1200);
              }
              pos.tokenQty -= sellQty;
              const getMarketCapForSell = () => {
                const mcElements = document.querySelectorAll('[class*="mc"], [class*="MarketCap"]');
                for (const el2 of mcElements) {
                  const text = el2.textContent || "";
                  const match = text.match(/\$?([\d,.]+)\s*[KMB]?/i);
                  if (match) {
                    let num = parseFloat(match[1].replace(/,/g, ""));
                    if (text.includes("K"))
                      num *= 1e3;
                    if (text.includes("M"))
                      num *= 1e6;
                    if (text.includes("B"))
                      num *= 1e9;
                    if (num > 1e3)
                      return num;
                  }
                }
                return null;
              };
              const sellMarketCap = getMarketCap();
              if (!STATE.trades)
                STATE.trades = [];
              STATE.trades.push({
                ts: Date.now(),
                side: "SELL",
                symbol,
                mint,
                solSize: solReceived,
                tokenQty: sellQty,
                priceUsd: currentPriceUsd,
                realizedPnlSol,
                pnlSol: realizedPnlSol,
                // For analyzeRecentTrades
                marketCap: sellMarketCap,
                exitMc: sellMarketCap,
                entryMc: pos.entryMarketCap || null,
                entryTs: pos.entryTs || null,
                exitTs: Date.now()
              });
              await saveState();
              updatePnlHud();
              const sellNow = Date.now();
              const entryTs = pos.entryTs || 0;
              const holdTimeMs = sellNow - entryTs;
              const entryMC = pos.entryMarketCap || sellMarketCap;
              const mcRatio = entryMC > 0 ? sellMarketCap / entryMC : 1;
              const pctGainLoss = (mcRatio - 1) * 100;
              if (realizedPnlSol < 0 && holdTimeMs < 3e4) {
                setTimeout(() => showProfessorCritique("quick_exit_loss", holdTimeMs), 500);
              }
              if (realizedPnlSol < 0 && pctGainLoss > -10 && pctGainLoss < -2 && holdTimeMs > 3e4) {
                setTimeout(() => showProfessorCritique("paper_hands", pctGainLoss), 700);
              }
              if (realizedPnlSol < 0 && entryMC > 0) {
                if (holdTimeMs > 12e4 && pctGainLoss > -30 && pctGainLoss < -5) {
                  setTimeout(() => showProfessorCritique("gains_given_back", { maxGain: 0, finalLoss: Math.abs(pctGainLoss) }), 900);
                }
              }
              STATE.sessionTradeCount = (STATE.sessionTradeCount || 0) + 1;
              if (STATE.sessionTradeCount >= 10 && STATE.sessionTradeCount % 5 === 0) {
                setTimeout(() => showProfessorCritique("overtrading", STATE.sessionTradeCount), 1100);
              }
              STATE.lastSellTs = sellNow;
              STATE.lastSellPnl = realizedPnlSol;
              await saveState();
              createTradeMarker("sell", currentPriceUsd, solReceived, sellMarketCap);
              const pnlSign = realizedPnlSol >= 0 ? "+" : "";
              const status = root.querySelector('[data-k="status"]');
              if (status)
                status.textContent = `\u2713 Sold ${sellPct}% @ $${currentPriceUsd.toFixed(6)} (${pnlSign}${fmtSol(realizedPnlSol)} SOL)`;
              if (field)
                field.value = "";
            }
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (el.classList.contains("qbtn")) {
            const val = el.getAttribute("data-v");
            const field = root.querySelector('input[data-k="field"]');
            if (field && val)
              field.value = val;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        });
      }
      if (STATE.buyHudDocked) {
        root.className = "docked";
        root.style.top = "";
        root.style.left = "";
        root.style.right = "";
        root.style.width = "";
      } else {
        root.className = "floating";
        if (STATE.buyHudPos.x > 0) {
          root.style.left = `${STATE.buyHudPos.x}px`;
          root.style.right = "auto";
        } else {
          root.style.right = "18px";
          root.style.left = "";
        }
        root.style.top = `${clamp(STATE.buyHudPos.y || 120, 34, window.innerHeight - 80)}px`;
        root.style.width = "320px";
      }
    }
    function renderQuickButtons(container, labels, values) {
      if (!container)
        return;
      container.innerHTML = labels.map((lab, i) => `<button class="qbtn" data-v="${escapeHtml(values[i])}">${escapeHtml(lab)}</button>`).join("");
    }
    function updateBuyHud() {
      const root = getShadowRoot().getElementById(IDS.buyHud);
      if (!root)
        return;
      const tabs = root.querySelectorAll(".tab");
      tabs.forEach((t) => {
        const tab = t.getAttribute("data-tab");
        t.classList.toggle("active", tab === BUYHUD_TAB);
      });
      const stable = getStableToken();
      const symbol = stable?.symbol || "TOKEN";
      const label = root.querySelector('[data-k="label"]');
      const field = root.querySelector('input[data-k="field"]');
      const action = root.querySelector('button[data-act="action"]');
      const quick = root.querySelector('[data-k="quick"]');
      const status = root.querySelector('[data-k="status"]');
      const editBtn = root.querySelector('button[data-act="edit"]');
      if (editBtn)
        editBtn.textContent = BUYHUD_EDIT ? "Done" : "Edit";
      if (BUYHUD_TAB === "buy") {
        if (label)
          label.textContent = "Buy Amount (SOL)";
        if (field) {
          field.placeholder = "e.g. 0.25";
          field.setAttribute("inputmode", "decimal");
        }
        if (action) {
          action.innerHTML = `ZER\xD8 Buy ${symbol} `;
          action.classList.remove("sell");
        }
        renderQuickButtons(
          quick,
          STATE.quickBuySols.map((n) => `${n} SOL`),
          STATE.quickBuySols.map((n) => String(n))
        );
      } else {
        if (label)
          label.textContent = "Sell Percent (%)";
        if (field) {
          field.placeholder = "e.g. 25";
          field.setAttribute("inputmode", "numeric");
        }
        if (action) {
          action.innerHTML = `ZER\xD8 Sell ${symbol} `;
          action.classList.add("sell");
        }
        renderQuickButtons(
          quick,
          STATE.quickSellPcts.map((n) => `${n}% `),
          STATE.quickSellPcts.map((n) => String(n))
        );
      }
      if (status) {
        status.textContent = STATE.enabled ? "Trades are simulated. Real wallet is not touched." : "ZER\xD8 mode is disabled.";
      }
    }
    function scheduleRender() {
      if (renderScheduled)
        return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        const now = Date.now();
        if (now - lastRenderAt < 250)
          return;
        lastRenderAt = now;
        renderAll();
      });
    }
    function isOurNode(node) {
      if (!(node instanceof HTMLElement))
        return false;
      return node.id === IDS.banner || node.id === IDS.pnlHud || node.id === IDS.buyHud || node.closest?.(`#${IDS.banner}, #${IDS.pnlHud}, #${IDS.buyHud} `) != null;
    }
    function attachObserver() {
      if (observer)
        return;
      observer = new MutationObserver((muts) => {
        if (suppressObserver)
          return;
        for (const m of muts) {
          if (isOurNode(m.target))
            continue;
          scheduleRender();
          break;
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    function renderAll() {
      suppressObserver = true;
      try {
        ensureStyle();
        mountBanner();
        ensureBodyOffsetForBanner();
        mountPnlHud();
        mountBuyHud();
        updateBanner();
        updatePnlHud();
        updateBuyHud();
        sendContextToBridge();
        applyOverlayFontFamily();
      } finally {
        suppressObserver = false;
      }
    }
    async function boot() {
      if (booted)
        return;
      booted = true;
      await loadState();
      const waitForBody = async () => {
        if (document.body)
          return;
        await new Promise((r) => setTimeout(r, 25));
        return waitForBody();
      };
      await waitForBody();
      await new Promise((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => setTimeout(r, 50));
      const injectPageBridge = () => {
        const id = "paper-page-bridge";
        if (document.getElementById(id))
          return;
        const script = document.createElement("script");
        script.id = id;
        script.src = chrome.runtime.getURL("src/page-bridge.js");
        script.type = "text/javascript";
        (document.head || document.documentElement).appendChild(script);
      };
      injectPageBridge();
      renderAll();
      if (!PLATFORM.isPadre) {
        setTimeout(() => {
          attachObserver();
          scheduleRender();
        }, 600);
      } else {
        console.log("[paper:Padre v16] Skipping MutationObserver to avoid React interference");
      }
      if (PLATFORM.isPadre) {
        setTimeout(applyOverlayFontFamily, 2e3);
      } else {
        setTimeout(applyOverlayFontFamily, 1500);
        setTimeout(applyOverlayFontFamily, 4500);
      }
      window.addEventListener("message", (event) => {
        if (event.source !== window)
          return;
        const msg = event.data;
        if (!msg || !msg.__paper)
          return;
        if (msg.type === "PRICE_TICK") {
          handlePriceTick(msg);
        }
      });
      const pollPrice = () => {
        if (!window.location.pathname.includes("/trade/"))
          return;
        const stable = getStableToken();
        if (!stable)
          return;
        const posKey = stable.mint || stable.symbol;
        if (!STATE.positions[posKey] || !STATE.positions[posKey].tokenQty)
          return;
        const currentMC = getMarketCap();
        const pos = STATE.positions[posKey];
        if (currentMC > 0 && pos && pos.impliedSupply > 0) {
          const derivedPrice = currentMC / pos.impliedSupply;
          if (Number.isFinite(derivedPrice) && derivedPrice > 0) {
            const oldPrice = pos.lastPriceUsd;
            if (derivedPrice !== oldPrice) {
              pos.lastPriceUsd = derivedPrice;
              pos.lastPriceTs = Date.now();
              log("Price DERIVED from MC:", derivedPrice, `(MC: ${currentMC})`);
              updatePnlHud();
              return;
            }
          }
        }
        let priceElements = [];
        if (PLATFORM.isPadre) {
          priceElements = Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2")).filter((el) => {
            const text = el.textContent || "";
            const hasSubscript = /[\u2080-\u2089]/.test(text);
            return (hasSubscript || /\$0\.[0-9]{4,}/.test(text)) && el.childElementCount <= 2;
          }).sort((a, b) => {
            const textA = a.textContent || "";
            const textB = b.textContent || "";
            const subA = /[\u2080-\u2089]/.test(textA);
            const subB = /[\u2080-\u2089]/.test(textB);
            if (subA && !subB)
              return -1;
            if (!subA && subB)
              return 1;
            return textB.length - textA.length;
          });
        } else {
          priceElements = Array.from(document.querySelectorAll("span, div")).filter((el) => {
            const text = el.textContent || "";
            return /\$0\.\d{4,}/.test(text) && el.childElementCount === 0;
          }).slice(0, 10);
        }
        for (const el of priceElements) {
          const text = el.textContent || "";
          let price = null;
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
          const subMatch = text.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
          if (subMatch) {
            const extraZeros = subscriptMap[subMatch[1]];
            const digits = subMatch[2];
            const priceStr = "0." + "0".repeat(extraZeros + 1) + digits;
            price = parseFloat(priceStr);
            log("Polling: Parsed subscript price:", text, "\u2192", price);
          } else {
            const stdMatch = text.match(/\$([\d.]+)/);
            if (stdMatch) {
              price = parseFloat(stdMatch[1]);
            }
          }
          if (price && price > 1e-7 && price < 10) {
            const oldPrice = STATE.positions[posKey].lastPriceUsd;
            if (oldPrice !== price) {
              STATE.positions[posKey].lastPriceUsd = price;
              STATE.positions[posKey].lastPriceTs = Date.now();
              log("Price polled from page:", price, "(was:", oldPrice, ")");
              updatePnlHud();
            }
            return;
          }
        }
      };
      setInterval(pollPrice, 1e3);
      window.addEventListener("resize", () => scheduleRender());
    }
    if (PLATFORM.isPadre) {
      log("Padre mode initialized");
      shadowHost = document.createElement("paper-trader-host");
      shadowHost.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;";
      shadowRoot = shadowHost.attachShadow({ mode: "open" });
      const container = document.createElement("div");
      container.id = "paper-shadow-container";
      container.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;";
      shadowRoot.appendChild(container);
      document.documentElement.appendChild(shadowHost);
      const minimalBoot = async () => {
        await loadState();
        const waitForBody = async () => {
          if (document.body)
            return;
          await new Promise((r) => setTimeout(r, 25));
          return waitForBody();
        };
        await waitForBody();
        await new Promise((r) => requestAnimationFrame(() => r()));
        await new Promise((r) => setTimeout(r, 50));
        injectPadreHeaderOffset();
        renderAll();
        log("HUDs mounted");
        const safePollPrice = () => {
          if (!window.location.pathname.includes("/trade/"))
            return;
          const stable = getStableToken();
          if (!stable) {
            log("Price poll: no stable token");
            return;
          }
          const posKey = stable.mint || stable.symbol;
          const hasPosition = STATE.positions[posKey] && STATE.positions[posKey].tokenQty > 0;
          if (!hasPosition) {
            return;
          }
          const parseSubscriptPrice = (text) => {
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
            const match = text.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
            if (match) {
              const extraZeros = subscriptMap[match[1]];
              const digits = match[2];
              const priceStr = "0." + "0".repeat(extraZeros + 1) + digits;
              return parseFloat(priceStr);
            }
            const stdMatch = text.match(/\$([\d.]+)/);
            if (stdMatch) {
              const price = parseFloat(stdMatch[1]);
              if (price > 0 && price < 10)
                return price;
            }
            return null;
          };
          const priceElements = Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2, p.MuiTypography-body1")).filter((el) => {
            const text = el.textContent || "";
            return /\$[\d.]+/.test(text) || /\$0\.0[₀₁₂₃₄₅₆₇₈₉]/.test(text);
          });
          for (const el of priceElements) {
            const price = parseSubscriptPrice(el.textContent || "");
            if (price && price > 1e-7 && price < 10) {
              const oldPrice = STATE.positions[posKey].lastPriceUsd;
              const priceChanged = Math.abs((oldPrice || 0) - price) > 1e-10;
              STATE.positions[posKey].lastPriceUsd = price;
              STATE.positions[posKey].lastPriceTs = Date.now();
              if (priceChanged) {
                log("Price polled:", price.toFixed(10), "(was:", oldPrice?.toFixed(10), ")");
              }
              updatePnlHud();
              return;
            }
          }
        };
        setInterval(safePollPrice, 1e3);
        window.addEventListener("message", (event) => {
          if (event.source !== window)
            return;
          const msg = event.data;
          if (!msg || !msg.__paper)
            return;
          if (msg.type === "PRICE_TICK") {
            handlePriceTick(msg);
          }
        });
        waitForTvWidget(() => {
          log("Rendering stored trade markers...");
          renderTradeMarkers();
        });
      };
      const isOnTradePage2 = () => window.location.pathname.includes("/trade/");
      if (isOnTradePage2()) {
        setTimeout(() => {
          minimalBoot().catch((e) => console.warn("[paper] boot error", e));
        }, 3e3);
      }
      let lastPath = window.location.pathname;
      let lastHref = window.location.href;
      let hudInitialized = false;
      const updateVisibility = () => {
        const banner = shadowRoot?.getElementById?.("paper-mode-banner");
        const pnlHud = shadowRoot?.getElementById?.("paper-pnl-hud");
        const buyHud = shadowRoot?.getElementById?.("paper-buyhud-root");
        const onTrade = isOnTradePage2();
        const display = onTrade ? "" : "none";
        if (banner)
          banner.style.display = display;
        if (pnlHud)
          pnlHud.style.display = display;
        if (buyHud)
          buyHud.style.display = display;
      };
      setInterval(() => {
        const currentPath = window.location.pathname;
        const currentHref = window.location.href;
        if (currentPath !== lastPath || currentHref !== lastHref) {
          log("Navigation:", lastPath, "->", currentPath);
          lastPath = currentPath;
          lastHref = currentHref;
          updateVisibility();
          if (isOnTradePage2() && !hudInitialized) {
            hudInitialized = true;
            setTimeout(() => {
              minimalBoot().catch((e) => console.warn("[paper] boot error", e));
            }, 2e3);
          }
          if (isOnTradePage2() && hudInitialized) {
            setTimeout(() => {
              log("Refreshing HUDs for new token...");
              updatePnlHud();
              updateBuyHud();
            }, 1500);
          }
        }
      }, 500);
    } else {
      boot().catch((e) => console.warn("[paper] boot error", e));
    }
  })();
})();
