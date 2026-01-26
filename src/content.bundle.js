(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/modules/store.js
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
  var EXT_KEY, DEFAULTS, Store;
  var init_store = __esm({
    "src/modules/store.js"() {
      EXT_KEY = "sol_paper_trader_v1";
      DEFAULTS = {
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
          showProfessor: true,
          // Show trade analysis popup
          rolloutPhase: "full",
          // 'beta' | 'preview' | 'full'
          featureOverrides: {},
          // For remote kill-switches
          behavioralAlerts: true
          // Phase 9: Elite Guardrails
        },
        // Session as first-class object
        session: {
          id: null,
          // Unique session ID
          startTime: 0,
          // Session start timestamp
          endTime: null,
          // Session end timestamp (null if active)
          balance: 10,
          equity: 10,
          realized: 0,
          trades: [],
          // Trade IDs in this session
          equityHistory: [],
          // [{ts, equity}]
          winStreak: 0,
          lossStreak: 0,
          tradeCount: 0,
          disciplineScore: 100,
          activeAlerts: [],
          // {type, message, ts}
          status: "active"
          // 'active' | 'completed' | 'abandoned'
        },
        // Session history (archived sessions)
        sessionHistory: [],
        // Array of completed session objects
        trades: {},
        // Map ID -> Trade Object { id, strategy, emotion, plannedStop, plannedTarget, entryThesis, riskDefined, ... }
        positions: {},
        // Pending trade plan (cleared after trade execution)
        pendingPlan: {
          stopLoss: null,
          // Price in USD or % below entry
          target: null,
          // Price in USD or % above entry
          thesis: "",
          // Entry reasoning
          maxRiskPct: null
          // Max % of balance to risk
        },
        behavior: {
          tiltFrequency: 0,
          panicSells: 0,
          fomoTrades: 0,
          sunkCostFrequency: 0,
          overtradingFrequency: 0,
          profitNeglectFrequency: 0,
          strategyDriftFrequency: 0,
          profile: "Disciplined"
        },
        // Persistent Event Log (up to 100 events)
        eventLog: [],
        // { ts, type, category, message, data }
        // Categories: TRADE, ALERT, DISCIPLINE, SYSTEM, MILESTONE
        schemaVersion: 2,
        version: "1.11.0"
      };
      Store = {
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
            if (!this.state.session.id) {
              this.state.session.id = this.generateSessionId();
              this.state.session.startTime = Date.now();
            }
          }
        },
        generateSessionId() {
          return `session_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
        },
        // Start a new session (archive current if it has trades)
        async startNewSession() {
          const currentSession = this.state.session;
          if (currentSession.trades && currentSession.trades.length > 0) {
            currentSession.endTime = Date.now();
            currentSession.status = "completed";
            if (!this.state.sessionHistory)
              this.state.sessionHistory = [];
            this.state.sessionHistory.push({ ...currentSession });
            if (this.state.sessionHistory.length > 10) {
              this.state.sessionHistory = this.state.sessionHistory.slice(-10);
            }
          }
          const startSol = this.state.settings.startSol || 10;
          this.state.session = {
            id: this.generateSessionId(),
            startTime: Date.now(),
            endTime: null,
            balance: startSol,
            equity: startSol,
            realized: 0,
            trades: [],
            equityHistory: [],
            winStreak: 0,
            lossStreak: 0,
            tradeCount: 0,
            disciplineScore: 100,
            activeAlerts: [],
            status: "active"
          };
          delete this.state._milestone_2x;
          delete this.state._milestone_3x;
          delete this.state._milestone_5x;
          await this.save();
          return this.state.session;
        },
        // Get current session duration in minutes
        getSessionDuration() {
          const session = this.state?.session;
          if (!session || !session.startTime)
            return 0;
          const endTime = session.endTime || Date.now();
          return Math.floor((endTime - session.startTime) / 6e4);
        },
        // Get session summary
        getSessionSummary() {
          const session = this.state?.session;
          if (!session)
            return null;
          const trades = session.trades || [];
          const sellTrades = trades.map((id) => this.state.trades[id]).filter((t) => t && t.side === "SELL");
          const wins = sellTrades.filter((t) => (t.realizedPnlSol || 0) > 0).length;
          const losses = sellTrades.filter((t) => (t.realizedPnlSol || 0) < 0).length;
          const winRate = sellTrades.length > 0 ? (wins / sellTrades.length * 100).toFixed(1) : 0;
          return {
            id: session.id,
            duration: this.getSessionDuration(),
            tradeCount: trades.length,
            wins,
            losses,
            winRate,
            realized: session.realized,
            disciplineScore: session.disciplineScore,
            status: session.status
          };
        }
      };
    }
  });

  // src/modules/featureManager.js
  var TIERS, FEATURES, FeatureManager;
  var init_featureManager = __esm({
    "src/modules/featureManager.js"() {
      TIERS = {
        FREE: "free",
        PRO: "pro",
        ELITE: "elite"
      };
      FEATURES = {
        // Phase 1-2: Core
        BASIC_TRADING: "free",
        REAL_TIME_PNL: "free",
        // Phase 2-4: Pro Foundations
        STRATEGY_TAGGING: "pro",
        EMOTION_TRACKING: "pro",
        DISCIPLINE_SCORING: "pro",
        AI_DEBRIEF: "pro",
        TRADE_PLAN: "pro",
        // Stop loss, targets, thesis capture
        // Phase 5-6: Advanced Pro
        EQUITY_CHARTS: "pro",
        DETAILED_LOGS: "pro",
        ADVANCED_ANALYTICS: "pro",
        RISK_ADJUSTED_METRICS: "pro",
        SHARE_TO_X: "pro",
        // Phase 6+: Elite
        TILT_DETECTION: "elite",
        SESSION_REPLAY: "elite",
        ADVANCED_COACHING: "elite",
        BEHAVIOR_BASELINE: "elite",
        MARKET_CONTEXT: "elite",
        TRADER_PROFILE: "elite"
        // Personal Trader Profile dashboard
      };
      FeatureManager = {
        TIERS,
        FEATURES,
        resolveFlags(state, featureName) {
          const userTier = state.settings?.tier || TIERS.FREE;
          const requiredTier = FEATURES[featureName];
          const flags = {
            enabled: false,
            visible: false,
            interactive: false,
            gated: false
          };
          if (!requiredTier)
            return flags;
          const hasEntitlement = this.hasTierAccess(userTier, requiredTier);
          const phase = state.settings?.rolloutPhase || "full";
          if (requiredTier === TIERS.FREE) {
            flags.enabled = true;
            flags.visible = true;
            flags.interactive = true;
            flags.gated = false;
          } else {
            flags.enabled = true;
            if (hasEntitlement) {
              flags.visible = true;
              flags.interactive = true;
              flags.gated = false;
            } else {
              if (phase === "preview") {
                flags.visible = true;
                flags.interactive = true;
                flags.gated = false;
              } else if (phase === "beta") {
                flags.visible = false;
                flags.interactive = false;
              } else {
                flags.visible = true;
                flags.interactive = false;
                flags.gated = true;
              }
            }
          }
          if (state.settings?.featureOverrides?.[featureName] === false) {
            flags.enabled = false;
            flags.visible = false;
            flags.interactive = false;
          }
          return flags;
        },
        hasTierAccess(userTier, requiredTier) {
          if (requiredTier === TIERS.FREE)
            return true;
          if (requiredTier === TIERS.PRO)
            return [TIERS.PRO, TIERS.ELITE].includes(userTier);
          if (requiredTier === TIERS.ELITE)
            return userTier === TIERS.ELITE;
          return false;
        }
      };
    }
  });

  // src/modules/core/market.js
  var Market;
  var init_market = __esm({
    "src/modules/core/market.js"() {
      Market = {
        price: 0,
        marketCap: 0,
        lastPriceTs: 0,
        context: null,
        // { vol24h, priceChange24h, liquidity, fdv }
        lastContextFetch: 0,
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
            candidates = Array.from(document.querySelectorAll("h2")).filter((el) => {
              const txt = el.textContent || "";
              return txt.includes("$") && /\d/.test(txt) && !txt.includes("SOL") && !txt.includes("%") && txt.length < 30;
            });
          } else {
            candidates = Array.from(document.querySelectorAll("h1, h2, .price")).filter((el) => {
              const txt = el.textContent || "";
              return txt.includes("$") && /\d/.test(txt) && !txt.includes("%") && txt.length < 30;
            });
          }
          for (const el of candidates) {
            const raw = el.textContent.trim();
            const val = this.parsePriceStr(raw);
            const hasUnit = /[KMB]/.test(raw.toUpperCase());
            if (hasUnit || val > 1e4) {
              if (val > 0)
                this.marketCap = val;
            } else if (val > 0 && val < 1e4) {
              if (val >= 50 && val <= 500) {
                continue;
              }
              if (this.price > 0) {
                const ratio = val / this.price;
                if (ratio > 100 || ratio < 0.01) {
                  console.warn(`[Market] SPIKE REJECTED: $${val} (${(ratio * 100).toFixed(0)}x change from $${this.price})`);
                  continue;
                }
              }
              this.updatePrice(val);
              this.fetchMarketContext();
            }
          }
        },
        async fetchMarketContext() {
          const url = window.location.href;
          const mintMatch = url.match(/\/trade\/([a-zA-Z0-9]+)/);
          const mint = mintMatch ? mintMatch[1] : null;
          if (!mint || this.lastContextFetch && Date.now() - this.lastContextFetch < 3e4)
            return;
          this.lastContextFetch = Date.now();
          try {
            console.log(`[Market] Fetching context for ${mint}...`);
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
            const data = await response.json();
            const pair = data.pairs?.[0];
            if (pair) {
              this.context = {
                vol24h: pair.volume?.h24 || 0,
                priceChange24h: pair.priceChange?.h24 || 0,
                liquidity: pair.liquidity?.usd || 0,
                fdv: pair.fdv || 0,
                ts: Date.now()
              };
              console.log(`[Market] Context: Vol=$${(this.context.vol24h / 1e6).toFixed(1)}M, Chg=${this.context.priceChange24h}%`);
            }
          } catch (e) {
            console.error("[Market] Context fetch failed:", e);
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
            console.log(`[Market] Price updated: $${val.toFixed(8)} (MC: $${this.marketCap.toFixed(0)})`);
            this.price = val;
            this.lastPriceTs = Date.now();
            this.listeners.forEach((cb) => cb(val));
          }
        }
      };
    }
  });

  // src/modules/core/analytics.js
  var analytics_exports = {};
  __export(analytics_exports, {
    Analytics: () => Analytics,
    EVENT_CATEGORIES: () => EVENT_CATEGORIES
  });
  var EVENT_CATEGORIES, Analytics;
  var init_analytics = __esm({
    "src/modules/core/analytics.js"() {
      init_store();
      init_featureManager();
      init_market();
      EVENT_CATEGORIES = {
        TRADE: "TRADE",
        ALERT: "ALERT",
        DISCIPLINE: "DISCIPLINE",
        SYSTEM: "SYSTEM",
        MILESTONE: "MILESTONE"
      };
      Analytics = {
        // ==========================================
        // PERSISTENT EVENT LOGGING
        // ==========================================
        logEvent(state, type, category, message, data = {}) {
          if (!state.eventLog)
            state.eventLog = [];
          const event = {
            id: `evt_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
            ts: Date.now(),
            type,
            category,
            message,
            data
          };
          state.eventLog.push(event);
          if (state.eventLog.length > 100) {
            state.eventLog = state.eventLog.slice(-100);
          }
          console.log(`[EVENT LOG] [${category}] ${type}: ${message}`);
          return event;
        },
        logTradeEvent(state, trade) {
          const pnlText = trade.realizedPnlSol ? `P&L: ${trade.realizedPnlSol > 0 ? "+" : ""}${trade.realizedPnlSol.toFixed(4)} SOL` : `Size: ${trade.solAmount.toFixed(4)} SOL`;
          const message = `${trade.side} ${trade.symbol} @ $${trade.priceUsd?.toFixed(6) || "N/A"} | ${pnlText}`;
          this.logEvent(state, trade.side, EVENT_CATEGORIES.TRADE, message, {
            tradeId: trade.id,
            symbol: trade.symbol,
            priceUsd: trade.priceUsd,
            solAmount: trade.solAmount,
            realizedPnlSol: trade.realizedPnlSol,
            strategy: trade.strategy,
            riskDefined: trade.riskDefined
          });
        },
        logDisciplineEvent(state, score, penalty, reasons) {
          if (penalty <= 0)
            return;
          const message = `Discipline -${penalty} pts: ${reasons.join(", ")}`;
          this.logEvent(state, "PENALTY", EVENT_CATEGORIES.DISCIPLINE, message, {
            score,
            penalty,
            reasons
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
          let events = state.eventLog || [];
          if (category) {
            events = events.filter((e) => e.category === category);
          }
          events = events.sort((a, b) => b.ts - a.ts);
          return events.slice(offset, offset + limit);
        },
        getEventStats(state) {
          const events = state.eventLog || [];
          const stats = {
            total: events.length,
            trades: events.filter((e) => e.category === EVENT_CATEGORIES.TRADE).length,
            alerts: events.filter((e) => e.category === EVENT_CATEGORIES.ALERT).length,
            disciplineEvents: events.filter((e) => e.category === EVENT_CATEGORIES.DISCIPLINE).length,
            milestones: events.filter((e) => e.category === EVENT_CATEGORIES.MILESTONE).length
          };
          return stats;
        },
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
            if (trade.marketCap) {
              avgExitMc += trade.marketCap;
              exitMcCount++;
            }
          }
          const winRate = recentTrades.length > 0 ? wins / recentTrades.length * 100 : 0;
          const grossProfits = recentTrades.reduce((sum, t) => sum + Math.max(0, t.realizedPnlSol || 0), 0);
          const grossLosses = Math.abs(recentTrades.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0));
          const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : grossProfits > 0 ? "MAX" : "0.00";
          let peak = 0, maxDd = 0, currentBal = 0;
          recentTrades.forEach((t) => {
            currentBal += t.realizedPnlSol || 0;
            if (currentBal > peak)
              peak = currentBal;
            const dd = peak - currentBal;
            if (dd > maxDd)
              maxDd = dd;
          });
          return {
            totalTrades: recentTrades.length,
            wins,
            losses,
            winRate: winRate.toFixed(1),
            profitFactor,
            maxDrawdown: maxDd.toFixed(4),
            totalPnlSol
          };
        },
        calculateDiscipline(trade, state) {
          const flags = FeatureManager.resolveFlags(state, "DISCIPLINE_SCORING");
          if (!flags.enabled)
            return { score: state.session.disciplineScore || 100, penalty: 0, reasons: [] };
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
            const planFlags = FeatureManager.resolveFlags(state, "TRADE_PLAN");
            if (planFlags.interactive && !trade.riskDefined) {
              penalty += 5;
              reasons.push("No Stop Loss Defined");
            }
          }
          if (trade.side === "SELL") {
            const result = this.checkPlanAdherence(trade, state);
            if (result.penalty > 0) {
              penalty += result.penalty;
              reasons.push(...result.reasons);
            }
          }
          let score = state.session.disciplineScore !== void 0 ? state.session.disciplineScore : 100;
          score = Math.max(0, score - penalty);
          state.session.disciplineScore = score;
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
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          const buyTrade = trades.find(
            (t) => t.side === "BUY" && t.mint === sellTrade.mint && t.ts < sellTrade.ts && t.riskDefined
          );
          if (!buyTrade || !buyTrade.plannedStop)
            return { penalty: 0, reasons: [] };
          const exitPrice = sellTrade.priceUsd;
          const plannedStop = buyTrade.plannedStop;
          const plannedTarget = buyTrade.plannedTarget;
          const entryPrice = buyTrade.priceUsd;
          if (exitPrice < plannedStop && sellTrade.realizedPnlSol < 0) {
            const violationPct = ((plannedStop - exitPrice) / plannedStop * 100).toFixed(1);
            penalty += 15;
            reasons.push(`Stop Violated (-${violationPct}% below stop)`);
          }
          if (plannedTarget && exitPrice < plannedTarget && sellTrade.realizedPnlSol > 0) {
            const targetDistance = (plannedTarget - exitPrice) / plannedTarget * 100;
            if (targetDistance > 30) {
              penalty += 5;
              reasons.push("Early Exit (Left >30% gains)");
            }
          }
          sellTrade.planAdherence = {
            hadPlan: true,
            plannedStop,
            plannedTarget,
            entryPrice,
            exitPrice,
            stopViolated: exitPrice < plannedStop && sellTrade.realizedPnlSol < 0,
            hitTarget: plannedTarget && exitPrice >= plannedTarget
          };
          return { penalty, reasons };
        },
        // Calculate R-Multiple for a trade (requires defined risk)
        calculateRMultiple(sellTrade, state) {
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          const buyTrade = trades.find(
            (t) => t.side === "BUY" && t.mint === sellTrade.mint && t.ts < sellTrade.ts && t.riskDefined
          );
          if (!buyTrade || !buyTrade.plannedStop)
            return null;
          const entryPrice = buyTrade.priceUsd;
          const exitPrice = sellTrade.priceUsd;
          const stopPrice = buyTrade.plannedStop;
          const riskPerUnit = entryPrice - stopPrice;
          if (riskPerUnit <= 0)
            return null;
          const pnlPerUnit = exitPrice - entryPrice;
          const rMultiple = pnlPerUnit / riskPerUnit;
          return {
            rMultiple: parseFloat(rMultiple.toFixed(2)),
            entryPrice,
            exitPrice,
            stopPrice,
            riskPerUnit,
            pnlPerUnit
          };
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
          if (!state.session.equityHistory)
            state.session.equityHistory = [];
          state.session.equityHistory.push({
            ts: Date.now(),
            equity: state.session.balance + (state.session.realized || 0)
          });
          if (state.session.equityHistory.length > 50)
            state.session.equityHistory.shift();
          this.detectTilt(trade, state);
          this.detectFomo(trade, state);
          this.detectPanicSell(trade, state);
          this.detectSunkCost(trade, state);
          this.detectStrategyDrift(trade, state);
          this.monitorMarketRegime(state);
          this.updateProfile(state);
        },
        monitorMarketRegime(state) {
          const flags = FeatureManager.resolveFlags(state, "ADVANCED_COACHING");
          if (!flags.enabled)
            return;
          const ctx = Market.context;
          if (!ctx)
            return;
          const vol = ctx.vol24h;
          const chg = Math.abs(ctx.priceChange24h);
          if (vol < 5e5 && Date.now() - (state.lastRegimeAlert || 0) > 36e5) {
            this.addAlert(state, "MARKET_REGIME", "\u{1F4C9} LOW VOLUME: Liquidity is thin ($<500k). Slippage may be high.");
            state.lastRegimeAlert = Date.now();
          }
          if (chg > 50 && Date.now() - (state.lastRegimeAlert || 0) > 36e5) {
            this.addAlert(state, "MARKET_REGIME", "\u26A0\uFE0F HIGH VOLATILITY: 24h change is >50%. Expect rapid swings.");
            state.lastRegimeAlert = Date.now();
          }
        },
        detectTilt(trade, state) {
          const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
          if (!flags.enabled)
            return;
          const lossStreak = state.session.lossStreak || 0;
          if (lossStreak >= 3) {
            this.addAlert(state, "TILT", `\u26A0\uFE0F TILT DETECTED: ${lossStreak} Losses in a row. Take a break.`);
            state.behavior.tiltFrequency = (state.behavior.tiltFrequency || 0) + 1;
          }
        },
        detectSunkCost(trade, state) {
          if (trade.side !== "BUY")
            return;
          const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
          if (!flags.enabled)
            return;
          const pos = state.positions[trade.mint];
          if (pos && (pos.pnlSol || 0) < 0) {
            this.addAlert(state, "SUNK_COST", "\u{1F4C9} SUNK COST: Averaging down into a losing position increases risk.");
            state.behavior.sunkCostFrequency = (state.behavior.sunkCostFrequency || 0) + 1;
          }
        },
        detectOvertrading(state) {
          const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
          if (!flags.enabled)
            return;
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          if (trades.length < 5)
            return;
          const last5 = trades.slice(-5);
          const timeSpan = last5[4].ts - last5[0].ts;
          if (timeSpan < 3e5) {
            this.addAlert(state, "VELOCITY", "\u26A0\uFE0F OVERTRADING: You're trading too fast. Stop and evaluate setups.");
            state.behavior.overtradingFrequency = (state.behavior.overtradingFrequency || 0) + 1;
          }
        },
        monitorProfitOverstay(state) {
          const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
          if (!flags.enabled)
            return;
          Object.values(state.positions).forEach((pos) => {
            const pnlPct = pos.pnlPct || 0;
            const peakPct = pos.peakPnlPct !== void 0 ? pos.peakPnlPct : 0;
            if (peakPct > 10 && pnlPct < 0) {
              if (!pos.alertedGreenToRed) {
                this.addAlert(state, "PROFIT_NEGLECT", `\u{1F34F} GREEN-TO-RED: ${pos.symbol} was up 10%+. Don't let winners die.`);
                pos.alertedGreenToRed = true;
                state.behavior.profitNeglectFrequency = (state.behavior.profitNeglectFrequency || 0) + 1;
              }
            }
          });
        },
        detectStrategyDrift(trade, state) {
          if (trade.side !== "BUY")
            return;
          const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
          if (!flags.enabled)
            return;
          if (trade.strategy === "Unknown" || trade.strategy === "Other") {
            const trades = Object.values(state.trades || {});
            const profitableStrategies = trades.filter((t) => (t.realizedPnlSol || 0) > 0 && t.strategy !== "Unknown").map((t) => t.strategy);
            if (profitableStrategies.length >= 3) {
              this.addAlert(state, "DRIFT", "\u{1F575}\uFE0F STRATEGY DRIFT: Playing 'Unknown' instead of your winning setups.");
              state.behavior.strategyDriftFrequency = (state.behavior.strategyDriftFrequency || 0) + 1;
            }
          }
        },
        detectFomo(trade, state) {
          if (trade.side !== "BUY")
            return;
          const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
          if (!flags.enabled)
            return;
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;
          if (prevTrade && trade.ts - prevTrade.ts < 3e4 && prevTrade.side === "SELL" && (prevTrade.realizedPnlSol || 0) < 0) {
            this.addAlert(state, "FOMO", "\u{1F6A8} FOMO ALERT: Revenge trading detected.");
            state.behavior.fomoTrades = (state.behavior.fomoTrades || 0) + 1;
          }
        },
        detectPanicSell(trade, state) {
          if (trade.side !== "SELL")
            return;
          const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
          if (!flags.enabled)
            return;
          if (trade.entryTs && trade.ts - trade.entryTs < 45e3 && (trade.realizedPnlSol || 0) < 0) {
            this.addAlert(state, "PANIC", "\u{1F631} PANIC SELL: You're cutting too early. Trust your stops.");
            state.behavior.panicSells = (state.behavior.panicSells || 0) + 1;
          }
        },
        addAlert(state, type, message) {
          if (!state.session.activeAlerts)
            state.session.activeAlerts = [];
          const alert = { type, message, ts: Date.now() };
          state.session.activeAlerts.push(alert);
          if (state.session.activeAlerts.length > 3)
            state.session.activeAlerts.shift();
          this.logAlertEvent(state, type, message);
          console.log(`[ELITE ALERT] ${type}: ${message}`);
        },
        updateProfile(state) {
          const b = state.behavior;
          const totalMistakes = (b.tiltFrequency || 0) + (b.fomoTrades || 0) + (b.panicSells || 0);
          if (totalMistakes === 0)
            b.profile = "Disciplined";
          else if (b.tiltFrequency > 2)
            b.profile = "Emotional";
          else if (b.fomoTrades > 2)
            b.profile = "Impulsive";
          else if (b.panicSells > 2)
            b.profile = "Hesitant";
          else
            b.profile = "Improving";
        },
        getProfessorDebrief(state) {
          const score = state.session.disciplineScore !== void 0 ? state.session.disciplineScore : 100;
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
          const trades = Object.values(state.trades || {});
          const sellTrades = trades.filter((t) => t.side === "SELL");
          const wins = sellTrades.filter((t) => (t.realizedPnlSol || 0) > 0).length;
          const losses = sellTrades.filter((t) => (t.realizedPnlSol || 0) < 0).length;
          const totalPnl = state.session.realized || 0;
          const winRate = sellTrades.length > 0 ? (wins / sellTrades.length * 100).toFixed(0) : 0;
          const disciplineScore = state.session.disciplineScore || 100;
          const winStreak = state.session.winStreak || 0;
          const lossStreak = state.session.lossStreak || 0;
          const currentStreak = winStreak > 0 ? `${winStreak}W` : lossStreak > 0 ? `${lossStreak}L` : "0";
          const pnlFormatted = totalPnl >= 0 ? `+${totalPnl.toFixed(3)}` : totalPnl.toFixed(3);
          const pnlTag = totalPnl >= 0 ? "[PROFIT]" : "[DRAWDOWN]";
          let text = `ZER\xD8 Trading Session Complete

`;
          text += `${pnlTag} P&L: ${pnlFormatted} SOL
`;
          text += `WIN RATE: ${winRate}%
`;
          text += `HISTORY: ${wins}W / ${losses}L
`;
          text += `STREAK: ${currentStreak}
`;
          text += `DISCIPLINE: ${disciplineScore}/100

`;
          if (winRate >= 70) {
            text += `Systematic Excellence. \u{1F4AA}

`;
          } else if (winRate >= 50) {
            text += `Disciplined Execution. \u{1F4CA}

`;
          } else if (sellTrades.length >= 3) {
            text += `Baseline Established. \u{1F4DA}

`;
          }
          text += `Paper trading with ZER\xD8 on Solana
`;
          text += `#Solana #PaperTrading #Crypto`;
          return text;
        },
        // ==========================================
        // EXPORT FUNCTIONALITY
        // ==========================================
        exportToCSV(state) {
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          if (trades.length === 0)
            return null;
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
            "Entry Thesis"
          ];
          const rows = trades.map((t) => [
            t.id,
            new Date(t.ts).toISOString(),
            t.side,
            t.symbol || "",
            t.mint || "",
            t.solAmount?.toFixed(6) || "",
            t.tokenQty?.toFixed(6) || "",
            t.priceUsd?.toFixed(8) || "",
            t.marketCap?.toFixed(2) || "",
            t.realizedPnlSol?.toFixed(6) || "",
            t.strategy || "",
            t.emotion || "",
            t.mode || "paper",
            t.plannedStop?.toFixed(8) || "",
            t.plannedTarget?.toFixed(8) || "",
            t.riskDefined ? "Yes" : "No",
            `"${(t.entryThesis || "").replace(/"/g, '""')}"`
          ]);
          const csvContent = [
            headers.join(","),
            ...rows.map((r) => r.join(","))
          ].join("\n");
          return csvContent;
        },
        exportToJSON(state) {
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          const session = state.session || {};
          const behavior = state.behavior || {};
          const exportData = {
            exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
            version: state.version || "1.0.0",
            session: {
              balance: session.balance,
              equity: session.equity,
              realized: session.realized,
              winStreak: session.winStreak,
              lossStreak: session.lossStreak,
              disciplineScore: session.disciplineScore,
              tradeCount: trades.length
            },
            behavior: {
              profile: behavior.profile,
              tiltFrequency: behavior.tiltFrequency,
              fomoTrades: behavior.fomoTrades,
              panicSells: behavior.panicSells,
              sunkCostFrequency: behavior.sunkCostFrequency,
              overtradingFrequency: behavior.overtradingFrequency,
              profitNeglectFrequency: behavior.profitNeglectFrequency
            },
            analytics: this.analyzeRecentTrades(state),
            trades: trades.map((t) => ({
              id: t.id,
              timestamp: new Date(t.ts).toISOString(),
              side: t.side,
              symbol: t.symbol,
              mint: t.mint,
              solAmount: t.solAmount,
              tokenQty: t.tokenQty,
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
                riskDefined: t.riskDefined
              },
              planAdherence: t.planAdherence || null
            }))
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
          const filename = `zero_trades_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
          this.downloadExport(csv, filename, "text/csv;charset=utf-8;");
          return true;
        },
        exportSessionAsJSON(state) {
          const json = this.exportToJSON(state);
          const filename = `zero_session_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
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
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          if (trades.length < 10) {
            return {
              ready: false,
              message: "Need 10+ trades to generate your profile",
              tradesNeeded: 10 - trades.length
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
            emotionalPatterns: this._analyzeEmotionalPatterns(trades, state)
          };
        },
        _analyzeBestStrategies(buyTrades, sellTrades, allTrades) {
          const strategyStats = {};
          buyTrades.forEach((buy) => {
            const strat = buy.strategy || "Unknown";
            if (!strategyStats[strat]) {
              strategyStats[strat] = { count: 0, wins: 0, totalPnl: 0, avgHoldTime: 0, trades: [] };
            }
            strategyStats[strat].count++;
            strategyStats[strat].trades.push(buy);
          });
          sellTrades.forEach((sell) => {
            const matchingBuy = allTrades.find(
              (t) => t.side === "BUY" && t.mint === sell.mint && t.ts < sell.ts
            );
            if (matchingBuy) {
              const strat = matchingBuy.strategy || "Unknown";
              if (strategyStats[strat]) {
                const pnl = sell.realizedPnlSol || 0;
                strategyStats[strat].totalPnl += pnl;
                if (pnl > 0)
                  strategyStats[strat].wins++;
                strategyStats[strat].avgHoldTime += sell.ts - matchingBuy.ts;
              }
            }
          });
          const results = Object.entries(strategyStats).filter(([_, s]) => s.count >= 2).map(([name, s]) => ({
            name,
            count: s.count,
            winRate: s.count > 0 ? (s.wins / s.count * 100).toFixed(1) : 0,
            totalPnl: s.totalPnl,
            avgPnl: s.count > 0 ? s.totalPnl / s.count : 0,
            avgHoldTime: s.wins > 0 ? Math.round(s.avgHoldTime / s.wins / 6e4) : 0
            // in minutes
          })).sort((a, b) => b.totalPnl - a.totalPnl);
          return {
            top: results.slice(0, 3),
            worst: results.filter((s) => s.totalPnl < 0).sort((a, b) => a.totalPnl - b.totalPnl).slice(0, 2),
            mostUsed: results.sort((a, b) => b.count - a.count)[0] || null
          };
        },
        _analyzeWorstConditions(trades, state) {
          const conditions = [];
          let afterLossWins = 0, afterLossTotal = 0;
          for (let i = 1; i < trades.length; i++) {
            if (trades[i - 1].side === "SELL" && (trades[i - 1].realizedPnlSol || 0) < 0) {
              afterLossTotal++;
              if (trades[i].side === "SELL" && (trades[i].realizedPnlSol || 0) > 0) {
                afterLossWins++;
              }
            }
          }
          if (afterLossTotal >= 3) {
            const afterLossWinRate = (afterLossWins / afterLossTotal * 100).toFixed(0);
            if (afterLossWinRate < 40) {
              conditions.push({
                type: "AFTER_LOSS",
                label: "After Losing Trades",
                severity: "high",
                stat: `${afterLossWinRate}% win rate`,
                advice: "Take a 5-minute break after losses before your next trade."
              });
            }
          }
          let rapidWins = 0, rapidTotal = 0;
          for (let i = 1; i < trades.length; i++) {
            if (trades[i].ts - trades[i - 1].ts < 12e4) {
              rapidTotal++;
              if (trades[i].side === "SELL" && (trades[i].realizedPnlSol || 0) > 0) {
                rapidWins++;
              }
            }
          }
          if (rapidTotal >= 3) {
            const rapidWinRate = (rapidWins / rapidTotal * 100).toFixed(0);
            if (rapidWinRate < 35) {
              conditions.push({
                type: "RAPID_TRADING",
                label: "Rapid-Fire Trading",
                severity: "high",
                stat: `${rapidWinRate}% win rate`,
                advice: "Slow down. Wait at least 2 minutes between trades."
              });
            }
          }
          const avgSize = trades.filter((t) => t.side === "BUY").reduce((sum, t) => sum + (t.solAmount || 0), 0) / trades.filter((t) => t.side === "BUY").length;
          let largeWins = 0, largeTotal = 0;
          trades.filter((t) => t.side === "SELL").forEach((t) => {
            const matchingBuy = trades.find((b) => b.side === "BUY" && b.mint === t.mint && b.ts < t.ts);
            if (matchingBuy && matchingBuy.solAmount > avgSize * 1.5) {
              largeTotal++;
              if ((t.realizedPnlSol || 0) > 0)
                largeWins++;
            }
          });
          if (largeTotal >= 2) {
            const largeWinRate = (largeWins / largeTotal * 100).toFixed(0);
            if (largeWinRate < 40) {
              conditions.push({
                type: "LARGE_POSITIONS",
                label: "Oversized Positions",
                severity: "medium",
                stat: `${largeWinRate}% win rate`,
                advice: "Your large trades underperform. Stick to consistent sizing."
              });
            }
          }
          const sessionTrades = this._groupBySession(trades, state);
          let lateWins = 0, lateTotal = 0;
          sessionTrades.forEach((session) => {
            if (session.length < 5)
              return;
            const sessionStart = session[0].ts;
            const lateThreshold = sessionStart + 60 * 60 * 1e3;
            session.filter((t) => t.ts > lateThreshold && t.side === "SELL").forEach((t) => {
              lateTotal++;
              if ((t.realizedPnlSol || 0) > 0)
                lateWins++;
            });
          });
          if (lateTotal >= 3) {
            const lateWinRate = (lateWins / lateTotal * 100).toFixed(0);
            if (lateWinRate < 35) {
              conditions.push({
                type: "LATE_SESSION",
                label: "Extended Sessions",
                severity: "medium",
                stat: `${lateWinRate}% win rate`,
                advice: "Your performance drops after 1 hour. Consider shorter sessions."
              });
            }
          }
          return conditions.sort((a, b) => (b.severity === "high" ? 1 : 0) - (a.severity === "high" ? 1 : 0));
        },
        _analyzeOptimalSessionLength(trades, state) {
          const sessionTrades = this._groupBySession(trades, state);
          if (sessionTrades.length < 2) {
            return { optimal: null, message: "Need more session data" };
          }
          const sessionPerformance = sessionTrades.map((session) => {
            const duration = session.length > 0 ? (session[session.length - 1].ts - session[0].ts) / 6e4 : 0;
            const sells = session.filter((t) => t.side === "SELL");
            const pnl = sells.reduce((sum, t) => sum + (t.realizedPnlSol || 0), 0);
            const wins = sells.filter((t) => (t.realizedPnlSol || 0) > 0).length;
            const winRate = sells.length > 0 ? wins / sells.length * 100 : 0;
            return { duration, pnl, winRate, tradeCount: session.length };
          });
          const buckets = {
            short: { range: "< 30 min", sessions: [], avgPnl: 0, avgWinRate: 0 },
            medium: { range: "30-60 min", sessions: [], avgPnl: 0, avgWinRate: 0 },
            long: { range: "60-120 min", sessions: [], avgPnl: 0, avgWinRate: 0 },
            extended: { range: "> 120 min", sessions: [], avgPnl: 0, avgWinRate: 0 }
          };
          sessionPerformance.forEach((s) => {
            if (s.duration < 30)
              buckets.short.sessions.push(s);
            else if (s.duration < 60)
              buckets.medium.sessions.push(s);
            else if (s.duration < 120)
              buckets.long.sessions.push(s);
            else
              buckets.extended.sessions.push(s);
          });
          Object.values(buckets).forEach((b) => {
            if (b.sessions.length > 0) {
              b.avgPnl = b.sessions.reduce((sum, s) => sum + s.pnl, 0) / b.sessions.length;
              b.avgWinRate = b.sessions.reduce((sum, s) => sum + s.winRate, 0) / b.sessions.length;
            }
          });
          const best = Object.entries(buckets).filter(([_, b]) => b.sessions.length >= 1).sort((a, b) => b[1].avgPnl - a[1].avgPnl)[0];
          return {
            optimal: best ? best[1].range : null,
            bestPnl: best ? best[1].avgPnl.toFixed(4) : 0,
            bestWinRate: best ? best[1].avgWinRate.toFixed(1) : 0,
            buckets: Object.fromEntries(
              Object.entries(buckets).map(([k, v]) => [k, {
                range: v.range,
                count: v.sessions.length,
                avgPnl: v.avgPnl.toFixed(4),
                avgWinRate: v.avgWinRate.toFixed(1)
              }])
            )
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
            night: { range: "12AM-6AM", wins: 0, total: 0, pnl: 0 }
          };
          sellTrades.forEach((t) => {
            const hour = new Date(t.ts).getHours();
            let slot;
            if (hour >= 6 && hour < 12)
              slot = "morning";
            else if (hour >= 12 && hour < 18)
              slot = "afternoon";
            else if (hour >= 18 && hour < 24)
              slot = "evening";
            else
              slot = "night";
            timeSlots[slot].total++;
            timeSlots[slot].pnl += t.realizedPnlSol || 0;
            if ((t.realizedPnlSol || 0) > 0)
              timeSlots[slot].wins++;
          });
          const results = Object.entries(timeSlots).filter(([_, s]) => s.total >= 2).map(([name, s]) => ({
            name,
            range: s.range,
            winRate: s.total > 0 ? (s.wins / s.total * 100).toFixed(1) : 0,
            pnl: s.pnl,
            count: s.total
          })).sort((a, b) => b.pnl - a.pnl);
          return {
            best: results[0] || null,
            worst: results[results.length - 1] || null,
            breakdown: results
          };
        },
        _determineTradingStyle(trades) {
          const sellTrades = trades.filter((t) => t.side === "SELL");
          if (sellTrades.length < 5)
            return { style: "Unknown", description: "Need more data" };
          let totalHoldTime = 0, holdCount = 0;
          sellTrades.forEach((sell) => {
            const buy = trades.find((t) => t.side === "BUY" && t.mint === sell.mint && t.ts < sell.ts);
            if (buy) {
              totalHoldTime += sell.ts - buy.ts;
              holdCount++;
            }
          });
          const avgHoldMinutes = holdCount > 0 ? totalHoldTime / holdCount / 6e4 : 0;
          if (avgHoldMinutes < 5) {
            return { style: "Scalper", description: "Quick in-and-out trades, high frequency", avgHold: avgHoldMinutes.toFixed(1) };
          } else if (avgHoldMinutes < 30) {
            return { style: "Day Trader", description: "Short-term positions, momentum focused", avgHold: avgHoldMinutes.toFixed(1) };
          } else if (avgHoldMinutes < 120) {
            return { style: "Swing Trader", description: "Medium holds, trend following", avgHold: avgHoldMinutes.toFixed(1) };
          } else {
            return { style: "Position Trader", description: "Long holds, conviction plays", avgHold: avgHoldMinutes.toFixed(1) };
          }
        },
        _analyzeRiskProfile(buyTrades, state) {
          if (buyTrades.length < 3)
            return { profile: "Unknown", avgRisk: 0 };
          const startSol = state.settings?.startSol || 10;
          const riskPcts = buyTrades.map((t) => t.solAmount / startSol * 100);
          const avgRisk = riskPcts.reduce((a, b) => a + b, 0) / riskPcts.length;
          const maxRisk = Math.max(...riskPcts);
          const plansUsed = buyTrades.filter((t) => t.riskDefined).length;
          const planRate = (plansUsed / buyTrades.length * 100).toFixed(0);
          let profile;
          if (avgRisk < 5)
            profile = "Conservative";
          else if (avgRisk < 15)
            profile = "Moderate";
          else if (avgRisk < 30)
            profile = "Aggressive";
          else
            profile = "High Risk";
          return {
            profile,
            avgRisk: avgRisk.toFixed(1),
            maxRisk: maxRisk.toFixed(1),
            planUsageRate: planRate,
            plansUsed
          };
        },
        _analyzeEmotionalPatterns(trades, state) {
          const behavior = state.behavior || {};
          const patterns = [];
          if ((behavior.fomoTrades || 0) > 2) {
            patterns.push({ type: "FOMO", frequency: behavior.fomoTrades, advice: "Wait 60 seconds before entering after seeing green candles." });
          }
          if ((behavior.panicSells || 0) > 2) {
            patterns.push({ type: "Panic Selling", frequency: behavior.panicSells, advice: "Set stop losses in advance and trust them." });
          }
          if ((behavior.tiltFrequency || 0) > 1) {
            patterns.push({ type: "Tilt Trading", frequency: behavior.tiltFrequency, advice: "Take a mandatory break after 3 consecutive losses." });
          }
          if ((behavior.sunkCostFrequency || 0) > 1) {
            patterns.push({ type: "Sunk Cost Bias", frequency: behavior.sunkCostFrequency, advice: "Never average down more than once per position." });
          }
          return patterns;
        },
        _groupBySession(trades, state) {
          const sessions = [];
          let currentSession = [];
          const SESSION_GAP = 30 * 60 * 1e3;
          trades.forEach((trade, i) => {
            if (i === 0) {
              currentSession.push(trade);
            } else if (trade.ts - trades[i - 1].ts > SESSION_GAP) {
              if (currentSession.length > 0)
                sessions.push(currentSession);
              currentSession = [trade];
            } else {
              currentSession.push(trade);
            }
          });
          if (currentSession.length > 0)
            sessions.push(currentSession);
          return sessions;
        },
        calculateConsistencyScore(state) {
          const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
          if (trades.length < 5) {
            return { score: null, message: "Need 5+ trades for consistency score", breakdown: null };
          }
          const breakdown = {
            winRateStability: 0,
            sizingConsistency: 0,
            frequencyStability: 0,
            strategyFocus: 0
          };
          const sellTrades = trades.filter((t) => t.side === "SELL");
          if (sellTrades.length >= 5) {
            const windowSize = Math.min(5, Math.floor(sellTrades.length / 2));
            const rollingWinRates = [];
            for (let i = windowSize; i <= sellTrades.length; i++) {
              const window2 = sellTrades.slice(i - windowSize, i);
              const wins = window2.filter((t) => (t.realizedPnlSol || 0) > 0).length;
              rollingWinRates.push(wins / windowSize);
            }
            if (rollingWinRates.length > 1) {
              const avg = rollingWinRates.reduce((a, b) => a + b, 0) / rollingWinRates.length;
              const variance = rollingWinRates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / rollingWinRates.length;
              const stdDev = Math.sqrt(variance);
              breakdown.winRateStability = Math.max(0, 25 - stdDev * 100);
            } else {
              breakdown.winRateStability = 20;
            }
          } else {
            breakdown.winRateStability = 15;
          }
          const buyTrades = trades.filter((t) => t.side === "BUY");
          if (buyTrades.length >= 3) {
            const sizes = buyTrades.map((t) => t.solAmount);
            const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
            const variance = sizes.reduce((sum, s) => sum + Math.pow(s - avgSize, 2), 0) / sizes.length;
            const cv = Math.sqrt(variance) / avgSize;
            breakdown.sizingConsistency = Math.max(0, 25 - cv * 25);
          } else {
            breakdown.sizingConsistency = 15;
          }
          if (trades.length >= 4) {
            const intervals = [];
            for (let i = 1; i < trades.length; i++) {
              intervals.push(trades[i].ts - trades[i - 1].ts);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
            const cv = Math.sqrt(variance) / avgInterval;
            breakdown.frequencyStability = Math.max(0, 25 - cv * 12.5);
          } else {
            breakdown.frequencyStability = 15;
          }
          const strategyCounts = {};
          buyTrades.forEach((t) => {
            const strat = t.strategy || "Unknown";
            strategyCounts[strat] = (strategyCounts[strat] || 0) + 1;
          });
          const sortedStrategies = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1]);
          const top2Count = sortedStrategies.slice(0, 2).reduce((sum, [_, count]) => sum + count, 0);
          const focusRatio = buyTrades.length > 0 ? top2Count / buyTrades.length : 0;
          breakdown.strategyFocus = focusRatio * 25;
          const score = Math.round(
            breakdown.winRateStability + breakdown.sizingConsistency + breakdown.frequencyStability + breakdown.strategyFocus
          );
          let message = "";
          if (score >= 80)
            message = "Highly consistent trading patterns";
          else if (score >= 60)
            message = "Good consistency, minor variations";
          else if (score >= 40)
            message = "Moderate consistency, room for improvement";
          else
            message = "Inconsistent patterns detected";
          return {
            score,
            message,
            breakdown: {
              winRateStability: Math.round(breakdown.winRateStability),
              sizingConsistency: Math.round(breakdown.sizingConsistency),
              frequencyStability: Math.round(breakdown.frequencyStability),
              strategyFocus: Math.round(breakdown.strategyFocus)
            }
          };
        }
      };
    }
  });

  // src/content.boot.js
  init_store();
  init_featureManager();

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

