(() => {
  "use strict";

  // Platform detection for dual-platform support
  const PLATFORM = {
    isAxiom: window.location.hostname.includes("axiom.trade"),
    isPadre: window.location.hostname.includes("padre.gg"),
    name: window.location.hostname.includes("axiom.trade") ? "Axiom" : "Padre",
  };

  // Track if we've already initialized
  const hasInitialized = false;

  // Check if we're on a trade page
  function isOnTradePage() {
    return window.location.pathname.includes("/trade/");
  }

  const EXT = {
    KEY: "sol_paper_trader_v1",
    VERSION: "0.8.0",
    DEBUG: true,
    PLATFORM: PLATFORM.name,
  };

  const log = (...m) =>
    EXT.DEBUG &&
    console.log(
      `%c[ZERØ ${EXT.VERSION}]`,
      "color: #14b8a6; font-weight: bold; background: #0d1117; padding: 2px 6px; border-radius: 3px;",
      ...m
    );

  // VERY VISIBLE version announcement
  console.log("%c ================================", "color: #14b8a6");
  console.log(
    `%c 🎯 ZERØ Extension v${EXT.VERSION} LOADED 🎯`,
    "color: #14b8a6; font-weight: bold; font-size: 16px; background: #0d1117; padding: 8px 16px; border-radius: 6px;"
  );
  console.log("%c ================================", "color: #14b8a6");

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
    lossStreak: 0, // Track consecutive losses for Professor triggers
    lastPortfolioMultiplier: 1, // Track achieved portfolio multipliers (2x, 3x, etc)
    tokenDisplayUsd: false, // Toggle for Unrealized P&L display
    sessionDisplayUsd: false, // Toggle for Session P&L display
    // Bad habit tracking state
    lastBuyTs: 0, // Timestamp of last buy (for revenge trade detection)
    lastSellTs: 0, // Timestamp of last sell
    lastSellPnl: 0, // P&L of last sell (for revenge trade detection)
    recentBuyTimestamps: [], // Array of recent buy timestamps (for FOMO detection)
    sessionTradeCount: 0, // Count of trades this session (for overtrading)
    sessionStartTs: 0, // When this trading session started
    tutorialCompleted: false, // Flag for Professor walkthrough persistence
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
    if (!Number.isFinite(n)) return "0.0000";
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
      try {
        if (!isChromeStorageAvailable()) return resolve(undefined);
        chrome.storage.local.get([key], (res) => {
          if (chrome.runtime.lastError) {
            console.warn("[paper] Storage get error:", chrome.runtime.lastError.message);
            return resolve(undefined);
          }
          resolve(res[key]);
        });
      } catch (e) {
        console.warn("[paper] Storage get exception:", e.message);
        resolve(undefined);
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve) => {
      try {
        if (!isChromeStorageAvailable()) return resolve();
        chrome.storage.local.set(obj, () => {
          if (chrome.runtime.lastError) {
            console.warn("[paper] Storage set error:", chrome.runtime.lastError.message);
          }
          resolve();
        });
      } catch (e) {
        console.warn("[paper] Storage set exception:", e.message);
        resolve();
      }
    });
  }

  function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const [k, v] of Object.entries(patch)) {
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        base[k] &&
        typeof base[k] === "object"
      ) {
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
    style: "paper-overlay-style",
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
  const tradePanelDockHost = null;

  // --- IMPORTANT: rendering throttle guards (prevents SPA boot blocking)
  let booted = false;
  let observer = null;
  let renderScheduled = false;
  let lastRenderAt = 0;
  let suppressObserver = false;

  // --- Shadow DOM container for React isolation (Padre compatibility)
  // All extension UI is rendered inside a Shadow DOM to avoid interfering with React's virtual DOM
  let shadowHost = null;
  let shadowRoot = null;

  function getShadowRoot() {
    // Return existing shadow root if available
    if (shadowRoot && shadowHost && shadowHost.isConnected) {
      return shadowRoot;
    }

    // Create Shadow DOM host element
    // Host needs full viewport size so children with pointer-events:auto can receive clicks
    shadowHost = document.createElement("paper-trader-host");
    shadowHost.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";

    // Create open shadow root for better event handling
    shadowRoot = shadowHost.attachShadow({ mode: "open" });

    // Add a container inside shadow root for positioning
    // NOTE: pointer-events must allow interaction with HUD elements
    const container = document.createElement("div");
    container.id = "paper-shadow-container";
    container.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;";
    shadowRoot.appendChild(container);

    // Append host to documentElement
    document.documentElement.appendChild(shadowHost);

    log("Shadow DOM created for React isolation");
    return shadowRoot;
  }

  // Helper to get the shadow container for appending elements
  function getShadowContainer() {
    const root = getShadowRoot();
    return root.getElementById("paper-shadow-container") || root;
  }

  async function loadState() {
    const saved = await storageGet(EXT.KEY);
    STATE = deepMerge(DEFAULTS, saved || {});
    STATE.startSol = safeParseFloat(STATE.startSol) || DEFAULTS.startSol;
    if (!Number.isFinite(STATE.cashSol)) STATE.cashSol = STATE.startSol;
    if (!Number.isFinite(STATE.equitySol)) STATE.equitySol = STATE.cashSol;
  }

  async function saveState() {
    await storageSet({ [EXT.KEY]: STATE });
  }

  function ensureStyle() {
    const root = getShadowRoot();
    if (root.getElementById(IDS.style)) return;
    const s = document.createElement("style");
    s.id = IDS.style;
    s.textContent = CSS;
    root.appendChild(s);
  }

  // Inject CSS into main document to push Padre's fixed header down
  function injectPadreHeaderOffset() {
    if (!PLATFORM.isPadre) return;
    const styleId = "paper-padre-offset-style";
    if (document.getElementById(styleId)) return;

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
        if (bf && bf !== "inherit") return bf;
      }
    } catch (e) { /* swallowed */ }

    const rootCandidates = [
      document.querySelector("#root"),
      document.querySelector("[data-testid]"),
      document.querySelector("main"),
      document.querySelector("header"),
    ].filter(Boolean);

    for (const el of rootCandidates) {
      try {
        const ff = getComputedStyle(el).fontFamily;
        if (ff && ff !== "inherit") return ff;
      } catch (e) { /* swallowed */ }
    }

    try {
      const els = Array.from(document.querySelectorAll("button, input, span, div"))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 20 && r.height > 10 && r.top >= 0 && r.left >= 0 && r.top < window.innerHeight
          );
        })
        .slice(0, 40);

      for (const el of els) {
        const ff = getComputedStyle(el).fontFamily;
        if (ff && ff !== "inherit") return ff;
      }
    } catch (e) { /* swallowed */ }

    return "";
  }

  function applyOverlayFontFamily() {
    // V16: Skip on Padre - fonts are already defined in CSS and DOM queries can interfere with React
    if (PLATFORM.isPadre) return;

    const ff = findBestAppFontFamily();
    if (!ff) return;
    const nodes = [
      document.getElementById(IDS.banner),
      document.getElementById(IDS.pnlHud),
      document.getElementById(IDS.buyHud),
    ].filter(Boolean);
    for (const n of nodes) n.style.fontFamily = ff;
  }

  // --- Banner: Push content down to make room for the banner
  // For Padre: We need to push down both the body AND any fixed-positioned headers
  function ensureBodyOffsetForBanner() {
    if (!document.body) return;
    const h = 28;

    // Standard body padding approach
    const body = document.body;
    const prev = body.getAttribute("data-paper-prev-padding-top");
    if (!prev) {
      body.setAttribute("data-paper-prev-padding-top", getComputedStyle(body).paddingTop || "0px");
    }
    const cur = safeParseFloat(getComputedStyle(body).paddingTop);
    if (cur < h) body.style.paddingTop = `${h}px`;

    // Padre-specific: Push down fixed-positioned header elements
    if (PLATFORM.isPadre) {
      body.style.boxSizing = "border-box";
      body.style.minHeight = `calc(100vh + ${h}px)`;
      document.documentElement.style.scrollPaddingTop = `${h}px`;

      // Find and offset the main header/nav bar
      const padreHeader =
        document.querySelector("header") ||
        document.querySelector("nav") ||
        document.querySelector('[class*="Header"]') ||
        document.querySelector('[class*="header"]');
      if (padreHeader) {
        const style = getComputedStyle(padreHeader);
        if (style.position === "fixed" || style.position === "sticky") {
          const currentTop = safeParseFloat(style.top);
          if (currentTop < h) {
            padreHeader.style.top = `${h}px`;
          }
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
    bar.style.pointerEvents = "auto"; // Enable clicks on this element
    bar.innerHTML = `
      <div class="inner" title="Click to toggle ZERØ mode">
        <div class="dot"></div>
        <div class="label">ZERØ MODE</div>
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
    if (!bar) return;
    const stateEl = bar.querySelector(".state");
    if (stateEl) stateEl.textContent = STATE.enabled ? "ENABLED" : "DISABLED";
    bar.classList.toggle("disabled", !STATE.enabled);
  }

  function makeDraggable(handleEl, onMove, onStop) {
    let dragging = false;
    let sx = 0,
      sy = 0;

    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      e.preventDefault();
      e.stopPropagation();
      window.addEventListener("mousemove", move, true);
      window.addEventListener("mouseup", up, true);
    };

    const move = (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      sx = e.clientX; // Update start position for next move
      sy = e.clientY; // Update start position for next move
      onMove(dx, dy);
      e.preventDefault();
      e.stopPropagation();
    };

    const up = async (e) => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener("mousemove", move, true);
      window.removeEventListener("mouseup", up, true);
      if (onStop) await onStop();
      e.preventDefault();
      e.stopPropagation();
    };

    handleEl.addEventListener("mousedown", down);
  }

  // --- Dock host finder (same as before)
  function findTradePanelDockHost() {
    const btns = Array.from(document.querySelectorAll("button")).filter((b) => {
      const t = (b.textContent || "").trim();
      return /^Buy\s+/i.test(t) || /^Sell\s+/i.test(t);
    });

    let best = null;
    let bestScore = 0;
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      if (r.width < 140 || r.height < 28) continue;
      const rightBias = r.left > window.innerWidth * 0.55 ? 1 : 0;
      const score = r.width * r.height + rightBias * 10000;
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (!best) return null;

    let host = best.closest("div");
    for (let i = 0; i < 8 && host; i++) {
      const hasInput = host.querySelector("input") != null;
      const hasManyBtns = host.querySelectorAll("button").length >= 4;
      const rr = host.getBoundingClientRect();
      const okSize = rr.width >= 260 && rr.width <= 520 && rr.height >= 220;
      if (hasInput && hasManyBtns && okSize) return host;
      host = host.parentElement;
    }
    return best.parentElement || null;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getStableToken() {
    let mint = null;
    let symbol = null;

    // Get mint from URL
    try {
      const url = location.href;
      const m = url.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
      if (m) mint = m[1];
    } catch (e) { /* swallowed */ }

    // Try CA: pattern in page (Axiom)
    try {
      const caNodes = Array.from(document.querySelectorAll("div, span, a"))
        .filter((n) => (n.textContent || "").includes("CA:"))
        .slice(0, 8);
      for (const n of caNodes) {
        const t = (n.textContent || "").trim();
        const mm = t.match(/CA:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (mm) {
          mint = mm[1];
          break;
        }
      }
    } catch (e) { /* swallowed */ }

    // Try to get symbol from document.title (Padre format: "TokenName ↓ $X.XXK | Padre")
    try {
      const title = document.title;
      // Padre titles can be "Name | Padre" or "Name ↓ $X.XXK | Terminal"
      if (title && (title.includes("Padre") || title.includes("Terminal"))) {
        const parts = title.split("|");
        if (parts.length >= 1) {
          let name = parts[0].trim();
          // CRITICAL: Strip price/MC suffix like "↓ $6.36K" or "↑ $123.45K"
          // This ensures symbol stays constant regardless of price changes
          name = name.replace(/\s*[↓↑]\s*\$[\d,.]+[KMB]?\s*$/i, "").trim();
          if (name && name.length > 0 && name.length <= 20) {
            symbol = name;
            log("Symbol from title (cleaned):", symbol);
          }
        }
      }
    } catch (e) { /* swallowed */ }

    // Fallback: try h1 element
    if (!symbol) {
      try {
        const h1 = document.querySelector("h1");
        if (h1) {
          // Look for ticker format like "WHALE/SOL" or just "WHALE"
          const t = (h1.textContent || "").trim();
          // Remove known suffixes if present
          const cleanT = t.replace("/SOL", "").replace("Price", "").trim();
          if (cleanT && cleanT.length > 1 && cleanT.length <= 12) symbol = cleanT;
        }
      } catch (e) { /* swallowed */ }
    }

    // Fallback: try "Change symbol" button aria-label
    if (!symbol) {
      try {
        const btn = document.querySelector('button[aria-label="Change symbol"]');
        if (btn) {
          // Button text is usually "Symbol/SOL" e.g. "WhaleGuru/SOL"
          const text = (btn.textContent || "").trim();
          if (text) {
            const clean = text.split("/")[0].trim();
            if (clean && clean.length > 0) {
              symbol = clean;
              log("Symbol from button:", symbol);
            }
          }
        }
      } catch (e) { /* swallowed */ }
    }

    if (!symbol) symbol = "TOKEN";
    return mint ? { mint, symbol } : { mint: null, symbol };
  }

  /**
   * Robust Market Cap extraction (Padre + Axiom)
   * Prioritizes Document Title > Token Header panel > Body
   * CRITICAL: Must exclude ZERØ HUD elements which also show MC
   */
  function getMarketCap() {
    let mc = null;
    try {
      if (PLATFORM.isPadre) {
        // 1. Try Document Title (MOST RELIABLE: "Symbol $123.45K | Terminal")
        const title = document.title || "";
        const titleMatch = title.match(/\$([\d,.]+)\s*([KMB])/i);
        if (titleMatch) {
          mc = parseMcString(titleMatch[1], titleMatch[2]);
          log("[getMarketCap] From title:", mc, `(${title})`);
          return mc;
        }

        // 2. Look for MC in the main content area (NOT in ticker bar or ZERØ HUD)
        // The token header usually shows MC prominently like "$16.4K"
        const mcElements = Array.from(
          document.querySelectorAll("h2.MuiTypography-h2, h2, h1, span, div")
        ).filter((el) => {
          // Skip elements inside ZERØ HUD (shadow root elements or paper-trader-host)
          if (el.closest("paper-trader-host")) return false;
          if (el.closest('[id*="paper"]')) return false;
          if (el.closest('[class*="paper"]')) return false;

          // CRITICAL: Skip ticker bar elements at top of page
          // These show multiple token MCs and would give wrong values
          if (el.closest('[class*="ticker"]')) return false;
          if (el.closest('[class*="Ticker"]')) return false;
          if (el.closest('[class*="trending"]')) return false;
          if (el.closest('[class*="Trending"]')) return false;
          if (el.closest('[class*="scroll"]')) return false; // Scrolling ticker
          if (el.closest('[class*="marquee"]')) return false; // Marquee style ticker

          // Skip elements that are very small (likely in a ticker/list)
          const rect = el.getBoundingClientRect();
          if (rect.height < 12 || rect.width < 30) return false;

          // Skip elements very close to the top (within 50px of top, likely ticker)
          if (rect.top < 50) return false;

          const text = el.textContent || "";
          // Must be a standalone MC value like "$16.4K" not mixed with other text
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
        // Axiom logic (unchanged)
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
    if (unit === "K") num *= 1000;
    if (unit === "M") num *= 1000000;
    if (unit === "B") num *= 1000000000;
    return num;
  }

  /**
   * Get real-time SOL/USD price from the page
   * Terminal shows SOL price in the footer/bottom bar next to a SOL icon
   * NO price range filtering - just find by context
   */
  function getSolPrice() {
    // Try to get cached price first (cache for 10 seconds)
    if (STATE.solPrice && Date.now() - (STATE.solPriceTs || 0) < 10000) {
      return STATE.solPrice;
    }

    let price = null;

    // Strategy 1: Look for SOL icon (image) and get price next to it - MOST RELIABLE
    const solImages = Array.from(document.querySelectorAll("img")).filter((img) => {
      const src = (img.src || "").toLowerCase();
      const alt = (img.alt || "").toLowerCase();
      return (
        (src.includes("solana") ||
          src.includes("sol.") ||
          src.includes("/sol") ||
          alt.includes("sol") ||
          alt.includes("solana")) &&
        img.clientWidth < 50 &&
        img.clientWidth > 8
      );
    });

    for (const img of solImages) {
      // Check parent, grandparent, and great-grandparent for price
      let parent = img.parentElement;
      for (let i = 0; i < 3 && parent && !price; i++) {
        const text = parent.textContent || "";
        // Match any $ price format
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
      if (price) break;
    }

    // Strategy 2: Look in footer/bottom area for SOL + price pattern
    if (!price) {
      const footerSelectors =
        'footer, [class*="footer"], [class*="Footer"], [class*="bottom"], [class*="Bottom"], [class*="status"]';
      const footerElements = document.querySelectorAll(footerSelectors);

      for (const footer of footerElements) {
        const text = (footer.textContent || "").toLowerCase();
        // Look for SOL-related text near a price
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

    // Strategy 3: Search entire page for "SOL $XXX" or "$XXX SOL" patterns
    if (!price) {
      const allText = document.body.innerText;
      const solPriceMatch =
        allText.match(/SOL[:\s]*\$(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)/i) ||
        allText.match(/\$(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)\s*SOL/i);
      if (solPriceMatch) {
        const val = parseFloat(solPriceMatch[1].replace(/,/g, ""));
        if (!isNaN(val) && val > 0) {
          price = val;
          log("[getSolPrice] Found SOL price pattern:", val);
        }
      }
    }

    // Cache valid price
    if (price) {
      STATE.solPrice = price;
      STATE.solPriceTs = Date.now();
      log("[getSolPrice] Using detected price:", price);
      return price;
    }

    // Fallback to last known or default
    const fallback = STATE.solPrice || 200;
    log("[getSolPrice] Using fallback:", fallback);
    return fallback;
  }

  // --- PnL HUD (unchanged look)
  function mountPnlHud() {
    const shadowRt = getShadowRoot();
    const container = getShadowContainer();

    let root = shadowRt.getElementById(IDS.pnlHud);

    // Visibility check
    if (!STATE.enabled) {
      if (root) root.style.display = "none";
      // If root doesn't exist, we don't create it
      return;
    }
    if (root) root.style.display = ""; // Reset display

    if (!root) {
      root = document.createElement("div");
      root.id = IDS.pnlHud;
      root.style.pointerEvents = "auto";
      root.innerHTML = `
        <div class="card">
          <div class="header">
            <div class="title"><span class="dot"></span> ZERØ PNL <span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);">TOKEN</span></div>
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

      // drag only when floating
      const header = root.querySelector(".header");
      makeDraggable(
        header,
        (dx, dy) => {
          if (STATE.pnlDocked) return;
          STATE.pnlPos.x += dx;
          STATE.pnlPos.y += dy;
          STATE.pnlPos.x = clamp(STATE.pnlPos.x, 0, window.innerWidth - 40);
          STATE.pnlPos.y = clamp(STATE.pnlPos.y, 34, window.innerHeight - 40);
          root.style.left = `${STATE.pnlPos.x}px`;
          root.style.top = `${STATE.pnlPos.y}px`;
        },
        async () => {
          if (!STATE.pnlDocked) await saveState();
        }
      );

      root.addEventListener("click", async (e) => {
        const t = e.target;

        // Allow input focus/interaction (broaden check)
        if (t.matches && t.matches("input, textarea, label, .startSolInput")) return;

        // Walk up DOM tree to find element with data-act
        const actEl = t.closest("[data-act]");
        const act = actEl?.getAttribute("data-act");

        log("PNL HUD click:", t.tagName, t.className, "act:", act);
        if (!(t instanceof HTMLElement)) return;
        if (act === "dock") {
          STATE.pnlDocked = !STATE.pnlDocked;
          await saveState();
          if (PLATFORM.isPadre) {
            renderAll(); // Direct call since MutationObserver is disabled
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

          // Create custom modal since window.confirm is blocked
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

          // Append to shadow root
          getShadowRoot().appendChild(overlay);

          const removeModal = () => overlay.remove();

          // Event listeners
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
            if (list) updateTradeList(list);
            removeModal();
          });

          // Click outside to close
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
          // Toggle between SOL and USD display for token value
          STATE.tokenDisplayUsd = !STATE.tokenDisplayUsd;
          await saveState();
          updatePnlHud();
          e.preventDefault();
          e.stopPropagation();
        }
        if (act === "toggleSessionUnit") {
          // Toggle between SOL and USD display for session P&L
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

    // dock state
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

  /**
   * Calculates unrealized P&L in SOL using Market Cap ratio
   * This is the most accurate method because MC is directly visible on the page
   * Formula: Current Position Value = SOL Spent × (Current MC / Entry MC)
   * Unrealized P&L = Current Value - SOL Spent
   */
  function calcUnrealizedSol() {
    let totalUnrealizedSol = 0;
    const posMap = STATE.positions || {};
    const currentMC = getMarketCap();
    const now = Date.now();

    const getLiveMarketCap = (pos) => {
      if (!pos) return 0;
      const impliedSupply = Number(pos.impliedSupply || 0);
      const lastPriceUsd = Number(pos.lastPriceUsd || 0);
      const lastPriceTs = Number(pos.lastPriceTs || 0);
      const derivedMc = impliedSupply > 0 && lastPriceUsd > 0 ? impliedSupply * lastPriceUsd : 0;

      // Prefer derived MC from fresh price ticks for instant P&L updates
      if (derivedMc > 0 && lastPriceTs > 0 && now - lastPriceTs <= 3000) {
        return derivedMc;
      }

      return currentMC || 0;
    };

    for (const p of Object.values(posMap)) {
      if (!p || !p.tokenQty || p.tokenQty <= 0) continue;

      const totalSolSpent = Number(p.totalSolSpent || 0);
      const entryMC = Number(p.entryMarketCap || 0);
      const liveMC = getLiveMarketCap(p);

      // Method 1: MC Ratio (MOST ACCURATE when both MCs are available)
      if (liveMC > 0 && entryMC > 0 && totalSolSpent > 0) {
        const mcRatio = liveMC / entryMC;
        const currentValueSol = totalSolSpent * mcRatio;
        const unrealizedPnl = currentValueSol - totalSolSpent;

        log("[calcUnrealizedSol] MC Ratio method:", {
          entryMC: entryMC.toFixed(0),
          currentMC: liveMC.toFixed(0),
          mcRatio: mcRatio.toFixed(4),
          totalSolSpent: totalSolSpent.toFixed(4),
          currentValueSol: currentValueSol.toFixed(4),
          unrealizedPnl: unrealizedPnl.toFixed(4),
        });

        totalUnrealizedSol += unrealizedPnl;
        continue;
      }

      // Method 2: Fallback to price-based calculation if MC not available
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
          unrealizedPnl: unrealizedPnl.toFixed(4),
        });

        totalUnrealizedSol += unrealizedPnl;
      }
    }

    return totalUnrealizedSol;
  }

  /**
   * Analyzes recent trades and returns insights
   */
  function analyzeRecentTrades() {
    const trades = STATE.trades || [];
    if (trades.length === 0) return null;

    // Get last 10 trades
    const recentTrades = trades.slice(-10);

    let wins = 0,
      losses = 0;
    let totalHoldTimeMs = 0;
    let totalPnlSol = 0;
    let avgEntryMc = 0,
      avgExitMc = 0;
    let entryMcCount = 0,
      exitMcCount = 0;
    let quickFlips = 0; // trades < 60 seconds
    let longHolds = 0; // trades > 10 minutes

    for (const trade of recentTrades) {
      if (trade.pnlSol > 0) wins++;
      else losses++;

      totalPnlSol += trade.pnlSol || 0;

      if (trade.entryTs && trade.exitTs) {
        const holdTime = trade.exitTs - trade.entryTs;
        totalHoldTimeMs += holdTime;
        if (holdTime < 60000) quickFlips++;
        if (holdTime > 600000) longHolds++;
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

    const avgHoldTimeSec =
      recentTrades.length > 0 ? totalHoldTimeMs / recentTrades.length / 1000 : 0;
    avgEntryMc = entryMcCount > 0 ? avgEntryMc / entryMcCount : 0;
    avgExitMc = exitMcCount > 0 ? avgExitMc / exitMcCount : 0;
    const winRate = recentTrades.length > 0 ? (wins / recentTrades.length) * 100 : 0;

    // Determine trading style
    let style = "balanced";
    if (quickFlips > recentTrades.length * 0.6) style = "scalper";
    else if (longHolds > recentTrades.length * 0.4) style = "swing";
    else if (avgEntryMc < 100000) style = "degen";
    else if (avgEntryMc > 500000) style = "conservative";

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
      longHolds,
    };
  }

  /**
   * Shows the Professor critique popup with trade analysis
   * @param {string} trigger - 'loss', 'achievement', 'win_streak', 'loss_streak', 'portfolio_multiplier'
   * @param {number} value - streak count, multiplier value, or previous streak
   */
  function showProfessorCritique(trigger, value) {
    const analysis = analyzeRecentTrades();
    const container = getShadowContainer();
    if (!container) return;

    // Get professor image URL
    const professorImgUrl =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("src/professor.png")
        : "";

    // Trading style for tips
    const style = analysis?.style || "balanced";

    // Style-specific tips that can be appended to messages
    const styleTips = {
      scalper: [
        "💡 Tip: Scalping works best in high-volume markets. Watch those fees!",
        "💡 Tip: Consider setting a 5-trade limit per hour to avoid overtrading.",
        "💡 Tip: Quick flips need quick reflexes. Always have an exit plan!",
      ],
      swing: [
        "💡 Tip: Setting a trailing stop can protect your swing trade profits.",
        "💡 Tip: Patient hands make the most gains. Trust your analysis!",
        "💡 Tip: Consider scaling out in 25% chunks to lock in profits.",
      ],
      degen: [
        "💡 Tip: Micro-caps are fun but size down! Never risk more than 5% on a single play.",
        "💡 Tip: In degen territory, the first green candle is often the exit signal.",
        "💡 Tip: Set a hard stop at -50%. Live to degen another day!",
      ],
      conservative: [
        "💡 Tip: Your conservative style keeps you in the game. Consider a small moon bag!",
        "💡 Tip: Larger caps mean smaller moves. Patience is your superpower.",
        "💡 Tip: Consider allocating 10% to higher-risk plays for balance.",
      ],
      balanced: [
        "💡 Tip: Your balanced approach is sustainable. Keep mixing risk levels!",
        "💡 Tip: Track your best-performing market cap range and lean into it.",
        "💡 Tip: Journal your winners - patterns emerge over time!",
      ],
    };

    const getRandomTip = () => {
      const tips = styleTips[style] || styleTips.balanced;
      return tips[Math.floor(Math.random() * tips.length)];
    };

    // Generate message based on trigger
    let title, message;
    const currentEquity = STATE.cashSol + calcUnrealizedSol() + (STATE.realizedSol || 0);

    if (trigger === "portfolio_multiplier") {
      const multiplier = value;
      const startSol = STATE.startSol || 10;

      if (multiplier === 2) {
        title = "🎉 PORTFOLIO DOUBLED!";
        const messages = [
          `You turned ${startSol} SOL into ${currentEquity.toFixed(2)} SOL! That's 2x gains!`,
          `DOUBLED! From ${startSol} to ${currentEquity.toFixed(2)} SOL. This is what smart trading looks like!`,
          `2X ACHIEVED! You've officially doubled your paper port. Time to lock in some gains?`,
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      } else if (multiplier === 3) {
        title = "🚀 3X PORTFOLIO!";
        const messages = [
          `INCREDIBLE! Your ${startSol} SOL is now ${currentEquity.toFixed(2)} SOL!`,
          `3X GAINS! You're trading like a pro. Consider taking 50% off to secure profits!`,
          `Triple your money! This is rare air - protect these gains!`,
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      } else {
        title = `🔥 ${multiplier}X PORTFOLIO!`;
        const messages = [
          `${multiplier}X GAINS! From ${startSol} to ${currentEquity.toFixed(2)} SOL! You're on FIRE!`,
          `LEGENDARY! ${multiplier}x returns! But remember - pigs get slaughtered. Take profits!`,
          `${multiplier}X! You're trading at god-tier levels. Don't give it all back!`,
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      }
      message += "\n\n" + getRandomTip();
    } else if (trigger === "win_streak") {
      const streak = value;

      if (streak === 5) {
        title = "🔥 5 Win Streak!";
        const messages = [
          "5 wins in a row! You're finding your rhythm. The market is speaking and you're listening!",
          "Halfway to legendary! Your entries are on point. Keep that discipline!",
          "FIVE straight wins! Your style is clicking. Ride this wave but don't get cocky!",
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      } else if (streak === 10) {
        title = "🏆 10 Win Streak!";
        const messages = [
          "10-win streak! You're reading the market like a book!",
          "DOUBLE DIGITS! Your patience and timing are elite. This is what consistent profitability looks like!",
          "TEN straight winners! You've earned legendary status. But the market humbles everyone eventually...",
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      } else if (streak === 15) {
        title = "👑 15 Win Streak!";
        const messages = [
          "15 STRAIGHT WINS?! You've unlocked god mode! But remember, every streak ends eventually.",
          "FIFTEEN! This is insane discipline. You're trading at a level most only dream of!",
          "15 wins in a row! The market bows to you. Stay humble, stay hungry!",
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      } else {
        title = `🌟 ${streak} Win Streak!`;
        const messages = [
          `${streak} consecutive wins! You've transcended normal trading. Absolute legend status!`,
          `${streak} WINS?! This is historic. Screenshot this moment!`,
          `${streak} straight! At this point, you're teaching the market lessons!`,
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      }
      message += "\n\n" + getRandomTip();
    } else if (trigger === "loss_streak") {
      const streak = value;

      if (streak === 3) {
        title = "⚠️ 3 Loss Streak";
        const messages = [
          "3 losses in a row. Time to step back and analyze your entries. The market is giving you feedback!",
          "Tough run! Consider reducing size until you find your groove again. Protect your capital!",
          "Three straight losses. Take a breath - revenge trading only makes it worse.",
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      } else if (streak === 5) {
        title = "🛑 5 Loss Streak";
        const messages = [
          "5 straight losses. The market is telling you something - are you listening?",
          "This is where discipline matters most. Don't revenge trade! Step away if needed.",
          "FIVE losses. Time for a break. Review your trades, find the pattern, then come back stronger.",
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      } else {
        title = `😰 ${streak} Loss Streak`;
        const messages = [
          `${streak} losses... This is painful but not permanent. Take a serious break and reset mentally.`,
          `${streak} in a row. The market is ruthless. Reduce size dramatically or pause entirely.`,
          `${streak} straight losses. Every trader has these moments. Your response defines you!`,
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
      }

      // Add style-specific loss advice
      const lossAdvice = {
        scalper: "As a scalper, consider slowing down. Fewer trades can mean better trades.",
        swing: "Your swing style means each loss hurts more. Tighten those stop losses!",
        degen: "Degen plays have high variance. This streak might just be the nature of the game.",
        conservative: "Even with safe plays, streaks happen. Your risk management will save you!",
        balanced: "Bad streaks happen to everyone. Review and adjust, don't abandon your strategy.",
      };
      message += "\n\n" + (lossAdvice[style] || lossAdvice.balanced);
    } else if (trigger === "quick_exit_loss") {
      // value = hold time in seconds
      const holdSec = Math.round(value / 1000);
      title = "⚡ Panic Sell Detected";
      const messages = [
        `You exited after only ${holdSec} seconds with a loss. Panic selling rarely pays off!`,
        `${holdSec} second hold time? That's not trading, that's gambling! Give positions time to breathe.`,
        `Lightning-fast exit into a loss. Ask yourself: Did the thesis change, or did you just panic?`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message +=
        "\n\n💡 Tip: Set a minimum hold time (like 2-3 minutes) before allowing yourself to exit.";
    } else if (trigger === "fomo_buying") {
      // value = number of buys in short period
      title = "🏃 FOMO Detected!";
      const messages = [
        `${value} buys in under 2 minutes? Slow down! FOMO is the #1 account killer.`,
        `Rapid-fire buying detected! Each trade should be deliberate, not reactive.`,
        `You're buying faster than you're thinking. Take a breath between entries!`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message +=
        "\n\n💡 Tip: Wait 30 seconds between trades. If you still want in after that, it's probably okay.";
    } else if (trigger === "revenge_trade") {
      // value = seconds since last loss
      const secSinceLoss = Math.round(value / 1000);
      title = "😤 Revenge Trade Alert!";
      const messages = [
        `Buying ${secSinceLoss}s after a loss? That's revenge trading - the fastest way to blow up!`,
        `I see you jumping back in immediately after losing. This rarely ends well!`,
        `Revenge trading detected! The market doesn't care about your last loss.`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message += "\n\n💡 Tip: After a loss, take a 5-minute break. Walk away from the screen.";
    } else if (trigger === "overtrading") {
      // value = trade count
      title = "📊 Overtrading Warning";
      const messages = [
        `${value} trades this session! Quality over quantity - each trade has fees and risk.`,
        `Are you trading or just clicking buttons? ${value} trades is a lot!`,
        `${value} trades already. The best traders often make fewer, more calculated moves.`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message += "\n\n💡 Tip: Set a daily trade limit (like 5-10) and stick to it.";
    } else if (trigger === "paper_hands") {
      // value = percentage loss (negative number like -5)
      const pctLoss = Math.abs(value).toFixed(1);
      title = "🧻 Paper Hands Warning";
      const messages = [
        `Exiting at just -${pctLoss}%? Successful traders give positions room to breathe!`,
        `A ${pctLoss}% dip scared you out? Volatility is normal - set wider stops!`,
        `Sold at -${pctLoss}%... This could have easily recovered. Patience is profit!`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message += "\n\n💡 Tip: Define your max loss BEFORE entering (like -20%) and stick to it.";
    } else if (trigger === "pump_chaser") {
      // value = object with entryMc, currentMc info
      title = "🎢 Pump Chaser Alert";
      const messages = [
        `You bought into an already-pumped token and got dumped on. Classic pump chase!`,
        `Chasing green candles = buying someone else's bags. Entry timing matters!`,
        `This token had already run up significantly before your entry. Let the FOMO go!`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message += "\n\n💡 Tip: Look for tokens with consolidation, not tokens mid-pump.";
    } else if (trigger === "averaging_down") {
      // value = percentage down when adding
      const pctDown = Math.abs(value).toFixed(1);
      title = "⚠️ Averaging Down Alert";
      const messages = [
        `Adding to a position that's -${pctDown}% down? Averaging down works until it doesn't!`,
        `Buying more of a loser at -${pctDown}%... Are you doubling down on a bad thesis?`,
        `Adding to a red position. Make sure you're not just hoping for a recovery!`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message += "\n\n💡 Tip: Only average into winners. Cut losers, add to winners.";
    } else if (trigger === "gains_given_back") {
      // value = object with maxGain, finalLoss
      const maxGain = value.maxGain?.toFixed(1) || "??";
      const finalLoss = Math.abs(value.finalLoss || 0).toFixed(1);
      title = "💸 Gains Given Back!";
      const messages = [
        `You were up +${maxGain}% and let it turn into -${finalLoss}%! Set trailing stops!`,
        `From +${maxGain}% to -${finalLoss}%... That's a painful round trip. Take profits earlier!`,
        `Max gain was +${maxGain}% but you held until -${finalLoss}%. Greed kills!`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message += "\n\n💡 Tip: Once up 20%+, set a trailing stop or take partial profits.";
    } else if (trigger === "big_win") {
      // value = percentage gain (e.g., 100 for 100%)
      const pctGain = value.toFixed(0);
      title = "🎉 Big Win!";
      const messages = [
        `+${pctGain}% on that trade! Incredible. Now's the time to breathe and NOT revenge buy something else.`,
        `${pctGain}% profit! You crushed it. Take a moment to celebrate - then step away for 10 minutes.`,
        `MASSIVE WIN at +${pctGain}%! Don't let this go to your head. Overconfidence is the silent killer.`,
        `+${pctGain}% secured! The adrenaline high is real, but calm traders make more money over time.`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message +=
        "\n\n💡 Pro Tip: After a big win, take a break. Your next trade is likely to be overconfident and poorly timed.";
    } else if (trigger === "big_loss") {
      // value = percentage loss (e.g., -50 for -50%)
      const pctLoss = Math.abs(value).toFixed(0);
      title = "💔 Tough Loss";
      const messages = [
        `-${pctLoss}% is painful. Take a breath. The market will be here tomorrow.`,
        `Down ${pctLoss}% on that one. Shake it off. Every pro trader has these days.`,
        `A -${pctLoss}% hit stings. Now is NOT the time to revenge trade. Walk away for 15 minutes.`,
        `Ouch, -${pctLoss}%. This is where amateurs blow up trying to make it back. Don't be that guy.`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
      message +=
        "\n\n💡 Pro Tip: After a big loss, your judgment is impaired. Step away from the screen and do something else.";
    } else if (trigger === "achievement") {
      title = "🏆 Incredible Achievement!";
      const achievementMessages = [
        "Remarkable! A 10-win streak shows true discipline. You've mastered the art of knowing when to take profits!",
        "Outstanding work, trader! Your consistency is legendary. Keep that winning momentum going!",
        "Phenomenal streak! You're reading the market like a pro. Remember, the key is sustainable success!",
      ];
      message = achievementMessages[Math.floor(Math.random() * achievementMessages.length)];
      message += "\n\n" + getRandomTip();
    } else {
      // Default loss trigger (streak ended)
      title = "📊 Trade Analysis";
      const lossMessages = {
        scalper: [
          "I see you're a fast trader! Quick flips can be profitable, but watch out for overtrading fees eating into gains.",
          "Speed is your game! Consider adding a cooldown between trades to avoid emotional decisions.",
          "Rapid-fire trading detected! Remember, sometimes the best trade is no trade at all.",
        ],
        swing: [
          "You like to hold positions. Make sure you're setting proper stop losses to protect those gains!",
          "Patient trader, I see! Consider taking partial profits along the way to lock in gains.",
          "Long holds can be rewarding, but don't let winners turn into losers. Set exit targets!",
        ],
        degen: [
          "Low market cap plays are high risk! Consider sizing down on these volatile micro-caps.",
          "I see you like the small caps! Exciting, but remember - most of these go to zero. Size wisely!",
          "Degen mode activated! Just remember, it's okay to take profits on the way up.",
        ],
        conservative: [
          "You trade safer market caps. Good discipline! But sometimes a bit of risk brings reward.",
          "Conservative approach noted. Consider allocating a small portion to higher-risk plays.",
          "Steady trading style! Your risk management is solid. Keep building those consistent gains.",
        ],
        balanced: [
          "Your streak ended, but that's part of the game. Review what made this trade different.",
          "Every loss is a lesson! Look at your entry timing and market conditions.",
          "The market humbled you today. Take a moment to analyze before the next trade.",
        ],
      };

      const styleMessages = lossMessages[style] || lossMessages.balanced;
      message = styleMessages[Math.floor(Math.random() * styleMessages.length)];

      if (value > 0) {
        message = `Your ${value}-win streak has ended. ` + message;
      }
    }

    // Build stats section if we have analysis
    let statsHtml = "";
    if (analysis && analysis.totalTrades > 0) {
      const formatMc = (mc) => {
        if (mc >= 1000000) return `$${(mc / 1000000).toFixed(1)}M`;
        if (mc >= 1000) return `$${(mc / 1000).toFixed(0)}K`;
        return `$${mc.toFixed(0)}`;
      };
      const formatTime = (sec) => {
        if (sec >= 3600) return `${(sec / 3600).toFixed(1)}h`;
        if (sec >= 60) return `${(sec / 60).toFixed(1)}m`;
        return `${sec.toFixed(0)}s`;
      };

      statsHtml = `
        <div class="professor-stats">
          <div>📈 Win Rate: <span>${analysis.winRate}%</span> (${analysis.wins}W / ${analysis.losses}L)</div>
          <div>⏱️ Avg Hold Time: <span>${formatTime(analysis.avgHoldTimeSec)}</span></div>
          ${analysis.avgEntryMc > 0 ? `<div>🎯 Avg Entry MC: <span>${formatMc(analysis.avgEntryMc)}</span></div>` : ""}
          <div>💰 Session P&L: <span style="color:${analysis.totalPnlSol >= 0 ? "#10b981" : "#ef4444"}">${analysis.totalPnlSol >= 0 ? "+" : ""}${analysis.totalPnlSol.toFixed(4)} SOL</span></div>
          <div>🎮 Style: <span>${analysis.style.charAt(0).toUpperCase() + analysis.style.slice(1)}</span></div>
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

    // Add dismiss handler
    overlay.querySelector(".professor-dismiss").addEventListener("click", () => {
      overlay.style.animation = "professorFadeIn 0.2s ease-out reverse";
      setTimeout(() => overlay.remove(), 200);
    });

    // Also dismiss on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.style.animation = "professorFadeIn 0.2s ease-out reverse";
        setTimeout(() => overlay.remove(), 200);
      }
    });

    log("Professor critique shown:", trigger, value);
  }

  // --- TUTORIAL LOGIC ---
  const TUTORIAL_CSS = `
    .professor-overlay.tutorial-mode {
      background: transparent !important;
      pointer-events: none !important;
    }
    .professor-overlay.tutorial-mode .professor-container {
      pointer-events: auto !important;
    }
    .highlight-active {
      outline: 3px solid #14b8a6 !important;
      outline-offset: 4px !important;
      box-shadow: 0 0 30px rgba(20,184,166,0.8) !important;
      animation: highlightGlow 1.5s ease-in-out infinite !important;
    }
    @keyframes highlightGlow {
      0%, 100% { outline-color: #14b8a6; box-shadow: 0 0 20px rgba(20,184,166,0.6); }
      50% { outline-color: #5eead4; box-shadow: 0 0 40px rgba(20,184,166,1); }
    }
  `;

  function ensureTutorialStyle() {
    const root = getShadowRoot();
    if (root.getElementById("paper-tutorial-style")) return;
    const style = document.createElement("style");
    style.id = "paper-tutorial-style";
    style.textContent = TUTORIAL_CSS;
    root.appendChild(style);
  }
  const TUTORIAL_STEPS = [
    {
      title: "👋 Welcome to ZERØ!",
      message:
        "I'm Professor Zero, and I'm here to help you master Solana trading without risking a single penny!<br><br>This is a <b>Paper Trading Simulation</b>. Everything looks real, but your wallet is completely safe.",
      highlightId: null,
    },
    {
      title: "🛡️ Zero Risk, Real Data",
      message:
        "See that overlay? That's your command center.<br><br>We use <b>real-time market data</b> to simulate exactly what would happen if you traded for real. Same prices, same thrills, zero risk.",
      highlightId: IDS.banner,
    },
    {
      title: "📊 Your P&L Tracker",
      message:
        "Keep an eye on the <b>P&L (Profit & Loss)</b> bar.<br><br>It tracks your wins and losses in real-time. I'll pop in occasionally to give you tips!<br><br>⚠️ The <b>RESET</b> button clears your entire session - balance, trades, and P&L.",
      highlightId: IDS.pnlHud,
    },
    {
      title: "💸 Buying & Selling",
      message:
        "Use the <b>HUD Panel</b> to place trades.<br><br>Enter an amount and click <b>BUY</b>. When you're ready to exit, switch to the <b>SELL</b> tab.<br><br>Try to build your 10 SOL starting balance into a fortune!",
      highlightId: IDS.buyHud,
    },
    {
      title: "🚀 Ready to Trade?",
      message:
        "That's it! You're ready to hit the markets.<br><br>Remember: The goal is to learn. Don't be afraid to make mistakes here—that's how you get better.<br><br><b>Good luck, trader!</b>",
      highlightId: null,
    },
  ];

  function showProfessorTutorial(stepIndex = 0) {
    const container = getShadowContainer();
    if (!container) return;

    // Get professor image URL
    const professorImgUrl =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("src/professor.png")
        : "";

    const step = TUTORIAL_STEPS[stepIndex];
    if (!step) return; // Should not happen

    // Remove existing if any (for next step transition)
    const existing = container.querySelector(".professor-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "professor-overlay";
    // Add specific class for tutorial to maybe style differently if needed
    overlay.classList.add("tutorial-mode");

    const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
    const btnText = isLastStep ? "Let's Go! 🚀" : "Next ➡️";

    overlay.innerHTML = `
      <div class="professor-container">
        ${professorImgUrl ? `<img class="professor-image" src="${professorImgUrl}" alt="Professor">` : ""}
        <div class="professor-bubble">
          <div class="professor-title">${step.title}</div>
          <div class="professor-message">${step.message}</div>
          <div class="professor-stats" style="margin-top:10px;text-align:right;color:#64748b;font-size:12px;">
            Step ${stepIndex + 1} of ${TUTORIAL_STEPS.length}
          </div>
          <button class="professor-dismiss">${btnText}</button>
        </div>
      </div>
    `;

    container.appendChild(overlay);

    // Handle Next/Finish
    overlay.querySelector(".professor-dismiss").addEventListener("click", async () => {
      if (isLastStep) {
        // Finish
        overlay.style.animation = "professorFadeIn 0.2s ease-out reverse";
        setTimeout(() => overlay.remove(), 200);

        // Save completion state
        STATE.tutorialCompleted = true;
        await saveState();

        // Show a quick toast or just let them trade
        log("Tutorial completed.");
      } else {
        // Next step
        showProfessorTutorial(stepIndex + 1);
      }
    });
  }

  function showProfessorTutorial2(stepIndex = 0) {
    const container = getShadowContainer();
    const shadowRoot = getShadowRoot();
    if (!container || !shadowRoot) return;

    ensureTutorialStyle();

    // Get professor image URL
    const professorImgUrl =
      typeof chrome !== "undefined" && chrome.runtime?.getURL
        ? chrome.runtime.getURL("src/professor.png")
        : "";

    const step = TUTORIAL_STEPS[stepIndex];
    if (!step) return;

    // --- manage highlight ---

    // 2. Clear previous highlights
    const highlighted = container.querySelectorAll(".highlight-active");
    highlighted.forEach((el) => el.classList.remove("highlight-active"));

    // 3. Apply new highlight if ID exists
    if (step.highlightId) {
      const target = shadowRoot.getElementById(step.highlightId);
      if (target) {
        target.classList.add("highlight-active");
      }
    }

    // --- manage overlay ---

    // Remove existing overlay
    const existing = container.querySelector(".professor-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "professor-overlay";
    overlay.classList.add("tutorial-mode");

    const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
    const btnText = isLastStep ? "Let's Go! 🚀" : "Next ➡️";

    overlay.innerHTML = `
      <div class="professor-container">
        ${professorImgUrl ? `<img class="professor-image" src="${professorImgUrl}" alt="Professor">` : ""}
        <div class="professor-bubble">
          <div class="professor-title">${step.title}</div>
          <div class="professor-message">${step.message}</div>
          <div class="professor-stats" style="margin-top:10px;text-align:right;color:#64748b;font-size:12px;">
            Step ${stepIndex + 1} of ${TUTORIAL_STEPS.length}
          </div>
          <button class="professor-dismiss">${btnText}</button>
        </div>
      </div>
    `;

    container.appendChild(overlay);

    // Handle Next/Finish
    overlay.querySelector(".professor-dismiss").addEventListener("click", async () => {
      if (isLastStep) {
        // Finish
        overlay.style.animation = "professorFadeIn 0.2s ease-out reverse";
        setTimeout(() => overlay.remove(), 200);

        // Remove highlights
        const highlighted = container.querySelectorAll(".highlight-active");
        highlighted.forEach((el) => el.classList.remove("highlight-active"));

        // Save completion state
        STATE.tutorialCompleted = true;
        await saveState();

        log("Tutorial completed.");
      } else {
        // Next step
        showProfessorTutorial2(stepIndex + 1);
      }
    });
  }

  function updatePnlHud() {
    const root = getShadowRoot().getElementById(IDS.pnlHud);
    if (!root) return;

    const unrealized = calcUnrealizedSol();
    const realized = Number(STATE.realizedSol || 0);
    const cash = Number(STATE.cashSol || 0);
    const solUsdPrice = getSolPrice();

    // Use actual unrealized value - removed aggressive sanity check that was hiding real price action
    // Small PNL changes (even $1K) should reflect in the display to match Axiom behavior
    const safeUnrl = unrealized;

    // Calculate balance (cash only - not including positions)
    const balance = cash;

    // Calculate total session P&L (unrealized + realized)
    const totalPnl = safeUnrl + realized;

    log("[updatePnlHud] P&L Breakdown:", {
      startSol: STATE.startSol,
      cashSol: cash.toFixed(4),
      unrealizedPnl: safeUnrl.toFixed(4),
      realizedPnl: realized.toFixed(4),
      sessionPnl: totalPnl.toFixed(4),
      solUsdPrice: solUsdPrice,
    });

    // Calculate token value (current value of all positions)
    let tokenValueSol = 0;
    let tokenValueUsd = 0;
    for (const pos of Object.values(STATE.positions || {})) {
      if (pos && pos.tokenQty > 0 && pos.lastPriceUsd > 0) {
        const valueUsd = pos.tokenQty * pos.lastPriceUsd;
        tokenValueUsd += valueUsd;
        tokenValueSol += valueUsd / solUsdPrice;
      }
    }

    // Update balance
    const balanceEl = root.querySelector('[data-k="balance"]');
    if (balanceEl) balanceEl.textContent = `${fmtSol(balance)} SOL`;

    // Calculate unrealized percentage for display
    // percentage = (currentMC / entryMC - 1) * 100
    let unrealizedPct = 0;
    const currentMC = getMarketCap();
    const now = Date.now();
    for (const p of Object.values(STATE.positions || {})) {
      if (p && p.tokenQty > 0 && p.entryMarketCap > 0) {
        const impliedSupply = Number(p.impliedSupply || 0);
        const lastPriceUsd = Number(p.lastPriceUsd || 0);
        const lastPriceTs = Number(p.lastPriceTs || 0);
        const derivedMc = impliedSupply > 0 && lastPriceUsd > 0 ? impliedSupply * lastPriceUsd : 0;
        const liveMC =
          derivedMc > 0 && lastPriceTs > 0 && now - lastPriceTs <= 3000 ? derivedMc : currentMC;
        if (liveMC > 0) {
          unrealizedPct = (liveMC / p.entryMarketCap - 1) * 100;
          break; // Use the first active position's percentage
        }
      }
    }

    // Update unrealized P&L (first stat - with USD/SOL toggle, color coding, AND percentage)
    const tokenValueEl = root.querySelector('[data-k="tokenValue"]');
    const tokenUnitEl = root.querySelector('[data-k="tokenUnit"]');
    if (tokenValueEl) {
      const sign = safeUnrl >= 0 ? "+" : "";
      const pctSign = unrealizedPct >= 0 ? "+" : "";
      const pctStr = unrealizedPct !== 0 ? ` (${pctSign}${unrealizedPct.toFixed(1)}%)` : "";

      if (STATE.tokenDisplayUsd) {
        const unrealizedUsd = safeUnrl * solUsdPrice;
        tokenValueEl.textContent = `${sign}$${Math.abs(unrealizedUsd).toFixed(2)}${pctStr}`;
        if (tokenUnitEl) tokenUnitEl.textContent = "USD";
      } else {
        // Reduce decimal places to make room for percentage
        const solStr = Math.abs(safeUnrl).toFixed(3);
        tokenValueEl.textContent = `${sign}${solStr} SOL${pctStr}`;
        if (tokenUnitEl) tokenUnitEl.textContent = "SOL";
      }
      tokenValueEl.style.color = safeUnrl >= 0 ? "#10b981" : "#ef4444";
    }

    // Update session P&L with color (and USD/SOL toggle)
    const pnlEl = root.querySelector('[data-k="pnl"]');
    const pnlUnitEl = root.querySelector('[data-k="pnlUnit"]');
    if (pnlEl) {
      const sign = totalPnl >= 0 ? "+" : "";
      if (STATE.sessionDisplayUsd) {
        const pnlUsd = totalPnl * solUsdPrice;
        pnlEl.textContent = `${sign}$${Math.abs(pnlUsd).toFixed(2)}`;
        if (pnlUnitEl) pnlUnitEl.textContent = "USD";
      } else {
        pnlEl.textContent = `${sign}${fmtSol(totalPnl)} SOL`;
        if (pnlUnitEl) pnlUnitEl.textContent = "SOL";
      }
      pnlEl.style.color = totalPnl >= 0 ? "#10b981" : "#ef4444";
    }

    // Update Win Streak
    const streakEl = root.querySelector(".stat.streak");
    const streakValEl = root.querySelector('[data-k="streak"]');
    if (streakEl && streakValEl) {
      const streak = STATE.winStreak || 0;
      streakValEl.textContent = streak;

      // Reset classes
      streakEl.classList.remove("win", "loss");

      if (streak > 0) {
        streakEl.classList.add("win");
      } else if (streak === 0 && STATE.lastTradeWasLoss) {
        streakEl.classList.add("loss");
        // Remove loss class after animation
        setTimeout(() => streakEl.classList.remove("loss"), 2000);
        STATE.lastTradeWasLoss = false; // Reset flag
      }
    }

    const tokenLabel = root.querySelector('[data-k="tokenSymbol"]');
    if (tokenLabel) {
      const sym = getStableToken()?.symbol;
      if (sym && sym !== "TOKEN") tokenLabel.textContent = sym;
    }

    const list = root.querySelector(".tradeList");
    if (list && list.style.display !== "none") updateTradeList(list);
  }

  function updateTradeList(listEl) {
    const rows = (STATE.trades || []).slice().reverse().slice(0, 50);
    if (rows.length === 0) {
      listEl.innerHTML = `<div style="padding:12px;color:rgba(148,163,184,0.9);font-weight:700;">No trades yet</div>`;
      return;
    }

    listEl.innerHTML = rows
      .map((t) => {
        const side = t.side === "SELL" ? "sell" : "buy";
        const sideLabel = t.side === "SELL" ? "SELL" : "BUY";
        const time = nowLocalTimeString(t.ts);
        const ticker = t.symbol || "TOKEN";
        const size =
          t.side === "SELL"
            ? `${Number(t.tokenQty || 0).toFixed(2)} tok`
            : `${fmtSol(Number(t.solSize || 0))} SOL`;
        const price = t.priceUsd ? `$${Number(t.priceUsd).toFixed(6)}` : "";

        // Format market cap (e.g., $125K, $1.2M)
        const formatMC = (mc) => {
          if (!mc) return "-";
          if (mc >= 1000000) return `$${(mc / 1000000).toFixed(1)}M`;
          if (mc >= 1000) return `$${(mc / 1000).toFixed(0)}K`;
          return `$${mc.toFixed(0)}`;
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
      })
      .join("");
  }

  /**
   * Handles price tick updates from page-bridge
   * Updates current price for ALL positions and triggers PNL update
   */
  function handlePriceTick(msg) {
    if (!msg || !msg.price) return;

    const price = Number(msg.price);
    if (!Number.isFinite(price) || price <= 0) return;

    const stable = getStableToken();
    const posKey = stable?.mint || stable?.symbol || null;

    if (posKey && STATE.positions?.[posKey]?.tokenQty > 0) {
      const pos = STATE.positions[posKey];
      pos.lastPriceUsd = price;
      pos.lastPriceTs = Date.now();
      updatePnlHud();
      return;
    }

    // Update ALL positions with the new price (fallback)
    // (In paper trading, we typically trade one token at a time)
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
      // Update PNL HUD to reflect new price
      updatePnlHud();
    }
  }

  /**
   * Creates a visual marker on the chart by sending message to page-bridge (auto-fix.js)
   * The page-bridge runs in page context and can access window.tvWidget without CSP issues
   */
  function createTradeMarker(side, price, amount, marketCap, timestamp) {
    if (!PLATFORM.isPadre) {
      log("Trade markers only supported on Padre (TradingView)");
      return;
    }

    const ts = timestamp || Date.now();

    log("Sending TRADE_EXECUTED message to page-bridge:", { side, price, marketCap, ts });

    // Send message to auto-fix.js page script which has access to window.tvWidget
    window.postMessage(
      {
        __paper: true,
        type: "TRADE_EXECUTED",
        side: side.toLowerCase(),
        price: price,
        marketCap: marketCap,
        timestamp: ts,
      },
      "*"
    );
  }
  // Track which tokens have had markers rendered this session to prevent duplicates
  const sessionRenderedMints = new Set();
  let lastRenderCallTs = 0;
  let renderCallCount = 0;

  /**
   * Renders trade markers for the current token from stored trades
   * Sends bulk message to auto-fix.js for rendering
   * Includes deduplication to prevent multiple renders per session
   */
  function renderTradeMarkers() {
    renderCallCount++;
    const callId = renderCallCount;
    const now = Date.now();
    const timeSinceLast = now - lastRenderCallTs;

    log(`📍 renderTradeMarkers CALLED #${callId} (${timeSinceLast}ms since last)`);

    if (!PLATFORM.isPadre) {
      log(`renderTradeMarkers #${callId}: Not on Padre, skipping`);
      return;
    }

    // Throttle: Skip if called within 5 seconds of last successful render
    if (timeSinceLast < 5000 && lastRenderCallTs > 0) {
      log(`📍 renderTradeMarkers #${callId}: THROTTLED (only ${timeSinceLast}ms since last call)`);
      return;
    }

    if (!STATE.trades || STATE.trades.length === 0) {
      log(`renderTradeMarkers #${callId}: No trades in STATE, count:`, STATE.trades?.length || 0);
      return;
    }

    const currentMint = getCurrentTokenMint();
    const currentStable = getStableToken();
    const tokenKey = currentMint || currentStable?.symbol || "";

    log(
      `📍 renderTradeMarkers #${callId}: tokenKey="${tokenKey}", sessionRenderedMints has: ${[...sessionRenderedMints].join(", ") || "none"}`
    );

    // Check if we already rendered markers for this token this session
    if (sessionRenderedMints.has(tokenKey)) {
      log(`📍 renderTradeMarkers #${callId}: Already rendered for ${tokenKey} - SKIPPING`);
      return;
    }

    log(
      "renderTradeMarkers: Looking for trades matching mint:",
      currentMint,
      "or symbol:",
      currentStable?.symbol
    );
    log("renderTradeMarkers: Total trades in STATE:", STATE.trades.length);

    if (!currentMint && !currentStable?.symbol) {
      log("renderTradeMarkers: No current token identifier found");
      return;
    }

    // Filter trades for current token - match by mint OR symbol
    const tokenTrades = STATE.trades.filter((t) => {
      if (t.mint && currentMint && t.mint === currentMint) return true;
      if (t.symbol && currentStable?.symbol && t.symbol === currentStable.symbol) return true;
      return false;
    });

    log("📍 renderTradeMarkers: Found", tokenTrades.length, "trades for current token");

    if (tokenTrades.length === 0) {
      log("renderTradeMarkers: No trades match current token");
      return;
    }

    // Mark this token as rendered for this session
    sessionRenderedMints.add(tokenKey);
    lastRenderCallTs = Date.now(); // Update for throttling
    log(
      `📍 Marked ${tokenKey} as rendered. Session rendered mints: ${sessionRenderedMints.size}. lastRenderCallTs updated.`
    );

    // Send bulk message to auto-fix.js with all trades
    log("📍 Sending RENDER_STORED_MARKERS message with", tokenTrades.length, "trades");
    window.postMessage(
      {
        __paper: true,
        type: "RENDER_STORED_MARKERS",
        trades: tokenTrades,
      },
      "*"
    );
  }

  /**
   * Gets the current token's mint address from the URL or page
   */
  function getCurrentTokenMint() {
    // Try to get from URL first (most reliable)
    const urlMatch = window.location.pathname.match(/\/([A-Za-z0-9]{32,})/);
    if (urlMatch) return urlMatch[1];

    // Fallback: try getStableToken
    const stable = getStableToken();
    return stable?.mint || null;
  }

  /**
   * Waits for TradingView widget to be available, then calls callback
   * Since auto-fix.js runs in page context and handles the API call,
   * we just need to wait for the page to fully load
   */
  function waitForTvWidget(callback, delayMs = 5000) {
    if (!PLATFORM.isPadre) return;

    // Wait for page to be fully loaded and tvWidget to be initialized
    // auto-fix.js will check window.tvWidget when it receives the message
    log("Waiting", delayMs, "ms for TradingView widget to initialize...");
    setTimeout(() => {
      log("Rendering stored trade markers via page-bridge");
      callback();
    }, delayMs);
  }

  /**
   * Sends current token context to page-bridge
   * This tells the bridge which token to track for price updates
   */
  function sendContextToBridge() {
    const stable = getStableToken();
    window.postMessage(
      {
        __paper: true,
        type: "PAPER_SET_CONTEXT",
        mint: stable?.mint || null,
        symbol: stable?.symbol || "TOKEN",
      },
      "*"
    );
  }

  // --- Buy HUD (same look; just safer mounting)
  let BUYHUD_TAB = "buy";
  let BUYHUD_EDIT = false;

  function mountBuyHud() {
    // Note: dock host feature disabled for shadow DOM compatibility
    const shadowRt = getShadowRoot();
    const container = getShadowContainer();

    let root = shadowRt.getElementById(IDS.buyHud);

    // Visibility check
    if (!STATE.enabled) {
      if (root) root.style.display = "none";
      return;
    }
    if (root) root.style.display = "";

    if (!root) {
      root = document.createElement("div");
      root.id = IDS.buyHud;
      root.style.pointerEvents = "auto";
      root.innerHTML = `
          <div class="panel">
          <div class="panelHeader">
            <div class="panelTitle"><span class="dot"></span> ZERØ</div>
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
            <button class="action" data-act="action">ZERØ Buy TOKEN</button>
            <div class="status" data-k="status"></div>
          </div>
        </div>
          `;
      container.appendChild(root);

      const header = root.querySelector(".panelHeader");
      makeDraggable(
        header,
        (dx, dy) => {
          if (STATE.buyHudDocked) return;
          STATE.buyHudPos.x += dx;
          STATE.buyHudPos.y += dy;
          STATE.buyHudPos.x = clamp(STATE.buyHudPos.x, 0, window.innerWidth - 100);
          STATE.buyHudPos.y = clamp(STATE.buyHudPos.y, 34, window.innerHeight - 80);
          root.style.left = `${STATE.buyHudPos.x}px`;
          root.style.right = "auto";
          root.style.top = `${STATE.buyHudPos.y}px`;
        },
        async () => {
          if (!STATE.buyHudDocked) await saveState();
        }
      );

      root.addEventListener("click", async (e) => {
        const el = e.target;
        if (!(el instanceof HTMLElement)) return;

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
          // Execute paper trade
          if (!STATE.enabled) {
            const status = root.querySelector('[data-k="status"]');
            if (status) status.textContent = "ZERØ mode is disabled. Click the banner to enable.";
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          const field = root.querySelector('input[data-k="field"]');
          const inputVal = field ? field.value.trim() : "";

          if (!inputVal) {
            const status = root.querySelector('[data-k="status"]');
            if (status) status.textContent = "Please enter an amount.";
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          const stable = getStableToken();
          const symbol = stable?.symbol || "TOKEN";
          const mint = stable?.mint || null;

          // Helper to get current price - DOM first, then cached
          const getCurrentPrice = () => {
            // Helper to parse Padre's Unicode subscript notation
            // Format: $0.0₃918 means $0.0 + 3 extra zeros + 918 = $0.000918
            const parseSubscriptPrice = (text) => {
              // Unicode subscripts: ₀=\u2080, ₁=\u2081, ..., ₉=\u2089
              const subscriptMap = {
                "₀": 0,
                "₁": 1,
                "₂": 2,
                "₃": 3,
                "₄": 4,
                "₅": 5,
                "₆": 6,
                "₇": 7,
                "₈": 8,
                "₉": 9,
              };

              // Match pattern: $0.0₃918 or $0.0₄1234
              // The subscript indicates how many additional zeros after the initial "0.0"
              const match = text.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
              if (match) {
                const extraZeros = subscriptMap[match[1]];
                const digits = match[2];
                // Build the price: the "0.0" prefix already has 1 zero, subscript adds more
                // e.g., $0.0₃932 means 0. + 1 zero (from 0.0) + 3 zeros + 932 = 0.0000932
                const priceStr = "0." + "0".repeat(extraZeros + 1) + digits;
                const price = parseFloat(priceStr);
                log("Parsed subscript price:", text, "→", price);
                return price;
              }

              // Also try standard decimal format
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

            // Look for price in DOM elements
            const priceElements = Array.from(
              document.querySelectorAll("h2.MuiTypography-h2, h2, p.MuiTypography-body1")
            ).filter((el) => {
              const text = el.textContent || "";
              return /\$[\d.]+/.test(text) || /\$0\.0[₀₁₂₃₄₅₆₇₈₉]/.test(text);
            });

            for (const el of priceElements) {
              const price = parseSubscriptPrice(el.textContent || "");
              if (price && price > 0.0000001 && price < 10) {
                return price;
              }
            }

            // Fallback: try cached position price if DOM scraping failed
            const posKey = mint || symbol;
            if (STATE.positions[posKey]?.lastPriceUsd) {
              log("DOM scraping failed, using cached price:", STATE.positions[posKey].lastPriceUsd);
              return STATE.positions[posKey].lastPriceUsd;
            }

            // Final fallback
            return 0.001;
          };

          if (BUYHUD_TAB === "buy") {
            // Execute buy
            const solAmount = safeParseFloat(inputVal);
            if (solAmount <= 0 || solAmount > STATE.cashSol) {
              const status = root.querySelector('[data-k="status"]');
              if (status) {
                status.textContent =
                  solAmount <= 0
                    ? "Invalid amount."
                    : `Insufficient cash. Available: ${fmtSol(STATE.cashSol)} SOL`;
              }
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            // Get current price from position or use fallback
            const posKey = mint || symbol;
            const currentPriceUsd = getCurrentPrice();
            const marketCap = getMarketCap();

            // Calculate token quantity based on SOL amount and current price
            // V51: Use dynamic SOL price instead of hardcoded $200
            const solUsdPrice = getSolPrice();
            const usdAmount = solAmount * solUsdPrice;
            const tokenQty = usdAmount / currentPriceUsd;

            // Deduct cash
            STATE.cashSol -= solAmount;

            // Update or create position
            if (!STATE.positions[posKey]) {
              STATE.positions[posKey] = {
                tokenQty: 0,
                entryPriceUsd: currentPriceUsd,
                lastPriceUsd: currentPriceUsd,
                symbol: symbol,
                mint: mint,
                entryTs: Date.now(), // For trade timing analysis
                entryMarketCap: marketCap, // For market cap analysis
                // V51: Track SOL-denominated cost basis for accurate P&L
                totalSolSpent: 0, // Will be set below
                // Store implied supply to derive precise price from MC later
                // ImpliedSupply = MC / Price
                impliedSupply:
                  marketCap > 0 && currentPriceUsd > 0 ? marketCap / currentPriceUsd : 0,
              };
            }

            const pos = STATE.positions[posKey];

            // Calculate weighted average entry price
            const oldValue = (pos.tokenQty || 0) * (pos.entryPriceUsd || currentPriceUsd);
            const newValue = tokenQty * currentPriceUsd;
            const totalQty = (pos.tokenQty || 0) + tokenQty;

            // Calculate weighted average entry market cap for accurate MC ratio P&L
            // Formula: (oldSolSpent * oldEntryMC + newSolSpent * newMC) / totalSolSpent
            const oldSolSpent = pos.totalSolSpent || 0;
            const oldEntryMC = pos.entryMarketCap || marketCap;
            const weightedEntryMC =
              oldSolSpent > 0
                ? (oldSolSpent * oldEntryMC + solAmount * marketCap) / (oldSolSpent + solAmount)
                : marketCap;

            pos.tokenQty = totalQty;
            pos.entryPriceUsd = totalQty > 0 ? (oldValue + newValue) / totalQty : currentPriceUsd;
            pos.lastPriceUsd = currentPriceUsd;
            pos.entryMarketCap = weightedEntryMC; // Update weighted average entry MC
            // V51: Accumulate SOL spent for accurate P&L tracking
            pos.totalSolSpent = (pos.totalSolSpent || 0) + solAmount;
            log(
              "[v51 BUY] Added",
              solAmount,
              "SOL. Total:",
              pos.totalSolSpent,
              "Weighted Entry MC:",
              weightedEntryMC
            );

            // Record trade
            if (!STATE.trades) STATE.trades = [];
            const tradeTs = Date.now();
            STATE.trades.push({
              ts: tradeTs,
              side: "BUY",
              symbol: symbol,
              mint: mint,
              solSize: solAmount,
              tokenQty: tokenQty,
              priceUsd: currentPriceUsd,
              marketCap: marketCap,
            });

            await saveState();
            updatePnlHud();

            // Create chart marker directly
            createTradeMarker("buy", currentPriceUsd, solAmount, marketCap, tradeTs);

            log("Buy executed:", {
              symbol,
              solAmount,
              tokenQty,
              currentPriceUsd,
              entryPriceUsd: pos.entryPriceUsd,
              position: pos,
            });

            // === BAD HABIT DETECTION (BUY SIDE) ===
            const now = Date.now();

            // 1. FOMO Detection: 3+ buys in 2 minutes
            if (!STATE.recentBuyTimestamps) STATE.recentBuyTimestamps = [];
            STATE.recentBuyTimestamps.push(now);
            // Keep only timestamps from last 2 minutes
            STATE.recentBuyTimestamps = STATE.recentBuyTimestamps.filter((ts) => now - ts < 120000);
            if (STATE.recentBuyTimestamps.length >= 3) {
              setTimeout(
                () => showProfessorCritique("fomo_buying", STATE.recentBuyTimestamps.length),
                500
              );
              STATE.recentBuyTimestamps = [now]; // Reset after warning
            }

            // 2. Revenge Trading: Buying within 30s of a loss
            const lastSellTs = STATE.lastSellTs || 0;
            const lastSellPnl = STATE.lastSellPnl || 0;
            if (lastSellPnl < 0 && now - lastSellTs < 30000) {
              setTimeout(() => showProfessorCritique("revenge_trade", now - lastSellTs), 700);
            }

            // 3. Averaging Down: Adding to a losing position
            // Check if this was an ADD to existing position that's underwater
            if (oldSolSpent > 0 && marketCap < oldEntryMC) {
              const pctDown = (marketCap / oldEntryMC - 1) * 100;
              if (pctDown < -5) {
                // Only warn if down more than 5%
                setTimeout(() => showProfessorCritique("averaging_down", pctDown), 900);
              }
            }

            // 4. Overtrading Detection
            STATE.sessionTradeCount = (STATE.sessionTradeCount || 0) + 1;
            if (!STATE.sessionStartTs) STATE.sessionStartTs = now;
            // Trigger at 10, 15, 20, etc.
            if (STATE.sessionTradeCount >= 10 && STATE.sessionTradeCount % 5 === 0) {
              setTimeout(() => showProfessorCritique("overtrading", STATE.sessionTradeCount), 1100);
            }

            // Update last buy timestamp
            STATE.lastBuyTs = now;
            await saveState();
            // === END BAD HABIT DETECTION ===

            const status = root.querySelector('[data-k="status"]');
            if (status)
              status.textContent = `✓ Bought ${tokenQty.toFixed(2)} ${symbol} @ $${currentPriceUsd.toFixed(6)}`;
            if (field) field.value = "";
          } else {
            // Execute sell
            const sellPct = safeParseFloat(inputVal);
            if (sellPct <= 0 || sellPct > 100) {
              const status = root.querySelector('[data-k="status"]');
              if (status) status.textContent = "Invalid percentage (0-100).";
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            const posKey = mint || symbol;
            const pos = STATE.positions[posKey];
            if (!pos || !pos.tokenQty || pos.tokenQty <= 0) {
              const status = root.querySelector('[data-k="status"]');
              if (status) status.textContent = `No position in ${symbol} to sell.`;
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            // Calculate sell quantity and proceeds - use live DOM price!
            const sellQty = (pos.tokenQty * sellPct) / 100;
            const currentPriceUsd = getCurrentPrice(); // Use live price from DOM
            const entryPriceUsd = pos.entryPriceUsd || currentPriceUsd;

            // Calculate proceeds in USD then convert to SOL
            const proceedsUsd = sellQty * currentPriceUsd;
            // V51: Use dynamic SOL price instead of hardcoded $200
            const solUsdPrice = getSolPrice();
            const solReceived = proceedsUsd / solUsdPrice;

            // V51 FIX: Calculate realized P&L using SOL-denominated cost basis
            // This ensures Session P&L always matches Balance changes regardless of SOL price fluctuations
            // Note: pos.tokenQty hasn't been reduced yet at this point
            const totalQtyBeforeSell = pos.tokenQty;
            const totalSolSpent = pos.totalSolSpent || 0;

            // Calculate proportional SOL cost for the tokens being sold
            // solSpentPortion = totalSolSpent × (sellQty / totalTokenQty)
            const solSpentPortion =
              totalQtyBeforeSell > 0 ? totalSolSpent * (sellQty / totalQtyBeforeSell) : 0;

            // SOL-denominated P&L = what we received - what we spent
            const realizedPnlSol = solReceived - solSpentPortion;

            log("[v51 SELL] Sell Qty:", sellQty, "of", totalQtyBeforeSell, "tokens");
            log("[v51 SELL] Total SOL Spent:", totalSolSpent, "Portion sold:", solSpentPortion);
            log("[v51 SELL] SOL Received:", solReceived, "P&L SOL:", realizedPnlSol);

            // Update position's remaining SOL cost basis
            pos.totalSolSpent = Math.max(0, totalSolSpent - solSpentPortion);

            // Update state
            STATE.cashSol += solReceived;
            STATE.realizedSol = (STATE.realizedSol || 0) + realizedPnlSol;

            // Win/Loss Streak Logic with expanded Professor triggers
            const previousWinStreak = STATE.winStreak || 0;
            const previousLossStreak = STATE.lossStreak || 0;

            if (realizedPnlSol > 0) {
              // WIN - reset loss streak, increment win streak
              STATE.winStreak = previousWinStreak + 1;
              STATE.lossStreak = 0;
              STATE.lastTradeWasLoss = false;

              // Trigger Professor at every 5 wins (5, 10, 15, 20, ...)
              if (STATE.winStreak % 5 === 0) {
                setTimeout(() => showProfessorCritique("win_streak", STATE.winStreak), 500);
              }
            } else {
              // LOSS - reset win streak, increment loss streak
              STATE.lossStreak = previousLossStreak + 1;
              STATE.winStreak = 0;
              STATE.lastTradeWasLoss = true;

              // Trigger Professor at 3, 5, or every 5 losses after that
              if (
                STATE.lossStreak === 3 ||
                STATE.lossStreak === 5 ||
                (STATE.lossStreak > 5 && STATE.lossStreak % 5 === 0)
              ) {
                setTimeout(() => showProfessorCritique("loss_streak", STATE.lossStreak), 500);
              }

              // Also show streak ended message if had a significant win streak
              if (previousWinStreak >= 3) {
                setTimeout(() => showProfessorCritique("loss", previousWinStreak), 800);
              }
            }

            // Check for portfolio multipliers (2x, 3x, 4x, etc)
            const currentEquity = STATE.cashSol + calcUnrealizedSol() + (STATE.realizedSol || 0);
            const startSol = STATE.startSol || 10;
            const currentMultiplier = Math.floor(currentEquity / startSol);
            const lastMultiplier = STATE.lastPortfolioMultiplier || 1;

            if (currentMultiplier >= 2 && currentMultiplier > lastMultiplier) {
              STATE.lastPortfolioMultiplier = currentMultiplier;
              setTimeout(
                () => showProfessorCritique("portfolio_multiplier", currentMultiplier),
                1200
              );
            }

            pos.tokenQty -= sellQty;

            // Helper to get market cap from page (same as in buy block)
            const getMarketCapForSell = () => {
              const mcElements = document.querySelectorAll('[class*="mc"], [class*="MarketCap"]');
              for (const el of mcElements) {
                const text = el.textContent || "";
                const match = text.match(/\$?([\d,.]+)\s*[KMB]?/i);
                if (match) {
                  let num = parseFloat(match[1].replace(/,/g, ""));
                  if (text.includes("K")) num *= 1000;
                  if (text.includes("M")) num *= 1000000;
                  if (text.includes("B")) num *= 1000000000;
                  if (num > 1000) return num;
                }
              }
              return null;
            };

            // Get market cap for trade record
            const sellMarketCap = getMarketCap();

            // Record trade with timing data for analysis
            if (!STATE.trades) STATE.trades = [];
            const tradeTs = Date.now();
            // Calculate hold time based on consistent timestamp
            // const holdTimeMs = tradeTs - (pos.entryTs || tradeTs); // Removed duplicate declaration

            STATE.trades.push({
              ts: tradeTs,
              side: "SELL",
              symbol: symbol,
              mint: mint,
              solSize: solReceived,
              tokenQty: sellQty,
              priceUsd: currentPriceUsd,
              realizedPnlSol: realizedPnlSol,
              pnlSol: realizedPnlSol, // For analyzeRecentTrades
              marketCap: sellMarketCap,
              entryTs: pos.entryTs || null,
              entryMarketCap: pos.entryMarketCap || null,
              holdTimeMs: tradeTs - (pos.entryTs || tradeTs),
            });

            if (pos.tokenQty <= 0.000001) {
              delete STATE.positions[posKey];
              updatePnlHud(); // Force update to remove position from list
            }

            // Recalculate PNL HUD immediately
            updatePnlHud(); // Ensures PNL is updated immediately
            await saveState();

            // === BAD HABIT DETECTION (SELL SIDE) ===
            const sellNow = Date.now();
            const entryTs = pos.entryTs || 0;
            const holdTimeMs = sellNow - entryTs;
            const entryMC = pos.entryMarketCap || sellMarketCap;
            const mcRatio = entryMC > 0 ? sellMarketCap / entryMC : 1;
            const pctGainLoss = (mcRatio - 1) * 100;

            // 1. Quick Exit Loss (Panic Sell)
            // If held for less than 30s and lost money
            if (holdTimeMs < 30000 && realizedPnlSol < 0) {
              setTimeout(() => showProfessorCritique("quick_exit_loss", holdTimeMs), 500);
            }

            // 2. Paper Hands: Selling at small losses (-2% to -10%)
            // Only trigger if they had a reasonable hold time (>30s) but still panic sold on a small dip
            if (realizedPnlSol < 0 && pctGainLoss > -10 && pctGainLoss < -2 && holdTimeMs > 30000) {
              setTimeout(() => showProfessorCritique("paper_hands", pctGainLoss), 700);
            }

            // 3. Gains Given Back: Position was up significantly but sold at loss
            // We'll estimate max gain from MC difference during hold
            // If entry MC < peak MC (we can only estimate this from current data)
            // For now, warn if they sold at loss but the trade could have been timed better
            if (realizedPnlSol < 0 && entryMC > 0) {
              // Check if the token dropped from entry (suggesting they might have had gains at some point)
              // This is a simplified heuristic - if entry MC was lower than current, they likely missed a pump
              // A more sophisticated check would track max unrealized during the hold
              // For now, trigger if loss is small but time was long (suggesting they held through volatility)
              if (holdTimeMs > 120000 && pctGainLoss > -30 && pctGainLoss < -5) {
                // Been holding for 2+ minutes and took a moderate loss - likely gave back gains
                setTimeout(
                  () =>
                    showProfessorCritique("gains_given_back", {
                      maxGain: 0,
                      finalLoss: Math.abs(pctGainLoss),
                    }),
                  900
                );
              }
            }

            // 4. Update session trade count
            STATE.sessionTradeCount = (STATE.sessionTradeCount || 0) + 1;
            if (STATE.sessionTradeCount >= 10 && STATE.sessionTradeCount % 5 === 0) {
              setTimeout(() => showProfessorCritique("overtrading", STATE.sessionTradeCount), 1100);
            }

            // Track last sell info for revenge trade detection on next buy
            STATE.lastSellTs = sellNow;
            STATE.lastSellPnl = realizedPnlSol;

            // 5. Big Win Detection (>50% gain) - remind to stay humble
            if (pctGainLoss >= 50) {
              setTimeout(() => showProfessorCritique("big_win", pctGainLoss), 1300);
            }

            // 6. Big Loss Detection (<-30% loss) - remind to take a break
            if (pctGainLoss <= -30) {
              setTimeout(() => showProfessorCritique("big_loss", pctGainLoss), 1300);
            }

            await saveState();
            // === END BAD HABIT DETECTION ===

            // Create chart marker directly
            createTradeMarker("sell", currentPriceUsd, solReceived, sellMarketCap, tradeTs);

            const pnlSign = realizedPnlSol >= 0 ? "+" : "";
            const status = root.querySelector('[data-k="status"]');
            if (status)
              status.textContent = `✓ Sold ${sellPct}% @ $${currentPriceUsd.toFixed(6)} (${pnlSign}${fmtSol(realizedPnlSol)} SOL)`;
            if (field) field.value = "";
          }

          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (el.classList.contains("qbtn")) {
          const val = el.getAttribute("data-v");
          const field = root.querySelector('input[data-k="field"]');
          if (field && val) field.value = val;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      });
    }

    // Docking logic
    if (STATE.buyHudDocked) {
      root.className = "docked";
      root.style.top = "";
      root.style.left = "";
      root.style.right = "";
      root.style.width = "";
    } else {
      root.className = "floating";
      // Use saved position if dragged, otherwise default to right side
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
    if (!container) return;
    container.innerHTML = labels
      .map(
        (lab, i) =>
          `<button class="qbtn" data-v="${escapeHtml(values[i])}">${escapeHtml(lab)}</button>`
      )
      .join("");
  }

  function updateBuyHud() {
    const root = getShadowRoot().getElementById(IDS.buyHud);
    if (!root) return;

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

    if (editBtn) editBtn.textContent = BUYHUD_EDIT ? "Done" : "Edit";

    if (BUYHUD_TAB === "buy") {
      if (label) label.textContent = "Buy Amount (SOL)";
      if (field) {
        field.placeholder = "e.g. 0.25";
        field.setAttribute("inputmode", "decimal");
      }
      if (action) {
        action.innerHTML = `ZERØ Buy ${symbol} `;
        action.classList.remove("sell");
      }
      renderQuickButtons(
        quick,
        STATE.quickBuySols.map((n) => `${n} SOL`),
        STATE.quickBuySols.map((n) => String(n))
      );
    } else {
      if (label) label.textContent = "Sell Percent (%)";
      if (field) {
        field.placeholder = "e.g. 25";
        field.setAttribute("inputmode", "numeric");
      }
      if (action) {
        action.innerHTML = `ZERØ Sell ${symbol} `;
        action.classList.add("sell");
      }
      renderQuickButtons(
        quick,
        STATE.quickSellPcts.map((n) => `${n}% `),
        STATE.quickSellPcts.map((n) => String(n))
      );
    }

    if (status) {
      status.textContent = STATE.enabled
        ? "Trades are simulated. Real wallet is not touched."
        : "ZERØ mode is disabled.";
    }
  }

  // --- Render scheduler (throttled)
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      const now = Date.now();
      // cooldown to avoid spamming during SPA hydration
      if (now - lastRenderAt < 250) return;
      lastRenderAt = now;
      renderAll();
    });
  }

  function isOurNode(node) {
    if (!(node instanceof HTMLElement)) return false;
    return (
      node.id === IDS.banner ||
      node.id === IDS.pnlHud ||
      node.id === IDS.buyHud ||
      node.closest?.(`#${IDS.banner}, #${IDS.pnlHud}, #${IDS.buyHud} `) != null
    );
  }

  function attachObserver() {
    if (observer) return;

    observer = new MutationObserver((muts) => {
      if (suppressObserver) return;

      // ignore mutations caused by our own overlay
      for (const m of muts) {
        if (isOurNode(m.target)) continue;
        // Axiom/Padre boot generates tons of mutations; only schedule render, do not render inline.
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

      // Only apply body offset once body exists (prevents layout breaking at boot)
      ensureBodyOffsetForBanner();

      mountPnlHud();
      mountBuyHud();

      updateBanner();
      updatePnlHud();
      updateBuyHud();

      // Send current token context to page-bridge for price tracking
      sendContextToBridge();

      // font family only; no other appearance changes
      applyOverlayFontFamily();
    } finally {
      suppressObserver = false;
    }
  }

  async function boot() {
    if (booted) return;
    booted = true;

    await loadState();

    // Let the SPA hydrate first. Do not hammer at document_start.
    // Wait for body + one paint.
    const waitForBody = async () => {
      if (document.body) return;
      await new Promise((r) => setTimeout(r, 25));
      return waitForBody();
    };
    await waitForBody();
    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => setTimeout(r, 50));

    // Inject page-bridge script to intercept price data
    const injectPageBridge = () => {
      const id = "paper-page-bridge";
      if (document.getElementById(id)) return;

      const script = document.createElement("script");
      script.id = id;
      script.src = chrome.runtime.getURL("src/page-bridge.js");
      script.type = "text/javascript";
      (document.head || document.documentElement).appendChild(script);
    };
    injectPageBridge();

    renderAll();

    // V16: On Padre, SKIP attachObserver - watching all document mutations causes React interference
    // The MutationObserver triggers scheduleRender on every React change, creating a feedback loop
    if (!PLATFORM.isPadre) {
      // Axiom: Attach observer after initial render
      setTimeout(() => {
        attachObserver();
        scheduleRender();
      }, 600);
    } else {
      console.log("[paper:Padre v16] Skipping MutationObserver to avoid React interference");
    }

    // Re-apply font after fonts load (only once on Padre to minimize DOM touches)
    if (PLATFORM.isPadre) {
      setTimeout(applyOverlayFontFamily, 2000); // Single application after settling
    } else {
      setTimeout(applyOverlayFontFamily, 1500);
      setTimeout(applyOverlayFontFamily, 4500);
    }

    // Listen for price updates from page-bridge
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || !msg.__paper) return;

      if (msg.type === "PRICE_TICK") {
        handlePriceTick(msg);
      }
    });

    // Fallback: Poll for price updates from the page
    // This ensures P&L updates even if page-bridge isn't sending ticks
    // V16: Use TARGETED selectors to avoid React interference
    const pollPrice = () => {
      // Skip polling if not on a trade page (prevents interference during navigation)
      if (!window.location.pathname.includes("/trade/")) return;

      const stable = getStableToken();
      if (!stable) return;

      const posKey = stable.mint || stable.symbol;
      if (!STATE.positions[posKey] || !STATE.positions[posKey].tokenQty) return;

      // Strategy: Prioritize calculating price from Market Cap (High Precision)
      // Price = MC / ImpliedSupply
      // This prevents "Zero P&L" due to price rounding on low-decimal tokens
      const currentMC = getMarketCap();
      const pos = STATE.positions[posKey];

      if (currentMC > 0 && pos && pos.impliedSupply > 0) {
        const derivedPrice = currentMC / pos.impliedSupply;
        if (Number.isFinite(derivedPrice) && derivedPrice > 0) {
          const oldPrice = pos.lastPriceUsd;
          // Update on any meaningful price change (lowered threshold for Axiom-like sensitivity)
          // Even tiny price movements should reflect in PNL to simulate real trading
          if (derivedPrice !== oldPrice) {
            pos.lastPriceUsd = derivedPrice;
            pos.lastPriceTs = Date.now();
            log("Price DERIVED from MC:", derivedPrice, `(MC: ${currentMC})`);
            updatePnlHud();
            return; // Skip DOM scraping
          }
        }
      }

      // Fallback: Scrape price from DOM if MC derivation failed
      let priceElements = [];

      if (PLATFORM.isPadre) {
        // Padre: Target h2 elements which contain prices
        // Updated regex to include subscript characters in the filter
        priceElements = Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2"))
          .filter((el) => {
            const text = el.textContent || "";
            const hasSubscript = /[\u2080-\u2089]/.test(text); // Check for subscripts ₀-₉
            return (hasSubscript || /\$0\.[0-9]{4,}/.test(text)) && el.childElementCount <= 2;
          })
          // Sort match sorting: Prioritize elements with subscripts, then longer text (more precision)
          .sort((a, b) => {
            const textA = a.textContent || "";
            const textB = b.textContent || "";
            const subA = /[\u2080-\u2089]/.test(textA);
            const subB = /[\u2080-\u2089]/.test(textB);

            if (subA && !subB) return -1;
            if (!subA && subB) return 1;
            return textB.length - textA.length; // Longest first
          });
      } else {
        // Axiom: Use broader but still targeted selectors
        priceElements = Array.from(document.querySelectorAll("span, div"))
          .filter((el) => {
            const text = el.textContent || "";
            return /\$0\.\d{4,}/.test(text) && el.childElementCount === 0;
          })
          .slice(0, 10);
      }

      for (const el of priceElements) {
        const text = el.textContent || "";

        // Parse subscript notation (e.g., $0.0₃932 means $0.0000932)
        let price = null;
        const subscriptMap = {
          "₀": 0,
          "₁": 1,
          "₂": 2,
          "₃": 3,
          "₄": 4,
          "₅": 5,
          "₆": 6,
          "₇": 7,
          "₈": 8,
          "₉": 9,
        };

        const subMatch = text.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
        if (subMatch) {
          const extraZeros = subscriptMap[subMatch[1]];
          const digits = subMatch[2];
          const priceStr = "0." + "0".repeat(extraZeros + 1) + digits;
          price = parseFloat(priceStr);
          log("Polling: Parsed subscript price:", text, "→", price);
        } else {
          // Fallback to standard decimal format
          const stdMatch = text.match(/\$([\d.]+)/);
          if (stdMatch) {
            price = parseFloat(stdMatch[1]);
          }
        }

        // Only accept prices between $0.0000001 and $10 (typical token range)
        if (price && price > 0.0000001 && price < 10) {
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

    // Poll every 1 second for responsive PNL updates like Axiom
    setInterval(pollPrice, 1000);

    window.addEventListener("resize", () => scheduleRender());
  }

  // Initialize extension with platform-specific timing
  if (PLATFORM.isPadre) {
    // Padre: Shadow DOM mode with safe polling (no MutationObserver)
    log("Padre mode initialized");

    // === Create Shadow DOM host ONCE ===
    // Host needs full viewport size so children with pointer-events:auto can receive clicks
    shadowHost = document.createElement("paper-trader-host");
    shadowHost.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;";
    shadowRoot = shadowHost.attachShadow({ mode: "open" }); // Changed to open for better event handling

    // Add container inside shadow root (required for getShadowContainer())
    // Container has pointer-events:none but HUD elements have pointer-events:auto
    const container = document.createElement("div");
    container.id = "paper-shadow-container";
    container.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;";
    shadowRoot.appendChild(container);

    document.documentElement.appendChild(shadowHost);

    // === Inject auto-fix.js for chart markers ===
    const injectAutoFix = () => {
      if (document.getElementById("zero-auto-fix")) return;
      const script = document.createElement("script");
      script.id = "zero-auto-fix";
      script.src = chrome.runtime.getURL("src/auto-fix.js");
      (document.head || document.documentElement).appendChild(script);
      log("Injected auto-fix.js");
    };
    injectAutoFix();

    // === Minimal boot: only load state and render UI ===
    const minimalBoot = async () => {
      await loadState();

      // Wait for body + one paint
      const waitForBody = async () => {
        if (document.body) return;
        await new Promise((r) => setTimeout(r, 25));
        return waitForBody();
      };
      await waitForBody();
      await new Promise((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => setTimeout(r, 50));

      // Inject CSS to push Padre header down
      // injectPadreHeaderOffset(); // DISABLED: Causing layout collapse/black screen

      // Render HUDs (into Shadow DOM)
      renderAll();
      log("HUDs mounted");

      // *** NO attachObserver() - this breaks React ***
      // *** NO applyOverlayFontFamily() - fonts are in CSS ***

      // === Safe Price Polling (targeted selectors only) ===
      const safePollPrice = () => {
        if (!window.location.pathname.includes("/trade/")) return;

        const stable = getStableToken();
        if (!stable) {
          log("Price poll: no stable token");
          return;
        }

        const posKey = stable.mint || stable.symbol;
        const hasPosition = STATE.positions[posKey] && STATE.positions[posKey].tokenQty > 0;
        if (!hasPosition) {
          // Don't spam logs, just return
          return;
        }

        // Helper to parse Padre's Unicode subscript notation
        // Format: $0.0₃918 means $0.0 + 3 extra zeros + 918 = $0.000918
        const parseSubscriptPrice = (text) => {
          const subscriptMap = {
            "₀": 0,
            "₁": 1,
            "₂": 2,
            "₃": 3,
            "₄": 4,
            "₅": 5,
            "₆": 6,
            "₇": 7,
            "₈": 8,
            "₉": 9,
          };

          // Match pattern: $0.0₃918 or $0.0₄1234
          const match = text.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
          if (match) {
            const extraZeros = subscriptMap[match[1]];
            const digits = match[2];
            const priceStr = "0." + "0".repeat(extraZeros + 1) + digits;
            return parseFloat(priceStr);
          }

          // Standard decimal format
          const stdMatch = text.match(/\$([\d.]+)/);
          if (stdMatch) {
            const price = parseFloat(stdMatch[1]);
            if (price > 0 && price < 10) return price;
          }
          return null;
        };

        // Use targeted h2 selectors for Padre
        const priceElements = Array.from(
          document.querySelectorAll("h2.MuiTypography-h2, h2, p.MuiTypography-body1")
        ).filter((el) => {
          const text = el.textContent || "";
          // Match both standard prices AND subscript prices
          return /\$[\d.]+/.test(text) || /\$0\.0[₀₁₂₃₄₅₆₇₈₉]/.test(text);
        });

        for (const el of priceElements) {
          const price = parseSubscriptPrice(el.textContent || "");
          if (price && price > 0.0000001 && price < 10) {
            const oldPrice = STATE.positions[posKey].lastPriceUsd;
            const priceChanged = Math.abs((oldPrice || 0) - price) > 0.0000000001;

            // Always update the price and timestamp
            STATE.positions[posKey].lastPriceUsd = price;
            STATE.positions[posKey].lastPriceTs = Date.now();

            if (priceChanged) {
              log("Price polled:", price.toFixed(10), "(was:", oldPrice?.toFixed(10), ")");
            }

            // Always refresh the HUD to keep P&L current
            updatePnlHud();
            return;
          }
        }
      };

      // Poll every 1 second for tighter P&L updates
      setInterval(safePollPrice, 1000);

      // Listen for price updates from page-bridge
      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || !msg.__paper) return;
        if (msg.type === "PRICE_TICK") {
          handlePriceTick(msg);
        }
      });

      // Wait for TradingView widget to be ready, then render stored trade markers
      waitForTvWidget(() => {
        log("Rendering stored trade markers...");
        renderTradeMarkers();
      });
    };

    // Only initialize on trade pages, with delay
    const isOnTradePage = () => window.location.pathname.includes("/trade/");

    if (isOnTradePage()) {
      setTimeout(() => {
        minimalBoot().catch((e) => console.warn("[paper] boot error", e));

        // Initial tutorial check (after boot, not just on navigation)
        setTimeout(() => {
          if (!STATE.tutorialCompleted && !sessionTutorialTriggered && getShadowContainer()) {
            sessionTutorialTriggered = true;
            log("Triggering Professor Tutorial from Initial Load");
            showProfessorTutorial2(0);
          }
        }, 1000); // Wait for HUDs to mount
      }, 3000);
    }

    // === URL monitoring with visibility toggle ===
    let lastPath = window.location.pathname;
    let lastHref = window.location.href;
    let hudInitialized = false;
    let sessionTutorialTriggered = false;

    const updateVisibility = () => {
      // Toggle visibility of HUDs inside shadow root (safe - React can't see this)
      const banner = shadowRoot?.getElementById?.("paper-mode-banner");
      const pnlHud = shadowRoot?.getElementById?.("paper-pnl-hud");
      const buyHud = shadowRoot?.getElementById?.("paper-buyhud-root");

      const onTrade = isOnTradePage();
      const display = onTrade ? "" : "none";

      if (banner) banner.style.display = display;
      if (pnlHud) pnlHud.style.display = display;
      if (buyHud) buyHud.style.display = display;
    };

    setInterval(() => {
      const currentPath = window.location.pathname;
      const currentHref = window.location.href;

      // Check if we navigated to a different page OR a different token
      if (currentPath !== lastPath || currentHref !== lastHref) {
        log("Navigation:", lastPath, "->", currentPath);
        lastPath = currentPath;
        lastHref = currentHref;

        // Toggle visibility based on page type
        updateVisibility();

        // Initialize HUDs if navigating to trade page and not yet initialized
        // Initialize HUDs if navigating to trade page and not yet initialized
        if (isOnTradePage()) {
          if (!hudInitialized) {
            hudInitialized = true;
            setTimeout(() => {
              minimalBoot().catch((e) => console.warn("[paper] boot error", e));
            }, 2000);
          }

          // Check for tutorial trigger (persistent check until completed)
          if (!STATE.tutorialCompleted && !sessionTutorialTriggered) {
            // Only trigger if we have a shadow container ready
            if (getShadowContainer()) {
              sessionTutorialTriggered = true;
              log("Triggering Professor Tutorial from Nav Loop");
              setTimeout(() => showProfessorTutorial2(0), 1000);
            }
          }
        }

        // If already on a trade page and HUDs exist, refresh them with new token
        if (isOnTradePage() && hudInitialized) {
          // Clear rendered markers tracking for fresh rendering on new chart
          sessionRenderedMints.clear();
          log("Cleared sessionRenderedMints for fresh chart");

          log("Navigation detected, will refresh HUDs and markers for new token if needed");

          setTimeout(() => {
            log("Refreshing HUDs for new token...");
            updatePnlHud();
            updateBuyHud();

            // Re-render trade markers for the new token after TradingView widget loads
            waitForTvWidget(() => {
              log("Re-rendering trade markers for new token...");
              renderTradeMarkers();
            }, 3000); // Give more time for TV widget on navigation
          }, 1500); // Wait for page title to update
        }
      }
    }, 500);
  } else {
    // Axiom: Initialize normally
    boot().catch((e) => console.warn("[paper] boot error", e));
  }
})();