/* Market Context HUD Styles */
.market-context-container {
    padding: 2px 0;
}

.market-badge {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(13, 17, 23, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
}

.market-badge.gated {
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px dashed rgba(168, 85, 247, 0.3);
    color: #a855f7;
    justify-content: center;
    gap: 8px;
    font-weight: 700;
}

.market-badge.loading {
    justify-content: center;
    color: #64748b;
    font-style: italic;
}

.market-badge .mitem {
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
}

.market-badge .mitem span {
    color: #f8fafc;
    margin-left: 4px;
}

/* Trade Plan Section Styles */
.trade-plan-section {
    margin-top: 14px;
    padding: 12px;
    background: rgba(99, 102, 241, 0.05);
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: 10px;
}

.trade-plan-section.gated {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
    border: 1px dashed rgba(99, 102, 241, 0.3);
    cursor: pointer;
    text-align: center;
    padding: 16px 12px;
    transition: all 0.2s;
}

.trade-plan-section.gated:hover {
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.1);
}

.plan-gated-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #6366f1;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.plan-gated-hint {
    color: #64748b;
    font-size: 10px;
    margin-top: 4px;
}

.plan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.plan-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.plan-title svg {
    color: #6366f1;
}

.plan-tag {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 8px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.5px;
}

.plan-row {
    display: flex;
    gap: 10px;
}

.plan-field {
    flex: 1;
}

.plan-field.full {
    margin-top: 10px;
}

.plan-label {
    display: block;
    color: #64748b;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
}

.plan-label .optional {
    color: #475569;
    font-weight: 500;
    text-transform: none;
}

.plan-input-wrap {
    display: flex;
    align-items: center;
    background: #161b22;
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 6px;
    overflow: hidden;
    transition: border-color 0.2s;
}

.plan-input-wrap:focus-within {
    border-color: #6366f1;
}

.plan-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    outline: none;
    width: 100%;
    min-width: 0;
}

.plan-input::placeholder {
    color: #475569;
}

.plan-unit {
    color: #64748b;
    font-size: 10px;
    font-weight: 600;
    padding-right: 10px;
    text-transform: uppercase;
}

.plan-textarea {
    width: 100%;
    background: #161b22;
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 6px;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
    resize: none;
    transition: border-color 0.2s;
}

.plan-textarea::placeholder {
    color: #475569;
}

.plan-textarea:focus {
    border-color: #6366f1;
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

/* Paywall Modal */
.paywall-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
  animation: fadeIn 0.2s ease;
}

.paywall-modal {
  background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 20px;
  padding: 0;
  width: 460px;
  max-width: 90vw;
  box-shadow: 0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1);
  font-family: 'Inter', sans-serif;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.paywall-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%);
  border-bottom: 1px solid rgba(99,102,241,0.15);
}

.paywall-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.3);
}

.badge-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.paywall-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
  padding: 4px 8px;
  line-height: 1;
}

.paywall-close:hover {
  color: #f8fafc;
}

.paywall-hero {
  padding: 28px 24px 24px;
  text-align: center;
}

.paywall-title {
  font-size: 24px;
  font-weight: 800;
  color: #f8fafc;
  margin: 0 0 8px 0;
  line-height: 1.2;
}

.paywall-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.5;
}

.paywall-features {
  padding: 0 24px 24px;
  display: grid;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: rgba(15,23,42,0.6);
  border: 1px solid rgba(99,102,241,0.1);
  border-radius: 12px;
  transition: all 0.2s;
}

.feature-item:hover {
  background: rgba(99,102,241,0.05);
  border-color: rgba(99,102,241,0.2);
  transform: translateX(4px);
}

.feature-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.feature-text {
  flex: 1;
}

.feature-name {
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.paywall-pricing {
  padding: 20px 24px;
  text-align: center;
  background: rgba(99,102,241,0.05);
  border-top: 1px solid rgba(99,102,241,0.1);
  border-bottom: 1px solid rgba(99,102,241,0.1);
}

.price-tag {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 6px;
}

.price-amount {
  font-size: 36px;
  font-weight: 800;
  color: #6366f1;
  line-height: 1;
}

.price-period {
  font-size: 16px;
  color: #94a3b8;
  font-weight: 600;
}

.price-subtext {
  font-size: 11px;
  color: #64748b;
}

.paywall-actions {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.paywall-btn {
  padding: 14px 24px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.paywall-btn.primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(99,102,241,0.4);
}

.paywall-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99,102,241,0.5);
}

.paywall-btn.secondary {
  background: rgba(99,102,241,0.1);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.2);
}

.paywall-btn.secondary:hover {
  background: rgba(99,102,241,0.15);
  border-color: rgba(99,102,241,0.3);
}

.btn-icon {
  font-size: 16px;
}

.paywall-footer {
  padding: 16px 24px 24px;
  text-align: center;
}

.paywall-footer p {
  font-size: 11px;
  color: #64748b;
  margin: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* PRO Tag */
.pro-tag {
  display: inline-block;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 8px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  letter-spacing: 0.5px;
  vertical-align: middle;
  box-shadow: 0 2px 6px rgba(99,102,241,0.3);
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

  // src/modules/ui/elite-styles.js
  var ELITE_CSS = `
.elite-alert-overlay {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
    width: 400px;
}

.elite-alert {
    background: rgba(13, 17, 23, 0.95);
    border: 1px solid rgba(245, 158, 11, 0.5);
    border-radius: 12px;
    padding: 12px 20px;
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 12px;
    pointer-events: auto;
    animation: alertSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    width: 100%;
}

.elite-alert.TILT { border-color: #ef4444; border-left: 4px solid #ef4444; }
.elite-alert.FOMO { border-color: #f59e0b; border-left: 4px solid #f59e0b; }
.elite-alert.PANIC { border-color: #6366f1; border-left: 4px solid #6366f1; }
.elite-alert.SUNK_COST { border-color: #a855f7; border-left: 4px solid #a855f7; }
.elite-alert.VELOCITY { border-color: #ec4899; border-left: 4px solid #ec4899; }
.elite-alert.PROFIT_NEGLECT { border-color: #10b981; border-left: 4px solid #10b981; }
.elite-alert.DRIFT { border-color: #06b6d4; border-left: 4px solid #06b6d4; }
.elite-alert.MARKET_REGIME { border-color: #fbbf24; border-left: 4px solid #fbbf24; }

.elite-alert-close {
    margin-left: auto;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
}

@keyframes alertSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes alertFadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
}

.behavior-profile-card {
    margin-top: 24px;
    padding: 20px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 16px;
}

.behavior-tag {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
}

.behavior-tag.Disciplined { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.behavior-tag.Impulsive { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.behavior-tag.Emotional { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.behavior-tag.Hesitant { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
.behavior-tag.Improving { background: rgba(20, 184, 166, 0.2); color: #14b8a6; }

.behavior-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 16px;
}

.behavior-stat-item {
    text-align: center;
}

.behavior-stat-item .k { font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
.behavior-stat-item .v { font-size: 16px; font-weight: 800; color: #f8fafc; }
`;

  // src/modules/ui/styles.js
  var CSS = COMMON_CSS + BANNER_CSS + PNL_HUD_CSS + BUY_HUD_CSS + MODALS_CSS + PROFESSOR_CSS + THEME_OVERRIDES_CSS + ELITE_CSS;

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

  // src/content.boot.js
  init_market();

  // src/modules/ui/hud.js
  init_store();
  init_market();

  // src/modules/ui/banner.js
  init_store();
  init_featureManager();

  // src/modules/ui/icons.js
  var ICONS = {
    // Brand & Status
    ZERO: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 8-8 8"/><path d="m8 8 8 8"/></svg>`,
    // Trading
    WIN: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    LOSS: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
    TARGET: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    // Psychological / Alerts
    TILT: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    FOMO: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    PANIC: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 12L2.1 14.9"/><path d="M12 12l9.9 2.9"/><path d="M12 12L7.5 2.1"/><path d="M12 12l4.5-9.9"/></svg>`,
    SUNK_COST: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17l10-10"/></svg>`,
    VELOCITY: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    // General UI
    LOCK: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    BRAIN: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.97-3.06 2.5 2.5 0 0 1-1.95-4.36 2.5 2.5 0 0 1 2-4.11 2.5 2.5 0 0 1 5.38-2.45Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.97-3.06 2.5 2.5 0 0 0 1.95-4.36 2.5 2.5 0 0 0-2-4.11 2.5 2.5 0 0 0-5.38-2.45Z"/></svg>`,
    SHARE: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V4a2 2 0 0 1 2-2h10l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/><path d="M14 2v4h4"/><path d="m8 18 3 3 6-6"/></svg>`,
    X: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    DOWNLOAD: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    FILE_JSON: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/></svg>`,
    FILE_CSV: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    USER: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    CHART_BAR: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
    CLOCK: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    ALERT_CIRCLE: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    TROPHY: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`
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
      this.updateAlerts();
    },
    updateAlerts() {
      const root = OverlayManager.getShadowRoot();
      if (!root || !Store.state)
        return;
      const flags = FeatureManager.resolveFlags(Store.state, "TILT_DETECTION");
      if (!flags.visible || !Store.state.settings.behavioralAlerts) {
        const existing = root.getElementById("elite-alert-container");
        if (existing)
          existing.remove();
        return;
      }
      let container = root.getElementById("elite-alert-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "elite-alert-container";
        container.className = "elite-alert-overlay";
        root.appendChild(container);
      }
      const alerts = Store.state.session.activeAlerts || [];
      const existingIds = Array.from(container.children).map((c) => c.dataset.ts);
      alerts.forEach((alert) => {
        if (!existingIds.includes(alert.ts.toString())) {
          const el = document.createElement("div");
          el.className = `elite-alert ${alert.type}`;
          el.dataset.ts = alert.ts;
          el.innerHTML = `
                    <div class="alert-icon" style="flex-shrink:0; display:flex;">
                        ${ICONS[alert.type] || ICONS.TILT}
                    </div>
                    <div class="alert-msg">${alert.message}</div>
                    <button class="elite-alert-close">${ICONS.X}</button>
                `;
          el.querySelector(".elite-alert-close").onclick = () => {
            el.style.animation = "alertFadeOut 0.3s forwards";
            setTimeout(() => el.remove(), 300);
          };
          container.appendChild(el);
          setTimeout(() => {
            if (el.parentNode) {
              el.style.animation = "alertFadeOut 0.3s forwards";
              setTimeout(() => el.remove(), 300);
            }
          }, 5e3);
        }
      });
    }
  };

  // src/modules/ui/pnl-hud.js
  init_store();
  init_featureManager();

  // src/modules/core/pnl-calculator.js
  init_market();
  init_store();
  var PnlCalculator = {
    cachedSolPrice: 200,
    // Default fallback
    lastValidSolPrice: null,
    // Stores last successful API fetch
    lastSolPriceFetch: 0,
    priceUpdateInterval: null,
    lastPriceSave: 0,
    // Initialize price fetching on load
    init() {
      this.fetchSolPriceBackground();
      if (!this.priceUpdateInterval) {
        this.priceUpdateInterval = setInterval(() => {
          this.fetchSolPriceBackground();
        }, 6e4);
      }
    },
    // Background fetch - never blocks, updates cache silently
    async fetchSolPriceBackground() {
      console.log("[PNL] Fetching SOL price from CoinGecko...");
      try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
          signal: AbortSignal.timeout(5e3)
          // Increase timeout from 3s to 5s
        });
        const data = await response.json();
        const solPrice = data?.solana?.usd;
        if (solPrice && solPrice > 50 && solPrice < 500) {
          this.cachedSolPrice = solPrice;
          this.lastValidSolPrice = solPrice;
          this.lastSolPriceFetch = Date.now();
          console.log(`[PNL] \u2713 SOL price: $${solPrice.toFixed(2)} (CoinGecko)`);
          return;
        } else if (solPrice) {
          console.error(`[PNL] \u2717 Invalid SOL price from CoinGecko: $${solPrice} (expected $50-$500)`);
        }
      } catch (e) {
        console.error(`[PNL] \u2717 CoinGecko failed: ${e.message}`);
      }
      if (this.lastValidSolPrice) {
        console.warn(`[PNL] Using last valid price: $${this.lastValidSolPrice.toFixed(2)}`);
        this.cachedSolPrice = this.lastValidSolPrice;
      } else {
        console.error(`[PNL] \u2717 No valid price available. Using safe default $140`);
        this.cachedSolPrice = 140;
      }
    },
    // Always returns immediately - never blocks on fetch
    getSolPrice() {
      return this.cachedSolPrice;
    },
    fmtSol(n) {
      if (!Number.isFinite(n))
        return "0.0000";
      if (Math.abs(n) < 1 && n !== 0) {
        return n.toFixed(6);
      }
      return n.toFixed(4);
    },
    getUnrealizedPnl(state, currentTokenMint = null) {
      let totalUnrealized = 0;
      const solUsd = this.getSolPrice();
      let priceWasUpdated = false;
      const positions = Object.values(state.positions || {});
      console.log(`[PNL] Calculating for ${positions.length} position(s), SOL=$${solUsd.toFixed(2)}`);
      positions.forEach((pos) => {
        const reasons = [];
        if (pos.entryPriceUsd > 1e4)
          reasons.push(`entryPrice=$${pos.entryPriceUsd.toFixed(0)}`);
        if (pos.lastPriceUsd > 1e4)
          reasons.push(`lastPrice=$${pos.lastPriceUsd.toFixed(0)}`);
        if (pos.totalSolSpent < 1e-5)
          reasons.push(`spent=${pos.totalSolSpent.toFixed(6)}`);
        if (reasons.length > 0) {
          console.error(`[PNL] \u2717 DELETING CORRUPTED ${pos.symbol}: ${reasons.join(", ")}`);
          delete state.positions[pos.mint];
          priceWasUpdated = true;
          return;
        }
        let currentPrice = pos.lastPriceUsd || pos.entryPriceUsd;
        if (currentTokenMint && pos.mint === currentTokenMint && Market.price > 0 && Market.price < 1e4) {
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
        const pnlPct = pnl / pos.totalSolSpent * 100;
        if (pos.peakPnlPct === void 0 || pnlPct > pos.peakPnlPct) {
          pos.peakPnlPct = pnlPct;
        }
        pos.pnlPct = pnlPct;
        console.log(`[PNL] ${pos.symbol}: qty=${pos.tokenQty.toFixed(2)}, price=$${currentPrice.toFixed(6)}, pnl=${pnl.toFixed(4)} SOL (${pnlPct.toFixed(1)}%)`);
        totalUnrealized += pnl;
      });
      const { Analytics: Analytics2 } = (init_analytics(), __toCommonJS(analytics_exports));
      Analytics2.monitorProfitOverstay(state);
      Analytics2.detectOvertrading(state);
      const now = Date.now();
      if (priceWasUpdated && now - this.lastPriceSave > 5e3) {
        this.lastPriceSave = now;
        Store.save();
      }
      return totalUnrealized;
    }
  };

  // src/modules/core/trading.js
  init_analytics();

  // src/modules/core/order-execution.js
  init_store();
  init_market();
  init_analytics();
  init_featureManager();
  var OrderExecution = {
    async buy(amountSol, strategy = "Trend", tokenInfo = null, tradePlan = null) {
      const state = Store.state;
      if (!state.settings.enabled)
        return { success: false, error: "Paper trading disabled" };
      if (amountSol <= 0)
        return { success: false, error: "Invalid amount" };
      if (amountSol > state.session.balance)
        return { success: false, error: "Insufficient funds" };
      let price = Market.price || 1e-6;
      let marketCap = Market.marketCap || 0;
      if (price > 1e4 && marketCap > 0 && marketCap < 1e4) {
        console.warn(`[Trading] SWAP DETECTED! Price=${price} MarketCap=${marketCap}. Swapping...`);
        [price, marketCap] = [marketCap, price];
      }
      if (price > 1e4) {
        console.error(`[Trading] INVALID PRICE: $${price} - refusing to execute trade`);
        return { success: false, error: `Price data invalid ($${price.toFixed(2)}). Wait for chart to load.` };
      }
      const solUsd = PnlCalculator.getSolPrice();
      const usdAmount = amountSol * solUsd;
      const tokenQty = usdAmount / price;
      const symbol = tokenInfo?.symbol || "SOL";
      const mint = tokenInfo?.mint || "So111...";
      console.log(`[Trading] BUY: ${amountSol} SOL \u2192 ${tokenQty.toFixed(2)} ${symbol} @ $${price} | SOL=$${solUsd} | MC=$${marketCap}`);
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
      const plan = tradePlan || {};
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
        strategy: FeatureManager.resolveFlags(state, "STRATEGY_TAGGING").interactive ? strategy || "Trend" : "Trend",
        mode: state.settings.tradingMode || "paper",
        // Trade Plan (PRO feature)
        plannedStop: plan.plannedStop || null,
        plannedTarget: plan.plannedTarget || null,
        entryThesis: plan.entryThesis || "",
        riskDefined: plan.riskDefined || false
      };
      if (!state.trades)
        state.trades = {};
      state.trades[tradeId] = trade;
      if (!state.session.trades)
        state.session.trades = [];
      state.session.trades.push(tradeId);
      Analytics.calculateDiscipline(trade, state);
      Analytics.logTradeEvent(state, trade);
      this.checkMilestones(trade, state);
      window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade }, "*");
      await Store.save();
      return { success: true, trade, position: pos };
    },
    async sell(pct = 100, strategy = "Trend", tokenInfo = null) {
      const state = Store.state;
      if (!state.settings.enabled)
        return { success: false, error: "Paper trading disabled" };
      let currentPrice = Market.price || 0;
      if (currentPrice <= 0)
        return { success: false, error: "No price data" };
      if (currentPrice > 1e4) {
        console.error(`[Trading] INVALID PRICE for SELL: $${currentPrice}`);
        return { success: false, error: `Price data invalid ($${currentPrice.toFixed(2)}). Wait for chart to load.` };
      }
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
      const solUsd = PnlCalculator.getSolPrice();
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
      Analytics.logTradeEvent(state, trade);
      this.checkMilestones(trade, state);
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
    },
    checkMilestones(trade, state) {
      const tradeCount = Object.keys(state.trades || {}).length;
      const sellTrades = Object.values(state.trades || {}).filter((t) => t.side === "SELL");
      const wins = sellTrades.filter((t) => (t.realizedPnlSol || 0) > 0).length;
      if (tradeCount === 1) {
        Analytics.logMilestone(state, "FIRST_TRADE", "First trade executed! Welcome to ZER\xD8.", { tradeCount });
      } else if (tradeCount === 10) {
        Analytics.logMilestone(state, "TRADE_10", "10 trades completed. Building your baseline.", { tradeCount });
      } else if (tradeCount === 50) {
        Analytics.logMilestone(state, "TRADE_50", "50 trades! You have a solid trading history.", { tradeCount });
      } else if (tradeCount === 100) {
        Analytics.logMilestone(state, "TRADE_100", "100 trades milestone! Veteran status unlocked.", { tradeCount });
      }
      const winStreak = state.session.winStreak || 0;
      if (winStreak === 5) {
        Analytics.logMilestone(state, "WIN_STREAK_5", "5 wins in a row! Keep the discipline.", { winStreak });
      } else if (winStreak === 10) {
        Analytics.logMilestone(state, "WIN_STREAK_10", "10 consecutive wins! Elite performance.", { winStreak });
      }
      const startSol = state.settings.startSol || 10;
      const currentEquity = state.session.balance + (state.session.realized || 0);
      const equityMultiple = currentEquity / startSol;
      if (equityMultiple >= 2 && !state._milestone_2x) {
        Analytics.logMilestone(state, "EQUITY_2X", "Portfolio doubled! 2x achieved.", { equityMultiple: equityMultiple.toFixed(2) });
        state._milestone_2x = true;
      } else if (equityMultiple >= 3 && !state._milestone_3x) {
        Analytics.logMilestone(state, "EQUITY_3X", "Portfolio tripled! 3x achieved.", { equityMultiple: equityMultiple.toFixed(2) });
        state._milestone_3x = true;
      } else if (equityMultiple >= 5 && !state._milestone_5x) {
        Analytics.logMilestone(state, "EQUITY_5X", "Portfolio 5x! Legendary.", { equityMultiple: equityMultiple.toFixed(2) });
        state._milestone_5x = true;
      }
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
    buy: async (amountSol, strategy, tokenInfo, tradePlan) => await OrderExecution.buy(amountSol, strategy, tokenInfo, tradePlan),
    sell: async (pct, strategy, tokenInfo) => await OrderExecution.sell(pct, strategy, tokenInfo),
    tagTrade: async (tradeId, updates) => await OrderExecution.tagTrade(tradeId, updates)
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

  // src/modules/ui/paywall.js
  init_store();
  init_featureManager();
  var Paywall = {
    showUpgradeModal(lockedFeature = null) {
      const root = OverlayManager.getShadowRoot();
      const existing = root.getElementById("paywall-modal-overlay");
      if (existing)
        existing.remove();
      const overlay = document.createElement("div");
      overlay.id = "paywall-modal-overlay";
      overlay.className = "paywall-modal-overlay";
      let featureTitle = "Upgrade to PRO";
      let featureDesc = "Unlock advanced trading features";
      if (lockedFeature === "EQUITY_CHARTS") {
        featureTitle = "Equity Chart - PRO Feature";
        featureDesc = "Track your equity curve over time with advanced charting";
      } else if (lockedFeature === "DETAILED_LOGS") {
        featureTitle = "Detailed Logs - PRO Feature";
        featureDesc = "Export comprehensive trade logs for analysis";
      } else if (lockedFeature === "AI_DEBRIEF") {
        featureTitle = "AI Debrief - PRO Feature";
        featureDesc = "Get AI-powered insights on your trading patterns";
      } else if (lockedFeature === "BEHAVIOR_BASELINE") {
        featureTitle = "Behavioral Profile - ELITE Feature";
        featureDesc = "Deep psychological profiling and real-time intervention";
      }
      overlay.innerHTML = `
            <div class="paywall-modal">
                <div class="paywall-header">
                    <div class="paywall-badge">
                        ${ICONS.ZERO}
                        <span>ZER\xD8 PRO</span>
                    </div>
                    <button class="paywall-close" data-act="close">${ICONS.X}</button>
                </div>

                <div class="paywall-hero">
                    <h2 class="paywall-title">${featureTitle}</h2>
                    <p class="paywall-subtitle">${featureDesc}</p>
                </div>

                <div class="paywall-features">
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
                        <div class="feature-text">
                            <div class="feature-name">Equity Charts</div>
                            <div class="feature-desc">Visualize your performance over time</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Advanced AI Debrief</div>
                            <div class="feature-desc">Deep analysis of your trading psychology</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Multi-Token P&L</div>
                            <div class="feature-desc">Track multiple positions simultaneously</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Detailed Trade Logs</div>
                            <div class="feature-desc">Export comprehensive trade history</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Real Trading Mode</div>
                            <div class="feature-desc">Log and track your real trades</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Discipline Tracking</div>
                            <div class="feature-desc">Stay accountable with real-time scoring</div>
                        </div>
                    </div>
                </div>

                <div class="paywall-pricing">
                    <div class="price-tag">
                        <span class="price-amount">$19</span>
                        <span class="price-period">/month</span>
                    </div>
                    <div class="price-subtext">Cancel anytime \u2022 7-day money back guarantee</div>
                </div>

                <div class="paywall-actions">
                    <button class="paywall-btn primary" data-act="upgrade">
                        <span>Upgrade to PRO</span>
                        <span class="btn-icon">\u2192</span>
                    </button>
                    <button class="paywall-btn secondary" data-act="unlock-elite">
                        <span>Unlock ELITE (Dev)</span>
                    </button>
                    <button class="paywall-btn secondary" data-act="demo">
                        <span>Unlock PRO (Dev)</span>
                    </button>
                </div>

                <div class="paywall-footer">
                    <p>Join hundreds of traders improving their discipline</p>
                </div>
            </div>
        `;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest('[data-act="close"]')) {
          overlay.remove();
        }
        if (e.target.closest('[data-act="upgrade"]')) {
          this.handleUpgrade();
        }
        if (e.target.closest('[data-act="demo"]')) {
          this.unlockDemo("pro");
          overlay.remove();
        }
        if (e.target.closest('[data-act="unlock-elite"]')) {
          this.unlockDemo("elite");
          overlay.remove();
        }
      });
      root.appendChild(overlay);
    },
    handleUpgrade(tier = "pro") {
      const url = tier === "elite" ? "https://zero-trading.com/elite" : "https://zero-trading.com/pro";
      window.open(url, "_blank");
      console.log(`[Paywall] Redirecting to ${tier.toUpperCase()} upgrade page`);
    },
    unlockDemo(tier = "pro") {
      Store.state.settings.tier = tier;
      Store.save();
      console.log(`[Paywall] Demo mode unlocked - ${tier.toUpperCase()} tier activated`);
      const root = OverlayManager.getShadowRoot();
      const toast = document.createElement("div");
      toast.className = "paywall-toast";
      toast.textContent = `\u2713 ${tier.toUpperCase()} Demo Unlocked`;
      toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(16,185,129,0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            z-index: 2147483647;
            pointer-events: none;
            animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;
      root.appendChild(toast);
      setTimeout(() => toast.remove(), 2e3);
    },
    isFeatureLocked(featureName) {
      if (!FeatureManager)
        return false;
      const flags = FeatureManager.resolveFlags(Store.state, featureName);
      return flags.gated;
    }
  };

  // src/modules/ui/pnl-hud.js
  init_analytics();

  // src/modules/ui/dashboard.js
  init_store();
  init_analytics();
  init_market();

  // src/modules/ui/dashboard-styles.js
  var DASHBOARD_CSS = `
.paper-dashboard-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(13, 17, 23, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #f8fafc;
    pointer-events: auto;
}

.paper-dashboard-modal {
    width: 900px;
    max-width: 95vw;
    height: 700px;
    max-height: 90vh;
    background: #0d1117;
    border: 1px solid rgba(20, 184, 166, 0.3);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.dashboard-header {
    padding: 24px 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.dashboard-title {
    font-size: 20px;
    font-weight: 800;
    color: #14b8a6;
    letter-spacing: 0.5px;
}

.dashboard-close {
    background: none;
    border: none;
    color: #64748b;
    font-size: 28px;
    cursor: pointer;
    transition: color 0.2s;
}

.dashboard-close:hover { color: #f8fafc; }

.dashboard-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    display: grid;
    grid-template-columns: 2fr 1.2fr;
    gap: 32px;
}

.dashboard-card {
    background: #161b22;
    border-radius: 16px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.03);
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 32px;
}

.big-stat {
    text-align: center;
}

.big-stat .k { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
.big-stat .v { font-size: 24px; font-weight: 800; }

.win { color: #10b981; }
.loss { color: #ef4444; }

.professor-critique-box {
    background: linear-gradient(145deg, #1e293b, #0f172a);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 16px;
    padding: 24px;
}

.professor-title { color: #a5b4fc; font-weight: 800; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; }
.professor-text { font-size: 15px; line-height: 1.6; color: #e2e8f0; font-style: italic; }

.equity-chart-placeholder {
    height: 200px;
    background: rgba(20, 184, 166, 0.05);
    border: 1px dashed rgba(20, 184, 166, 0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #14b8a6;
    font-size: 12px;
    margin-top: 20px;
}

.trade-mini-list {
    margin-top: 24px;
}

.mini-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    font-size: 13px;
}
.mini-row:last-child { border-bottom: none; }

canvas#equity-canvas {
    width: 100%;
    height: 180px;
    background: rgba(13, 17, 23, 0.4);
    border-radius: 12px;
    margin-top: 10px;
}

.locked-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(13, 17, 23, 0.85);
    backdrop-filter: blur(6px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    cursor: pointer;
    border-radius: 16px;
}

.locked-icon { font-size: 28px; margin-bottom: 12px; }
.locked-text { font-size: 11px; font-weight: 900; color: #14b8a6; letter-spacing: 2px; }
`;

  // src/modules/ui/dashboard.js
  init_featureManager();

  // src/modules/ui/session-replay.js
  init_store();
  init_analytics();
  init_featureManager();
  var SESSION_REPLAY_CSS = `
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
`;
  var SessionReplay = {
    isOpen: false,
    activeFilters: ["TRADE", "ALERT", "DISCIPLINE", "MILESTONE"],
    open() {
      this.isOpen = true;
      this.render();
    },
    close() {
      this.isOpen = false;
      const overlay = OverlayManager.getShadowRoot().querySelector(".replay-overlay");
      if (overlay)
        overlay.remove();
    },
    toggle() {
      if (this.isOpen)
        this.close();
      else
        this.open();
    },
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
      const flags = FeatureManager.resolveFlags(state, "SESSION_REPLAY");
      const eventStats = Analytics.getEventStats(state);
      const session = state.session || {};
      if (flags.gated) {
        overlay.innerHTML = this.renderLockedState();
        this.bindLockedEvents(overlay);
        return;
      }
      const events = this.getFilteredEvents(state);
      overlay.innerHTML = `
            <div class="replay-modal">
                <div class="replay-header">
                    <div class="replay-title">
                        ${ICONS.BRAIN}
                        <span>Session Replay</span>
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
                        <div class="v">${Store.getSessionDuration()} min</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Total Events</div>
                        <div class="v">${eventStats.total}</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Trades</div>
                        <div class="v" style="color:#14b8a6;">${eventStats.trades}</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Alerts</div>
                        <div class="v" style="color:#ef4444;">${eventStats.alerts}</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Discipline</div>
                        <div class="v" style="color:#f59e0b;">${eventStats.disciplineEvents}</div>
                    </div>
                </div>

                <div class="replay-filters">
                    <button class="filter-btn trade ${this.activeFilters.includes("TRADE") ? "active" : ""}" data-filter="TRADE">
                        Trades (${eventStats.trades})
                    </button>
                    <button class="filter-btn alert ${this.activeFilters.includes("ALERT") ? "active" : ""}" data-filter="ALERT">
                        Alerts (${eventStats.alerts})
                    </button>
                    <button class="filter-btn discipline ${this.activeFilters.includes("DISCIPLINE") ? "active" : ""}" data-filter="DISCIPLINE">
                        Discipline (${eventStats.disciplineEvents})
                    </button>
                    <button class="filter-btn milestone ${this.activeFilters.includes("MILESTONE") ? "active" : ""}" data-filter="MILESTONE">
                        Milestones (${eventStats.milestones})
                    </button>
                </div>

                <div class="replay-timeline">
                    ${events.length > 0 ? this.renderEvents(events) : this.renderEmpty()}
                </div>

                <div class="replay-footer">
                    <div class="replay-count">Showing ${events.length} of ${eventStats.total} events</div>
                    <div class="replay-elite-badge">
                        ${ICONS.BRAIN} ELITE FEATURE
                    </div>
                </div>
            </div>
        `;
      this.bindEvents(overlay);
    },
    renderLockedState() {
      return `
            <div class="replay-modal">
                <div class="replay-header">
                    <div class="replay-title">
                        ${ICONS.BRAIN}
                        <span>Session Replay</span>
                    </div>
                    <button class="replay-close">${ICONS.X}</button>
                </div>
                <div class="locked-replay">
                    ${ICONS.LOCK}
                    <h3>Session Replay is Elite</h3>
                    <p>Review your entire trading session with a visual timeline of trades, alerts, discipline events, and milestones.</p>
                    <button class="unlock-btn">Upgrade to Elite</button>
                </div>
            </div>
        `;
    },
    renderEmpty() {
      return `
            <div class="timeline-empty">
                ${ICONS.TARGET}
                <div style="font-size:14px; font-weight:600; margin-bottom:4px;">No events yet</div>
                <div style="font-size:12px;">Start trading to build your session timeline</div>
            </div>
        `;
    },
    renderEvents(events) {
      return events.map((event) => {
        const time = new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const category = event.category.toLowerCase();
        const icon = this.getEventIcon(event.category);
        const dataTags = this.renderEventData(event);
        return `
                <div class="timeline-event">
                    <div class="event-time">${time}</div>
                    <div class="event-icon ${category}">${icon}</div>
                    <div class="event-content">
                        <div class="event-type ${category}">${event.type}</div>
                        <div class="event-message">${event.message}</div>
                        ${dataTags ? `<div class="event-data">${dataTags}</div>` : ""}
                    </div>
                </div>
            `;
      }).join("");
    },
    renderEventData(event) {
      const data = event.data || {};
      const tags = [];
      if (data.symbol)
        tags.push(`<span class="event-tag">${data.symbol}</span>`);
      if (data.strategy)
        tags.push(`<span class="event-tag">${data.strategy}</span>`);
      if (data.realizedPnlSol !== void 0 && data.realizedPnlSol !== null) {
        const pnl = data.realizedPnlSol;
        const cls = pnl >= 0 ? "win" : "loss";
        tags.push(`<span class="event-tag ${cls}">${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} SOL</span>`);
      }
      if (data.penalty)
        tags.push(`<span class="event-tag">-${data.penalty} pts</span>`);
      if (data.winStreak)
        tags.push(`<span class="event-tag win">${data.winStreak}W Streak</span>`);
      if (data.tradeCount)
        tags.push(`<span class="event-tag">${data.tradeCount} trades</span>`);
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
    getFilteredEvents(state) {
      const allEvents = Analytics.getEventLog(state, { limit: 100 });
      return allEvents.filter((e) => this.activeFilters.includes(e.category));
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
    bindEvents(overlay) {
      const closeBtn = overlay.querySelector(".replay-close");
      if (closeBtn) {
        closeBtn.onclick = () => this.close();
      }
      overlay.onclick = (e) => {
        if (e.target === overlay)
          this.close();
      };
      overlay.querySelectorAll(".filter-btn").forEach((btn) => {
        btn.onclick = () => {
          const filter = btn.getAttribute("data-filter");
          this.toggleFilter(filter);
        };
      });
    },
    bindLockedEvents(overlay) {
      const closeBtn = overlay.querySelector(".replay-close");
      if (closeBtn) {
        closeBtn.onclick = () => this.close();
      }
      const unlockBtn = overlay.querySelector(".unlock-btn");
      if (unlockBtn) {
        unlockBtn.onclick = () => {
          this.close();
          Paywall.showUpgradeModal("SESSION_REPLAY");
        };
      }
      overlay.onclick = (e) => {
        if (e.target === overlay)
          this.close();
      };
    }
  };

  // src/modules/ui/trader-profile.js
  init_store();
  init_analytics();
  init_featureManager();
  var PROFILE_CSS = `
.trader-profile-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.trader-profile-modal {
    background: linear-gradient(145deg, #0d1117, #161b22);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(139, 92, 246, 0.1);
}

.profile-header {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.1));
    padding: 20px 24px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.profile-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.profile-avatar {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.profile-title-section h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: -0.5px;
}

.profile-subtitle {
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.profile-close {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.profile-close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
}

.profile-content {
    padding: 24px;
    overflow-y: auto;
    max-height: calc(85vh - 90px);
}

.profile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
}

.profile-card {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 18px;
}

.profile-card.full-width {
    grid-column: span 2;
}

.profile-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}

.profile-card-header svg {
    color: #8b5cf6;
}

.profile-card-title {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.strategy-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.strategy-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}

.strategy-name {
    font-weight: 700;
    color: #f8fafc;
    font-size: 13px;
}

.strategy-stats {
    display: flex;
    gap: 12px;
    font-size: 11px;
}

.strategy-stat {
    display: flex;
    align-items: center;
    gap: 4px;
}

.strategy-stat .label {
    color: #64748b;
}

.strategy-stat .value {
    font-weight: 600;
}

.strategy-stat .value.positive {
    color: #10b981;
}

.strategy-stat .value.negative {
    color: #ef4444;
}

.condition-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.condition-item {
    padding: 12px;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 8px;
}

.condition-item.medium {
    background: rgba(245, 158, 11, 0.05);
    border-color: rgba(245, 158, 11, 0.15);
}

.condition-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.condition-label {
    font-weight: 700;
    font-size: 12px;
    color: #f8fafc;
}

.condition-severity {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
}

.condition-severity.high {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
}

.condition-severity.medium {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
}

.condition-stat {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 6px;
}

.condition-advice {
    font-size: 11px;
    color: #64748b;
    font-style: italic;
}

.time-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.time-slot {
    padding: 12px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    text-align: center;
}

.time-slot.best {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.time-slot.worst {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.time-range {
    font-size: 10px;
    color: #64748b;
    margin-bottom: 4px;
}

.time-winrate {
    font-size: 14px;
    font-weight: 800;
    color: #f8fafc;
}

.time-pnl {
    font-size: 10px;
    margin-top: 2px;
}

.session-buckets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.session-bucket {
    padding: 12px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    text-align: center;
}

.session-bucket.optimal {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
}

.bucket-range {
    font-size: 10px;
    color: #64748b;
    margin-bottom: 4px;
}

.bucket-pnl {
    font-size: 13px;
    font-weight: 700;
}

.bucket-winrate {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
}

.style-display {
    display: flex;
    align-items: center;
    gap: 16px;
}

.style-badge {
    padding: 12px 20px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 10px;
    color: white;
    font-size: 16px;
    font-weight: 800;
}

.style-details {
    flex: 1;
}

.style-description {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 4px;
}

.style-hold {
    font-size: 11px;
    color: #64748b;
}

.risk-display {
    display: flex;
    gap: 20px;
}

.risk-badge {
    padding: 14px 20px;
    border-radius: 10px;
    text-align: center;
}

.risk-badge.Conservative { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); }
.risk-badge.Moderate { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); }
.risk-badge.Aggressive { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); }
.risk-badge.HighRisk { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }

.risk-label {
    font-size: 14px;
    font-weight: 800;
    color: #f8fafc;
}

.risk-stats {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

.risk-stat {
    text-align: center;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}

.risk-stat .k {
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 4px;
}

.risk-stat .v {
    font-size: 14px;
    font-weight: 700;
    color: #f8fafc;
}

.emotional-patterns {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pattern-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 8px;
}

.pattern-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.pattern-type {
    font-weight: 700;
    font-size: 12px;
    color: #f8fafc;
}

.pattern-freq {
    font-size: 10px;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.2);
    padding: 2px 8px;
    border-radius: 4px;
}

.pattern-advice {
    font-size: 10px;
    color: #64748b;
    max-width: 200px;
    text-align: right;
}

.no-data {
    color: #64748b;
    font-size: 12px;
    text-align: center;
    padding: 20px;
}

.profile-locked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
}

.locked-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.locked-icon svg {
    width: 32px;
    height: 32px;
    color: #8b5cf6;
}

.locked-title {
    font-size: 18px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 8px;
}

.locked-desc {
    font-size: 13px;
    color: #64748b;
    max-width: 400px;
    line-height: 1.6;
    margin-bottom: 24px;
}

.unlock-btn {
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
}

.unlock-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
}

.profile-building {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
}

.building-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: rgba(99, 102, 241, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.building-icon svg {
    width: 32px;
    height: 32px;
    color: #6366f1;
}

.building-title {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 8px;
}

.building-desc {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 16px;
}

.building-progress {
    width: 200px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
}

.building-progress-bar {
    height: 100%;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 3px;
    transition: width 0.3s;
}
`;
  var TraderProfile = {
    isOpen: false,
    open() {
      this.isOpen = true;
      this.render();
    },
    close() {
      this.isOpen = false;
      const overlay = OverlayManager.getShadowRoot().querySelector(".trader-profile-overlay");
      if (overlay)
        overlay.remove();
    },
    render() {
      const root = OverlayManager.getShadowRoot();
      let overlay = root.querySelector(".trader-profile-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "trader-profile-overlay";
        if (!root.getElementById("trader-profile-styles")) {
          const style = document.createElement("style");
          style.id = "trader-profile-styles";
          style.textContent = PROFILE_CSS;
          root.appendChild(style);
        }
        root.appendChild(overlay);
      }
      const state = Store.state;
      const flags = FeatureManager.resolveFlags(state, "TRADER_PROFILE");
      if (flags.gated) {
        overlay.innerHTML = this.renderLockedState();
        this.bindEvents(overlay);
        return;
      }
      const profile = Analytics.generateTraderProfile(state);
      if (!profile.ready) {
        overlay.innerHTML = this.renderBuildingState(profile);
        this.bindEvents(overlay);
        return;
      }
      overlay.innerHTML = this.renderFullProfile(profile);
      this.bindEvents(overlay);
    },
    renderLockedState() {
      return `
            <div class="trader-profile-modal">
                <div class="profile-header">
                    <div class="profile-header-left">
                        <div class="profile-avatar">${ICONS.USER}</div>
                        <div class="profile-title-section">
                            <h2>Personal Trader Profile</h2>
                            <div class="profile-subtitle">Elite Feature</div>
                        </div>
                    </div>
                    <button class="profile-close" id="profile-close-btn">${ICONS.X}</button>
                </div>
                <div class="profile-locked">
                    <div class="locked-icon">${ICONS.LOCK}</div>
                    <div class="locked-title">Unlock Your Trader DNA</div>
                    <div class="locked-desc">
                        Discover your best strategies, worst conditions, optimal session length, and peak trading hours.
                        Your personal trader profile evolves as you trade, giving you data-driven insights to improve.
                    </div>
                    <button class="unlock-btn" id="unlock-profile-btn">Upgrade to ELITE</button>
                </div>
            </div>
        `;
    },
    renderBuildingState(profile) {
      const progress = (10 - profile.tradesNeeded) / 10 * 100;
      return `
            <div class="trader-profile-modal">
                <div class="profile-header">
                    <div class="profile-header-left">
                        <div class="profile-avatar">${ICONS.USER}</div>
                        <div class="profile-title-section">
                            <h2>Personal Trader Profile</h2>
                            <div class="profile-subtitle">Building Your Profile...</div>
                        </div>
                    </div>
                    <button class="profile-close" id="profile-close-btn">${ICONS.X}</button>
                </div>
                <div class="profile-building">
                    <div class="building-icon">${ICONS.CHART_BAR}</div>
                    <div class="building-title">Profile Under Construction</div>
                    <div class="building-desc">${profile.message}</div>
                    <div class="building-progress">
                        <div class="building-progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                        ${profile.tradesNeeded} more trades needed
                    </div>
                </div>
            </div>
        `;
    },
    renderFullProfile(profile) {
      return `
            <div class="trader-profile-modal">
                <div class="profile-header">
                    <div class="profile-header-left">
                        <div class="profile-avatar">${ICONS.USER}</div>
                        <div class="profile-title-section">
                            <h2>Personal Trader Profile</h2>
                            <div class="profile-subtitle">${profile.tradeCount} trades analyzed</div>
                        </div>
                    </div>
                    <button class="profile-close" id="profile-close-btn">${ICONS.X}</button>
                </div>
                <div class="profile-content">
                    <div class="profile-grid">
                        <!-- Trading Style -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.TROPHY}
                                <span class="profile-card-title">Trading Style</span>
                            </div>
                            <div class="style-display">
                                <div class="style-badge">${profile.tradingStyle.style}</div>
                                <div class="style-details">
                                    <div class="style-description">${profile.tradingStyle.description}</div>
                                    <div class="style-hold">Avg Hold: ${profile.tradingStyle.avgHold} min</div>
                                </div>
                            </div>
                        </div>

                        <!-- Risk Profile -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.ALERT_CIRCLE}
                                <span class="profile-card-title">Risk Profile</span>
                            </div>
                            <div class="risk-display">
                                <div class="risk-badge ${profile.riskProfile.profile.replace(" ", "")}">
                                    <div class="risk-label">${profile.riskProfile.profile}</div>
                                </div>
                                <div class="risk-stats">
                                    <div class="risk-stat">
                                        <div class="k">Avg Risk</div>
                                        <div class="v">${profile.riskProfile.avgRisk}%</div>
                                    </div>
                                    <div class="risk-stat">
                                        <div class="k">Max Risk</div>
                                        <div class="v">${profile.riskProfile.maxRisk}%</div>
                                    </div>
                                    <div class="risk-stat">
                                        <div class="k">Plan Usage</div>
                                        <div class="v">${profile.riskProfile.planUsageRate}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Best Strategies -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.WIN}
                                <span class="profile-card-title">Best Strategies</span>
                            </div>
                            <div class="strategy-list">
                                ${profile.bestStrategies.top.length > 0 ? profile.bestStrategies.top.map((s, i) => `
                                    <div class="strategy-item">
                                        <span class="strategy-name">${i + 1}. ${s.name}</span>
                                        <div class="strategy-stats">
                                            <div class="strategy-stat">
                                                <span class="label">Win:</span>
                                                <span class="value positive">${s.winRate}%</span>
                                            </div>
                                            <div class="strategy-stat">
                                                <span class="label">P&L:</span>
                                                <span class="value ${s.totalPnl >= 0 ? "positive" : "negative"}">${s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    </div>
                                `).join("") : '<div class="no-data">No strategy data yet</div>'}
                            </div>
                        </div>

                        <!-- Worst Conditions -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.TILT}
                                <span class="profile-card-title">Worst Conditions</span>
                            </div>
                            <div class="condition-list">
                                ${profile.worstConditions.length > 0 ? profile.worstConditions.map((c) => `
                                    <div class="condition-item ${c.severity}">
                                        <div class="condition-header">
                                            <span class="condition-label">${c.label}</span>
                                            <span class="condition-severity ${c.severity}">${c.severity}</span>
                                        </div>
                                        <div class="condition-stat">${c.stat}</div>
                                        <div class="condition-advice">${c.advice}</div>
                                    </div>
                                `).join("") : '<div class="no-data">No problematic patterns detected</div>'}
                            </div>
                        </div>

                        <!-- Best Time of Day -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.CLOCK}
                                <span class="profile-card-title">Best Time of Day</span>
                            </div>
                            <div class="time-grid">
                                ${profile.bestTimeOfDay.breakdown && profile.bestTimeOfDay.breakdown.length > 0 ? profile.bestTimeOfDay.breakdown.map((t) => `
                                        <div class="time-slot ${t === profile.bestTimeOfDay.best ? "best" : ""} ${t === profile.bestTimeOfDay.worst ? "worst" : ""}">
                                            <div class="time-range">${t.range}</div>
                                            <div class="time-winrate">${t.winRate}%</div>
                                            <div class="time-pnl ${t.pnl >= 0 ? "positive" : "negative"}" style="color: ${t.pnl >= 0 ? "#10b981" : "#ef4444"}">
                                                ${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(3)}
                                            </div>
                                        </div>
                                    `).join("") : '<div class="no-data" style="grid-column: span 4;">Need more trades across different times</div>'}
                            </div>
                        </div>

                        <!-- Optimal Session Length -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.CHART_BAR}
                                <span class="profile-card-title">Optimal Session Length</span>
                            </div>
                            ${profile.optimalSessionLength.optimal ? `
                                <div style="margin-bottom: 12px; font-size: 13px; color: #94a3b8;">
                                    Your best performance: <strong style="color: #8b5cf6;">${profile.optimalSessionLength.optimal}</strong> sessions
                                </div>
                                <div class="session-buckets">
                                    ${Object.entries(profile.optimalSessionLength.buckets).map(([key, b]) => `
                                        <div class="session-bucket ${b.range === profile.optimalSessionLength.optimal ? "optimal" : ""}">
                                            <div class="bucket-range">${b.range}</div>
                                            <div class="bucket-pnl" style="color: ${parseFloat(b.avgPnl) >= 0 ? "#10b981" : "#ef4444"}">
                                                ${parseFloat(b.avgPnl) >= 0 ? "+" : ""}${b.avgPnl}
                                            </div>
                                            <div class="bucket-winrate">${b.avgWinRate}% WR</div>
                                        </div>
                                    `).join("")}
                                </div>
                            ` : '<div class="no-data">Need more session data</div>'}
                        </div>

                        <!-- Emotional Patterns -->
                        ${profile.emotionalPatterns.length > 0 ? `
                            <div class="profile-card full-width">
                                <div class="profile-card-header">
                                    ${ICONS.BRAIN}
                                    <span class="profile-card-title">Emotional Patterns to Address</span>
                                </div>
                                <div class="emotional-patterns">
                                    ${profile.emotionalPatterns.map((p) => `
                                        <div class="pattern-item">
                                            <div class="pattern-info">
                                                <span class="pattern-type">${p.type}</span>
                                                <span class="pattern-freq">${p.frequency}x detected</span>
                                            </div>
                                            <div class="pattern-advice">${p.advice}</div>
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                        ` : ""}
                    </div>
                </div>
            </div>
        `;
    },
    bindEvents(overlay) {
      const self = this;
      const closeBtn = overlay.querySelector("#profile-close-btn");
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          self.close();
        };
      }
      const unlockBtn = overlay.querySelector("#unlock-profile-btn");
      if (unlockBtn) {
        unlockBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          self.close();
          Paywall.showUpgradeModal("TRADER_PROFILE");
        };
      }
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          self.close();
        }
      };
    }
  };

  // src/modules/ui/dashboard.js
  var Dashboard = {
    isOpen: false,
    toggle() {
      if (this.isOpen)
        this.close();
      else
        this.open();
    },
    open() {
      this.isOpen = true;
      this.render();
    },
    close() {
      this.isOpen = false;
      const overlay = OverlayManager.getShadowRoot().querySelector(".paper-dashboard-overlay");
      if (overlay)
        overlay.remove();
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
      const stats = Analytics.analyzeRecentTrades(state) || { winRate: "0.0", totalTrades: 0, wins: 0, losses: 0, totalPnlSol: 0 };
      const debrief = Analytics.getProfessorDebrief(state);
      const consistency = Analytics.calculateConsistencyScore(state);
      const chartFlags = FeatureManager.resolveFlags(state, "EQUITY_CHARTS");
      const logFlags = FeatureManager.resolveFlags(state, "DETAILED_LOGS");
      const aiFlags = FeatureManager.resolveFlags(state, "ADVANCED_ANALYTICS");
      const shareFlags = FeatureManager.resolveFlags(state, "SHARE_TO_X");
      const eliteFlags = FeatureManager.resolveFlags(state, "BEHAVIOR_BASELINE");
      const isFree = state.settings.tier === "free";
      overlay.innerHTML = `
            <div class="paper-dashboard-modal">
                <div class="dashboard-header">
                    <div class="dashboard-title">PRO PERFORMANCE DASHBOARD ${isFree ? '<span style="color:#64748b; font-size:10px; margin-left:10px;">(FREE TIER)</span>' : ""}</div>
                    <div style="display:flex; align-items:center; gap:16px;">
                        ${isFree ? '<button class="dashboard-upgrade-btn" style="background:#14b8a6; color:#0d1117; border:none; padding:6px 14px; border-radius:6px; font-weight:800; font-size:11px; cursor:pointer;">UPGRADE TO PRO</button>' : ""}
                        <button class="dashboard-close" id="dashboard-close-btn" style="padding:10px; line-height:1; min-width:40px; min-height:40px; display:flex; align-items:center; justify-content:center;">X</button>
                    </div>
                </div>
                <div class="dashboard-content">
                    <div class="main-stats">
                        <div class="stat-grid">
                            <div class="dashboard-card big-stat">
                                <div class="k">Win Rate</div>
                                <div class="v win">${stats.winRate}%</div>
                            </div>
                            <div class="dashboard-card big-stat">
                                <div class="k">Profit Factor</div>
                                <div class="v" style="color:#6366f1;">${stats.profitFactor}</div>
                            </div>
                            <div class="dashboard-card big-stat">
                                <div class="k">Max Drawdown</div>
                                <div class="v" style="color:#ef4444;">${stats.maxDrawdown} SOL</div>
                            </div>
                            <div class="dashboard-card big-stat">
                                <div class="k">Session P&L</div>
                                <div class="v ${stats.totalPnlSol >= 0 ? "win" : "loss"}">${stats.totalPnlSol.toFixed(4)} SOL</div>
                            </div>
                            <div class="dashboard-card big-stat" id="consistency-score-card">
                                <div class="k">Consistency</div>
                                <div class="v" style="color:${consistency.score >= 70 ? "#10b981" : consistency.score >= 50 ? "#f59e0b" : "#64748b"};">
                                    ${consistency.score !== null ? consistency.score : "--"}
                                </div>
                            </div>
                        </div>

                        <div class="dashboard-card" id="dashboard-equity-chart" style="min-height:220px;">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">LIVE EQUITY CURVE</div>
                            <canvas id="equity-canvas"></canvas>
                        </div>
                    </div>

                    <div class="side-panel">
                        <div class="professor-critique-box" id="dashboard-professor-box">
                            <div class="professor-title">Professor's Debrief</div>
                            <div class="professor-text">"${debrief.critique}"</div>
                            
                            <div style="margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:12px; color:#64748b;">DISCIPLINE SCORE</span>
                                    <span style="font-size:18px; font-weight:800; color:${debrief.score >= 90 ? "#10b981" : "#f59e0b"}">${debrief.score}</span>
                                </div>
                                <div style="height:6px; background:#1e293b; border-radius:3px; margin-top:8px; overflow:hidden;">
                                    <div style="width:${debrief.score}%; height:100%; background:${debrief.score >= 90 ? "#10b981" : "#f59e0b"};"></div>
                                </div>
                            </div>
                        </div>

                        <div class="trade-mini-list" id="dashboard-recent-logs">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">RECENT LOGS</div>
                            ${this.renderRecentMiniRows(state)}
                        </div>

                        <div class="behavior-profile-card" id="dashboard-behavior-profile">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">BEHAVIORAL PROFILE</div>
                            <div class="behavior-tag ${state.behavior.profile}">${state.behavior.profile || "Disciplined"}</div>
                            <div style="font-size:13px; color:#94a3b8; line-height:1.5;">
                                Your trading patterns suggest a **${state.behavior.profile || "Disciplined"}** archetype this session.
                            </div>
                            <div class="behavior-stats" style="grid-template-columns: repeat(3, 1fr);">
                                <div class="behavior-stat-item">
                                    <div class="k">Tilt</div>
                                    <div class="v">${state.behavior.tiltFrequency || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">FOMO</div>
                                    <div class="v">${state.behavior.fomoTrades || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Panic</div>
                                    <div class="v">${state.behavior.panicSells || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Sunk Cost</div>
                                    <div class="v">${state.behavior.sunkCostFrequency || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Velocity</div>
                                    <div class="v">${state.behavior.overtradingFrequency || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Neglect</div>
                                    <div class="v">${state.behavior.profitNeglectFrequency || 0}</div>
                                </div>
                            </div>
                        </div>

                        <div class="behavior-profile-card" id="dashboard-market-session" style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1)); border: 1px solid rgba(6, 182, 212, 0.2); margin-top:20px;">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">MARKET SNAPSHOT</div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                                <div>
                                    <div style="font-size:11px; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Volume (24h)</div>
                                    <div style="font-size:16px; font-weight:800; color:#f8fafc;">
                                        $${Market.context ? (Market.context.vol24h / 1e6).toFixed(1) + "M" : "N/A"}
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:11px; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Price Change</div>
                                    <div style="font-size:16px; font-weight:800; color:${Market.context && Market.context.priceChange24h >= 0 ? "#10b981" : "#ef4444"}">
                                        ${Market.context ? Market.context.priceChange24h.toFixed(1) + "%" : "N/A"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                            <button id="dashboard-share-btn" style="width:100%; background:#1d9bf0; color:white; border:none; padding:10px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                                <span>\u{1D54F}</span> Share Session
                            </button>
                            <button id="session-replay-btn" style="width:100%; background:rgba(139,92,246,0.15); color:#a78bfa; border:1px solid rgba(139,92,246,0.3); padding:10px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                                ${ICONS.BRAIN} Session Replay
                                <span style="font-size:9px; background:linear-gradient(135deg,#8b5cf6,#a78bfa); color:white; padding:2px 6px; border-radius:4px; margin-left:4px;">ELITE</span>
                            </button>
                            <button id="trader-profile-btn" style="width:100%; background:rgba(99,102,241,0.15); color:#818cf8; border:1px solid rgba(99,102,241,0.3); padding:10px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                                ${ICONS.USER} Trader Profile
                                <span style="font-size:9px; background:linear-gradient(135deg,#6366f1,#818cf8); color:white; padding:2px 6px; border-radius:4px; margin-left:4px;">ELITE</span>
                            </button>
                            <div class="export-btns" style="display:flex; gap:8px;">
                                <button id="export-csv-btn" class="export-btn" style="flex:1; background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:8px; border-radius:6px; font-weight:600; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                                    ${ICONS.FILE_CSV} Export CSV
                                </button>
                                <button id="export-json-btn" class="export-btn" style="flex:1; background:rgba(99,102,241,0.1); color:#6366f1; border:1px solid rgba(99,102,241,0.3); padding:8px; border-radius:6px; font-weight:600; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                                    ${ICONS.FILE_JSON} Export JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
      const self = this;
      const closeBtn = overlay.querySelector("#dashboard-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("[Dashboard] Close button clicked");
          self.close();
        });
      }
      const upgradeBtn = overlay.querySelector(".dashboard-upgrade-btn");
      if (upgradeBtn) {
        upgradeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          Paywall.showUpgradeModal();
        });
      }
      const shareBtn = overlay.querySelector("#dashboard-share-btn");
      if (shareBtn) {
        shareBtn.style.display = shareFlags.visible ? "" : "none";
        if (shareFlags.gated) {
          shareBtn.style.opacity = "0.5";
          shareBtn.onclick = () => Paywall.showUpgradeModal("SHARE_TO_X");
        } else {
          shareBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = Analytics.generateXShareText(state);
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, "_blank");
          };
        }
      }
      const exportCsvBtn = overlay.querySelector("#export-csv-btn");
      const exportJsonBtn = overlay.querySelector("#export-json-btn");
      if (exportCsvBtn) {
        if (logFlags.gated) {
          exportCsvBtn.style.opacity = "0.5";
          exportCsvBtn.onclick = () => Paywall.showUpgradeModal("DETAILED_LOGS");
        } else {
          exportCsvBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const success = Analytics.exportTradesAsCSV(state);
            if (success) {
              exportCsvBtn.textContent = "Downloaded!";
              setTimeout(() => {
                exportCsvBtn.innerHTML = `${ICONS.FILE_CSV} Export CSV`;
              }, 2e3);
            }
          };
        }
      }
      if (exportJsonBtn) {
        if (logFlags.gated) {
          exportJsonBtn.style.opacity = "0.5";
          exportJsonBtn.onclick = () => Paywall.showUpgradeModal("DETAILED_LOGS");
        } else {
          exportJsonBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            Analytics.exportSessionAsJSON(state);
            exportJsonBtn.textContent = "Downloaded!";
            setTimeout(() => {
              exportJsonBtn.innerHTML = `${ICONS.FILE_JSON} Export JSON`;
            }, 2e3);
          };
        }
      }
      const replayBtn = overlay.querySelector("#session-replay-btn");
      if (replayBtn) {
        replayBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          self.close();
          SessionReplay.open();
        };
      }
      const profileBtn = overlay.querySelector("#trader-profile-btn");
      if (profileBtn) {
        profileBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          self.close();
          TraderProfile.open();
        };
      }
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          console.log("[Dashboard] Overlay background clicked");
          self.close();
        }
      };
      if (chartFlags.visible) {
        const chartEl = overlay.querySelector("#dashboard-equity-chart");
        if (chartFlags.gated)
          this.lockSection(chartEl, "EQUITY_CHARTS");
      } else {
        overlay.querySelector("#dashboard-equity-chart").style.display = "none";
      }
      if (logFlags.visible) {
        const logEl = overlay.querySelector("#dashboard-recent-logs");
        if (logFlags.gated)
          this.lockSection(logEl, "DETAILED_LOGS");
      } else {
        overlay.querySelector("#dashboard-recent-logs").style.display = "none";
      }
      if (eliteFlags.visible) {
        const eliteEl = overlay.querySelector("#dashboard-behavior-profile");
        if (eliteFlags.gated)
          this.lockSection(eliteEl, "BEHAVIOR_BASELINE");
      } else {
        overlay.querySelector("#dashboard-behavior-profile").style.display = "none";
      }
      if (aiFlags.visible) {
        const aiEl = overlay.querySelector("#dashboard-professor-box");
        if (aiFlags.gated)
          this.lockSection(aiEl, "ADVANCED_ANALYTICS");
      } else {
        overlay.querySelector("#dashboard-professor-box").style.display = "none";
      }
      if (chartFlags.interactive) {
        setTimeout(() => this.drawEquityCurve(overlay, state), 100);
      }
    },
    drawEquityCurve(root, state) {
      const canvas = root.querySelector("#equity-canvas");
      if (!canvas)
        return;
      const ctx = canvas.getContext("2d");
      const history = state.session.equityHistory || [];
      if (history.length < 2) {
        ctx.fillStyle = "#475569";
        ctx.font = "10px Inter";
        ctx.textAlign = "center";
        ctx.fillText("Need more trades to visualize equity...", canvas.width / 4, canvas.height / 4);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const padding = 20;
      const points = history.map((h2) => h2.equity);
      const min = Math.min(...points) * 0.99;
      const max = Math.max(...points) * 1.01;
      const range = max - min;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.strokeStyle = "#14b8a6";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      history.forEach((entry, i) => {
        const x = padding + i / (history.length - 1) * (w - padding * 2);
        const y = h - padding - (entry.equity - min) / range * (h - padding * 2);
        if (i === 0)
          ctx.moveTo(x, y);
        else
          ctx.lineTo(x, y);
      });
      ctx.stroke();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(20, 184, 166, 0.2)");
      grad.addColorStop(1, "rgba(20, 184, 166, 0)");
      ctx.lineTo(w - padding, h - padding);
      ctx.lineTo(padding, h - padding);
      ctx.fillStyle = grad;
      ctx.fill();
    },
    lockSection(el, featureName) {
      if (!el)
        return;
      el.style.position = "relative";
      el.style.overflow = "hidden";
      const overlay = document.createElement("div");
      overlay.className = "locked-overlay";
      overlay.innerHTML = `
            <div class="locked-icon">${ICONS.LOCK}</div>
            <div class="locked-text">${featureName.includes("ELITE") || featureName === "BEHAVIOR_BASELINE" ? "ELITE FEATURE" : "PRO FEATURE"}</div>
        `;
      overlay.onclick = (e) => {
        e.stopPropagation();
        Paywall.showUpgradeModal(featureName);
      };
      el.appendChild(overlay);
    },
    renderRecentMiniRows(state) {
      const trades = Object.values(state.trades || {}).sort((a, b) => b.ts - a.ts).slice(0, 5);
      if (trades.length === 0)
        return '<div style="color:#475569; font-size:12px;">No trade history.</div>';
      return trades.map((t) => `
            <div class="mini-row">
                <span style="color:#64748b;">${new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span style="font-weight:700; color:${t.side === "BUY" ? "#14b8a6" : "#ef4444"}">${t.side}</span>
                <span>${t.symbol}</span>
                <span class="${(t.realizedPnlSol || 0) >= 0 ? "win" : "loss"}" style="font-weight:600;">
                    ${t.realizedPnlSol ? (t.realizedPnlSol > 0 ? "+" : "") + t.realizedPnlSol.toFixed(4) : t.solAmount.toFixed(2)}
                </span>
            </div>
        `).join("");
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
      const CURRENT_UI_VERSION = "1.10.3";
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
                <div class="title" style="display:flex;align-items:center;justify-content:space-between;flex:1;"><div><span class="dot"></span> ZER\xD8 PNL</div><span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);">TOKEN</span></div>
                <div class="controls">
                  <div class="startSol">
                    <span style="font-weight:700;color:rgba(203,213,225,0.92);">Start SOL</span>
                    <input class="startSolInput" type="text" inputmode="decimal" />
                  </div>
                  <button class="pillBtn" data-act="shareX" style="background:rgba(29,155,240,0.15);color:#1d9bf0;border:1px solid rgba(29,155,240,0.3);font-family:'Arial',sans-serif;font-weight:600;display:none;" id="pnl-share-btn">Share \u{1D54F}</button>
                  <button class="pillBtn" data-act="getPro" style="background:rgba(99,102,241,0.15);color:#6366f1;border:1px solid rgba(99,102,241,0.3);font-weight:700;display:none;align-items:center;gap:4px;" id="pnl-pro-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>PRO</button>
                  <button class="pillBtn" data-act="trades">Trades</button>
                  <button class="pillBtn" data-act="dashboard" style="background:rgba(20,184,166,0.15);color:#14b8a6;border:1px solid rgba(20,184,166,0.3);font-weight:700;">Stats</button>
                  <button class="pillBtn" data-act="reset" style="color:#ef4444;">Reset</button>
                  <button class="pillBtn" data-act="settings" style="padding:6px 10px;font-size:16px;">\u2699</button>
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
                    <div class="k">DISCIPLINE <span class="pro-tag" style="display:none;" id="discipline-pro-tag">PRO</span></div>
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
        if (act === "dashboard") {
          Dashboard.toggle();
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
        if (act === "shareX") {
          this.shareToX();
        }
        if (act === "getPro") {
          Paywall.showUpgradeModal();
        }
      });
    },
    shareToX() {
      const shareText = Analytics.generateXShareText(Store.state);
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
      window.open(url, "_blank", "width=550,height=420");
      console.log("[PNL HUD] Sharing session to X");
    },
    async updatePnlHud() {
      const root = OverlayManager.getContainer().querySelector("#" + IDS.pnlHud);
      if (!root || !Store.state)
        return;
      const s = Store.state;
      const shareFlags = FeatureManager.resolveFlags(s, "SHARE_TO_X");
      const proFlags = FeatureManager.resolveFlags(s, "SHARE_TO_X");
      const shareBtn = root.querySelector("#pnl-share-btn");
      const proBtn = root.querySelector("#pnl-pro-btn");
      if (shareBtn)
        shareBtn.style.display = shareFlags.visible && !shareFlags.gated ? "" : "none";
      if (proBtn)
        proBtn.style.display = s.settings.tier === "free" ? "flex" : "none";
      if (!Store.state.settings.enabled) {
        root.style.display = "none";
        return;
      }
      root.style.display = "";
      root.className = Store.state.settings.pnlDocked ? "docked" : "floating";
      if (!Store.state.settings.pnlDocked) {
        root.style.left = px(Store.state.settings.pnlPos.x);
        root.style.top = px(Store.state.settings.pnlPos.y);
        root.style.transform = "none";
      } else {
        root.style.left = "";
        root.style.top = "";
      }
      const solUsd = Trading.getSolPrice();
      const currentToken = TokenDetector.getCurrentToken();
      const unrealized = Trading.getUnrealizedPnl(s, currentToken.mint);
      const inp = root.querySelector(".startSolInput");
      if (document.activeElement !== inp)
        inp.value = s.settings.startSol;
      root.querySelector('[data-k="balance"]').textContent = `${Trading.fmtSol(s.session.balance)} SOL`;
      const positions = Object.values(s.positions || {});
      const totalInvested = positions.reduce((sum, pos) => sum + (pos.totalSolSpent || 0), 0);
      const unrealizedPct = totalInvested > 0 ? unrealized / totalInvested * 100 : 0;
      const tokenValueEl = root.querySelector('[data-k="tokenValue"]');
      const tokenUnitEl = root.querySelector('[data-k="tokenUnit"]');
      if (tokenValueEl && tokenUnitEl) {
        const showUsd = s.settings.tokenDisplayUsd;
        if (showUsd) {
          const unrealizedUsd = unrealized * solUsd;
          tokenValueEl.textContent = (unrealizedUsd >= 0 ? "+" : "") + "$" + Trading.fmtSol(Math.abs(unrealizedUsd));
          tokenUnitEl.textContent = "USD";
        } else {
          tokenValueEl.textContent = (unrealized >= 0 ? "+" : "") + Trading.fmtSol(unrealized) + ` (${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(1)}%)`;
          tokenUnitEl.textContent = "SOL";
        }
        tokenValueEl.style.color = unrealized >= 0 ? "#10b981" : "#ef4444";
      }
      const realized = s.session.realized || 0;
      const totalPnl = realized + unrealized;
      const startBalance = s.settings.startSol || 10;
      const sessionPct = totalPnl / startBalance * 100;
      const pnlEl = root.querySelector('[data-k="pnl"]');
      const pnlUnitEl = root.querySelector('[data-k="pnlUnit"]');
      if (pnlEl && pnlUnitEl) {
        const showUsd = s.settings.sessionDisplayUsd;
        if (showUsd) {
          const totalPnlUsd = totalPnl * solUsd;
          pnlEl.textContent = (totalPnlUsd >= 0 ? "+" : "") + "$" + Trading.fmtSol(Math.abs(totalPnlUsd));
          pnlUnitEl.textContent = "USD";
        } else {
          pnlEl.textContent = (totalPnl >= 0 ? "+" : "") + Trading.fmtSol(totalPnl) + ` (${sessionPct >= 0 ? "+" : ""}${sessionPct.toFixed(1)}%)`;
          pnlUnitEl.textContent = "SOL";
        }
        pnlEl.style.color = totalPnl >= 0 ? "#10b981" : "#ef4444";
      }
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
      const discFlags = FeatureManager.resolveFlags(s, "DISCIPLINE_SCORING");
      const discStatEl = root.querySelector(".stat.discipline");
      const discProTag = root.querySelector("#discipline-pro-tag");
      if (discStatEl) {
        discStatEl.style.display = discFlags.visible ? "" : "none";
        if (discProTag)
          discProTag.style.display = discFlags.gated ? "" : "none";
        if (discFlags.gated) {
          discStatEl.style.opacity = "0.5";
          discStatEl.style.cursor = "pointer";
          discStatEl.onclick = (e) => {
            e.stopPropagation();
            Paywall.showUpgradeModal();
          };
        } else {
          discStatEl.style.opacity = "1";
          discStatEl.style.cursor = "default";
          discStatEl.onclick = null;
        }
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
      const tokenSymbolEl = root.querySelector('[data-k="tokenSymbol"]');
      if (tokenSymbolEl) {
        const symbol = currentToken?.symbol || "TOKEN";
        tokenSymbolEl.textContent = symbol;
      }
    },
    showResetModal() {
      const overlay = document.createElement("div");
      overlay.className = "confirm-modal-overlay";
      const duration = Store.getSessionDuration();
      const summary = Store.getSessionSummary();
      overlay.innerHTML = `
            <div class="confirm-modal">
                <h3>End Session?</h3>
                <p>This will archive your current session and start fresh.</p>
                ${summary && summary.tradeCount > 0 ? `
                    <div style="background:rgba(20,184,166,0.1); border:1px solid rgba(20,184,166,0.2); border-radius:8px; padding:10px; margin:12px 0; font-size:11px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color:#64748b;">Duration</span>
                            <span style="color:#f8fafc; font-weight:600;">${duration} min</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color:#64748b;">Trades</span>
                            <span style="color:#f8fafc; font-weight:600;">${summary.tradeCount}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color:#64748b;">Win Rate</span>
                            <span style="color:#10b981; font-weight:600;">${summary.winRate}%</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#64748b;">P&L</span>
                            <span style="color:${summary.realized >= 0 ? "#10b981" : "#ef4444"}; font-weight:600;">${summary.realized >= 0 ? "+" : ""}${summary.realized.toFixed(4)} SOL</span>
                        </div>
                    </div>
                ` : ""}
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">New Session</button>
                </div>
            </div>
        `;
      OverlayManager.getContainer().appendChild(overlay);
      overlay.querySelector(".cancel").onclick = () => overlay.remove();
      overlay.querySelector(".confirm").onclick = async () => {
        await Store.startNewSession();
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
        let mcStr = "";
        if (t.marketCap && t.marketCap > 0) {
          if (t.marketCap >= 1e9) {
            mcStr = `$${(t.marketCap / 1e9).toFixed(2)}B`;
          } else if (t.marketCap >= 1e6) {
            mcStr = `$${(t.marketCap / 1e6).toFixed(2)}M`;
          } else if (t.marketCap >= 1e3) {
            mcStr = `$${(t.marketCap / 1e3).toFixed(1)}K`;
          } else {
            mcStr = `$${t.marketCap.toFixed(0)}`;
          }
        }
        html += `
                <div class="tradeRow">
                    <div class="muted" style="font-size:9px;">${new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    <div class="tag ${t.side.toLowerCase()}">${t.side}</div>
                    <div style="flex:1;">
                        <div>${t.symbol}</div>
                        ${mcStr ? `<div class="muted" style="font-size:9px;">${mcStr} MC</div>` : ""}
                    </div>
                    <div class="${pnlClass}">${valStr}</div>
                </div>
            `;
      });
      container.innerHTML = html || '<div style="padding:10px;color:#64748b;text-align:center;">No trades yet</div>';
    }
  };

  // src/modules/ui/buy-hud.js
  init_store();
  init_featureManager();
  init_market();
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
                    ${this.renderMarketContext()}
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
                    ${this.renderTradePlanFields()}
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
          const strategyFlags = FeatureManager.resolveFlags(Store.state, "STRATEGY_TAGGING");
          const strategy = strategyEl && strategyFlags.interactive ? strategyEl.value : "Trend";
          if (val <= 0) {
            if (status)
              status.textContent = "Invalid amount";
            return;
          }
          status.textContent = "Executing...";
          if (this.buyHudTab === "buy") {
            this.savePendingPlan(root);
          }
          const tokenInfo = TokenDetector.getCurrentToken();
          const tradePlan = this.buyHudTab === "buy" ? this.consumePendingPlan() : null;
          let res;
          try {
            if (this.buyHudTab === "buy") {
              res = await Trading.buy(val, strategy, tokenInfo, tradePlan);
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
            this.clearPlanFields(root);
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
        if (act === "upgrade-plan") {
          Paywall.showUpgradeModal("TRADE_PLAN");
        }
        if (act === "edit") {
          this.buyHudEdit = !this.buyHudEdit;
          this.mountBuyHud();
        }
      });
    },
    showEmotionSelector(tradeId) {
      const emoFlags = FeatureManager.resolveFlags(Store.state, "EMOTION_TRACKING");
      if (!emoFlags.enabled || Store.state.settings.showJournal === false)
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
      if (emoFlags.gated) {
        const modalInner = overlay.querySelector(".emotion-modal");
        modalInner.style.filter = "grayscale(1) opacity(0.8)";
        const lock = document.createElement("div");
        lock.innerHTML = '<div style="background:rgba(13,17,23,0.8); color:#14b8a6; padding:10px; border-radius:8px; font-weight:800; cursor:pointer;">PRO FEATURE: EMOTION TRACKING</div>';
        lock.style.position = "absolute";
        lock.style.top = "50%";
        lock.style.left = "50%";
        lock.style.transform = "translate(-50%, -50%)";
        lock.style.pointerEvents = "auto";
        lock.onclick = (e) => {
          e.stopPropagation();
          Paywall.showUpgradeModal();
        };
        modalInner.appendChild(lock);
      }
    },
    updateBuyHud() {
      const root = OverlayManager.getContainer().querySelector("#" + IDS.buyHud);
      if (!root || !Store.state)
        return;
      if (!Store.state.settings.enabled) {
        root.style.display = "none";
        return;
      }
      root.style.display = "";
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
    },
    renderMarketContext() {
      if (!Store.state)
        return "";
      const flags = FeatureManager.resolveFlags(Store.state, "MARKET_CONTEXT");
      if (!flags.visible)
        return "";
      const ctx = Market.context;
      const isGated = flags.gated;
      let content = "";
      if (isGated) {
        content = `
                <div class="market-badge gated" style="cursor:pointer;" onclick="this.dispatchEvent(new CustomEvent('zero-upgrade', { bubbles:true, detail:'MARKET_CONTEXT' }))">
                    ${ICONS.LOCK} MARKET CONTEXT (ELITE)
                </div>
            `;
      } else if (ctx) {
        const vol = (ctx.vol24h / 1e6).toFixed(1) + "M";
        const chg = ctx.priceChange24h.toFixed(1) + "%";
        const chgColor = ctx.priceChange24h >= 0 ? "#10b981" : "#ef4444";
        content = `
                <div class="market-badge">
                    <div class="mitem">VOL <span>$${vol}</span></div>
                    <div class="mitem">24H <span style="color:${chgColor}">${chg}</span></div>
                </div>
            `;
      } else {
        content = `
                <div class="market-badge loading">Fetching market data...</div>
            `;
      }
      return `
            <div class="market-context-container" style="margin-bottom:12px;">
                ${content}
            </div>
        `;
    },
    renderTradePlanFields() {
      if (!Store.state)
        return "";
      const flags = FeatureManager.resolveFlags(Store.state, "TRADE_PLAN");
      if (!flags.visible)
        return "";
      const isGated = flags.gated;
      const plan = Store.state.pendingPlan || {};
      if (isGated) {
        return `
                <div class="trade-plan-section gated" data-act="upgrade-plan">
                    <div class="plan-gated-badge">
                        ${ICONS.LOCK}
                        <span>TRADE PLAN (PRO)</span>
                    </div>
                    <div class="plan-gated-hint">Define stop loss, targets & thesis</div>
                </div>
            `;
      }
      return `
            <div class="trade-plan-section">
                <div class="plan-header">
                    <span class="plan-title">${ICONS.TARGET} Trade Plan</span>
                    <span class="plan-tag">PRO</span>
                </div>
                <div class="plan-row">
                    <div class="plan-field">
                        <label class="plan-label">Stop Loss</label>
                        <div class="plan-input-wrap">
                            <input type="text" class="plan-input" data-k="stopLoss" placeholder="0.00" value="${plan.stopLoss || ""}">
                            <span class="plan-unit">USD</span>
                        </div>
                    </div>
                    <div class="plan-field">
                        <label class="plan-label">Target</label>
                        <div class="plan-input-wrap">
                            <input type="text" class="plan-input" data-k="target" placeholder="0.00" value="${plan.target || ""}">
                            <span class="plan-unit">USD</span>
                        </div>
                    </div>
                </div>
                <div class="plan-field full">
                    <label class="plan-label">Entry Thesis <span class="optional">(optional)</span></label>
                    <textarea class="plan-textarea" data-k="thesis" placeholder="Why are you taking this trade?" rows="2">${plan.thesis || ""}</textarea>
                </div>
            </div>
        `;
    },
    // Save pending plan values as user types
    savePendingPlan(root) {
      if (!Store.state.pendingPlan) {
        Store.state.pendingPlan = { stopLoss: null, target: null, thesis: "", maxRiskPct: null };
      }
      const stopEl = root.querySelector('[data-k="stopLoss"]');
      const targetEl = root.querySelector('[data-k="target"]');
      const thesisEl = root.querySelector('[data-k="thesis"]');
      if (stopEl) {
        const val = parseFloat(stopEl.value);
        Store.state.pendingPlan.stopLoss = isNaN(val) ? null : val;
      }
      if (targetEl) {
        const val = parseFloat(targetEl.value);
        Store.state.pendingPlan.target = isNaN(val) ? null : val;
      }
      if (thesisEl) {
        Store.state.pendingPlan.thesis = thesisEl.value.trim();
      }
    },
    // Get and clear pending plan for trade execution
    consumePendingPlan() {
      const plan = Store.state.pendingPlan || {};
      Store.state.pendingPlan = { stopLoss: null, target: null, thesis: "", maxRiskPct: null };
      return {
        plannedStop: plan.stopLoss || null,
        plannedTarget: plan.target || null,
        entryThesis: plan.thesis || "",
        riskDefined: !!(plan.stopLoss && plan.stopLoss > 0)
      };
    },
    // Clear plan input fields in the UI
    clearPlanFields(root) {
      const stopEl = root.querySelector('[data-k="stopLoss"]');
      const targetEl = root.querySelector('[data-k="target"]');
      const thesisEl = root.querySelector('[data-k="thesis"]');
      if (stopEl)
        stopEl.value = "";
      if (targetEl)
        targetEl.value = "";
      if (thesisEl)
        thesisEl.value = "";
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
    console.log("%c ZER\xD8 v1.10.7 (Market Context & Coaching)", "color: #14b8a6; font-weight: bold; font-size: 14px;");
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
      console.log("[ZER\xD8] Init PNL Calculator...");
      PnlCalculator.init();
    } catch (e) {
      console.error("[ZER\xD8] PNL Calculator Init Failed:", e);
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
