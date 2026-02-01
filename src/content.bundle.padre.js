(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/modules/store.js
  function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object") return base;
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
  var DEV_FORCE_ELITE, EXT_KEY, DEFAULTS, Store;
  var init_store = __esm({
    "src/modules/store.js"() {
      DEV_FORCE_ELITE = false;
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
          // 'paper' | 'analysis' | 'shadow'
          showProfessor: true,
          // Show trade analysis popup
          rolloutPhase: "full",
          // 'beta' | 'preview' | 'full'
          featureOverrides: {},
          // For remote kill-switches
          behavioralAlerts: true,
          // Phase 9: Elite Guardrails
          // Onboarding State
          onboardingSeen: false,
          onboardingVersion: null,
          onboardingCompletedAt: null,
          // License / Whop Membership
          license: {
            key: null,
            // Whop license key (mem_xxx or license string)
            valid: false,
            // Last known validation result
            lastVerified: null,
            // Timestamp (ms) of last successful verification
            expiresAt: null,
            // ISO string or null (founders = lifetime)
            status: "none",
            // 'none' | 'active' | 'expired' | 'cancelled' | 'error'
            plan: null
            // 'monthly' | 'annual' | 'founders'
          }
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
          status: "active",
          // 'active' | 'completed' | 'abandoned'
          notes: ""
          // Session notes (max 280 chars, stored locally)
        },
        // Session history (archived sessions)
        sessionHistory: [],
        // Array of completed session objects
        trades: {},
        // Map ID -> Trade Object { id, strategy, emotion, plannedStop, plannedTarget, entryThesis, riskDefined, ... }
        positions: {},
        // Pending trade plan (cleared after trade is recorded)
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
        shadow: {
          declaredStrategy: "Trend",
          notes: [],
          hudDocked: false,
          hudPos: { x: 20, y: 400 },
          narrativeTrustCache: {}
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
        version: "1.11.8"
      };
      Store = {
        state: null,
        async load() {
          let timeoutId;
          const loadLogic = new Promise((resolve) => {
            try {
              if (!isChromeStorageAvailable()) {
                this.state = JSON.parse(JSON.stringify(DEFAULTS));
                if (timeoutId) clearTimeout(timeoutId);
                resolve(this.state);
                return;
              }
              chrome.storage.local.get([EXT_KEY], (res) => {
                if (timeoutId) clearTimeout(timeoutId);
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
              if (timeoutId) clearTimeout(timeoutId);
              resolve(JSON.parse(JSON.stringify(DEFAULTS)));
            }
          });
          const timeout = new Promise((resolve) => {
            timeoutId = setTimeout(() => {
              console.warn("[ZER\xD8] Storage load timed out, using defaults.");
              if (!this.state) this.state = JSON.parse(JSON.stringify(DEFAULTS));
              resolve(this.state);
            }, 1e3);
          });
          return Promise.race([loadLogic, timeout]);
        },
        async save() {
          if (!isChromeStorageAvailable() || !this.state) return;
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
        // Immediate save for critical operations (trades)
        // No debounce - saves immediately for data integrity
        async saveImmediate() {
          return this.save();
        },
        async clear() {
          if (!isChromeStorageAvailable()) return;
          return new Promise((resolve) => {
            chrome.storage.local.remove(EXT_KEY, () => {
              this.state = JSON.parse(JSON.stringify(DEFAULTS));
              resolve();
            });
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
          newState.settings.onboardingSeen = oldState.onboardingSeen ?? false;
          newState.settings.onboardingVersion = oldState.onboardingVersion ?? null;
          newState.settings.onboardingCompletedAt = oldState.onboardingCompletedAt ?? null;
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
            if (this.state.settings.tier === "pro") {
              this.state.settings.tier = "free";
            }
            if (DEV_FORCE_ELITE) {
              this.state.settings.tier = "elite";
            } else if (this.state.settings.license?.valid && this.state.settings.license?.lastVerified) {
              const GRACE_MS = 72 * 60 * 60 * 1e3;
              const elapsed = Date.now() - this.state.settings.license.lastVerified;
              if (elapsed < GRACE_MS) {
                this.state.settings.tier = "elite";
              } else {
                this.state.settings.tier = "free";
                this.state.settings.license.valid = false;
                this.state.settings.license.status = "expired";
              }
            } else {
              this.state.settings.tier = "free";
            }
            if (this.state.fills) {
              this.state.fills.forEach((f) => {
                if (f.side === "ENTRY") f.side = "BUY";
                if (f.side === "EXIT") f.side = "SELL";
              });
            }
            if (this.state.trades) {
              Object.values(this.state.trades).forEach((t) => {
                if (t.side === "ENTRY") t.side = "BUY";
                if (t.side === "EXIT") t.side = "SELL";
              });
            }
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
            if (!this.state.sessionHistory) this.state.sessionHistory = [];
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
          if (!session || !session.startTime) return 0;
          const endTime = session.endTime || Date.now();
          return Math.floor((endTime - session.startTime) / 6e4);
        },
        // Get session summary
        getSessionSummary() {
          const session = this.state?.session;
          if (!session) return null;
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

  // src/modules/schemas.js
  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : r & 3 | 8).toString(16);
    });
  }
  function createEvent(type, payload = {}, overrides = {}) {
    return {
      eventId: uuid(),
      ts: Date.now(),
      sessionId: void 0,
      tradeId: void 0,
      platform: Platform.UNKNOWN,
      type,
      payload,
      ...overrides
    };
  }
  var Platform, SCHEMA_VERSION;
  var init_schemas = __esm({
    "src/modules/schemas.js"() {
      Platform = {
        AXIOM: "AXIOM",
        PADRE: "PADRE",
        UNKNOWN: "UNKNOWN"
      };
      SCHEMA_VERSION = 3;
    }
  });

  // src/modules/diagnostics-store.js
  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      clientId: uuid(),
      events: [],
      settings: {
        privacy: {
          autoSendDiagnostics: false,
          diagnosticsConsentAcceptedAt: null,
          includeFeatureClicks: true
        },
        diagnostics: {
          endpointUrl: "https://zero-diagnostics.zerodata1.workers.dev/v1/zero/ingest",
          lastUploadedEventTs: 0
        }
      },
      upload: {
        queue: [],
        backoffUntilTs: 0,
        lastError: null
      }
    };
  }
  function isStorageAvailable() {
    try {
      return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
    } catch {
      return false;
    }
  }
  async function chromeStorageGet(key) {
    if (!isStorageAvailable()) return null;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([key], (res) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || "";
            if (!msg.includes("context invalidated")) {
              console.warn("[DiagStore] get error:", msg);
            }
            resolve(null);
            return;
          }
          resolve(res[key] || null);
        });
      } catch (e) {
        if (!String(e).includes("context invalidated")) {
          console.error("[DiagStore] get exception:", e);
        }
        resolve(null);
      }
    });
  }
  async function chromeStorageSet(key, value) {
    if (!isStorageAvailable()) return;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || "";
            if (!msg.includes("context invalidated")) {
              console.warn("[DiagStore] set error:", msg);
            }
          }
          resolve();
        });
      } catch (e) {
        if (!String(e).includes("context invalidated")) {
          console.error("[DiagStore] set exception:", e);
        }
        resolve();
      }
    });
  }
  async function chromeStorageRemove(key) {
    if (!isStorageAvailable()) return;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove(key, () => resolve());
      } catch {
        resolve();
      }
    });
  }
  var STORAGE_KEY, EVENTS_CAP, UPLOAD_QUEUE_CAP, DEBOUNCE_MS, ERROR_COOLDOWN_MS, DiagnosticsStore;
  var init_diagnostics_store = __esm({
    "src/modules/diagnostics-store.js"() {
      init_schemas();
      STORAGE_KEY = "zero_state";
      EVENTS_CAP = 2e4;
      UPLOAD_QUEUE_CAP = 200;
      DEBOUNCE_MS = 400;
      ERROR_COOLDOWN_MS = 5e3;
      DiagnosticsStore = {
        /** @type {ReturnType<typeof defaultState>|null} */
        state: null,
        _saveTimer: null,
        _lastErrorTs: 0,
        // ------ Lifecycle ------
        async load() {
          const saved = await chromeStorageGet(STORAGE_KEY);
          if (!saved) {
            this.state = defaultState();
            await this._persist();
          } else {
            this.state = this._migrate(saved);
          }
          return this.state;
        },
        _migrate(saved) {
          const s = { ...defaultState(), ...saved };
          s.settings = { ...defaultState().settings, ...s.settings };
          s.settings.privacy = { ...defaultState().settings.privacy, ...s.settings?.privacy };
          s.settings.diagnostics = { ...defaultState().settings.diagnostics, ...s.settings?.diagnostics };
          s.upload = { ...defaultState().upload, ...s.upload };
          if (!s.clientId) s.clientId = uuid();
          if (!Array.isArray(s.events)) s.events = [];
          if (!Array.isArray(s.upload.queue)) s.upload.queue = [];
          s.schemaVersion = SCHEMA_VERSION;
          return s;
        },
        // ------ Debounced persist ------
        save() {
          if (this._saveTimer) return;
          this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._persist();
          }, DEBOUNCE_MS);
        },
        async _persist() {
          if (!this.state) return;
          await chromeStorageSet(STORAGE_KEY, this.state);
        },
        async forceSave() {
          if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
          }
          await this._persist();
        },
        // ------ Events ring buffer ------
        /**
         * Append an event to the ring buffer.
         * @param {string} type - EventType value
         * @param {Record<string, any>} payload
         * @param {{ sessionId?: string, tradeId?: string, platform?: string }} ctx
         */
        logEvent(type, payload = {}, ctx = {}) {
          if (!this.state) return;
          if (type === "ERROR") {
            const now = Date.now();
            if (now - this._lastErrorTs < ERROR_COOLDOWN_MS) return;
            this._lastErrorTs = now;
          }
          const evt = createEvent(type, payload, {
            sessionId: ctx.sessionId,
            tradeId: ctx.tradeId,
            platform: ctx.platform || "UNKNOWN"
          });
          this.state.events.push(evt);
          if (this.state.events.length > EVENTS_CAP) {
            this.state.events = this.state.events.slice(-EVENTS_CAP);
          }
          this.save();
        },
        // ------ Upload queue ------
        enqueuePacket(packet) {
          if (!this.state) return;
          this.state.upload.queue.push({
            uploadId: packet.uploadId,
            createdAt: packet.createdAt,
            eventCount: (packet.eventsDelta || []).length,
            payload: packet
          });
          if (this.state.upload.queue.length > UPLOAD_QUEUE_CAP) {
            this.state.upload.queue = this.state.upload.queue.slice(-UPLOAD_QUEUE_CAP);
          }
          this.logEvent("UPLOAD_PACKET_ENQUEUED", { uploadId: packet.uploadId });
          this.save();
        },
        dequeuePacket() {
          if (!this.state || !this.state.upload.queue.length) return null;
          const item = this.state.upload.queue.shift();
          this.save();
          return item;
        },
        peekPacket() {
          if (!this.state || !this.state.upload.queue.length) return null;
          return this.state.upload.queue[0];
        },
        // ------ Privacy settings ------
        isAutoSendEnabled() {
          return !!this.state?.settings?.privacy?.autoSendDiagnostics;
        },
        enableAutoSend() {
          if (!this.state) return;
          this.state.settings.privacy.autoSendDiagnostics = true;
          this.state.settings.privacy.diagnosticsConsentAcceptedAt = Date.now();
          this.save();
        },
        disableAutoSend() {
          if (!this.state) return;
          this.state.settings.privacy.autoSendDiagnostics = false;
          this.save();
        },
        getEndpointUrl() {
          return this.state?.settings?.diagnostics?.endpointUrl || "";
        },
        setEndpointUrl(url) {
          if (!this.state) return;
          this.state.settings.diagnostics.endpointUrl = url;
          this.save();
        },
        getLastUploadedEventTs() {
          return this.state?.settings?.diagnostics?.lastUploadedEventTs || 0;
        },
        setLastUploadedEventTs(ts) {
          if (!this.state) return;
          this.state.settings.diagnostics.lastUploadedEventTs = ts;
          this.save();
        },
        // ------ Backoff ------
        isInBackoff() {
          return Date.now() < (this.state?.upload?.backoffUntilTs || 0);
        },
        setBackoff(delayMs) {
          if (!this.state) return;
          this.state.upload.backoffUntilTs = Date.now() + delayMs;
          this.save();
        },
        clearBackoff() {
          if (!this.state) return;
          this.state.upload.backoffUntilTs = 0;
          this.state.upload.lastError = null;
          this.save();
        },
        setLastError(msg) {
          if (!this.state) return;
          this.state.upload.lastError = msg;
          this.save();
        },
        // ------ Data management ------
        async clearAllData() {
          await chromeStorageRemove(STORAGE_KEY);
          this.state = defaultState();
          await this._persist();
        },
        async clearUploadQueue() {
          if (!this.state) return;
          this.state.upload.queue = [];
          this.state.upload.backoffUntilTs = 0;
          this.state.upload.lastError = null;
          await this.forceSave();
        },
        // ------ Delta query ------
        getEventsDelta() {
          if (!this.state) return [];
          const lastTs = this.getLastUploadedEventTs();
          return this.state.events.filter((e) => e.ts > lastTs);
        },
        getClientId() {
          return this.state?.clientId || "";
        }
      };
    }
  });

  // src/modules/upload-packet.js
  function buildUploadPackets() {
    const events = DiagnosticsStore.getEventsDelta();
    if (events.length === 0) return { packets: [], totalEvents: 0 };
    const clientId = DiagnosticsStore.getClientId();
    const version = Store.state?.version || "0.0.0";
    const chunks = [];
    for (let i = 0; i < events.length; i += MAX_EVENTS_PER_PACKET) {
      chunks.push(events.slice(i, i + MAX_EVENTS_PER_PACKET));
    }
    const packets = chunks.map((chunk) => {
      const packet = {
        uploadId: uuid(),
        clientId,
        createdAt: Date.now(),
        schemaVersion: SCHEMA_VERSION,
        extensionVersion: version,
        eventsDelta: chunk
      };
      let serialized = JSON.stringify(packet);
      if (serialized.length > MAX_PAYLOAD_BYTES && chunk.length > 100) {
        const trimmed = chunk.slice(-Math.floor(chunk.length * 0.7));
        packet.eventsDelta = trimmed;
        packet._trimmed = true;
      }
      return packet;
    });
    return { packets, totalEvents: events.length };
  }
  function enqueueUploadPackets() {
    const { packets } = buildUploadPackets();
    for (const pkt of packets) {
      DiagnosticsStore.enqueuePacket(pkt);
    }
    return packets.length;
  }
  var MAX_EVENTS_PER_PACKET, MAX_PAYLOAD_BYTES;
  var init_upload_packet = __esm({
    "src/modules/upload-packet.js"() {
      init_diagnostics_store();
      init_schemas();
      init_store();
      MAX_EVENTS_PER_PACKET = 2e3;
      MAX_PAYLOAD_BYTES = 300 * 1024;
    }
  });

  // src/modules/diagnostics-manager.js
  var diagnostics_manager_exports = {};
  __export(diagnostics_manager_exports, {
    DiagnosticsManager: () => DiagnosticsManager
  });
  var UPLOAD_INTERVAL_MS, DiagnosticsManager;
  var init_diagnostics_manager = __esm({
    "src/modules/diagnostics-manager.js"() {
      init_diagnostics_store();
      init_upload_packet();
      UPLOAD_INTERVAL_MS = 6e4;
      DiagnosticsManager = {
        _timer: null,
        init() {
          if (this._timer) return;
          console.log("[DiagnosticsManager] Initialized. Status:", DiagnosticsStore.isAutoSendEnabled() ? "ENABLED" : "DISABLED");
          this._scheduleNextTick();
        },
        _scheduleNextTick(delay = UPLOAD_INTERVAL_MS) {
          if (this._timer) clearTimeout(this._timer);
          this._timer = setTimeout(() => this._tick(), delay);
        },
        async _tick() {
          try {
            if (!DiagnosticsStore.isAutoSendEnabled()) {
              this._scheduleNextTick();
              return;
            }
            if (DiagnosticsStore.isInBackoff()) {
              const state = await DiagnosticsStore.load();
              const now = Date.now();
              if (now < state.upload.backoffUntilTs) {
                this._scheduleNextTick(UPLOAD_INTERVAL_MS);
                return;
              }
            }
            const enqueuedCount = enqueueUploadPackets();
            if (enqueuedCount > 0) {
              console.log(`[DiagnosticsManager] Enqueued ${enqueuedCount} packets.`);
            }
            chrome.runtime.sendMessage({ type: "ZERO_TRIGGER_UPLOAD" });
          } catch (e) {
            console.error("[DiagnosticsManager] Loop error:", e);
          }
          this._scheduleNextTick();
        },
        async _processQueue() {
          chrome.runtime.sendMessage({ type: "ZERO_TRIGGER_UPLOAD" });
        }
      };
    }
  });

  // src/modules/ui/ids.js
  var IDS = {
    banner: "paper-mode-banner",
    pnlHud: "paper-pnl-hud",
    buyHud: "paper-buyhud-root",
    shadowHud: "paper-shadow-hud",
    style: "paper-overlay-style",
    positionsPanel: "paper-positions-panel"
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

/* Premium Scrollbars */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #0d1117;
}

::-webkit-scrollbar-thumb {
  background: rgba(20, 184, 166, 0.2);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: #14b8a6;
  background-clip: content-box;
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
  padding: 10px 14px;
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
  gap: 5px;
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}

#${IDS.pnlHud} .pillBtn {
  border: 1px solid rgba(20,184,166,0.2);
  background: transparent;
  color: #94a3b8;
  padding: 4px 7px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  font-size: 10px;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0;
  flex-shrink: 0;
  white-space: nowrap;
}

#${IDS.pnlHud} .pillBtn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}

#${IDS.pnlHud} .startSol {
  display: flex;
  align-items: center;
  gap: 5px;
}

#${IDS.pnlHud} input.startSolInput {
  width: 52px;
  border: 1px solid rgba(20,184,166,0.2);
  background: #161b22;
  color: #f8fafc;
  padding: 4px 7px;
  border-radius: 5px;
  outline: none;
  font-weight: 600;
  font-size: 11px;
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
  grid-template-columns: 40px 35px 1fr 60px 70px;
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

/* Positions Panel */
#${IDS.pnlHud} .positionsPanel {
  border-top: 1px solid rgba(20,184,166,0.1);
}

#${IDS.pnlHud} .positionsHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  background: rgba(20,184,166,0.03);
  transition: background 0.2s;
}

#${IDS.pnlHud} .positionsHeader:hover {
  background: rgba(20,184,166,0.08);
}

#${IDS.pnlHud} .positionsTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.pnlHud} .positionCount {
  color: #14b8a6;
  font-weight: 800;
}

#${IDS.pnlHud} .positionsToggle {
  color: #64748b;
  transition: transform 0.2s;
}

#${IDS.pnlHud} .positionsToggle.expanded {
  transform: rotate(180deg);
}

#${IDS.pnlHud} .positionsList {
  max-height: 300px;
  overflow-y: auto;
}

#${IDS.pnlHud} .positionRow {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(20,184,166,0.05);
  transition: background 0.15s;
}

#${IDS.pnlHud} .positionRow:hover {
  background: rgba(20,184,166,0.05);
}

#${IDS.pnlHud} .positionRow:last-child {
  border-bottom: none;
}

#${IDS.pnlHud} .positionInfo {
  min-width: 0;
}

#${IDS.pnlHud} .positionSymbol {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 2px;
}

#${IDS.pnlHud} .positionDetails {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #64748b;
}

#${IDS.pnlHud} .positionPnl {
  text-align: right;
  min-width: 100px;
}

#${IDS.pnlHud} .positionPnl .pnlValue {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

#${IDS.pnlHud} .positionPnl .pnlPct {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

#${IDS.pnlHud} .positionPnl.positive .pnlValue,
#${IDS.pnlHud} .positionPnl.positive .pnlPct {
  color: #10b981;
}

#${IDS.pnlHud} .positionPnl.negative .pnlValue,
#${IDS.pnlHud} .positionPnl.negative .pnlPct {
  color: #ef4444;
}

#${IDS.pnlHud} .quickSellBtns {
  display: flex;
  gap: 6px;
}

#${IDS.pnlHud} .qSellBtn {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  color: #ef4444;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

#${IDS.pnlHud} .qSellBtn:hover {
  background: rgba(239,68,68,0.2);
  border-color: rgba(239,68,68,0.4);
}

#${IDS.pnlHud} .noPositions {
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-size: 12px;
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

/* Trade Plan Styles */
#${IDS.buyHud} .plan-toggle {
    margin-top: 12px;
    padding: 10px 14px;
    background: #161b22;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 8px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.2s;
}

#${IDS.buyHud} .plan-toggle:hover {
    border-color: rgba(20,184,166,0.3);
    background: #1c2128;
}

#${IDS.buyHud} .plan-toggle svg {
    flex-shrink: 0;
}

#${IDS.buyHud} .trade-plan-section {
    margin-top: 12px;
    padding: 12px 14px;
    background: #161b22;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 8px;
}

#${IDS.buyHud} .trade-plan-section.gated {
    background: linear-gradient(135deg, rgba(168,85,247,0.05), rgba(139,92,246,0.05));
    border: 1px dashed rgba(168,85,247,0.25);
}

#${IDS.buyHud} .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

#${IDS.buyHud} .plan-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #e2e8f0;
    font-weight: 700;
    font-size: 11px;
}

#${IDS.buyHud} .plan-tag {
    background: rgba(168,85,247,0.15);
    color: #a78bfa;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
}

#${IDS.buyHud} .plan-collapse-arrow {
    cursor: pointer;
    color: #64748b;
    padding: 4px;
    transition: color 0.2s;
}

#${IDS.buyHud} .plan-collapse-arrow:hover {
    color: #94a3b8;
}

#${IDS.buyHud} .plan-gated-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    background: rgba(168,85,247,0.1);
    border: 1px dashed rgba(168,85,247,0.3);
    border-radius: 6px;
    color: #a855f7;
    font-weight: 700;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

#${IDS.buyHud} .plan-gated-badge:hover {
    background: rgba(168,85,247,0.15);
    border-color: rgba(168,85,247,0.5);
}

#${IDS.buyHud} .plan-gated-hint {
    text-align: center;
    color: #64748b;
    font-size: 10px;
    margin-top: 6px;
}

#${IDS.buyHud} .plan-row {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
}

#${IDS.buyHud} .plan-field {
    flex: 1;
}

#${IDS.buyHud} .plan-field.full {
    flex: unset;
    width: 100%;
}

#${IDS.buyHud} .plan-label {
    display: block;
    color: #64748b;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
}

#${IDS.buyHud} .plan-label .optional {
    font-weight: 400;
    text-transform: none;
    color: #475569;
}

#${IDS.buyHud} .plan-input-wrap {
    display: flex;
    align-items: center;
    background: #0d1117;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 6px;
    overflow: hidden;
    transition: border-color 0.2s;
}

#${IDS.buyHud} .plan-input-wrap:focus-within {
    border-color: #14b8a6;
}

#${IDS.buyHud} .plan-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    min-width: 0;
}

#${IDS.buyHud} .plan-unit {
    color: #475569;
    font-size: 10px;
    font-weight: 600;
    padding: 0 8px;
    flex-shrink: 0;
}

#${IDS.buyHud} .plan-textarea {
    width: 100%;
    background: #0d1117;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 6px;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
    resize: vertical;
    min-height: 36px;
    transition: border-color 0.2s;
}

#${IDS.buyHud} .plan-textarea:focus {
    border-color: #14b8a6;
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

.emotion-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
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

/* Tier Tag */
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

/* Tutorial / Walkthrough Mode */
.professor-overlay.tutorial-mode {
  background: transparent !important;
  pointer-events: none !important;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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

:host(.zero-shadow-mode) #${IDS.banner} .label {
  color: #f59e0b;
}

:host(.zero-shadow-mode) #${IDS.banner} .dot {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245,158,11,0.5);
}

:host(.zero-shadow-mode) #${IDS.banner} {
  border-color: rgba(245,158,11,0.3);
}

.zero-shadow-mode #${IDS.shadowHud} .sh-header-title {
  color: #f59e0b;
}

.zero-shadow-mode #${IDS.shadowHud} .sh-header-icon {
  color: #f59e0b;
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

/* Elite Locked Card Design */
.elite-locked-card {
    position: relative;
    background: linear-gradient(145deg, rgba(139, 92, 246, 0.04), rgba(99, 102, 241, 0.02));
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 12px;
    padding: 16px 18px;
    cursor: default;
    overflow: hidden;
}

.elite-locked-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 8px,
        rgba(139, 92, 246, 0.015) 8px,
        rgba(139, 92, 246, 0.015) 16px
    );
    pointer-events: none;
}

.elite-locked-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
    position: relative;
}

.elite-locked-card-icon {
    color: #8b5cf6;
    opacity: 0.7;
    display: flex;
    align-items: center;
}

.elite-locked-card-title {
    font-size: 13px;
    font-weight: 700;
    color: #e2e8f0;
}

.elite-locked-card-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-left: auto;
}

.elite-locked-card-desc {
    font-size: 11px;
    color: #64748b;
    line-height: 1.5;
    position: relative;
}
`;

  // src/modules/ui/settings-panel-styles.js
  var SETTINGS_PANEL_CSS = `
/* Section titles */
.settings-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 20px 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(20,184,166,0.08);
}

/* Tier badges */
.tier-badge {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.tier-badge.pro {
  background: rgba(99,102,241,0.15);
  color: #818cf8;
}

.tier-badge.elite {
  background: rgba(245,158,11,0.15);
  color: #f59e0b;
}

/* Privacy info box */
.privacy-info-box {
  background: rgba(20,184,166,0.03);
  border: 1px solid rgba(20,184,166,0.08);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.privacy-info-box p {
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
  margin: 0 0 6px 0;
}

.privacy-info-box p:last-child {
  margin-bottom: 0;
}

/* Diagnostics status */
.diag-status {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.08);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
}

.diag-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.diag-label {
  font-size: 11px;
  color: #64748b;
}

.diag-value {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
}

.diag-value.enabled {
  color: #10b981;
}

.diag-value.disabled {
  color: #64748b;
}

.diag-value.error {
  color: #ef4444;
  font-size: 10px;
  max-width: 200px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Settings action buttons */
.settings-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.settings-action-btn {
  flex: 1;
  min-width: 120px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(20,184,166,0.15);
  background: rgba(20,184,166,0.05);
  color: #94a3b8;
  transition: all 0.2s;
}

.settings-action-btn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.3);
  color: #14b8a6;
}

.settings-action-btn.danger {
  border-color: rgba(239,68,68,0.15);
  background: rgba(239,68,68,0.05);
}

.settings-action-btn.danger:hover {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.3);
  color: #ef4444;
}

/* Feature cards */
.feature-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #0d1117;
  border: 1px solid rgba(100,116,139,0.12);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.feature-card:hover {
  background: rgba(20,184,166,0.03);
  border-color: rgba(20,184,166,0.15);
  transform: translateX(2px);
}

.feature-card-lock {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.6;
}

.feature-card-body {
  flex: 1;
  min-width: 0;
}

.feature-card-name {
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 2px;
}

.feature-card-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.feature-card-badge {
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(100,116,139,0.1);
}
`;

  // src/modules/ui/modes-styles.js
  var MODES_CSS = `
/* ==========================================
   MODE BADGE (Global indicator)
   ========================================== */

.zero-mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
}

.zero-mode-badge svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}

.zero-mode-badge.paper {
    background: rgba(20, 184, 166, 0.1);
    color: #14b8a6;
    border: 1px solid rgba(20, 184, 166, 0.2);
}

.zero-mode-badge.analysis {
    background: rgba(96, 165, 250, 0.1);
    color: #60a5fa;
    border: 1px solid rgba(96, 165, 250, 0.2);
}

.zero-mode-badge.shadow {
    background: rgba(139, 92, 246, 0.1);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.2);
}

.zero-mode-badge .mode-subtext {
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.3px;
    opacity: 0.75;
    margin-left: 4px;
}

/* ==========================================
   MODE SESSION BANNER (once per session)
   ========================================== */

.zero-session-banner-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    pointer-events: auto;
    animation: modeFadeIn 0.25s ease-out;
}

.zero-session-banner {
    width: 380px;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 28px 24px 20px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: modeSlideIn 0.3s ease-out;
}

.zero-session-banner .banner-icon {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
}

.zero-session-banner .banner-icon svg {
    width: 20px;
    height: 20px;
}

.zero-session-banner .banner-title {
    font-size: 15px;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: 0.3px;
}

.zero-session-banner .banner-body {
    font-size: 13px;
    color: #94a3b8;
    line-height: 1.65;
    margin-bottom: 16px;
    white-space: pre-line;
}

.zero-session-banner .banner-footer {
    font-size: 11px;
    color: #64748b;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    letter-spacing: 0.2px;
}

.zero-session-banner .banner-dismiss {
    display: block;
    width: 100%;
    margin-top: 16px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
}

.zero-session-banner .banner-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
}

/* Analysis mode accent */
.zero-session-banner.analysis .banner-title {
    color: #60a5fa;
}

.zero-session-banner.analysis .banner-dismiss {
    border-color: rgba(96, 165, 250, 0.2);
}

/* Shadow mode accent */
.zero-session-banner.shadow .banner-title {
    color: #a78bfa;
}

.zero-session-banner.shadow .banner-dismiss {
    border-color: rgba(139, 92, 246, 0.2);
}

/* ==========================================
   MODE SESSION SUMMARY HEADER
   ========================================== */

.zero-session-summary-header {
    margin-bottom: 12px;
}

.zero-session-summary-header .summary-title {
    font-size: 14px;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: 0.2px;
}

.zero-session-summary-header .summary-subtitle {
    font-size: 11px;
    color: #64748b;
    margin-top: 4px;
    letter-spacing: 0.3px;
}

.zero-session-summary-header .summary-footer {
    font-size: 11px;
    color: #8b5cf6;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* ==========================================
   STATS SEPARATION TABS
   ========================================== */

.zero-stats-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.zero-stats-tab {
    flex: 1;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-align: center;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    letter-spacing: 0.4px;
    text-transform: uppercase;
}

.zero-stats-tab:hover {
    color: #94a3b8;
}

.zero-stats-tab.active {
    color: #f8fafc;
    border-bottom-color: #14b8a6;
}

.zero-stats-tab.active.real {
    border-bottom-color: #60a5fa;
}

/* ==========================================
   MODE TOOLTIP
   ========================================== */

.zero-mode-tooltip {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 10;
}

.zero-mode-badge:hover .zero-mode-tooltip {
    opacity: 1;
}

/* ==========================================
   ANIMATIONS
   ========================================== */

@keyframes modeFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes modeSlideIn {
    from { transform: translateY(16px) scale(0.97); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
}

/* ==========================================
   CONTAINER MODE CLASSES
   ========================================== */

:host(.zero-analysis-mode) #paper-mode-banner .dot {
    background: #60a5fa;
    box-shadow: 0 0 6px rgba(96, 165, 250, 0.4);
}

:host(.zero-shadow-mode) #paper-mode-banner .dot {
    background: #a78bfa;
    box-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
}
`;

  // src/modules/ui/shadow-insights-styles.js
  var SHADOW_INSIGHTS_CSS = `
/* ==========================================
   SHADOW INSIGHTS MODAL
   ========================================== */

.zero-shadow-insights-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    animation: modeFadeIn 0.3s ease-out;
}

.zero-shadow-insights-modal {
    width: 400px;
    background: #0f172a;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 14px;
    padding: 28px 24px 20px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: modeSlideIn 0.35s ease-out;
}

.zero-shadow-insights-modal .si-header {
    margin-bottom: 20px;
}

.zero-shadow-insights-modal .si-title {
    font-size: 16px;
    font-weight: 700;
    color: #a78bfa;
    letter-spacing: 0.3px;
    margin-bottom: 6px;
}

.zero-shadow-insights-modal .si-subtitle {
    font-size: 12px;
    color: #64748b;
    line-height: 1.5;
}

/* Individual insight card */
.zero-shadow-insights-modal .si-insight {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: rgba(139, 92, 246, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.1);
    border-radius: 10px;
    margin-bottom: 8px;
}

.zero-shadow-insights-modal .si-insight-num {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #a78bfa;
}

.zero-shadow-insights-modal .si-insight-text {
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.55;
}

.zero-shadow-insights-modal .si-insight-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #64748b;
    margin-bottom: 3px;
}

/* Footer disclaimer */
.zero-shadow-insights-modal .si-footer {
    font-size: 11px;
    color: #475569;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-style: italic;
}

/* Action button */
.zero-shadow-insights-modal .si-action {
    display: block;
    width: 100%;
    margin-top: 16px;
    padding: 11px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
    letter-spacing: 0.2px;
}

.zero-shadow-insights-modal .si-action:hover {
    background: rgba(139, 92, 246, 0.2);
}
`;

  // src/modules/ui/shadow-hud-styles.js
  var SHADOW_HUD_CSS = `

/* ===== Shadow HUD Root ===== */
#${IDS.shadowHud} {
    z-index: 2147483644;
    pointer-events: auto;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #e2e8f0;
    width: 320px;
}

#${IDS.shadowHud}.floating {
    position: fixed;
    left: 20px;
    top: 400px;
}

#${IDS.shadowHud}.docked {
    position: fixed;
    right: 16px;
    bottom: 100px;
    width: 320px;
}

/* ===== Main Card ===== */
#${IDS.shadowHud} .sh-card {
    background: #0d1117;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* ===== Header ===== */
#${IDS.shadowHud} .sh-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(139, 92, 246, 0.06);
    border-bottom: 1px solid rgba(139, 92, 246, 0.12);
    cursor: grab;
    user-select: none;
}

#${IDS.shadowHud} .sh-header:active {
    cursor: grabbing;
}

#${IDS.shadowHud} .sh-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

#${IDS.shadowHud} .sh-header-icon {
    color: #a78bfa;
    display: flex;
    align-items: center;
}

#${IDS.shadowHud} .sh-header-title {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #a78bfa;
}

#${IDS.shadowHud} .sh-header-btns {
    display: flex;
    gap: 6px;
}

#${IDS.shadowHud} .sh-header-btns .sh-btn {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.15);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s;
}

#${IDS.shadowHud} .sh-header-btns .sh-btn:hover {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
}

#${IDS.shadowHud} .sh-subtitle {
    font-size: 10px;
    color: #64748b;
    padding: 0 14px 8px;
    background: rgba(139, 92, 246, 0.03);
}

/* ===== Section Common ===== */
#${IDS.shadowHud} .sh-section {
    border-top: 1px solid rgba(255, 255, 255, 0.04);
}

#${IDS.shadowHud} .sh-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: pointer;
    transition: background 0.15s;
    user-select: none;
}

#${IDS.shadowHud} .sh-section-header:hover {
    background: rgba(139, 92, 246, 0.04);
}

#${IDS.shadowHud} .sh-section-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

#${IDS.shadowHud} .sh-section-icon {
    color: #8b5cf6;
    opacity: 0.7;
    display: flex;
    align-items: center;
}

#${IDS.shadowHud} .sh-section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
}

#${IDS.shadowHud} .sh-section-chevron {
    color: #475569;
    display: flex;
    align-items: center;
    transition: transform 0.2s;
}

#${IDS.shadowHud} .sh-section-chevron.expanded {
    transform: rotate(180deg);
}

#${IDS.shadowHud} .sh-section-body {
    padding: 0 14px 12px;
}

#${IDS.shadowHud} .sh-section-body.collapsed {
    display: none;
}

/* ===== Market Context \u2014 Score Bar ===== */
#${IDS.shadowHud} .sh-trust-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 14px 8px;
}

#${IDS.shadowHud} .sh-trust-score {
    font-size: 13px;
    font-weight: 800;
    color: #e2e8f0;
}

#${IDS.shadowHud} .sh-trust-score .score-val {
    color: #a78bfa;
}

#${IDS.shadowHud} .sh-trust-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
}

#${IDS.shadowHud} .sh-trust-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
}

#${IDS.shadowHud} .sh-trust-bar-fill.low {
    background: #ef4444;
}

#${IDS.shadowHud} .sh-trust-bar-fill.mid {
    background: #f59e0b;
}

#${IDS.shadowHud} .sh-trust-bar-fill.high {
    background: #10b981;
}

/* ===== Micro-Signals ===== */
#${IDS.shadowHud} .sh-signals {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px 8px;
}

#${IDS.shadowHud} .sh-signal-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    position: relative;
}

#${IDS.shadowHud} .sh-signal-dot.positive {
    background: #10b981;
}

#${IDS.shadowHud} .sh-signal-dot.neutral {
    background: #f59e0b;
}

#${IDS.shadowHud} .sh-signal-dot.unavailable {
    background: #475569;
}

#${IDS.shadowHud} .sh-signal-label {
    font-size: 9px;
    color: #64748b;
    margin-left: 2px;
}

/* ===== Tabs (Market Context Expanded) ===== */
#${IDS.shadowHud} .sh-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 8px;
}

#${IDS.shadowHud} .sh-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 4px;
    font-size: 9px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

#${IDS.shadowHud} .sh-tab:hover {
    color: #94a3b8;
    background: rgba(139, 92, 246, 0.04);
}

#${IDS.shadowHud} .sh-tab.active {
    color: #a78bfa;
    border-bottom-color: #8b5cf6;
}

#${IDS.shadowHud} .sh-tab-icon {
    display: flex;
    align-items: center;
    color: inherit;
}

#${IDS.shadowHud} .sh-tab-content {
    max-height: 250px;
    overflow-y: auto;
}

/* ===== Trust Fields (Key-Value Pairs) ===== */
#${IDS.shadowHud} .nt-field {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 5px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

#${IDS.shadowHud} .nt-field:last-child {
    border-bottom: none;
}

#${IDS.shadowHud} .nt-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 80px;
}

#${IDS.shadowHud} .nt-value {
    font-size: 10px;
    color: #cbd5e1;
    text-align: right;
    word-break: break-word;
}

#${IDS.shadowHud} .nt-field.unavailable .nt-value {
    color: #475569;
    font-style: italic;
}

/* ===== Strategy Section ===== */
#${IDS.shadowHud} .sh-strategy-select {
    width: 100%;
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 600;
    background: #0f172a;
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 6px;
    color: #e2e8f0;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 10px;
}

#${IDS.shadowHud} .sh-strategy-select:hover,
#${IDS.shadowHud} .sh-strategy-select:focus {
    border-color: rgba(139, 92, 246, 0.4);
}

#${IDS.shadowHud} .sh-strategy-label {
    font-size: 9px;
    color: #64748b;
    margin-bottom: 6px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

/* ===== Trade Notes Section ===== */
#${IDS.shadowHud} .sh-notes-input {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
}

#${IDS.shadowHud} .sh-notes-textarea {
    flex: 1;
    padding: 7px 10px;
    font-size: 11px;
    font-family: inherit;
    background: #0f172a;
    border: 1px solid rgba(139, 92, 246, 0.12);
    border-radius: 6px;
    color: #e2e8f0;
    resize: none;
    outline: none;
    min-height: 32px;
    max-height: 60px;
    transition: border-color 0.15s;
}

#${IDS.shadowHud} .sh-notes-textarea::placeholder {
    color: #475569;
}

#${IDS.shadowHud} .sh-notes-textarea:focus {
    border-color: rgba(139, 92, 246, 0.4);
}

#${IDS.shadowHud} .sh-notes-add {
    padding: 7px 10px;
    font-size: 10px;
    font-weight: 700;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 6px;
    color: #a78bfa;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
}

#${IDS.shadowHud} .sh-notes-add:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
}

#${IDS.shadowHud} .sh-notes-list {
    max-height: 140px;
    overflow-y: auto;
}

#${IDS.shadowHud} .sh-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

#${IDS.shadowHud} .sh-note:last-child {
    border-bottom: none;
}

#${IDS.shadowHud} .sh-note-time {
    font-size: 9px;
    color: #475569;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 38px;
    padding-top: 1px;
}

#${IDS.shadowHud} .sh-note-text {
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.4;
    flex: 1;
}

#${IDS.shadowHud} .sh-note-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
}

#${IDS.shadowHud} .sh-note:hover .sh-note-actions {
    opacity: 1;
}

#${IDS.shadowHud} .sh-note-action {
    padding: 2px;
    background: none;
    border: none;
    color: #475569;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: color 0.15s;
}

#${IDS.shadowHud} .sh-note-action:hover {
    color: #ef4444;
}

#${IDS.shadowHud} .sh-note-char-count {
    font-size: 9px;
    color: #475569;
    text-align: right;
    margin-top: 2px;
}

/* ===== Loading State ===== */
#${IDS.shadowHud} .sh-trust-loading-state {
    flex-direction: column;
    gap: 6px;
}

#${IDS.shadowHud} .sh-loading-text {
    font-size: 10px;
    color: #8b5cf6;
    font-weight: 600;
    letter-spacing: 0.3px;
}

#${IDS.shadowHud} .sh-loading-bar {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
}

#${IDS.shadowHud} .sh-loading-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, #8b5cf6, #a78bfa, #8b5cf6);
    background-size: 200% 100%;
    animation: shLoadProgress 4s ease-out forwards, shLoadShimmer 1.5s ease-in-out infinite;
}

#${IDS.shadowHud} .sh-signal-loading {
    color: #8b5cf6;
    font-style: italic;
}

@keyframes shLoadProgress {
    0% { width: 5%; }
    30% { width: 35%; }
    60% { width: 55%; }
    80% { width: 70%; }
    100% { width: 80%; }
}

@keyframes shLoadShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

/* ===== Empty / Loading States ===== */
#${IDS.shadowHud} .sh-empty {
    font-size: 10px;
    color: #475569;
    text-align: center;
    padding: 12px 0;
    font-style: italic;
}

#${IDS.shadowHud} .sh-confidence-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

#${IDS.shadowHud} .sh-confidence-badge.low {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

#${IDS.shadowHud} .sh-confidence-badge.medium {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
}

#${IDS.shadowHud} .sh-confidence-badge.high {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
}

/* ===== Scrollbar ===== */
#${IDS.shadowHud} ::-webkit-scrollbar {
    width: 4px;
}

#${IDS.shadowHud} ::-webkit-scrollbar-track {
    background: transparent;
}

#${IDS.shadowHud} ::-webkit-scrollbar-thumb {
    background: rgba(139, 92, 246, 0.2);
    border-radius: 2px;
}

#${IDS.shadowHud} ::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 92, 246, 0.4);
}
`;

  // src/modules/ui/styles.js
  var CSS = COMMON_CSS + BANNER_CSS + PNL_HUD_CSS + BUY_HUD_CSS + MODALS_CSS + PROFESSOR_CSS + THEME_OVERRIDES_CSS + ELITE_CSS + SETTINGS_PANEL_CSS + MODES_CSS + SHADOW_INSIGHTS_CSS + SHADOW_HUD_CSS;

  // src/modules/ui/overlay.js
  var OverlayManager = {
    shadowHost: null,
    shadowRoot: null,
    initialized: false,
    platformName: null,
    init(platformName) {
      if (this.initialized) return;
      if (!document.documentElement && !document.body) {
        document.addEventListener("DOMContentLoaded", () => this.init(platformName), { once: true });
        return;
      }
      this.initialized = true;
      this.platformName = platformName;
      console.log(`[ZER\xD8] OverlayManager.init() called with platform: "${platformName}"`);
      try {
        this.createShadowRoot();
      } catch (e) {
        console.warn("[ZER\xD8] Shadow root creation failed:", e);
      }
      try {
        this.injectStyles();
      } catch (e) {
        console.warn("[ZER\xD8] Style injection failed:", e);
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
      const existingHost = document.querySelector("paper-trader-host");
      if (existingHost?.shadowRoot) {
        this.shadowHost = existingHost;
        this.shadowRoot = existingHost.shadowRoot;
        return this.shadowRoot;
      }
      const mountTarget = document.documentElement || document.body;
      if (!mountTarget) {
        throw new Error("No documentElement/body available for overlay mount");
      }
      this.shadowHost = document.createElement("paper-trader-host");
      this.shadowHost.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;";
      try {
        this.shadowRoot = this.shadowHost.attachShadow({ mode: "open" });
        const container = document.createElement("div");
        container.id = "paper-shadow-container";
        container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;";
        this.shadowRoot.appendChild(container);
        mountTarget.appendChild(this.shadowHost);
        return this.shadowRoot;
      } catch (e) {
        console.warn("[ZER\xD8] Shadow DOM unavailable, using DOM fallback", e);
        const container = document.createElement("div");
        container.id = "paper-shadow-container";
        container.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;";
        mountTarget.appendChild(container);
        this.shadowHost = container;
        this.shadowRoot = document;
        return this.shadowRoot;
      }
    },
    injectStyles() {
      const root = this.getShadowRoot();
      if (root.getElementById(IDS.style)) return;
      const s = document.createElement("style");
      s.id = IDS.style;
      s.textContent = CSS;
      root.appendChild(s);
    },
    injectPadreOffset() {
      const styleId = "paper-padre-offset-style";
      if (document.getElementById(styleId)) return;
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
          html, body {
            scroll-padding-top: 28px;
          }
          body {
            padding-top: 28px !important;
            box-sizing: border-box;
            min-height: calc(100vh + 28px);
          }
          header, nav, [class*="Header"], [class*="Nav"], .MuiAppBar-root, [style*="sticky"], [style*="fixed"], [data-testid="top-bar"] {
            top: 28px !important;
            margin-top: 28px !important;
          }
          .MuiBox-root[style*="top: 0"], .MuiBox-root[style*="top:0"] {
            top: 28px !important;
          }
        `;
      document.head.appendChild(style);
    }
  };

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
    // Emotion Icons (Post-Trade Check)
    EMO_CALM: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Calm"><path d="M2 12c3-6 7-6 10 0s7 6 10 0"/></svg>`,
    EMO_ANXIOUS: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Anxious"><polyline points="2 12 5 5 8 17 11 3 14 19 17 6 20 15 22 9"/></svg>`,
    EMO_EXCITED: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" role="img" aria-label="Excited"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`,
    EMO_ANGRY: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Angry"><path d="M12 22c-4 0-7-3-7-7 0-3 3-6 5-9l2-3 2 3c2 3 5 6 5 9 0 4-3 7-7 7z"/></svg>`,
    EMO_BORED: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" role="img" aria-label="Bored"><circle cx="12" cy="12" r="8"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
    EMO_CONFIDENT: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Confident"><line x1="12" y1="22" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
    // Mode Icons
    MODE_PAPER: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/></svg>`,
    MODE_ANALYSIS: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    MODE_SHADOW: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><clipPath id="sh"><path d="M0 0L16 0L16 16Z"/></clipPath><circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" clip-path="url(#sh)"/></svg>`,
    // Shadow HUD Section Icons
    SHADOW_HUD_ICON: `<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><clipPath id="shh"><path d="M0 0L16 0L16 16Z"/></clipPath><circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" clip-path="url(#shh)"/></svg>`,
    TRUST_SHIELD: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    STRATEGY_COMPASS: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    NOTES_DOC: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    TAB_X_ACCOUNT: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l6.5 8L4 20h2l5.5-6.8L16 20h4l-6.8-8.4L19.5 4h-2l-5 6.2L8 4H4z"/></svg>`,
    TAB_COMMUNITY: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    TAB_WEBSITE: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    TAB_DEVELOPER: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    // General UI
    LOCK: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    BRAIN: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.97-3.06 2.5 2.5 0 0 1-1.95-4.36 2.5 2.5 0 0 1 2-4.11 2.5 2.5 0 0 1 5.38-2.45Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.97-3.06 2.5 2.5 0 0 0 1.95-4.36 2.5 2.5 0 0 0-2-4.11 2.5 2.5 0 0 0-5.38-2.45Z"/></svg>`,
    SHARE: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12V4a2 2 0 0 1 2-2h10l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/><path d="M14 2v4h4"/><path d="m8 18 3 3 6-6"/></svg>`,
    X: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    CHEVRON_DOWN: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    CHEVRON_UP: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
  };

  // src/modules/ui/professor.js
  init_store();
  var TUTORIAL_STEPS = [
    {
      title: "\u{1F44B} Welcome to ZER\xD8!",
      message: "I'm Professor Zero, and I'm here to help you master Solana trading without risking a single penny!<br><br>This is a <b>Paper Trading Simulation</b>. Everything looks real, but your wallet is completely safe.",
      highlightId: null
    },
    {
      title: "\u{1F6E1}\uFE0F Zero Risk, Real Data",
      message: "See that overlay? That's your command center.<br><br>We use <b>real-time market data</b> to simulate exactly what would happen if you traded for real. Same prices, same thrills, zero risk.",
      highlightId: IDS.banner
    },
    {
      title: "\u{1F4CA} Your P&L Tracker",
      message: "Keep an eye on the <b>P&L (Profit & Loss)</b> bar.<br><br>It tracks your wins and losses in real-time. I'll pop in occasionally to give you tips!<br><br>\u26A0\uFE0F The <b>RESET</b> button clears your entire session \u2014 balance, trades, and P&L.",
      highlightId: IDS.pnlHud
    },
    {
      title: "\u{1F4B8} Buying & Selling",
      message: "Use the <b>HUD Panel</b> to place trades.<br><br>Enter an amount and click <b>BUY</b>. When you're ready to exit, switch to the <b>SELL</b> tab.<br><br>Try to build your 10 SOL starting balance into a fortune!",
      highlightId: IDS.buyHud
    },
    {
      title: "\u{1F680} Ready to Trade?",
      message: "That's it! You're ready to hit the markets.<br><br>Remember: The goal is to learn. Don't be afraid to make mistakes here\u2014that's how you get better.<br><br><b>Good luck, trader!</b>",
      highlightId: null
    }
  ];
  var Professor = {
    init() {
    },
    /**
     * Start the walkthrough tutorial.
     * @param {boolean} [isReplay=false] - If true, replays even if already completed.
     */
    startWalkthrough(isReplay = false) {
      this._showStep(0);
    },
    /** @private */
    _showStep(stepIndex) {
      const container = OverlayManager.getContainer();
      const shadowRoot = OverlayManager.getShadowRoot();
      if (!container || !shadowRoot) return;
      const step = TUTORIAL_STEPS[stepIndex];
      if (!step) return;
      const highlighted = container.querySelectorAll(".highlight-active");
      highlighted.forEach((el) => el.classList.remove("highlight-active"));
      if (step.highlightId) {
        const target = shadowRoot.getElementById(step.highlightId);
        if (target) {
          target.classList.add("highlight-active");
        }
      }
      const existing = container.querySelector(".professor-overlay");
      if (existing) existing.remove();
      const professorImgUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL("src/professor.png") : "";
      const overlay = document.createElement("div");
      overlay.className = "professor-overlay tutorial-mode";
      const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
      const btnText = isLastStep ? "Let's Go! \u{1F680}" : "Next \u27A1\uFE0F";
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
      overlay.querySelector(".professor-dismiss").addEventListener("click", async () => {
        if (isLastStep) {
          overlay.style.animation = "professorFadeIn 0.2s ease-out reverse";
          setTimeout(() => overlay.remove(), 200);
          const hl = container.querySelectorAll(".highlight-active");
          hl.forEach((el) => el.classList.remove("highlight-active"));
          if (Store.state?.settings) {
            Store.state.settings.tutorialCompleted = true;
            await Store.save();
          }
        } else {
          this._showStep(stepIndex + 1);
        }
      });
    },
    showCritique(trigger, value, analysisState) {
      return;
      const container = OverlayManager.getContainer();
      if (!container) return;
      const existing = container.querySelector(".professor-overlay");
      if (existing) existing.remove();
      const { title, message } = this.generateMessage(trigger, value, analysisState);
      const overlay = document.createElement("div");
      overlay.className = "professor-overlay";
      overlay.innerHTML = `
            <div class="professor-container" style="box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(20,184,166,0.2);">
                <img src="${chrome.runtime.getURL("src/professor.png")}" class="professor-image">
                <div class="professor-bubble">
                    <div class="professor-title" style="display:flex; align-items:center; gap:8px;">
                        ${ICONS.BRAIN} ${title}
                    </div>
                    <div class="professor-message">${message}</div>
                    <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#64748b; cursor:pointer;">
                            <input type="checkbox" class="professor-opt-out"> Don't show again
                        </label>
                        <button class="professor-dismiss" style="font-size:11px; padding:4px 8px;">Dismiss</button>
                    </div>
                </div>
            </div>
        `;
      const buyHud = container.querySelector("#paper-buyhud-root");
      if (buyHud) {
        const rect = buyHud.getBoundingClientRect();
        overlay.style.top = rect.bottom + 12 + "px";
        overlay.style.left = rect.left + "px";
        overlay.style.width = rect.width + "px";
      } else {
        overlay.style.bottom = "20px";
        overlay.style.left = "50%";
        overlay.style.transform = "translateX(-50%)";
      }
      container.appendChild(overlay);
      const checkbox = overlay.querySelector(".professor-opt-out");
      const dismissBtn = overlay.querySelector(".professor-dismiss");
      const close = async () => {
        if (checkbox.checked) {
          Store.state.settings.showProfessor = false;
          await Store.save();
        }
        overlay.remove();
      };
      dismissBtn.onclick = close;
      setTimeout(() => {
        if (overlay.isConnected) close();
      }, 15e3);
    },
    generateMessage(trigger, value, analysis) {
      let title = "Observation";
      let message = "Keep pushing.";
      const style = analysis?.style || "balanced";
      const tips = this.getTips(style);
      const randomTip = tips[Math.floor(Math.random() * tips.length)];
      if (trigger === "win_streak") {
        if (value === 5) {
          title = "\u{1F525} 5 Win Streak!";
          message = "You're finding your rhythm. The market is speaking and you're listening!";
        } else if (value === 10) {
          title = "\u{1F3C6} 10 Win Streak!";
          message = "Double digits! This is what consistent profitability looks like.";
        } else {
          title = `\u26A1 ${value} Win Streak!`;
          message = "Impressive run. Stay disciplined.";
        }
      } else if (trigger === "loss_streak") {
        title = "\u26A0\uFE0F Loss Streak Detected";
        message = `${value} losses in a row. Take a breath. Are you forcing trades?`;
      } else if (trigger === "fomo_buying") {
        title = "\u{1F6AB} FOMO Detected";
        message = "3+ buys in 2 minutes. You're chasing price. Let the setup come to you.";
      } else if (trigger === "revenge_trade") {
        title = "\u26A0\uFE0F Revenge Trade Warning";
        message = "Buying immediately after a loss? That's emotion, not strategy.";
      } else if (trigger === "overtrading") {
        title = "\u{1F6D1} High Volume Warning";
        message = `${value} trades this session. Quality > Quantity. Consider taking a break.`;
      } else if (trigger === "portfolio_multiplier") {
        title = `\u{1F389} ${value}X PORTFOLIO!`;
        message = `You've turned your starting balance into ${value}x! Incredible work.`;
      }
      return { title, message: message + '<br><br><span style="color:#94a3b8;font-size:12px">\u{1F4A1} ' + randomTip + "</span>" };
    },
    getTips(style) {
      const tips = {
        scalper: [
          "Scalping works best in high-volume markets. Watch those fees!",
          "Consider setting a 5-trade limit per hour to avoid overtrading.",
          "Quick flips need quick reflexes. Always have an exit plan!"
        ],
        swing: [
          "Setting a trailing stop can protect your swing trade profits.",
          "Patient hands make the most gains. Trust your analysis!",
          "Consider scaling out in 25% chunks to lock in profits."
        ],
        degen: [
          "Micro-caps are fun but size down! Never risk more than 5% on a single play.",
          "In degen territory, the first green candle is often the exit signal.",
          "Set a hard stop at -50%. Live to degen another day!"
        ],
        conservative: [
          "Your conservative style keeps you in the game. Consider a small moon bag!",
          "Larger caps mean smaller moves. Patience is your superpower.",
          "Consider allocating 10% to higher-risk plays for balance."
        ],
        balanced: [
          "Your balanced approach is sustainable. Keep mixing risk levels!",
          "Track your best-performing market cap range and lean into it.",
          "Journal your winners - patterns emerge over time!"
        ]
      };
      return tips[style] || tips.balanced;
    }
  };

  // src/platforms/padre/boot.padre.js
  init_store();

  // src/modules/featureManager.js
  var TIERS = {
    FREE: "free",
    ELITE: "elite"
  };
  var FEATURES = {
    // Free: Core trading + raw stats
    BASIC_TRADING: "free",
    REAL_TIME_PNL: "free",
    STRATEGY_TAGGING: "free",
    EMOTION_TRACKING: "free",
    EQUITY_CHARTS: "free",
    SHARE_TO_X: "free",
    // Elite: Interpretation, context, behavioral intelligence
    TRADE_PLAN: "elite",
    DISCIPLINE_SCORING: "elite",
    AI_DEBRIEF: "elite",
    DETAILED_LOGS: "elite",
    ADVANCED_ANALYTICS: "elite",
    RISK_ADJUSTED_METRICS: "elite",
    TILT_DETECTION: "elite",
    SESSION_REPLAY: "elite",
    ADVANCED_COACHING: "elite",
    BEHAVIOR_BASELINE: "elite",
    MARKET_CONTEXT: "elite",
    NARRATIVE_TRUST: "elite",
    SHADOW_HUD: "elite",
    TRADER_PROFILE: "elite",
    // Tease-card keys (for Settings/Insights UI)
    ELITE_TRADE_PLAN: "elite",
    ELITE_DISCIPLINE: "elite",
    ELITE_STRATEGY_ANALYTICS: "elite",
    ELITE_EMOTION_ANALYTICS: "elite",
    ELITE_AI_DEBRIEF: "elite",
    ELITE_TILT_DETECTION: "elite",
    ELITE_RISK_METRICS: "elite",
    ELITE_SESSION_REPLAY: "elite",
    ELITE_TRADER_PROFILE: "elite",
    ELITE_MARKET_CONTEXT: "elite"
  };
  var TEASED_FEATURES = {
    ELITE: [
      { id: "ELITE_TRADE_PLAN", name: "Trade Planning", desc: "Set stop losses, targets, and capture your thesis before every trade." },
      { id: "ELITE_DISCIPLINE", name: "Discipline Scoring", desc: "Track how well you stick to your trading rules with an objective score." },
      { id: "ELITE_STRATEGY_ANALYTICS", name: "Strategy Insights", desc: "See which strategies perform best across sessions." },
      { id: "ELITE_EMOTION_ANALYTICS", name: "Emotion Insights", desc: "Understand how your emotional state affects your trading outcomes." },
      { id: "ELITE_AI_DEBRIEF", name: "AI Trade Debrief", desc: "Post-session behavioral analysis to accelerate your learning." },
      { id: "ELITE_TILT_DETECTION", name: "Tilt Detection", desc: "Real-time alerts when your behavior signals emotional trading." },
      { id: "ELITE_RISK_METRICS", name: "Risk Metrics", desc: "Advanced risk-adjusted performance metrics for serious traders." },
      { id: "ELITE_SESSION_REPLAY", name: "Session Replay", desc: "Replay your sessions to review decisions and improve execution." },
      { id: "ELITE_TRADER_PROFILE", name: "Trader Profile", desc: "Your personal trading identity \u2014 strengths, weaknesses, and growth." },
      { id: "ELITE_MARKET_CONTEXT", name: "Market Context", desc: "Overlay market conditions to see how context affected your trades." },
      { id: "ELITE_NARRATIVE_TRUST", name: "Narrative Trust", desc: "Observe social signals, community presence, and developer history for any token." }
    ]
  };
  var FeatureManager = {
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
      if (!requiredTier) return flags;
      const hasEntitlement = this.hasTierAccess(userTier, requiredTier);
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
          flags.visible = true;
          flags.interactive = false;
          flags.gated = true;
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
      if (requiredTier === TIERS.FREE) return true;
      if (requiredTier === TIERS.ELITE) return userTier === TIERS.ELITE;
      return false;
    },
    isElite(state) {
      return (state?.settings?.tier || TIERS.FREE) === TIERS.ELITE;
    }
  };

  // src/modules/core/token-context.js
  var TokenContextResolver = {
    _platform: null,
    // 'axiom' | 'padre'
    _cache: {
      lastUrl: null,
      lastResult: { activeMint: null, activeSymbol: null, sourceSite: "unknown" },
      lastDomScanAt: 0
    },
    init(platformName) {
      if (platformName === "Axiom") this._platform = "axiom";
      else if (platformName === "Padre") this._platform = "padre";
      else this._platform = "unknown";
    },
    resolve() {
      const url = window.location.href;
      const now = Date.now();
      const urlChanged = url !== this._cache.lastUrl;
      const sourceSite = this._platform || "unknown";
      let activeMint = null;
      let activeSymbol = null;
      if (sourceSite === "axiom") {
        const title = document.title || "";
        const words = title.replace(/[|$-]/g, " ").trim().split(/\s+/);
        for (const w of words) {
          if (w.length >= 2 && w.length <= 10 && /^[A-Z0-9]+$/.test(w)) {
            activeSymbol = w;
            break;
          }
        }
      } else if (sourceSite === "padre") {
        const title = document.title || "";
        const cleaned = title.replace(/\s*[↓↑]\s*\$[\d,.]+[KMB]?\s*$/i, "").trim();
        const m = cleaned.match(/([A-Z0-9]+)\s*\//i);
        if (m) activeSymbol = m[1].toUpperCase();
        if (!activeSymbol && cleaned) {
          const parts = cleaned.split("|")[0]?.trim();
          if (parts && parts.length <= 12) activeSymbol = parts.toUpperCase();
        }
      }
      if (sourceSite !== "padre" && sourceSite !== "axiom") {
        const mintMatch = url.match(/\/trade\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) || url.match(/\/token\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) || url.match(/\/terminal\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) || url.match(/\/meme\/([a-zA-Z0-9]{32,44})/);
        if (mintMatch && mintMatch[1]) {
          activeMint = mintMatch[1];
        }
        if (!activeMint) {
          const urlParamMatch = url.match(/[?&](?:mint|token|address)=([1-9A-HJ-NP-Za-km-z]{32,44})/i);
          if (urlParamMatch) activeMint = urlParamMatch[1];
        }
        if (!activeMint) {
          const allMints = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
          if (allMints) activeMint = allMints.find((m) => m.length >= 32 && m.length <= 44);
        }
      }
      const domScanThrottle = sourceSite === "padre" || sourceSite === "axiom" ? 500 : 1500;
      const shouldScanDom = urlChanged || !activeMint && now - this._cache.lastDomScanAt > domScanThrottle;
      if (!activeMint && shouldScanDom) {
        this._cache.lastDomScanAt = now;
        const attrSelectors = [
          "[data-mint]",
          "[data-token]",
          "[data-token-address]",
          "[data-address]",
          "[data-ca]"
        ];
        try {
          const attrNodes = document.querySelectorAll(attrSelectors.join(","));
          for (const node of attrNodes) {
            for (const attr of ["data-mint", "data-token", "data-token-address", "data-address", "data-ca"]) {
              const val = node.getAttribute(attr);
              if (val && /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(val)) {
                const match = val.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
                if (match) {
                  activeMint = match[0];
                  break;
                }
              }
            }
            if (activeMint) break;
          }
        } catch (e) {
        }
        if (!activeMint) {
          try {
            const links = document.querySelectorAll('a[href*="solscan"], a[href*="solana.fm"], a[href*="birdeye"], a[href*="bullx"], a[href*="pump.fun"]');
            for (const link of links) {
              const match = link.href.match(/([a-zA-Z0-9]{32,44})/);
              if (match && match[1] && !link.href.includes("/account/")) {
                activeMint = match[1];
                break;
              }
            }
          } catch (e) {
          }
        }
        if (!activeMint) {
          try {
            const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
            let seen = 0;
            while (walker.nextNode() && seen < 50) {
              const text = walker.currentNode?.nodeValue || "";
              if (!text.includes("CA:") && !text.includes("DA:")) {
                seen += 1;
                continue;
              }
              const mm = text.match(/(?:CA|DA):\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
              if (mm) {
                activeMint = mm[1];
                break;
              }
              let container = walker.currentNode?.parentElement;
              for (let depth = 0; depth < 5 && container && !activeMint; depth++) {
                const nearbyLinks = container.querySelectorAll("a[href]");
                for (const link of nearbyLinks) {
                  const href = link.href || "";
                  const hm = href.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
                  if (hm && hm[1].length >= 32) {
                    activeMint = hm[1];
                    break;
                  }
                }
                container = container.parentElement;
              }
              if (activeMint) break;
              seen += 1;
            }
          } catch (e) {
          }
        }
      }
      if (!activeMint && !urlChanged) {
        activeMint = this._cache.lastResult.activeMint;
      }
      if (!activeSymbol && !urlChanged) {
        activeSymbol = this._cache.lastResult.activeSymbol;
      }
      const result = { activeMint, activeSymbol, sourceSite };
      this._cache.lastUrl = url;
      this._cache.lastResult = result;
      return result;
    }
  };

  // src/services/shared/proxy-fetch.js
  async function proxyFetch(url, options) {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        return { ok: false, error: "Chrome runtime not available" };
      }
      return await chrome.runtime.sendMessage({
        type: "PROXY_FETCH",
        url,
        options: options || { method: "GET" }
      });
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("context invalidated") || msg.includes("Receiving end does not exist")) {
        return { ok: false, error: "context_invalidated" };
      }
      return { ok: false, error: msg || "Proxy fetch failed" };
    }
  }

  // src/modules/core/token-market-data.js
  var TokenMarketDataService = {
    currentMint: null,
    pollInterval: null,
    lastUpdateTs: 0,
    isStale: false,
    dexHasData: true,
    // Track if DexScreener has data for current mint
    // Data State
    data: {
      priceUsd: 0,
      marketCapUsd: 0,
      liquidityUsd: 0,
      symbol: null,
      name: null,
      info: null
    },
    listeners: [],
    init() {
    },
    subscribe(callback) {
      this.listeners.push(callback);
    },
    notify() {
      this.listeners.forEach((cb) => cb({
        mint: this.currentMint,
        ...this.data,
        isStale: this.isStale,
        ts: this.lastUpdateTs
      }));
    },
    setMint(mint) {
      if (this.currentMint === mint) return;
      this.currentMint = mint;
      this.stopPolling();
      this.data = { priceUsd: 0, marketCapUsd: 0, liquidityUsd: 0, symbol: null, name: null, info: null };
      this.isStale = false;
      this.dexHasData = true;
      if (mint) {
        console.log(`[MarketData] New Mint: ${mint}. Starting Poll.`);
        this.startPolling();
      } else {
        console.log(`[MarketData] Mint cleared. Stopping Poll.`);
      }
    },
    startPolling() {
      if (this.pollInterval) return;
      this.fetchData();
      this.pollInterval = setInterval(() => {
        if (this.currentMint) {
          this.fetchData();
          this.checkStale();
        }
      }, 500);
    },
    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    },
    checkStale() {
      if (Date.now() - this.lastUpdateTs > 1e4) {
        if (!this.isStale) {
          this.isStale = true;
          console.warn("[MarketData] Data Stale (no update > 10s)");
          this.notify();
        }
      }
    },
    async fetchData() {
      if (!this.currentMint) return;
      try {
        if (this.dexHasData) {
          const url = `https://api.dexscreener.com/latest/dex/tokens/${this.currentMint}`;
          const response = await proxyFetch(url, { method: "GET" });
          if (response.ok && response.data?.pairs?.length > 0) {
            const bestPair = response.data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
            if (bestPair) {
              const price = parseFloat(bestPair.priceUsd) || 0;
              let mc = bestPair.marketCap || bestPair.fdv || 0;
              this.data = {
                priceUsd: price,
                marketCapUsd: mc,
                liquidityUsd: bestPair.liquidity?.usd || 0,
                symbol: bestPair.baseToken?.symbol,
                name: bestPair.baseToken?.name,
                info: bestPair.info || null
              };
              this.lastUpdateTs = Date.now();
              this.isStale = false;
              this.notify();
              return;
            }
          }
          this.dexHasData = false;
          console.log(`[MarketData] DexScreener has no data \u2014 switching to Jupiter only`);
        }
        await this.fetchJupiterFallback();
      } catch (e) {
        console.error("[MarketData] Fetch Exception:", e);
      }
    },
    async fetchJupiterFallback() {
      if (!this.currentMint) return;
      try {
        const jupUrl = `https://lite-api.jup.ag/price/v3?ids=${this.currentMint}`;
        const jupResponse = await proxyFetch(jupUrl, { method: "GET" });
        if (jupResponse.ok && jupResponse.data?.[this.currentMint]) {
          const jupData = jupResponse.data[this.currentMint];
          const price = parseFloat(jupData.usdPrice) || 0;
          if (price > 0) {
            console.log(`[MarketData] Jupiter Price: $${price} for ${this.currentMint}`);
            this.data = {
              priceUsd: price,
              marketCapUsd: this.data.marketCapUsd || 0,
              liquidityUsd: this.data.liquidityUsd || 0,
              symbol: this.data.symbol,
              name: this.data.name,
              info: this.data.info || null
            };
            this.lastUpdateTs = Date.now();
            this.isStale = false;
            this.notify();
            return;
          }
        }
        console.warn(`[MarketData] No pairs found for ${this.currentMint}`);
      } catch (e) {
        console.warn("[MarketData] Jupiter fallback failed:", e);
      }
    },
    // Public getter for sync access
    getSnapshot() {
      return {
        mint: this.currentMint,
        ...this.data,
        isStale: this.isStale,
        ts: this.lastUpdateTs
      };
    }
  };

  // src/modules/core/market.js
  var Market = {
    price: 0,
    marketCap: 0,
    liquidity: 0,
    currentMint: null,
    currentSymbol: null,
    sourceSite: null,
    listeners: [],
    // Legacy support flags if needed
    lastTickTs: 0,
    lastSource: null,
    // 'site', 'dom', 'api'
    lastChartMCapTs: 0,
    // Dedicated tracker for chart MCap activity
    init() {
      console.log("[Market] Initializing API-Driven Market Service");
      TokenMarketDataService.subscribe((data) => {
        const now = Date.now();
        const chartMCapActive = now - this.lastChartMCapTs < 3e3;
        if (data.priceUsd > 0) {
          this.price = data.priceUsd;
          this.priceIsFresh = !data.isStale;
        }
        if (!chartMCapActive && data.marketCapUsd > 0) {
          this.marketCap = data.marketCapUsd;
        }
        this.liquidity = data.liquidityUsd;
        if (data.symbol) this.currentSymbol = data.symbol;
        this.lastSource = "api";
        if (data.priceUsd > 0 && data.marketCapUsd > 0) {
          const priceDelta = this._lastRefPrice ? Math.abs(data.priceUsd - this._lastRefPrice) / this._lastRefPrice : 1;
          if (priceDelta > 5e-3 || !this._lastRefPrice) {
            this._lastRefPrice = data.priceUsd;
            window.postMessage({
              __paper: true,
              type: "PAPER_PRICE_REFERENCE",
              priceUsd: data.priceUsd,
              marketCapUsd: data.marketCapUsd
            }, "*");
          }
        }
        this.notify();
      });
      this.pollContext();
      setInterval(() => this.pollContext(), 250);
      window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data?.__paper) return;
        const d = e.data;
        if (d.type === "PRICE_TICK") {
          if (d.price > 0 && d.confidence >= 1) {
            const now = Date.now();
            if (this.price > 0 && Math.abs(d.price - this.price) / this.price > 0.8 && d.confidence < 3) return;
            console.log(`[Market] Real-time Price Integration (${d.source}): $${d.price}`);
            this.price = d.price;
            this.priceIsFresh = true;
            this.lastTickTs = now;
            this.lastSource = d.source || "site";
            if (d.chartMCap > 0) {
              this.marketCap = d.chartMCap;
              this.lastChartMCapTs = now;
            }
            this.notify();
          }
        }
      });
    },
    pollContext() {
      const { activeMint, activeSymbol, sourceSite } = TokenContextResolver.resolve();
      if (activeMint !== this.currentMint) {
        console.log(`[Market] Context Changed: ${this.currentMint} -> ${activeMint} (${sourceSite})`);
        this.currentMint = activeMint;
        this.sourceSite = sourceSite;
        this.currentSymbol = activeSymbol;
        window.postMessage({
          __paper: true,
          type: "PAPER_SET_CONTEXT",
          mint: activeMint,
          symbol: activeSymbol
        }, "*");
        TokenMarketDataService.setMint(activeMint);
        this.notify();
      }
    },
    subscribe(callback) {
      this.listeners.push(callback);
    },
    notify() {
      this.listeners.forEach((cb) => cb({
        price: this.price,
        marketCap: this.marketCap,
        mint: this.currentMint,
        symbol: this.currentSymbol,
        context: {
          // Legacy shape adaptation for 'context' if needed by HUD
          liquidity: this.liquidity,
          fdv: this.marketCap,
          symbol: this.currentSymbol
        }
      }));
    },
    // Explicit getter if needed
    getSnapshot() {
      return TokenMarketDataService.getSnapshot();
    }
  };

  // src/modules/ui/hud.js
  init_store();

  // src/modules/ui/banner.js
  init_store();

  // src/modules/mode-manager.js
  init_store();
  var MODES = {
    PAPER: "paper",
    ANALYSIS: "analysis",
    SHADOW: "shadow"
  };
  var MODE_META = {
    [MODES.PAPER]: {
      label: "PAPER MODE",
      badge: "PAPER MODE",
      tier: "free",
      showBuyHud: true,
      isRealTrading: false,
      shareCopy: "Paper trading session tracked with ZERO.",
      sessionBanner: null
      // Paper mode has no session disclaimer
    },
    [MODES.ANALYSIS]: {
      label: "ANALYSIS MODE",
      badge: "ANALYSIS MODE",
      tier: "free",
      showBuyHud: false,
      isRealTrading: true,
      shareCopy: "Real trades observed and reviewed with ZERO.",
      sessionBanner: {
        title: "Analysis Mode Active",
        body: "You are trading real money.\nZERO is quietly observing and recording trades for review.",
        footer: "No execution. No automation. Analysis only."
      },
      tooltip: "ZERO does not execute or automate trades in this mode.",
      subtext: "Observing real trades only",
      summaryHeader: "Session Summary \u2014 Real Trades",
      summarySubheader: "Observed \u2022 No interpretation applied",
      summaryFooter: "Advanced behavioral insights are available in Shadow Mode."
    },
    [MODES.SHADOW]: {
      label: "SHADOW MODE",
      badge: "SHADOW MODE",
      tier: "elite",
      showBuyHud: false,
      showShadowHud: true,
      isRealTrading: true,
      shareCopy: "Real trades analyzed using ZERO's advanced behavioral analysis.",
      sessionBanner: {
        title: "Shadow Mode Active",
        body: "You are trading real money.\nZERO is analyzing your trades with advanced behavioral intelligence.",
        footer: "No execution. No automation. Elite analysis active."
      },
      tooltip: "ZERO observes and analyzes your real trades using advanced behavioral patterns.",
      subtext: "Elite behavioral analysis active"
    }
  };
  var ModeManager = {
    /**
     * Get the current active mode key.
     */
    getMode() {
      return Store.state?.settings?.tradingMode || MODES.PAPER;
    },
    /**
     * Get metadata for the current mode.
     */
    getMeta() {
      return MODE_META[this.getMode()] || MODE_META[MODES.PAPER];
    },
    /**
     * Get metadata for a specific mode.
     */
    getMetaFor(mode) {
      return MODE_META[mode] || MODE_META[MODES.PAPER];
    },
    /**
     * Set the active mode, with tier check for Shadow.
     * Returns true if mode was set, false if gated.
     */
    async setMode(mode) {
      if (!MODES[mode.toUpperCase()] && !Object.values(MODES).includes(mode)) {
        console.warn("[ModeManager] Unknown mode:", mode);
        return false;
      }
      if (mode === MODES.SHADOW && !FeatureManager.isElite(Store.state)) {
        return false;
      }
      Store.state.settings.tradingMode = mode;
      await Store.save();
      return true;
    },
    /**
     * Whether the BUY/SELL HUD should be rendered in the DOM.
     */
    shouldShowBuyHud() {
      const meta = this.getMeta();
      return meta.showBuyHud;
    },
    /**
     * Whether the current mode operates on real trades.
     */
    isRealTrading() {
      const meta = this.getMeta();
      return meta.isRealTrading;
    },
    /**
     * Get the share copy for the current mode.
     */
    getShareCopy() {
      const meta = this.getMeta();
      return meta.shareCopy;
    },
    /**
     * Whether the current mode has a session disclaimer banner.
     */
    hasSessionBanner() {
      const meta = this.getMeta();
      return !!meta.sessionBanner;
    },
    /**
     * Get the CSS class to apply to the overlay container.
     */
    getContainerClass() {
      const mode = this.getMode();
      if (mode === MODES.ANALYSIS) return "zero-analysis-mode";
      if (mode === MODES.SHADOW) return "zero-shadow-mode";
      return "";
    },
    /**
     * Whether the Shadow HUD should be rendered in the DOM.
     */
    shouldShowShadowHud() {
      return this.getMode() === MODES.SHADOW;
    },
    /**
     * Check if Shadow Mode first-session aha moment should show.
     * Returns true only once per user (first shadow session completion).
     */
    shouldShowShadowAha() {
      if (this.getMode() !== MODES.SHADOW) return false;
      if (!FeatureManager.isElite(Store.state)) return false;
      return !Store.state.settings._shadowAhaShown;
    },
    /**
     * Mark Shadow aha moment as shown.
     */
    async markShadowAhaShown() {
      Store.state.settings._shadowAhaShown = true;
      await Store.save();
    }
  };

  // src/modules/ui/modes-ui.js
  init_store();
  var sessionBannerShownForSession = null;
  function getModeIcon(mode) {
    if (mode === MODES.ANALYSIS) return ICONS.MODE_ANALYSIS;
    if (mode === MODES.SHADOW) return ICONS.MODE_SHADOW;
    return ICONS.MODE_PAPER;
  }
  var ModesUI = {
    /**
     * Render an inline mode badge HTML string.
     * Usage: insert into banner or header HTML.
     */
    renderBadge(mode) {
      mode = mode || ModeManager.getMode();
      const meta = MODE_META[mode] || MODE_META[MODES.PAPER];
      const icon = getModeIcon(mode);
      const tooltip = meta.tooltip || "";
      const subtext = meta.subtext || "";
      let html = `<span class="zero-mode-badge ${mode}" title="${tooltip}">`;
      html += icon;
      html += ` ${meta.badge}`;
      if (subtext) {
        html += `<span class="mode-subtext">${subtext}</span>`;
      }
      if (tooltip) {
        html += `<span class="zero-mode-tooltip">${tooltip}</span>`;
      }
      html += `</span>`;
      return html;
    },
    /**
     * Show the once-per-session disclaimer banner for Analysis or Shadow mode.
     * Returns immediately if already shown for this session or if mode has no banner.
     */
    showSessionBanner() {
      const mode = ModeManager.getMode();
      const meta = ModeManager.getMeta();
      if (!meta.sessionBanner) return;
      const sessionId = Store.state?.session?.id;
      if (sessionBannerShownForSession === sessionId) return;
      sessionBannerShownForSession = sessionId;
      const container = OverlayManager.getContainer();
      if (!container) return;
      if (container.querySelector(".zero-session-banner-overlay")) return;
      const icon = getModeIcon(mode);
      const banner = meta.sessionBanner;
      const overlay = document.createElement("div");
      overlay.className = "zero-session-banner-overlay";
      overlay.innerHTML = `
            <div class="zero-session-banner ${mode}">
                <div class="banner-icon">
                    ${icon}
                    <span class="banner-title">${banner.title}</span>
                </div>
                <div class="banner-body">${banner.body}</div>
                <div class="banner-footer">${banner.footer}</div>
                <button class="banner-dismiss">Continue</button>
            </div>
        `;
      container.appendChild(overlay);
      const dismiss = () => overlay.remove();
      overlay.querySelector(".banner-dismiss").onclick = dismiss;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) dismiss();
      });
    },
    /**
     * Render session summary header HTML for the current mode.
     * Used in dashboard / session review.
     */
    renderSessionSummaryHeader() {
      const mode = ModeManager.getMode();
      const meta = ModeManager.getMeta();
      if (mode === MODES.PAPER) {
        return `
                <div class="zero-session-summary-header">
                    <div class="summary-title">Session Summary &mdash; Paper Trades</div>
                    <div class="summary-subtitle">Simulated &bull; Risk-free practice</div>
                </div>
            `;
      }
      if (mode === MODES.ANALYSIS) {
        return `
                <div class="zero-session-summary-header">
                    <div class="summary-title">${meta.summaryHeader}</div>
                    <div class="summary-subtitle">${meta.summarySubheader}</div>
                    <div class="summary-footer">${meta.summaryFooter}</div>
                </div>
            `;
      }
      return `
            <div class="zero-session-summary-header">
                <div class="summary-title">Session Summary &mdash; Real Trades</div>
                <div class="summary-subtitle">Analyzed &bull; Elite behavioral insights applied</div>
            </div>
        `;
    },
    /**
     * Render stats section tabs (Paper Trading / Real Trading) HTML.
     * Only renders tabs if the user has trades in both modes.
     */
    renderStatsTabs(activeTab) {
      activeTab = activeTab || "paper";
      return `
            <div class="zero-stats-tabs">
                <div class="zero-stats-tab ${activeTab === "paper" ? "active" : ""}" data-stats-tab="paper">Paper Trading</div>
                <div class="zero-stats-tab real ${activeTab === "real" ? "active" : ""}" data-stats-tab="real">Real Trading (Observed)</div>
            </div>
        `;
    },
    /**
     * Get the banner hint text based on current mode.
     */
    getBannerHint() {
      const mode = ModeManager.getMode();
      if (mode === MODES.ANALYSIS) return "(Analysis Mode)";
      if (mode === MODES.SHADOW) return "(Shadow Mode)";
      return "(Paper Trading Overlay)";
    },
    /**
     * Get the banner label text based on current mode.
     */
    getBannerLabel() {
      const mode = ModeManager.getMode();
      const meta = ModeManager.getMeta();
      return meta.badge;
    },
    /**
     * Apply the correct mode container class to the overlay root.
     */
    applyContainerClass() {
      const container = OverlayManager.getContainer();
      if (!container) return;
      container.classList.remove("zero-shadow-mode", "zero-analysis-mode");
      const cls = ModeManager.getContainerClass();
      if (cls) container.classList.add(cls);
      const host = OverlayManager.shadowHost;
      if (host) {
        host.classList.remove("zero-shadow-mode", "zero-analysis-mode");
        if (cls) host.classList.add(cls);
      }
    },
    /**
     * Check whether trades exist in both paper and real categories.
     * Used to decide if stats tabs should render.
     */
    hasMultipleTradeSources() {
      const trades = Object.values(Store.state?.trades || {});
      let hasPaper = false;
      let hasReal = false;
      for (const t of trades) {
        if (t.mode === "paper" || !t.mode) hasPaper = true;
        if (t.mode === "analysis" || t.mode === "shadow") hasReal = true;
        if (hasPaper && hasReal) return true;
      }
      return false;
    },
    /**
     * Filter trades by source category.
     */
    filterTradesBySource(source) {
      const trades = Object.values(Store.state?.trades || {});
      if (source === "paper") {
        return trades.filter((t) => t.mode === "paper" || !t.mode);
      }
      return trades.filter((t) => t.mode === "analysis" || t.mode === "shadow");
    }
  };

  // src/modules/ui/banner.js
  var Banner = {
    ensurePageOffset() {
      const body = document.body;
      if (!body) return;
      const isPadre = window.location.hostname.includes("padre.gg");
      if (isPadre) return;
      const offset = 44;
      const html = document.documentElement;
      const bodyStyle = getComputedStyle(body);
      const htmlStyle = getComputedStyle(html);
      const isOverflowLocked = ["hidden", "clip"].includes(bodyStyle.overflowY) || ["hidden", "clip"].includes(bodyStyle.overflow) || ["hidden", "clip"].includes(htmlStyle.overflowY) || ["hidden", "clip"].includes(htmlStyle.overflow);
      if (isOverflowLocked) return;
      const prev = body.getAttribute("data-paper-prev-padding-top");
      if (!prev) {
        body.setAttribute("data-paper-prev-padding-top", bodyStyle.paddingTop || "0px");
      }
      const currentPadding = Number.parseFloat(bodyStyle.paddingTop || "0") || 0;
      if (currentPadding < offset) {
        body.style.paddingTop = `${offset}px`;
      }
    },
    mountBanner() {
      const root = OverlayManager.getShadowRoot();
      if (!root) return;
      let bar = root.getElementById(IDS.banner);
      if (bar) return;
      bar = document.createElement("div");
      bar.id = IDS.banner;
      const modeHint = ModesUI.getBannerHint();
      bar.innerHTML = `
            <div class="inner" style="cursor:pointer;" title="Click to toggle ZER\xD8 Mode">
                <div class="dot"></div>
                <div class="label">ZER\xD8 MODE</div>
                <div class="state">ENABLED</div>
                <div class="hint" style="margin-left:8px; opacity:0.5; font-size:11px;">${modeHint}</div>
            </div>
            <div style="position:absolute; right:20px; font-size:10px; color:#334155; pointer-events:none;">v${Store.state?.version || "0.9.1"}</div>
        `;
      bar.addEventListener("click", async () => {
        if (!Store.state) return;
        Store.state.settings.enabled = !Store.state.settings.enabled;
        await Store.save();
        if (window.ZeroHUD && window.ZeroHUD.updateAll) {
          window.ZeroHUD.updateAll();
        }
      });
      root.insertBefore(bar, root.firstChild);
      this.ensurePageOffset();
    },
    updateBanner() {
      const root = OverlayManager.getShadowRoot();
      const bar = root?.getElementById(IDS.banner);
      if (!bar || !Store.state) return;
      const enabled = Store.state.settings.enabled;
      const stateEl = bar.querySelector(".state");
      if (stateEl) stateEl.textContent = enabled ? "ENABLED" : "DISABLED";
      bar.classList.toggle("disabled", !enabled);
      const hintEl = bar.querySelector(".hint");
      if (hintEl) hintEl.textContent = ModesUI.getBannerHint();
      this.updateAlerts();
    },
    updateAlerts() {
      const root = OverlayManager.getShadowRoot();
      if (!root || !Store.state) return;
      const flags = FeatureManager.resolveFlags(Store.state, "TILT_DETECTION");
      if (!flags.visible || !Store.state.settings.behavioralAlerts) {
        const existing = root.getElementById("elite-alert-container");
        if (existing) existing.remove();
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
  init_diagnostics_store();

  // src/modules/core/pnl-calculator.js
  init_store();

  // src/modules/core/analytics.js
  init_store();
  var EVENT_CATEGORIES = {
    TRADE: "TRADE",
    ALERT: "ALERT",
    DISCIPLINE: "DISCIPLINE",
    SYSTEM: "SYSTEM",
    MILESTONE: "MILESTONE"
  };
  var Analytics = {
    // ==========================================
    // PERSISTENT EVENT LOGGING
    // ==========================================
    logEvent(state, type, category, message, data = {}) {
      if (!state.eventLog) state.eventLog = [];
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
      if (penalty <= 0) return;
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
      if (trades.length === 0) return null;
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
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
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
        totalPnlSol
      };
    },
    calculateDiscipline(trade, state) {
      const flags = FeatureManager.resolveFlags(state, "DISCIPLINE_SCORING");
      if (!flags.enabled) return { score: state.session.disciplineScore || 100, penalty: 0, reasons: [] };
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
      if (!buyTrade || !buyTrade.plannedStop) return { penalty: 0, reasons: [] };
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
      if (!buyTrade || !buyTrade.plannedStop) return null;
      const entryPrice = buyTrade.priceUsd;
      const exitPrice = sellTrade.priceUsd;
      const stopPrice = buyTrade.plannedStop;
      const riskPerUnit = entryPrice - stopPrice;
      if (riskPerUnit <= 0) return null;
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
      if (trade.side !== "SELL") return;
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
      if (!state.session.equityHistory) state.session.equityHistory = [];
      state.session.equityHistory.push({
        ts: Date.now(),
        equity: state.session.balance + (state.session.realized || 0)
      });
      if (state.session.equityHistory.length > 50) state.session.equityHistory.shift();
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
      if (!flags.enabled) return;
      const ctx = Market.context;
      if (!ctx) return;
      const vol = ctx.vol24h;
      const chg = Math.abs(ctx.priceChange24h);
      if (vol < 5e5 && Date.now() - (state.lastRegimeAlert || 0) > 36e5) {
        this.addAlert(state, "MARKET_REGIME", "LOW VOLUME: Liquidity is thin ($<500k). Slippage may be high.");
        state.lastRegimeAlert = Date.now();
      }
      if (chg > 50 && Date.now() - (state.lastRegimeAlert || 0) > 36e5) {
        this.addAlert(state, "MARKET_REGIME", "HIGH VOLATILITY: 24h change is >50%. Expect rapid swings.");
        state.lastRegimeAlert = Date.now();
      }
    },
    detectTilt(trade, state) {
      const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
      if (!flags.enabled) return;
      const lossStreak = state.session.lossStreak || 0;
      if (lossStreak >= 3) {
        this.addAlert(state, "TILT", `TILT DETECTED: ${lossStreak} Losses in a row. Take a break.`);
        state.behavior.tiltFrequency = (state.behavior.tiltFrequency || 0) + 1;
      }
    },
    detectSunkCost(trade, state) {
      if (trade.side !== "BUY") return;
      const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
      if (!flags.enabled) return;
      const pos = state.positions[trade.mint];
      if (pos && (pos.pnlSol || 0) < 0) {
        this.addAlert(state, "SUNK_COST", "SUNK COST: Averaging down into a losing position increases risk.");
        state.behavior.sunkCostFrequency = (state.behavior.sunkCostFrequency || 0) + 1;
      }
    },
    detectOvertrading(state) {
      const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
      if (!flags.enabled) return;
      if (state.session?.activeAlerts) {
        const lastAlert = state.session.activeAlerts.slice().reverse().find((a) => a.type === "VELOCITY");
        if (lastAlert && Date.now() - lastAlert.ts < 6e4) {
          return;
        }
      }
      const trades = Object.values(state.trades || {}).filter((t) => t.mode === (state.settings.tradingMode || "paper")).sort((a, b) => a.ts - b.ts);
      if (trades.length < 5) return;
      const last5 = trades.slice(-5);
      const timeSpan = last5[4].ts - last5[0].ts;
      const timeSinceLast = Date.now() - last5[4].ts;
      if (timeSpan < 3e5 && timeSinceLast < 3e5) {
        console.log(`[ZER\xD8 ALERT] Overtrading Detected: 5 trades in ${(timeSpan / 1e3).toFixed(1)}s`, last5.map((t) => t.id));
        this.addAlert(state, "VELOCITY", "OVERTRADING: You're trading too fast. Stop and evaluate setups.");
        state.behavior.overtradingFrequency = (state.behavior.overtradingFrequency || 0) + 1;
        state.lastOvertradingAlert = Date.now();
      }
    },
    monitorProfitOverstay(state) {
      const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
      if (!flags.enabled) return;
      Object.values(state.positions).forEach((pos) => {
        const pnlPct = pos.pnlPct || 0;
        const peakPct = pos.peakPnlPct !== void 0 ? pos.peakPnlPct : 0;
        if (peakPct > 10 && pnlPct < 0) {
          if (!pos.alertedGreenToRed) {
            this.addAlert(state, "PROFIT_NEGLECT", `GREEN-TO-RED: ${pos.symbol} was up 10%+. Don't let winners die.`);
            pos.alertedGreenToRed = true;
            state.behavior.profitNeglectFrequency = (state.behavior.profitNeglectFrequency || 0) + 1;
          }
        }
      });
    },
    detectStrategyDrift(trade, state) {
      if (trade.side !== "BUY") return;
      const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
      if (!flags.enabled) return;
      if (trade.strategy === "Unknown" || trade.strategy === "Other") {
        const trades = Object.values(state.trades || {});
        const profitableStrategies = trades.filter((t) => (t.realizedPnlSol || 0) > 0 && t.strategy !== "Unknown").map((t) => t.strategy);
        if (profitableStrategies.length >= 3) {
          this.addAlert(state, "DRIFT", "STRATEGY DRIFT: Playing 'Unknown' instead of your winning setups.");
          state.behavior.strategyDriftFrequency = (state.behavior.strategyDriftFrequency || 0) + 1;
        }
      }
    },
    detectFomo(trade, state) {
      if (trade.side !== "BUY") return;
      const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
      if (!flags.enabled) return;
      const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
      const prevTrade = trades.length > 1 ? trades[trades.length - 2] : null;
      if (prevTrade && trade.ts - prevTrade.ts < 3e4 && prevTrade.side === "SELL" && (prevTrade.realizedPnlSol || 0) < 0) {
        this.addAlert(state, "FOMO", "FOMO ALERT: Revenge trading detected.");
        state.behavior.fomoTrades = (state.behavior.fomoTrades || 0) + 1;
      }
    },
    detectPanicSell(trade, state) {
      if (trade.side !== "SELL") return;
      const flags = FeatureManager.resolveFlags(state, "TILT_DETECTION");
      if (!flags.enabled) return;
      if (trade.entryTs && trade.ts - trade.entryTs < 45e3 && (trade.realizedPnlSol || 0) < 0) {
        this.addAlert(state, "PANIC", "PANIC SELL: You're cutting too early. Trust your stops.");
        state.behavior.panicSells = (state.behavior.panicSells || 0) + 1;
      }
    },
    addAlert(state, type, message) {
      if (!state.session.activeAlerts) state.session.activeAlerts = [];
      const alert = { type, message, ts: Date.now() };
      state.session.activeAlerts.push(alert);
      if (state.session.activeAlerts.length > 3) state.session.activeAlerts.shift();
      this.logAlertEvent(state, type, message);
      console.log(`[ELITE ALERT] ${type}: ${message}`);
    },
    updateProfile(state) {
      const b = state.behavior;
      const totalMistakes = (b.tiltFrequency || 0) + (b.fomoTrades || 0) + (b.panicSells || 0);
      if (totalMistakes === 0) b.profile = "Disciplined";
      else if (b.tiltFrequency > 2) b.profile = "Emotional";
      else if (b.fomoTrades > 2) b.profile = "Impulsive";
      else if (b.panicSells > 2) b.profile = "Hesitant";
      else b.profile = "Improving";
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
      const mode = state.settings?.tradingMode || "paper";
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
      let text = `ZERO Trading Session Complete

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
      if (mode === "shadow") {
        text += `Real trades analyzed using ZERO's advanced behavioral analysis.
`;
      } else if (mode === "analysis") {
        text += `Real trades observed and reviewed with ZERO.
`;
      } else {
        text += `Paper trading session tracked with ZERO.
`;
      }
      text += `https://get-zero.xyz

`;
      text += `#Solana #PaperTrading #Crypto`;
      return text;
    },
    /**
     * Analyze trades filtered by source category.
     * source: 'paper' | 'real' | 'all'
     */
    analyzeTradesBySource(state, source) {
      const allTrades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
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
      let wins = 0, losses = 0;
      let totalPnlSol = 0;
      for (const trade of recentTrades) {
        const pnl = trade.realizedPnlSol || 0;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
        totalPnlSol += pnl;
      }
      const winRate = recentTrades.length > 0 ? wins / recentTrades.length * 100 : 0;
      const grossProfits = recentTrades.reduce((sum, t) => sum + Math.max(0, t.realizedPnlSol || 0), 0);
      const grossLosses = Math.abs(recentTrades.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0));
      const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : grossProfits > 0 ? "MAX" : "0.00";
      let peak = 0, maxDd = 0, currentBal = 0;
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
        source
      };
    },
    // ==========================================
    // EXPORT FUNCTIONALITY
    // ==========================================
    exportToCSV(state) {
      const trades = Object.values(state.trades || {}).sort((a, b) => a.ts - b.ts);
      if (trades.length === 0) return null;
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
            if (pnl > 0) strategyStats[strat].wins++;
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
          if ((t.realizedPnlSol || 0) > 0) largeWins++;
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
        if (session.length < 5) return;
        const sessionStart = session[0].ts;
        const lateThreshold = sessionStart + 60 * 60 * 1e3;
        session.filter((t) => t.ts > lateThreshold && t.side === "SELL").forEach((t) => {
          lateTotal++;
          if ((t.realizedPnlSol || 0) > 0) lateWins++;
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
        if (hour >= 6 && hour < 12) slot = "morning";
        else if (hour >= 12 && hour < 18) slot = "afternoon";
        else if (hour >= 18 && hour < 24) slot = "evening";
        else slot = "night";
        timeSlots[slot].total++;
        timeSlots[slot].pnl += t.realizedPnlSol || 0;
        if ((t.realizedPnlSol || 0) > 0) timeSlots[slot].wins++;
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
      if (sellTrades.length < 5) return { style: "Unknown", description: "Need more data" };
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
      if (buyTrades.length < 3) return { profile: "Unknown", avgRisk: 0 };
      const startSol = state.settings?.startSol || 10;
      const riskPcts = buyTrades.map((t) => t.solAmount / startSol * 100);
      const avgRisk = riskPcts.reduce((a, b) => a + b, 0) / riskPcts.length;
      const maxRisk = Math.max(...riskPcts);
      const plansUsed = buyTrades.filter((t) => t.riskDefined).length;
      const planRate = (plansUsed / buyTrades.length * 100).toFixed(0);
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
          if (currentSession.length > 0) sessions.push(currentSession);
          currentSession = [trade];
        } else {
          currentSession.push(trade);
        }
      });
      if (currentSession.length > 0) sessions.push(currentSession);
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
          strategyFocus: Math.round(breakdown.strategyFocus)
        }
      };
    }
  };

  // src/modules/core/pnl-calculator.js
  var PnlCalculator = {
    cachedSolPrice: 200,
    // Default fallback
    lastValidSolPrice: null,
    lastSolPriceFetch: 0,
    priceUpdateInterval: null,
    lastPriceSave: 0,
    init() {
      console.log("[PNL] Initializing WAC PnL Calculator");
      this.fetchSolPrice();
      if (!this.priceUpdateInterval) {
        this.priceUpdateInterval = setInterval(() => {
          this.fetchSolPrice();
        }, 3e5);
      }
    },
    /**
     * Fetches SOL/USD from Kraken + Coinbase and computes Median.
     */
    async fetchSolPrice() {
      console.log("[PNL] Fetching SOL Price (Kraken + Coinbase)...");
      const fetchKraken = async () => {
        try {
          const res = await proxyFetch("https://api.kraken.com/0/public/Ticker?pair=SOLUSD", { method: "GET" });
          if (res.ok && res.data?.result?.SOLUSD?.c?.[0]) {
            return parseFloat(res.data.result.SOLUSD.c[0]);
          }
        } catch (e) {
          console.warn("[PNL] Kraken failed", e);
        }
        return null;
      };
      const fetchCoinbase = async () => {
        try {
          const res = await proxyFetch("https://api.coinbase.com/v2/prices/SOL-USD/spot", { method: "GET" });
          if (res.ok && res.data?.data?.amount) {
            return parseFloat(res.data.data.amount);
          }
        } catch (e) {
          console.warn("[PNL] Coinbase failed", e);
        }
        return null;
      };
      const [kPrice, cPrice] = await Promise.all([fetchKraken(), fetchCoinbase()]);
      let validPrices = [];
      if (kPrice) validPrices.push(kPrice);
      if (cPrice) validPrices.push(cPrice);
      if (validPrices.length > 0) {
        const sum = validPrices.reduce((a, b) => a + b, 0);
        const median = sum / validPrices.length;
        this.cachedSolPrice = median;
        this.lastValidSolPrice = median;
        this.lastSolPriceFetch = Date.now();
        console.log(`[PNL] SOL/USD Updated: $${median.toFixed(2)} (Sources: ${validPrices.length})`);
      } else {
        console.error("[PNL] All SOL price sources failed. Using fallback.");
        if (this.lastValidSolPrice) this.cachedSolPrice = this.lastValidSolPrice;
      }
    },
    getSolPrice() {
      return this.cachedSolPrice;
    },
    fmtSol(n) {
      if (!Number.isFinite(n)) return "0.0000";
      if (Math.abs(n) < 1 && n !== 0) return n.toFixed(9);
      return n.toFixed(4);
    },
    /**
     * Calculates WAC-based PnL for all positions.
     */
    getUnrealizedPnl(state, currentTokenMint = null) {
      let totalUnrealizedSol = 0;
      const solUsd = this.getSolPrice();
      let priceWasUpdated = false;
      let totalUnrealizedUsd = 0;
      const positions = Object.values(state.positions || {});
      const currentSymbol = (Market.currentSymbol || "").toUpperCase();
      const currentMC = Market.marketCap || 0;
      positions.forEach((pos) => {
        const mintMatches = currentTokenMint && pos.mint === currentTokenMint;
        const symbolMatches = !currentTokenMint && currentSymbol && pos.symbol && pos.symbol.toUpperCase() === currentSymbol;
        if ((mintMatches || symbolMatches) && Market.price > 0) {
          pos.lastMarkPriceUsd = Market.price;
          pos.lastMarketCapUsd = Market.marketCap;
          priceWasUpdated = true;
        }
        if (pos.qtyTokens <= 0) return;
        const entryMC = pos.entryMarketCapUsdReference || 0;
        const totalSolSpent = pos.totalSolSpent || 0;
        if (currentMC > 0 && entryMC > 0 && totalSolSpent > 0) {
          const mcRatio = currentMC / entryMC;
          if (mcRatio > 1e5 || mcRatio < 1e-5) {
            console.warn(`[PNL] ${pos.symbol}: SUSPICIOUS MC RATIO ${mcRatio.toFixed(2)}x (entry=$${entryMC.toFixed(0)}, current=$${currentMC.toFixed(0)}) \u2014 falling back to WAC method`);
          } else {
            const currentValueSol = totalSolSpent * mcRatio;
            const unrealizedPnlSol2 = currentValueSol - totalSolSpent;
            const unrealizedPnlUsd2 = unrealizedPnlSol2 * solUsd;
            const pnlPct2 = totalSolSpent > 0 ? unrealizedPnlSol2 / totalSolSpent * 100 : 0;
            pos.pnlPct = pnlPct2;
            if (pos.peakPnlPct === void 0 || pnlPct2 > pos.peakPnlPct) pos.peakPnlPct = pnlPct2;
            totalUnrealizedUsd += unrealizedPnlUsd2;
            totalUnrealizedSol += unrealizedPnlSol2;
            console.log(`[PNL] ${pos.symbol}: MC Ratio \u2014 entryMC=$${entryMC.toFixed(0)}, currentMC=$${currentMC.toFixed(0)}, ratio=${mcRatio.toFixed(4)}, pnl=${unrealizedPnlSol2.toFixed(4)} SOL (${pnlPct2.toFixed(1)}%)`);
            return;
          }
        }
        const markPriceUsd = pos.lastMarkPriceUsd || 0;
        if (markPriceUsd <= 0) return;
        const currentValueUsd = pos.qtyTokens * markPriceUsd;
        const unrealizedPnlUsd = currentValueUsd - pos.costBasisUsd;
        const unrealizedPnlSol = unrealizedPnlUsd / solUsd;
        const pnlPct = pos.costBasisUsd > 0 ? unrealizedPnlUsd / pos.costBasisUsd * 100 : 0;
        pos.pnlPct = pnlPct;
        if (pos.peakPnlPct === void 0 || pnlPct > pos.peakPnlPct) pos.peakPnlPct = pnlPct;
        totalUnrealizedUsd += unrealizedPnlUsd;
        totalUnrealizedSol += unrealizedPnlSol;
        console.log(`[PNL] ${pos.symbol}: WAC fallback \u2014 qty=${pos.qtyTokens.toFixed(2)}, price=$${markPriceUsd.toFixed(6)}, pnl=${unrealizedPnlSol.toFixed(4)} SOL (${pnlPct.toFixed(1)}%)`);
      });
      Analytics.monitorProfitOverstay(state);
      Analytics.detectOvertrading(state);
      const now = Date.now();
      if (priceWasUpdated && now - this.lastPriceSave > 5e3) {
        this.lastPriceSave = now;
        Store.save();
      }
      return totalUnrealizedSol;
    }
  };

  // src/modules/core/order-execution.js
  init_store();
  var OrderExecution = {
    // ENTRY Action
    // tokenInfo arg matches existing UI signature but we rely on Market.currentMint for truth
    async buy(solAmount, strategy = "MANUAL", tokenInfo = null, tradePlan = null) {
      const state = Store.state;
      const mint = Market.currentMint;
      const priceUsd = Market.price;
      const symbol = Market.currentSymbol || "UNKNOWN";
      if (!mint) return { success: false, error: "No active token context" };
      if (solAmount <= 0) return { success: false, error: "Invalid SOL amount" };
      if (priceUsd <= 0) return { success: false, error: `Price not available (${priceUsd})` };
      const tickAge = Date.now() - Market.lastTickTs;
      console.log(`[EXEC] BUY DIAG: price=$${priceUsd}, mcap=$${Market.marketCap}, source=${Market.lastSource}, tickAge=${tickAge}ms`);
      const solUsd = PnlCalculator.getSolPrice();
      const buyUsd = solAmount * solUsd;
      const qtyDelta = buyUsd / priceUsd;
      if (!state.positions[mint]) {
        state.positions[mint] = {
          mint,
          symbol,
          qtyTokens: 0,
          costBasisUsd: 0,
          avgCostUsdPerToken: 0,
          realizedPnlUsd: 0,
          totalSolSpent: 0,
          // Legacy tracking
          entryMarketCapUsdReference: null,
          lastMarkPriceUsd: priceUsd,
          ts: Date.now()
        };
      }
      const pos = state.positions[mint];
      pos.qtyTokens += qtyDelta;
      pos.costBasisUsd += buyUsd;
      pos.totalSolSpent += solAmount;
      pos.avgCostUsdPerToken = pos.qtyTokens > 0 ? pos.costBasisUsd / pos.qtyTokens : 0;
      if (pos.entryMarketCapUsdReference === null && Market.marketCap > 0) {
        pos.entryMarketCapUsdReference = Market.marketCap;
      }
      console.log(`[EXEC] BUY ${symbol}: +${qtyDelta.toFixed(2)} ($${buyUsd.toFixed(2)}) @ $${priceUsd}`);
      const fillData = {
        side: "BUY",
        mint,
        symbol,
        solAmount,
        usdNotional: buyUsd,
        qtyTokensDelta: qtyDelta,
        fillPriceUsd: priceUsd,
        marketCapUsdAtFill: Market.marketCap,
        priceSource: Market.lastSource || "unknown",
        strategy,
        tradePlan
        // Store if provided
      };
      const fillId = this.recordFill(state, fillData);
      state.session.balance -= solAmount;
      await Store.save();
      return { success: true, message: `Bought ${symbol}`, trade: { id: fillId } };
    },
    // EXIT Action
    async sell(percent, strategy = "MANUAL", tokenInfo = null) {
      const state = Store.state;
      const mint = Market.currentMint;
      const priceUsd = Market.price;
      const symbol = Market.currentSymbol || "UNKNOWN";
      if (!mint) return { success: false, error: "No active token context" };
      if (!state.positions[mint] || state.positions[mint].qtyTokens <= 0) return { success: false, error: "No open position" };
      const pos = state.positions[mint];
      const tickAge = Date.now() - Market.lastTickTs;
      console.log(`[EXEC] SELL DIAG: price=$${priceUsd}, mcap=$${Market.marketCap}, source=${Market.lastSource}, tickAge=${tickAge}ms`);
      console.log(`[EXEC] SELL DIAG: avgCost=$${pos.avgCostUsdPerToken}, qty=${pos.qtyTokens}, costBasis=$${pos.costBasisUsd}`);
      const pct = percent === void 0 || percent === null ? 100 : Math.min(Math.max(percent, 0), 100);
      const rawDelta = pos.qtyTokens * (pct / 100);
      const qtyDelta = Math.min(rawDelta, pos.qtyTokens);
      if (qtyDelta <= 0) return { success: false, error: "Zero quantity exit" };
      const proceedsUsd = qtyDelta * priceUsd;
      const costRemovedUsd = qtyDelta * pos.avgCostUsdPerToken;
      const pnlEventUsd = proceedsUsd - costRemovedUsd;
      pos.realizedPnlUsd += pnlEventUsd;
      pos.qtyTokens -= qtyDelta;
      pos.costBasisUsd -= costRemovedUsd;
      const solUsd = PnlCalculator.getSolPrice();
      pos.totalSolSpent -= costRemovedUsd / solUsd;
      if (pos.qtyTokens < 1e-6) {
        pos.qtyTokens = 0;
        pos.costBasisUsd = 0;
        pos.avgCostUsdPerToken = 0;
        pos.entryMarketCapUsdReference = null;
      }
      console.log(`[EXEC] SELL ${symbol}: -${qtyDelta.toFixed(2)} ($${proceedsUsd.toFixed(2)}) PnL: $${pnlEventUsd.toFixed(2)}`);
      const proceedsSol = proceedsUsd / solUsd;
      const pnlEventSol = pnlEventUsd / solUsd;
      const fillData = {
        side: "SELL",
        mint,
        symbol,
        percent: pct,
        qtyTokensDelta: -qtyDelta,
        proceedsUsd,
        fillPriceUsd: priceUsd,
        marketCapUsdAtFill: Market.marketCap,
        priceSource: Market.lastSource || "unknown",
        strategy,
        realizedPnlSol: pnlEventSol
      };
      const fillId = this.recordFill(state, fillData);
      state.session.balance += proceedsSol;
      state.session.realized = (state.session.realized || 0) + pnlEventSol;
      try {
        Analytics.updateStreaks({ side: "SELL", realizedPnlSol: pnlEventSol }, state);
      } catch (e) {
      }
      await Store.save();
      return { success: true, message: `Sold ${pct}% ${symbol}`, trade: { id: fillId } };
    },
    // Tagging (Emotion/Notes)
    async tagTrade(tradeId, updates) {
      const state = Store.state;
      const fill = state.fills ? state.fills.find((f) => f.id === tradeId) : null;
      if (fill) {
        Object.assign(fill, updates);
        await Store.save();
        return true;
      }
      return false;
    },
    recordFill(state, fillData) {
      if (!state.fills) state.fills = [];
      if (!state.trades) state.trades = {};
      const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const fill = {
        id,
        ts: Date.now(),
        ...fillData
      };
      state.fills.unshift(fill);
      state.trades[id] = fill;
      if (state.session) {
        if (!state.session.trades) state.session.trades = [];
        state.session.trades.push(id);
        state.session.tradeCount = (state.session.tradeCount || 0) + 1;
      }
      if (state.fills.length > 500) state.fills.pop();
      return id;
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
      return {
        symbol: Market.currentSymbol || "SOL",
        mint: Market.currentMint || "So11111111111111111111111111111111111111112"
      };
    }
  };

  // src/modules/ui/paywall.js
  init_store();

  // src/modules/license.js
  init_store();

  // src/modules/logger.js
  var Logger = {
    isProduction: false,
    // Set to true in prod builds
    info(msg, ...args) {
      if (this.isProduction) return;
      console.log(`[ZER\xD8] ${msg}`, ...this.cleanArgs(args));
    },
    warn(msg, ...args) {
      console.warn(`[ZER\xD8] ${msg}`, ...this.cleanArgs(args));
    },
    error(msg, ...args) {
      console.error(`[ZER\xD8] ${msg}`, ...this.cleanArgs(args));
    },
    cleanArgs(args) {
      return args.map((arg) => {
        if (arg instanceof Error) {
          return { name: arg.name, message: arg.message, stack: arg.stack };
        }
        if (typeof DOMException !== "undefined" && arg instanceof DOMException) {
          return { name: arg.name, message: arg.message, code: arg.code };
        }
        if (typeof arg === "object" && arg !== null) {
          const clean = { ...arg };
          ["key", "secret", "token", "auth", "password"].forEach((k) => {
            if (k in clean) clean[k] = "***REDACTED***";
          });
          return clean;
        }
        return arg;
      });
    }
  };

  // src/modules/license.js
  var WHOP_PRODUCT_URL = "https://whop.com/crowd-ctrl/zero-elite/";
  var REVALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1e3;
  var License = {
    /**
     * Check if the user has a valid Elite license (from cached state).
     * Does NOT call any API — reads Store only.
     * @returns {boolean}
     */
    isValid() {
      const license = Store.state?.settings?.license;
      if (!license || !license.valid || !license.lastVerified) return false;
      const GRACE_MS = 72 * 60 * 60 * 1e3;
      const elapsed = Date.now() - license.lastVerified;
      return elapsed < GRACE_MS;
    },
    /**
     * Get the stored license key.
     * @returns {string|null}
     */
    getKey() {
      return Store.state?.settings?.license?.key || null;
    },
    /**
     * Get license status for UI display.
     * @returns {{ status: string, plan: string|null, expiresAt: string|null, lastVerified: number|null, maskedKey: string|null }}
     */
    getStatus() {
      const license = Store.state?.settings?.license;
      if (!license || !license.key) {
        return { status: "none", plan: null, expiresAt: null, lastVerified: null, maskedKey: null };
      }
      const key = license.key;
      const maskedKey = key.length > 4 ? "****" + key.slice(-4) : "****";
      return {
        status: license.status || "none",
        plan: license.plan || null,
        expiresAt: license.expiresAt || null,
        lastVerified: license.lastVerified || null,
        maskedKey
      };
    },
    /**
     * Get a human-readable plan label.
     * @returns {string}
     */
    getPlanLabel() {
      const plan = Store.state?.settings?.license?.plan;
      if (plan === "founders") return "Founders Lifetime";
      if (plan === "annual") return "Annual";
      if (plan === "monthly") return "Monthly";
      return "";
    },
    /**
     * Activate a license key — stores it and triggers verification.
     * @param {string} key - Whop license key or membership ID
     * @returns {Promise<{ ok: boolean, error?: string }>}
     */
    async activate(key) {
      if (!key || typeof key !== "string" || key.trim().length < 4) {
        return { ok: false, error: "Invalid license key" };
      }
      key = key.trim();
      Logger.info("[License] Activating key...");
      Store.state.settings.license.key = key;
      Store.state.settings.license.status = "pending";
      await Store.save();
      const result = await this.revalidate();
      if (result.ok) {
        Logger.info("[License] Activation successful");
      } else {
        Logger.warn("[License] Activation failed:", result.error);
        if (result.error === "invalid_key" || result.error === "invalid_product") {
          Store.state.settings.license.key = null;
          Store.state.settings.license.valid = false;
          Store.state.settings.license.status = "error";
          Store.state.settings.tier = "free";
          await Store.save();
        }
      }
      return result;
    },
    /**
     * Deactivate the license — clears key and reverts to Free.
     * @returns {Promise<void>}
     */
    async deactivate() {
      Logger.info("[License] Deactivating...");
      Store.state.settings.license = {
        key: null,
        valid: false,
        lastVerified: null,
        expiresAt: null,
        status: "none",
        plan: null
      };
      Store.state.settings.tier = "free";
      await Store.save();
    },
    /**
     * Re-validate the stored license key against the server.
     * @returns {Promise<{ ok: boolean, error?: string }>}
     */
    async revalidate() {
      const key = Store.state?.settings?.license?.key;
      if (!key) return { ok: false, error: "no_key" };
      Logger.info("[License] Revalidating...");
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "VERIFY_LICENSE", licenseKey: key },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
                return;
              }
              resolve(res || { ok: false, error: "no_response" });
            }
          );
        });
        if (response.ok && response.membership) {
          const m = response.membership;
          Store.state.settings.license.valid = m.valid;
          Store.state.settings.license.status = m.status || (m.valid ? "active" : "expired");
          Store.state.settings.license.plan = m.plan || null;
          Store.state.settings.license.expiresAt = m.expiresAt || null;
          Store.state.settings.license.lastVerified = Date.now();
          Store.state.settings.tier = m.valid ? "elite" : "free";
          await Store.save();
          return { ok: m.valid, error: m.valid ? void 0 : "membership_inactive" };
        }
        const license = Store.state.settings.license;
        if (license.valid && license.lastVerified) {
          const GRACE_MS = 72 * 60 * 60 * 1e3;
          const elapsed = Date.now() - license.lastVerified;
          if (elapsed < GRACE_MS) {
            Logger.warn("[License] Verification failed, using cached (grace period)");
            return { ok: true };
          }
        }
        Store.state.settings.license.valid = false;
        Store.state.settings.license.status = "error";
        Store.state.settings.tier = "free";
        await Store.save();
        return { ok: false, error: response.error || "verification_failed" };
      } catch (e) {
        Logger.error("[License] Revalidation error:", e);
        return { ok: false, error: "network_error" };
      }
    },
    /**
     * Check if revalidation is needed (called on boot).
     * @returns {boolean}
     */
    needsRevalidation() {
      const license = Store.state?.settings?.license;
      if (!license || !license.key) return false;
      if (!license.lastVerified) return true;
      return Date.now() - license.lastVerified > REVALIDATION_INTERVAL_MS;
    },
    /**
     * Open the Whop product page for purchase.
     */
    openPurchasePage() {
      window.open(WHOP_PRODUCT_URL, "_blank");
      Logger.info("[License] Opened Whop purchase page");
    }
  };

  // src/modules/ui/paywall.js
  var Paywall = {
    showUpgradeModal(lockedFeature = null) {
      const root = OverlayManager.getShadowRoot();
      const existing = root.getElementById("paywall-modal-overlay");
      if (existing) existing.remove();
      const overlay = document.createElement("div");
      overlay.id = "paywall-modal-overlay";
      overlay.className = "paywall-modal-overlay";
      let featureTitle = "ZER\xD8 Elite";
      let featureDesc = "Advanced behavioral analytics and cross-session insights";
      if (lockedFeature === "TRADE_PLAN") {
        featureTitle = "Trade Planning";
        featureDesc = "Set stop losses, targets, and capture your thesis before every trade.";
      } else if (lockedFeature === "DETAILED_LOGS") {
        featureTitle = "Detailed Logs";
        featureDesc = "Export comprehensive trade logs for analysis.";
      } else if (lockedFeature === "AI_DEBRIEF") {
        featureTitle = "AI Debrief";
        featureDesc = "Post-session behavioral analysis to accelerate your learning.";
      } else if (lockedFeature === "BEHAVIOR_BASELINE") {
        featureTitle = "Behavioral Profile";
        featureDesc = "Deep psychological profiling and real-time intervention.";
      } else if (lockedFeature === "DISCIPLINE_SCORING") {
        featureTitle = "Discipline Scoring";
        featureDesc = "Track how well you stick to your trading rules.";
      } else if (lockedFeature === "MARKET_CONTEXT") {
        featureTitle = "Market Context";
        featureDesc = "Overlay market conditions to see how context affected your trades.";
      }
      overlay.innerHTML = `
            <div class="paywall-modal">
                <div class="paywall-header">
                    <div class="paywall-badge">
                        ${ICONS.ZERO}
                        <span>ZER\xD8 ELITE</span>
                    </div>
                    <button class="paywall-close" data-act="close">${ICONS.X}</button>
                </div>

                <div class="paywall-hero">
                    <h2 class="paywall-title">${featureTitle}</h2>
                    <p class="paywall-subtitle">${featureDesc}</p>
                </div>

                <div class="paywall-features">
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Trade Planning</div>
                            <div class="feature-desc">Stop losses, targets, and thesis capture</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Discipline Scoring</div>
                            <div class="feature-desc">Track how well you follow your rules</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <div class="feature-text">
                            <div class="feature-name">Tilt Detection</div>
                            <div class="feature-desc">Real-time alerts for emotional trading</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Risk Metrics</div>
                            <div class="feature-desc">Advanced risk-adjusted performance analytics</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <div class="feature-text">
                            <div class="feature-name">AI Trade Debrief</div>
                            <div class="feature-desc">Post-session behavioral analysis</div>
                        </div>
                    </div>
                </div>

                <div class="paywall-pricing" style="text-align:center; margin:16px 0 8px; font-size:12px; color:#94a3b8; line-height:1.6;">
                    <span style="color:#f8fafc; font-weight:600;">$19/mo</span> &middot;
                    <span style="color:#f8fafc; font-weight:600;">$149/yr</span> &middot;
                    <span style="color:#a78bfa; font-weight:600;">$299 Founders Lifetime</span>
                </div>

                <div class="paywall-actions" style="display:flex; flex-direction:column; gap:8px;">
                    <button class="paywall-btn primary" data-act="purchase" style="background:linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer;">
                        Get Elite on Whop
                    </button>
                    <button class="paywall-btn text" data-act="show-key-input" style="background:none; border:none; color:#8b5cf6; font-size:12px; cursor:pointer; padding:6px;">
                        I have a license key
                    </button>
                </div>

                <div class="paywall-key-section" style="display:none; margin-top:12px;">
                    <div style="display:flex; gap:8px;">
                        <input type="text" class="paywall-license-input" placeholder="Enter license key (mem_xxx...)" maxlength="64"
                            style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:10px 12px; color:#f8fafc; font-size:13px; outline:none;">
                        <button class="paywall-btn" data-act="activate" style="background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); color:#a78bfa; padding:10px 16px; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; white-space:nowrap;">
                            Activate
                        </button>
                    </div>
                    <div class="paywall-key-status" style="margin-top:8px; font-size:12px; min-height:18px;"></div>
                </div>

                <div class="paywall-footer">
                    <p style="font-size:11px; color:#475569; margin-top:12px;">Manage your membership at whop.com/orders</p>
                </div>
            </div>
        `;
      overlay.addEventListener("click", async (e) => {
        if (e.target === overlay || e.target.closest('[data-act="close"]')) {
          overlay.remove();
        }
        if (e.target.closest('[data-act="purchase"]')) {
          License.openPurchasePage();
        }
        if (e.target.closest('[data-act="show-key-input"]')) {
          const keySection = overlay.querySelector(".paywall-key-section");
          if (keySection) {
            keySection.style.display = keySection.style.display === "none" ? "block" : "none";
            const input = keySection.querySelector(".paywall-license-input");
            if (input) input.focus();
          }
        }
        if (e.target.closest('[data-act="activate"]')) {
          const input = overlay.querySelector(".paywall-license-input");
          const statusEl = overlay.querySelector(".paywall-key-status");
          const key = input?.value?.trim();
          if (!key) {
            if (statusEl) {
              statusEl.textContent = "Please enter a license key";
              statusEl.style.color = "#f59e0b";
            }
            return;
          }
          const btn = e.target.closest('[data-act="activate"]');
          const origText = btn.textContent;
          btn.textContent = "Verifying...";
          btn.disabled = true;
          if (statusEl) {
            statusEl.textContent = "Verifying your license...";
            statusEl.style.color = "#94a3b8";
          }
          const result = await License.activate(key);
          btn.textContent = origText;
          btn.disabled = false;
          if (result.ok) {
            if (statusEl) {
              statusEl.textContent = "Elite activated!";
              statusEl.style.color = "#10b981";
            }
            this._showSuccessToast(License.getPlanLabel());
            setTimeout(() => overlay.remove(), 1500);
          } else {
            const errorMsg = result.error === "invalid_key" ? "Invalid license key" : result.error === "invalid_product" ? "Key not for this product" : result.error === "membership_inactive" ? "Membership is not active" : "Verification failed \u2014 try again";
            if (statusEl) {
              statusEl.textContent = errorMsg;
              statusEl.style.color = "#ef4444";
            }
          }
        }
      });
      root.appendChild(overlay);
    },
    handleUpgrade() {
      License.openPurchasePage();
    },
    _showSuccessToast(planLabel = "") {
      const root = OverlayManager.getShadowRoot();
      const toast = document.createElement("div");
      toast.className = "paywall-toast";
      toast.textContent = planLabel ? `Elite Activated (${planLabel})` : "Elite Activated";
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
        `;
      root.appendChild(toast);
      setTimeout(() => toast.remove(), 3e3);
    },
    isFeatureLocked(featureName) {
      if (!FeatureManager) return false;
      const flags = FeatureManager.resolveFlags(Store.state, featureName);
      return flags.gated;
    }
  };

  // src/modules/ui/dashboard.js
  init_store();

  // src/modules/ui/dashboard-styles.js
  var DASHBOARD_CSS = `
.paper-dashboard-overlay {
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

.paper-dashboard-modal {
    width: 680px;
    max-width: 95vw;
    max-height: 88vh;
    background: #0f1218;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px -16px rgba(0, 0, 0, 0.7);
}

/* HEADER */
.dash-header {
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}

.dash-title {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
}

.dash-subtitle {
    font-size: 11px;
    color: #475569;
    margin-top: 2px;
    font-weight: 500;
}

.dash-close {
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

.dash-close:hover {
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
}

/* SCROLLABLE CONTENT */
.dash-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px 24px;
}

.dash-scroll::-webkit-scrollbar { width: 4px; }
.dash-scroll::-webkit-scrollbar-track { background: transparent; }
.dash-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }

/* HERO SECTION */
.dash-hero {
    text-align: center;
    padding: 28px 20px 24px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 14px;
    margin-bottom: 16px;
}

.dash-hero.win-bg {
    background: rgba(16, 185, 129, 0.03);
    border-color: rgba(16, 185, 129, 0.08);
}

.dash-hero.loss-bg {
    background: rgba(239, 68, 68, 0.03);
    border-color: rgba(239, 68, 68, 0.08);
}

.dash-hero-label {
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    letter-spacing: 1.5px;
    margin-bottom: 10px;
}

.dash-hero-value {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.5px;
}

.dash-hero-pct {
    font-size: 15px;
    font-weight: 600;
    margin-top: 4px;
    opacity: 0.75;
}

.dash-hero-meta {
    font-size: 11px;
    color: #475569;
    margin-top: 10px;
    font-weight: 500;
}

/* METRIC GROUPS */
.dash-metrics-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
}

.dash-group-label {
    font-size: 9px;
    font-weight: 700;
    color: #3f4a5a;
    letter-spacing: 1.2px;
    margin-bottom: 6px;
    padding-left: 2px;
}

.dash-metric-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.dash-metric-card {
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.025);
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
}

.dash-metric-k {
    font-size: 9px;
    color: #4b5563;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
}

.dash-metric-v {
    font-size: 18px;
    font-weight: 800;
    color: #e2e8f0;
}

/* GENERIC CARD */
.dash-card {
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.025);
    border-radius: 12px;
    padding: 16px;
}

.dash-section-label {
    font-size: 9px;
    font-weight: 700;
    color: #3f4a5a;
    letter-spacing: 1.2px;
    margin-bottom: 12px;
}

/* EQUITY CHART */
.dash-equity-section {
    margin-bottom: 16px;
}

canvas#equity-canvas {
    width: 100%;
    height: 120px;
    border-radius: 6px;
}

/* BOTTOM ROW (FACTS + NOTES) */
.dash-bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
}

/* FACTS */
.dash-facts-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.dash-fact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
}

.dash-fact-k {
    color: #64748b;
    font-weight: 500;
}

.dash-fact-v {
    font-weight: 700;
    color: #cbd5e1;
}

/* NOTES */
.dash-notes-input {
    width: 100%;
    height: 72px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    color: #e2e8f0;
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 12px;
    padding: 10px;
    resize: none;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    line-height: 1.5;
}

.dash-notes-input:focus {
    border-color: rgba(20, 184, 166, 0.25);
}

.dash-notes-input::placeholder {
    color: #2d3748;
}

.dash-notes-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
}

.dash-notes-count {
    font-size: 10px;
    color: #2d3748;
    font-weight: 500;
}

.dash-notes-save {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
}

.dash-notes-save:hover {
    color: #e2e8f0;
    border-color: rgba(20, 184, 166, 0.25);
}

/* SHARE SECTION */
.dash-share-section {
    text-align: center;
}

.dash-share-btn {
    width: 100%;
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
    padding: 11px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.15s;
    font-family: inherit;
}

.dash-share-btn:hover {
    background: #1e293b;
    border-color: rgba(255, 255, 255, 0.08);
}

.dash-share-sub {
    font-size: 10px;
    color: #2d3748;
    margin-top: 6px;
    font-weight: 500;
}

/* ELITE INSIGHTS SECTION */
.dash-elite-section {
    margin-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    padding-top: 16px;
}

.dash-elite-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 8px 4px;
    border-radius: 8px;
    transition: background 0.15s;
}

.dash-elite-toggle:hover {
    background: rgba(139, 92, 246, 0.04);
}

.dash-elite-toggle-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.dash-elite-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.dash-elite-chevron {
    color: #475569;
    font-size: 14px;
    transition: transform 0.15s;
}

.dash-elite-content {
    padding-top: 12px;
}

.dash-elite-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* SHARED UTILITIES */
.win { color: #10b981; }
.loss { color: #ef4444; }
`;

  // src/modules/ui/elite-helpers.js
  function renderEliteLockedCard(title, desc) {
    return `
        <div class="elite-locked-card">
            <div class="elite-locked-card-header">
                <div class="elite-locked-card-icon">${ICONS.LOCK}</div>
                <div class="elite-locked-card-title">${title}</div>
                <div class="elite-locked-card-badge">Elite</div>
            </div>
            <div class="elite-locked-card-desc">${desc}</div>
        </div>
    `;
  }

  // src/modules/ui/dashboard.js
  var Dashboard = {
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
      const sessionTradeIds = state.session.trades || [];
      const allSessionTrades = sessionTradeIds.map((id) => state.trades[id]).filter(Boolean).sort((a, b) => a.ts - b.ts);
      const exits = allSessionTrades.filter(
        (t) => t.side === "SELL" || t.side === "EXIT" || t.realizedPnlSol !== void 0
      );
      const wins = exits.filter((t) => (t.realizedPnlSol || 0) > 0).length;
      const losses = exits.filter((t) => (t.realizedPnlSol || 0) < 0).length;
      const winRate = exits.length > 0 ? wins / exits.length * 100 : 0;
      const grossProfits = exits.reduce((sum, t) => sum + Math.max(0, t.realizedPnlSol || 0), 0);
      const grossLosses = Math.abs(exits.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0));
      const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : grossProfits > 0 ? Infinity : 0;
      let peak = 0, maxDd = 0, runningBal = 0;
      exits.forEach((t) => {
        runningBal += t.realizedPnlSol || 0;
        if (runningBal > peak) peak = runningBal;
        const dd = peak - runningBal;
        if (dd > maxDd) maxDd = dd;
      });
      let worstTradePnl = 0;
      exits.forEach((t) => {
        const pnl = t.realizedPnlSol || 0;
        if (pnl < worstTradePnl) worstTradePnl = pnl;
      });
      let maxWinStreak = 0, maxLossStreak = 0;
      let curWin = 0, curLoss = 0;
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
      const avgPnl = exits.length > 0 ? exits.reduce((sum, t) => sum + (t.realizedPnlSol || 0), 0) / exits.length : 0;
      const sessionPnl = state.session.realized || 0;
      const startSol = state.settings.startSol || 10;
      const sessionPnlPct = startSol > 0 ? sessionPnl / startSol * 100 : 0;
      const startTime = state.session.startTime || Date.now();
      const endTime = state.session.endTime || Date.now();
      const durationMs = endTime - startTime;
      const durationMin = Math.floor(durationMs / 6e4);
      const durationHr = Math.floor(durationMin / 60);
      const durationRemMin = durationMin % 60;
      let durationStr;
      if (durationHr > 0) {
        durationStr = `${durationHr}h ${durationRemMin}m`;
      } else {
        durationStr = `${durationMin}m`;
      }
      const endTimeStr = new Date(endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
        hasExits: exits.length > 0
      };
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
      const stats = this.computeSessionStats(state);
      const hasEquityData = (state.session.equityHistory || []).length >= 2;
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
      const subtext = state.settings.tradingMode === "shadow" ? "Observed session results" : "Paper session results";
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
                        ${isEmpty ? `<div class="dash-hero-value" style="color:#64748b;">No trades in this session</div>
                               <div class="dash-hero-meta">Duration ${stats.durationStr}</div>` : `<div class="dash-hero-value ${pnlClass}">${pnlSign}${stats.sessionPnl.toFixed(4)} SOL</div>
                               <div class="dash-hero-pct ${pnlClass}">${pnlPctStr}</div>
                               <div class="dash-hero-meta">Duration ${stats.durationStr} \xB7 ${stats.endTimeStr}</div>`}
                    </div>

                    ${!isEmpty ? `
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
                    ` : ""}

                    ${hasEquityData ? `
                    <div class="dash-card dash-equity-section">
                        <div class="dash-section-label">EQUITY CURVE</div>
                        <canvas id="equity-canvas"></canvas>
                    </div>
                    ` : ""}

                    <div class="dash-bottom-row">
                        <div class="dash-card dash-facts">
                            <div class="dash-section-label">SESSION FACTS</div>
                            <div class="dash-facts-grid">
                                <div class="dash-fact"><span class="dash-fact-k">Trades taken</span><span class="dash-fact-v">${stats.totalTrades}</span></div>
                                ${stats.hasExits ? `
                                <div class="dash-fact"><span class="dash-fact-k">Wins / Losses</span><span class="dash-fact-v">${stats.wins} / ${stats.losses}</span></div>
                                ${stats.maxWinStreak > 0 ? `<div class="dash-fact"><span class="dash-fact-k">Best win streak</span><span class="dash-fact-v win">${stats.maxWinStreak}</span></div>` : ""}
                                ${stats.maxLossStreak > 0 ? `<div class="dash-fact"><span class="dash-fact-k">Worst loss streak</span><span class="dash-fact-v loss">${stats.maxLossStreak}</span></div>` : ""}
                                <div class="dash-fact"><span class="dash-fact-k">Avg trade P&L</span><span class="dash-fact-v ${stats.avgPnl >= 0 ? "win" : "loss"}">${fmtPnl(stats.avgPnl)}</span></div>
                                ` : ""}
                            </div>
                        </div>
                        <div class="dash-card dash-notes">
                            <div class="dash-section-label">SESSION NOTES</div>
                            <textarea class="dash-notes-input" id="dash-session-notes" maxlength="280" placeholder="Add a note about this session...">${state.session.notes || ""}</textarea>
                            <div class="dash-notes-footer">
                                <span class="dash-notes-count" id="dash-notes-count">${(state.session.notes || "").length}/280</span>
                                <button class="dash-notes-save" id="dash-notes-save">Save note</button>
                            </div>
                        </div>
                    </div>

                    <div class="dash-share-section">
                        <button class="dash-share-btn" id="dashboard-share-btn">
                            <span style="font-size:16px;">\u{1D54F}</span>
                            <span>Share session summary</span>
                        </button>
                        <div class="dash-share-sub">Includes paper session stats only</div>
                    </div>

                    <div class="dash-elite-section">
                        <div class="dash-elite-toggle" id="dash-elite-toggle">
                            <div class="dash-elite-toggle-left">
                                <span class="dash-section-label" style="margin-bottom:0;">ADVANCED INSIGHTS</span>
                                <span class="dash-elite-badge">Elite</span>
                            </div>
                            <span class="dash-elite-chevron" id="dash-elite-chevron">\u25B8</span>
                        </div>
                        <div class="dash-elite-content" id="dash-elite-content" style="display:none;">
                            ${isElite ? `
                            <div class="dash-elite-grid">
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Discipline Score</div>
                                    <div class="dash-metric-v" style="color:#8b5cf6;">${state.session.disciplineScore || 100}</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Consistency</div>
                                    <div class="dash-metric-v" style="color:#8b5cf6;">\u2014</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Behavior Profile</div>
                                    <div class="dash-metric-v" style="color:#8b5cf6;">${state.behavior?.profile || "Disciplined"}</div>
                                </div>
                            </div>
                            ` : `
                            <div class="dash-elite-grid">
                                ${renderEliteLockedCard("Discipline Scoring", "Track how well you stick to your trading rules with an objective score.")}
                                ${renderEliteLockedCard("Risk Metrics", "Advanced risk-adjusted performance metrics for serious traders.")}
                                ${renderEliteLockedCard("Behavioral Patterns", "Understand how your emotional state affects your trading outcomes.")}
                            </div>
                            `}
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
          self.close();
        });
      }
      overlay.onclick = (e) => {
        if (e.target === overlay) self.close();
      };
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
      const notesInput = overlay.querySelector("#dash-session-notes");
      const notesCount = overlay.querySelector("#dash-notes-count");
      const notesSave = overlay.querySelector("#dash-notes-save");
      if (notesInput) {
        notesInput.addEventListener("input", () => {
          if (notesCount) notesCount.textContent = `${notesInput.value.length}/280`;
        });
        notesInput.addEventListener("blur", async () => {
          state.session.notes = notesInput.value.slice(0, 280);
          await Store.save();
        });
      }
      if (notesSave) {
        notesSave.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          state.session.notes = notesInput.value.slice(0, 280);
          await Store.save();
          notesSave.textContent = "Saved";
          notesSave.style.color = "#10b981";
          setTimeout(() => {
            notesSave.textContent = "Save note";
            notesSave.style.color = "";
          }, 1500);
        });
      }
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
      if (hasEquityData) {
        setTimeout(() => this.drawEquityCurve(overlay, state), 100);
      }
    },
    drawEquityCurve(root, state) {
      const canvas = root.querySelector("#equity-canvas");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const history = state.session.equityHistory || [];
      if (history.length < 2) return;
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
      ctx.beginPath();
      ctx.strokeStyle = "#14b8a6";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      history.forEach((entry, i) => {
        const x = padding + i / (history.length - 1) * (w - padding * 2);
        const y = h - padding - (entry.equity - min) / range * (h - padding * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(20, 184, 166, 0.15)");
      grad.addColorStop(1, "rgba(20, 184, 166, 0)");
      ctx.lineTo(w - padding, h - padding);
      ctx.lineTo(padding, h - padding);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  };

  // src/modules/ui/insights.js
  init_store();
  var INSIGHTS_CSS = `
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
`;
  var Insights = {
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
                </div>
            </div>
        `;
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
        { label: "BEHAVIORAL ANALYSIS", features: ["ELITE_TILT_DETECTION", "ELITE_EMOTION_ANALYTICS", "ELITE_TRADER_PROFILE"] },
        { label: "TRADE INTELLIGENCE", features: ["ELITE_DISCIPLINE", "ELITE_STRATEGY_ANALYTICS", "ELITE_RISK_METRICS"] },
        { label: "SESSION & CONTEXT", features: ["ELITE_SESSION_REPLAY", "ELITE_AI_DEBRIEF", "ELITE_MARKET_CONTEXT", "ELITE_TRADE_PLAN"] }
      ];
      const featureMap = {};
      TEASED_FEATURES.ELITE.forEach((f) => {
        featureMap[f.id] = f;
      });
      let html = `
            <div class="insights-intro">
                Advanced Insights reveals why your results happen \u2014 not just what happened.
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
      const session = state.session || {};
      const behavior = state.behavior || {};
      return `
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
    }
  };

  // src/modules/ui/settings-panel.js
  init_store();
  init_diagnostics_store();
  var SettingsPanel = {
    /**
     * Show the full settings modal (replaces old mini-settings).
     */
    show() {
      const container = OverlayManager.getContainer();
      const existing = container.querySelector(".zero-settings-overlay");
      if (existing) existing.remove();
      const overlay = document.createElement("div");
      overlay.className = "confirm-modal-overlay zero-settings-overlay";
      const currentMode = Store.state.settings.tradingMode || "paper";
      const isElite = FeatureManager.isElite(Store.state);
      const diagState = DiagnosticsStore.state || {};
      const isAutoSend = diagState.settings?.privacy?.autoSendDiagnostics || false;
      const lastUpload = diagState.settings?.diagnostics?.lastUploadedEventTs || 0;
      const lastError = diagState.upload?.lastError || null;
      const queueLen = (diagState.upload?.queue || []).length;
      overlay.innerHTML = `
            <div class="settings-modal" style="width:440px; max-height:85vh; overflow-y:auto;">
                <div class="settings-header">
                    <div class="settings-title">${ICONS.MODE_PAPER} Settings</div>
                    <button class="settings-close">\xD7</button>
                </div>

                <!-- Mode Selection -->
                <div class="settings-section-title">Trading Mode</div>

                <div class="setting-row" style="flex-direction:column; align-items:stretch; gap:8px;">
                    <label class="mode-option ${currentMode === "paper" ? "active" : ""}" data-mode="paper" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid ${currentMode === "paper" ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.06)"}; background:${currentMode === "paper" ? "rgba(20,184,166,0.06)" : "transparent"};">
                        <input type="radio" name="tradingMode" value="paper" ${currentMode === "paper" ? "checked" : ""} style="accent-color:#14b8a6;">
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:600; color:#f8fafc; display:flex; align-items:center; gap:6px;">
                                ${ICONS.MODE_PAPER} Paper Mode
                                <span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(20,184,166,0.12); color:#14b8a6; font-weight:700;">FREE</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-top:3px;">Simulated trades. BUY / SELL HUD visible.</div>
                        </div>
                    </label>

                    <label class="mode-option ${currentMode === "analysis" ? "active" : ""}" data-mode="analysis" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid ${currentMode === "analysis" ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.06)"}; background:${currentMode === "analysis" ? "rgba(96,165,250,0.06)" : "transparent"};">
                        <input type="radio" name="tradingMode" value="analysis" ${currentMode === "analysis" ? "checked" : ""} style="accent-color:#60a5fa;">
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:600; color:#f8fafc; display:flex; align-items:center; gap:6px;">
                                ${ICONS.MODE_ANALYSIS} Analysis Mode
                                <span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(96,165,250,0.12); color:#60a5fa; font-weight:700;">FREE</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-top:3px;">Observes real trades only. No BUY / SELL HUD.</div>
                        </div>
                    </label>

                    <label class="mode-option ${currentMode === "shadow" ? "active" : ""}" data-mode="shadow" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid ${currentMode === "shadow" ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}; background:${currentMode === "shadow" ? "rgba(139,92,246,0.06)" : "transparent"}; ${!isElite ? "opacity:0.6;" : ""}">
                        <input type="radio" name="tradingMode" value="shadow" ${currentMode === "shadow" ? "checked" : ""} ${!isElite ? "disabled" : ""} style="accent-color:#a78bfa;">
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:600; color:#f8fafc; display:flex; align-items:center; gap:6px;">
                                ${ICONS.MODE_SHADOW} Shadow Mode
                                <span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(139,92,246,0.12); color:#a78bfa; font-weight:700;">ELITE</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-top:3px;">Observes real trades with elite behavioral analysis.${!isElite ? " Requires Elite." : ""}</div>
                        </div>
                    </label>
                </div>

                <div class="setting-row">
                     <div class="setting-info">
                        <div class="setting-name">Walkthrough</div>
                        <div class="setting-desc">Replay the introductory walkthrough.</div>
                    </div>
                    <button class="settings-action-btn" data-setting-act="replayWalkthrough" style="width:auto; padding:6px 12px; font-size:12px;">View walkthrough</button>
                </div>

                <!-- Privacy & Data -->
                <div class="settings-section-title">Optional diagnostics (off by default)</div>

                <div class="privacy-info-box">
                    <p>ZER\xD8 stores your paper trading data locally on your device by default.</p>
                    <p>You can optionally enable diagnostics to help improve ZER\xD8 and unlock deeper features over time. Diagnostics help us understand session flow, feature usage, and where tools break down \u2014 not your private trading decisions.</p>
                    <ul style="margin:8px 0 8px 16px; padding:0; list-style-type:disc; color:#94a3b8; font-size:11px;">
                        <li>Improves Elite features</li>
                        <li>Helps analytics become more accurate</li>
                        <li>Helps fix bugs faster</li>
                        <li>Shapes future tools based on real usage</li>
                    </ul>
                    <p style="margin-top:12px; font-weight:600; color:#f8fafc;">What is NOT included:</p>
                    <ul style="margin:4px 0 8px 16px; padding:0; list-style-type:disc; color:#ef4444; font-size:11px;">
                        <li>Real funds or wallet access</li>
                        <li>Private keys or credentials</li>
                        <li>Raw page content or keystrokes</li>
                        <li>Any data sold or shared with third parties</li>
                    </ul>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">Enable diagnostics</div>
                        <div class="setting-desc">Enable optional diagnostics to help improve ZER\xD8 and future features.</div>
                        <div class="setting-desc" style="opacity:0.6; margin-top:4px;">Some future features may improve faster with anonymized diagnostics enabled.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="autoSend" ${isAutoSend ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="diag-status">
                    <div class="diag-status-row">
                        <span class="diag-label">Uploads</span>
                        <span class="diag-value ${isAutoSend ? "enabled" : "disabled"}">${isAutoSend ? "Enabled" : "Disabled"}</span>
                    </div>
                    ${lastUpload > 0 ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Last upload</span>
                        <span class="diag-value">${new Date(lastUpload).toLocaleString()}</span>
                    </div>` : ""}
                    ${lastError ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Last error</span>
                        <span class="diag-value error">${lastError}</span>
                    </div>` : ""}
                    ${queueLen > 0 ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Queued packets</span>
                        <span class="diag-value">${queueLen}</span>
                    </div>` : ""}
                </div>

                <div class="settings-btn-row">
                    <button class="settings-action-btn" data-setting-act="viewPayload">View sample payload</button>
                    <button class="settings-action-btn danger" data-setting-act="deleteQueue">Delete queued uploads</button>
                    <button class="settings-action-btn danger" data-setting-act="deleteLocal">Delete local ZER\xD8 data</button>
                </div>

                <!-- Elite -->
                <div class="settings-section-title" style="display:flex; align-items:center; gap:8px;">
                    Elite
                    <span style="font-size:9px; font-weight:800; padding:2px 8px; border-radius:4px; background:${FeatureManager.isElite(Store.state) ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)"}; color:${FeatureManager.isElite(Store.state) ? "#10b981" : "#8b5cf6"}; letter-spacing:0.5px; text-transform:uppercase;">
                        ${FeatureManager.isElite(Store.state) ? "Active" : "Free"}
                    </span>
                </div>

                ${FeatureManager.isElite(Store.state) ? (() => {
        const ls = License.getStatus();
        const planLabel = License.getPlanLabel();
        const hasLicense = ls.status !== "none" && ls.maskedKey;
        return `
                <div style="padding:12px 16px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); border-radius:10px; margin-bottom:12px;">
                    <div style="font-size:12px; font-weight:600; color:#10b981; display:flex; align-items:center; gap:8px;">
                        Elite Active
                        ${planLabel ? `<span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(139,92,246,0.12); color:#a78bfa; font-weight:700;">${planLabel}</span>` : ""}
                    </div>
                    ${hasLicense ? `
                    <div style="font-size:11px; color:#64748b; margin-top:6px; display:flex; flex-direction:column; gap:3px;">
                        <div>License: <span style="color:#94a3b8; font-family:monospace;">${ls.maskedKey}</span></div>
                        ${ls.lastVerified ? `<div>Verified: ${new Date(ls.lastVerified).toLocaleDateString()}</div>` : ""}
                        ${ls.expiresAt ? `<div>Renews: ${new Date(ls.expiresAt).toLocaleDateString()}</div>` : ""}
                        ${ls.plan === "founders" ? `<div style="color:#a78bfa;">Lifetime access</div>` : ""}
                    </div>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button data-setting-act="manageMembership" class="settings-action-btn" style="font-size:11px; padding:5px 10px;">Manage on Whop</button>
                        <button data-setting-act="deactivateLicense" class="settings-action-btn danger" style="font-size:11px; padding:5px 10px;">Deactivate</button>
                    </div>
                    ` : `
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">All advanced insights and behavioral analytics are unlocked.</div>
                    `}
                </div>`;
      })() : `
                <div style="font-size:11px; color:#64748b; margin-bottom:12px; line-height:1.5;">
                    Unlock cross-session context and behavioral analytics.
                </div>
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                    ${TEASED_FEATURES.ELITE.map((f) => renderEliteLockedCard(f.name, f.desc)).join("")}
                </div>
                <button data-setting-act="showUpgradeModal" style="width:100%; background:linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; margin-bottom:8px;">
                    Upgrade to Elite
                </button>
                `}

                <div style="margin-top:20px; text-align:center; font-size:11px; color:#64748b;">
                    ZER\xD8 v${Store.state.version || "1.11.6"}
                </div>
            </div>
        `;
      container.appendChild(overlay);
      this._bind(overlay);
    },
    _bind(overlay) {
      const close = () => {
        overlay.remove();
        if (window.ZeroHUD && window.ZeroHUD.updateAll) window.ZeroHUD.updateAll();
      };
      overlay.querySelector(".settings-close").onclick = close;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      const modeRadios = overlay.querySelectorAll('input[name="tradingMode"]');
      modeRadios.forEach((radio) => {
        radio.onchange = async (e) => {
          const newMode = e.target.value;
          const success = await ModeManager.setMode(newMode);
          if (!success) {
            const currentRadio = overlay.querySelector(`input[name="tradingMode"][value="${ModeManager.getMode()}"]`);
            if (currentRadio) currentRadio.checked = true;
            return;
          }
          overlay.querySelectorAll(".mode-option").forEach((opt) => {
            const mode = opt.getAttribute("data-mode");
            const isActive = mode === newMode;
            const colors = { paper: "20,184,166", analysis: "96,165,250", shadow: "139,92,246" };
            const c = colors[mode] || colors.paper;
            opt.style.borderColor = isActive ? `rgba(${c},0.3)` : "rgba(255,255,255,0.06)";
            opt.style.background = isActive ? `rgba(${c},0.06)` : "transparent";
          });
          if (window.ZeroHUD && window.ZeroHUD.renderAll) window.ZeroHUD.renderAll();
        };
      });
      const autoSendToggle = overlay.querySelector('[data-setting="autoSend"]');
      if (autoSendToggle) {
        autoSendToggle.onchange = (e) => {
          if (e.target.checked) {
            this._showConsentModal(overlay, () => {
              DiagnosticsStore.enableAutoSend();
              this._refreshDiagStatus(overlay, true);
            }, () => {
              e.target.checked = false;
            });
          } else {
            DiagnosticsStore.disableAutoSend();
            this._refreshDiagStatus(overlay, false);
          }
        };
      }
      overlay.addEventListener("click", async (e) => {
        const act = e.target.getAttribute("data-setting-act");
        if (!act) {
          const card = e.target.closest(".feature-card.locked");
          if (card) {
            const featureId = card.getAttribute("data-feature");
            this._logFeatureClick(featureId);
            this._showComingSoonModal(overlay, featureId);
          }
          return;
        }
        if (act === "viewPayload") {
          this._showSamplePayload(overlay);
        }
        if (act === "replayWalkthrough") {
          overlay.remove();
          Professor.startWalkthrough(true);
        }
        if (act === "deleteQueue") {
          await DiagnosticsStore.clearUploadQueue();
          this._refreshDiagStatus(overlay, DiagnosticsStore.isAutoSendEnabled());
        }
        if (act === "deleteLocal") {
          this._showDeleteConfirm(overlay);
        }
        if (act === "showUpgradeModal") {
          overlay.remove();
          Paywall.showUpgradeModal();
        }
        if (act === "manageMembership") {
          window.open("https://whop.com/orders/", "_blank");
        }
        if (act === "deactivateLicense") {
          this._showDeactivateConfirm(overlay);
        }
      });
    },
    _refreshDiagStatus(overlay, isEnabled) {
      const statusEl = overlay.querySelector(".diag-status");
      if (!statusEl) return;
      const diagState = DiagnosticsStore.state || {};
      const lastUpload = diagState.settings?.diagnostics?.lastUploadedEventTs || 0;
      const lastError = diagState.upload?.lastError || null;
      const queueLen = (diagState.upload?.queue || []).length;
      statusEl.innerHTML = `
            <div class="diag-status-row">
                <span class="diag-label">Uploads</span>
                <span class="diag-value ${isEnabled ? "enabled" : "disabled"}">${isEnabled ? "Enabled" : "Disabled"}</span>
            </div>
            ${lastUpload > 0 ? `<div class="diag-status-row"><span class="diag-label">Last upload</span><span class="diag-value">${new Date(lastUpload).toLocaleString()}</span></div>` : ""}
            ${lastError ? `<div class="diag-status-row"><span class="diag-label">Last error</span><span class="diag-value error">${lastError}</span></div>` : ""}
            ${queueLen > 0 ? `<div class="diag-status-row"><span class="diag-label">Queued packets</span><span class="diag-value">${queueLen}</span></div>` : ""}
        `;
    },
    _showConsentModal(parent, onAccept, onDecline) {
      const modal = document.createElement("div");
      modal.className = "confirm-modal-overlay";
      modal.style.zIndex = "2147483648";
      modal.innerHTML = `
            <div class="confirm-modal" style="max-width:420px;">
                <h3>Help improve ZER\xD8 (optional)</h3>
                <p style="font-size:13px; line-height:1.6;">
                    By enabling diagnostics, ZER\xD8 will automatically send anonymized session logs, simulated trades, and feature interaction events to help improve accuracy, performance, and future features.
                </p>
                <p style="font-size:13px; line-height:1.6; margin-top:8px;">
                    This is optional, off by default, and can be disabled at any time.
                </p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm" style="background:rgba(20,184,166,0.8);">Enable diagnostics</button>
                </div>
            </div>
        `;
      parent.appendChild(modal);
      modal.querySelector(".cancel").onclick = () => {
        modal.remove();
        onDecline();
      };
      modal.querySelector(".confirm").onclick = () => {
        modal.remove();
        onAccept();
      };
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
          onDecline();
        }
      });
    },
    _showComingSoonModal(parent, featureId) {
      const feat = TEASED_FEATURES.ELITE.find((f) => f.id === featureId);
      const modal = document.createElement("div");
      modal.className = "confirm-modal-overlay";
      modal.style.zIndex = "2147483648";
      modal.innerHTML = `
            <div class="confirm-modal" style="max-width:380px; text-align:center;">
                <h3 style="color:#8b5cf6;">Available in Elite</h3>
                <p style="font-size:14px; font-weight:600; color:#f8fafc; margin-bottom:6px;">
                    ${feat ? feat.name : featureId}
                </p>
                <p style="font-size:13px; color:#94a3b8; margin-bottom:16px;">
                    ${feat ? feat.desc : ""} This feature is part of <strong style="color:#8b5cf6;">Elite</strong>.
                </p>
                <div class="confirm-modal-buttons" style="justify-content:center;">
                    <button class="confirm-modal-btn cancel">Close</button>
                </div>
            </div>
        `;
      parent.appendChild(modal);
      modal.querySelector(".cancel").onclick = () => modal.remove();
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });
    },
    _showSamplePayload(parent) {
      const sample = {
        uploadId: "sample-xxxxx",
        clientId: "<redacted>",
        createdAt: Date.now(),
        schemaVersion: 3,
        extensionVersion: Store.state.version || "1.11.6",
        eventsDelta: [
          { eventId: "evt_sample1", ts: Date.now() - 6e4, type: "SESSION_STARTED", platform: "AXIOM", payload: {} },
          { eventId: "evt_sample2", ts: Date.now() - 3e4, type: "TRADE_OPENED", platform: "AXIOM", payload: { side: "BUY", symbol: "TOKEN" } },
          { eventId: "evt_sample3", ts: Date.now(), type: "TRADE_CLOSED", platform: "AXIOM", payload: { side: "SELL", pnl: 0.05 } }
        ]
      };
      const modal = document.createElement("div");
      modal.className = "confirm-modal-overlay";
      modal.style.zIndex = "2147483648";
      modal.innerHTML = `
            <div class="confirm-modal" style="max-width:500px;">
                <h3>Sample upload payload</h3>
                <pre style="background:#0d1117; border:1px solid rgba(20,184,166,0.15); border-radius:8px; padding:12px; font-size:11px; color:#94a3b8; overflow-x:auto; max-height:300px; white-space:pre-wrap; word-break:break-all;">${JSON.stringify(sample, null, 2)}</pre>
                <p style="font-size:11px; color:#64748b; margin-top:8px;">
                    This is a sample of what would be sent. Real payloads contain only event IDs, timestamps, types, and small scalar values. No DOM content, keystrokes, wallet data, or personal information.
                </p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Close</button>
                </div>
            </div>
        `;
      parent.appendChild(modal);
      modal.querySelector(".cancel").onclick = () => modal.remove();
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });
    },
    _showDeleteConfirm(parent) {
      const modal = document.createElement("div");
      modal.className = "confirm-modal-overlay";
      modal.style.zIndex = "2147483648";
      modal.innerHTML = `
            <div class="confirm-modal">
                <h3>Delete all local data?</h3>
                <p>This will permanently delete all ZER\xD8 diagnostics data, event logs, and upload queue from your browser. Your trading session data (stored under a separate key) is unaffected.</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">Delete</button>
                </div>
            </div>
        `;
      parent.appendChild(modal);
      modal.querySelector(".cancel").onclick = () => modal.remove();
      modal.querySelector(".confirm").onclick = async () => {
        await DiagnosticsStore.clearAllData();
        modal.remove();
      };
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });
    },
    _showDeactivateConfirm(parent) {
      const modal = document.createElement("div");
      modal.className = "confirm-modal-overlay";
      modal.style.zIndex = "2147483648";
      modal.innerHTML = `
            <div class="confirm-modal">
                <h3>Deactivate Elite?</h3>
                <p>This will remove your license key from this browser and revert to the Free tier. You can re-activate anytime with your license key.</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">Deactivate</button>
                </div>
            </div>
        `;
      parent.appendChild(modal);
      modal.querySelector(".cancel").onclick = () => modal.remove();
      modal.querySelector(".confirm").onclick = async () => {
        await License.deactivate();
        modal.remove();
        parent.remove();
        this.show();
      };
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });
    },
    _logFeatureClick(featureId) {
      DiagnosticsStore.logEvent("UI_LOCKED_FEATURE_CLICKED", { featureId });
    }
  };

  // src/modules/ui/pnl-hud.js
  function px(n) {
    return n + "px";
  }
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  var positionsExpanded = false;
  var PnlHud = {
    mountPnlHud(makeDraggable) {
      const container = OverlayManager.getContainer();
      const rootId = IDS.pnlHud;
      let root = container.querySelector("#" + rootId);
      if (!Store.state.settings.enabled) {
        if (root) root.style.display = "none";
        return;
      }
      if (root) root.style.display = "";
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
      const CURRENT_UI_VERSION = "1.12.0";
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
                <div class="title"><div><span class="dot"></span> ZER\xD8 PNL</div><span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);margin-left:10px;">TOKEN</span></div>
                <div class="controls">
                  <div class="startSol">
                    <span style="font-weight:700;color:rgba(203,213,225,0.92);font-size:10px;">Start</span>
                    <input class="startSolInput" type="text" inputmode="decimal" />
                  </div>
                  <button class="pillBtn" data-act="shareX" style="background:rgba(29,155,240,0.15);color:#1d9bf0;border:1px solid rgba(29,155,240,0.3);font-family:'Arial',sans-serif;font-weight:600;display:none;" id="pnl-share-btn">Share \u{1D54F}</button>
                  <button class="pillBtn" data-act="trades">Trades</button>
                  <button class="pillBtn" data-act="dashboard" style="background:rgba(20,184,166,0.15);color:#14b8a6;border:1px solid rgba(20,184,166,0.3);font-weight:700;">Stats</button>
                  <button class="pillBtn" data-act="insights" style="background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);font-weight:700;">Insights</button>
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
                    <div class="k">DISCIPLINE</div>
                    <div class="v" data-k="discipline">100</div>
                </div>
              </div>
              <div class="positionsPanel">
                <div class="positionsHeader" data-act="togglePositions">
                  <div class="positionsTitle">
                    <span>POSITIONS</span>
                    <span class="positionCount" data-k="positionCount">(0)</span>
                  </div>
                  <span class="positionsToggle">\u25BC</span>
                </div>
                <div class="positionsList" style="display:none;" data-k="positionsList"></div>
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
      if (!header || !makeDraggable) return;
      makeDraggable(header, (dx, dy) => {
        if (Store.state.settings.pnlDocked) return;
        const s = Store.state.settings;
        s.pnlPos.x = clamp(s.pnlPos.x + dx, 0, window.innerWidth - 40);
        s.pnlPos.y = clamp(s.pnlPos.y + dy, 34, window.innerHeight - 40);
        root.style.left = px(s.pnlPos.x);
        root.style.top = px(s.pnlPos.y);
      }, async () => {
        if (!Store.state.settings.pnlDocked) await Store.save();
      });
    },
    bindPnlEvents(root) {
      root.addEventListener("click", async (e) => {
        const t = e.target;
        if (t.matches("input, label")) return;
        const actEl = t.closest("[data-act]");
        if (!actEl) return;
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
        if (act === "insights") {
          Insights.toggle();
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
        if (act === "togglePositions") {
          positionsExpanded = !positionsExpanded;
          this.updatePositionsPanel(root);
        }
        if (act === "quickSell") {
          const mint = actEl.getAttribute("data-mint");
          const pct = parseFloat(actEl.getAttribute("data-pct"));
          await this.executeQuickSell(mint, pct);
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
      if (!root || !Store.state) return;
      const s = Store.state;
      const shareFlags = FeatureManager.resolveFlags(s, "SHARE_TO_X");
      const shareBtn = root.querySelector("#pnl-share-btn");
      if (shareBtn) shareBtn.style.display = shareFlags.visible && !shareFlags.gated ? "" : "none";
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
      if (document.activeElement !== inp) inp.value = s.settings.startSol;
      root.querySelector('[data-k="balance"]').textContent = `${Trading.fmtSol(s.session.balance)} SOL`;
      const currentMC = Market.marketCap || 0;
      let unrealizedPct = 0;
      for (const p of Object.values(s.positions || {})) {
        if (p && p.qtyTokens > 0 && p.entryMarketCapUsdReference > 0 && currentMC > 0) {
          unrealizedPct = (currentMC / p.entryMarketCapUsdReference - 1) * 100;
          break;
        }
      }
      if (unrealizedPct === 0 && unrealized !== 0) {
        const positions = Object.values(s.positions || {});
        const totalInvested = positions.reduce((sum, pos) => sum + (pos.totalSolSpent || 0), 0);
        unrealizedPct = totalInvested > 0 ? unrealized / totalInvested * 100 : 0;
      }
      const tokenValueEl = root.querySelector('[data-k="tokenValue"]');
      const tokenUnitEl = root.querySelector('[data-k="tokenUnit"]');
      if (tokenValueEl && tokenUnitEl) {
        const showUsd = s.settings.tokenDisplayUsd;
        if (showUsd) {
          const unrealizedUsd = unrealized * solUsd;
          tokenValueEl.textContent = (unrealizedUsd >= 0 ? "+" : "") + "$" + Trading.fmtSol(Math.abs(unrealizedUsd));
          tokenUnitEl.textContent = "USD";
        } else {
          tokenValueEl.textContent = (unrealized >= 0 ? "+" : "") + unrealized.toFixed(3) + ` (${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(1)}%)`;
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
          pnlEl.textContent = (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(3) + ` (${sessionPct >= 0 ? "+" : ""}${sessionPct.toFixed(1)}%)`;
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
      if (discStatEl) {
        discStatEl.style.display = discFlags.visible && !discFlags.gated ? "" : "none";
      }
      const tokenSymbolEl = root.querySelector('[data-k="tokenSymbol"]');
      if (tokenSymbolEl) {
        const symbol = currentToken?.symbol || "TOKEN";
        tokenSymbolEl.textContent = symbol;
      }
      this.updatePositionsPanel(root);
    },
    showResetModal() {
      const overlay = document.createElement("div");
      overlay.className = "confirm-modal-overlay";
      const duration = Store.getSessionDuration();
      const summary = Store.getSessionSummary();
      overlay.innerHTML = `
            <div class="confirm-modal">
                <h3>Reset current session?</h3>
                <p>This will clear current session stats and start a fresh run.<br>Your trade history and past sessions will not be deleted.</p>
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
                    <button class="confirm-modal-btn confirm">Reset session</button>
                </div>
            </div>
        `;
      OverlayManager.getContainer().appendChild(overlay);
      overlay.querySelector(".cancel").onclick = () => overlay.remove();
      overlay.querySelector(".confirm").onclick = async () => {
        await Store.startNewSession();
        Store.state.positions = {};
        await Store.save();
        window.postMessage({ __paper: true, type: "PAPER_CLEAR_MARKERS" }, "*");
        if (window.ZeroHUD && window.ZeroHUD.updateAll) {
          window.ZeroHUD.updateAll();
        }
        overlay.remove();
        overlay.remove();
      };
    },
    showDisciplineInfoModal() {
      const overlay = document.createElement("div");
      overlay.className = "confirm-modal-overlay";
      overlay.style.zIndex = "2147483648";
      overlay.innerHTML = `
                <div class="confirm-modal" style="max-width:380px; text-align:center;">
                    <h3>Discipline scoring</h3>
                    <p style="font-size:13px; line-height:1.6; color:#94a3b8; margin-bottom:16px;">
                        Discipline scoring analyzes how consistently you follow your plan and manage risk. Available in Elite.
                    </p>
                    <div class="confirm-modal-buttons" style="justify-content:center;">
                        <button class="confirm-modal-btn cancel">Close</button>
                    </div>
                </div>
            `;
      OverlayManager.getContainer().appendChild(overlay);
      overlay.querySelector(".cancel").onclick = () => overlay.remove();
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });
    },
    showSettingsModal() {
      SettingsPanel.show();
    },
    updateTradeList(container) {
      const trades = Store.state.session.trades || [];
      const tradeObjs = trades.map((id) => Store.state.trades[id]).filter((t) => t).reverse();
      let html = "";
      tradeObjs.forEach((t) => {
        const side = t.side === "ENTRY" ? "BUY" : t.side === "EXIT" ? "SELL" : t.side;
        const isBuy = side === "BUY";
        let valStr = "";
        let pnlClass = "muted";
        if (isBuy) {
          valStr = `${t.solAmount?.toFixed(3) || "0.1"} SOL`;
        } else {
          const isWin = (t.realizedPnlSol || 0) > 0;
          pnlClass = isWin ? "buy" : t.realizedPnlSol < 0 ? "sell" : "muted";
          valStr = (t.realizedPnlSol ? (t.realizedPnlSol > 0 ? "+" : "") + t.realizedPnlSol.toFixed(4) : "0.00") + " SOL";
        }
        const mc = t.marketCapUsdAtFill || t.marketCap || 0;
        let mcStr = "";
        if (mc > 0) {
          if (mc >= 1e9) {
            mcStr = `$${(mc / 1e9).toFixed(2)}B`;
          } else if (mc >= 1e6) {
            mcStr = `$${(mc / 1e6).toFixed(2)}M`;
          } else if (mc >= 1e3) {
            mcStr = `$${(mc / 1e3).toFixed(1)}K`;
          } else {
            mcStr = `$${mc.toFixed(0)}`;
          }
        }
        html += `
                <div class="tradeRow">
                    <div class="muted" style="font-size:9px;">${new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    <div class="tag ${side.toLowerCase()}">${side}</div>
                    <div style="flex:1;">
                        <div>${t.symbol}</div>
                    </div>
                    <div class="${pnlClass}" style="text-align:right;">
                        ${valStr}${mcStr ? ` <span class="muted" style="font-size:9px;opacity:0.8;">@ ${mcStr}</span>` : ""}
                    </div>
                </div>
            `;
      });
      container.innerHTML = html || '<div style="padding:10px;color:#64748b;text-align:center;">No trades yet</div>';
    },
    updatePositionsPanel(root) {
      const s = Store.state;
      const positions = Object.values(s.positions || {}).filter((p) => p.qtyTokens > 0);
      const listEl = root.querySelector('[data-k="positionsList"]');
      const toggleIcon = root.querySelector(".positionsToggle");
      const countEl = root.querySelector('[data-k="positionCount"]');
      if (countEl) {
        countEl.textContent = `(${positions.length})`;
      }
      if (toggleIcon) {
        toggleIcon.textContent = positionsExpanded ? "\u25B2" : "\u25BC";
        toggleIcon.classList.toggle("expanded", positionsExpanded);
      }
      if (listEl) {
        listEl.style.display = positionsExpanded ? "block" : "none";
        if (positionsExpanded) {
          listEl.innerHTML = this.renderPositionRows(positions);
        }
      }
    },
    renderPositionRows(positions) {
      if (positions.length === 0) {
        return '<div class="noPositions">No open positions</div>';
      }
      const solUsd = Trading.getSolPrice();
      const currentToken = TokenDetector.getCurrentToken();
      return positions.map((pos) => {
        let currentPrice = pos.lastMarkPriceUsd || pos.avgCostUsdPerToken || 0;
        const currentValueUsd = pos.qtyTokens * currentPrice;
        const unrealizedPnlUsd = currentValueUsd - (pos.costBasisUsd || 0);
        const pnl = unrealizedPnlUsd / solUsd;
        const pnlPct = pos.costBasisUsd > 0 ? unrealizedPnlUsd / pos.costBasisUsd * 100 : 0;
        const isPositive = pnl >= 0;
        return `
                <div class="positionRow">
                    <div class="positionInfo">
                        <div class="positionSymbol">${pos.symbol || "UNKNOWN"}</div>
                        <div class="positionDetails">
                            <span class="positionQty">${this.formatQty(pos.qtyTokens)} tokens</span>
                            <span class="positionPrices">Avg: $${this.formatPrice(pos.avgCostUsdPerToken)} \u2192 $${this.formatPrice(currentPrice)}</span>
                        </div>
                    </div>
                    <div class="positionPnl ${isPositive ? "positive" : "negative"}">
                        <div class="pnlValue">${isPositive ? "+" : ""}${Trading.fmtSol(pnl)} SOL</div>
                        <div class="pnlPct">${isPositive ? "+" : ""}${pnlPct.toFixed(1)}%</div>
                    </div>
                    <div class="quickSellBtns">
                        <button class="qSellBtn" data-act="quickSell" data-mint="${pos.mint}" data-pct="25">25%</button>
                        <button class="qSellBtn" data-act="quickSell" data-mint="${pos.mint}" data-pct="50">50%</button>
                        <button class="qSellBtn" data-act="quickSell" data-mint="${pos.mint}" data-pct="100">100%</button>
                    </div>
                </div>
            `;
      }).join("");
    },
    formatQty(n) {
      if (!n || n <= 0) return "0";
      if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
      if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
      if (n >= 1) return n.toFixed(2);
      return n.toFixed(6);
    },
    formatPrice(p) {
      if (!p || p <= 0) return "0.00";
      if (p >= 1) return p.toFixed(4);
      if (p >= 1e-4) return p.toFixed(6);
      const leadingZeros = Math.floor(-Math.log10(p));
      return p.toFixed(leadingZeros + 3);
    },
    async executeQuickSell(mint, pct) {
      const pos = Store.state.positions[mint];
      if (!pos) {
        console.error("[PnlHud] Position not found for mint:", mint);
        return;
      }
      const tokenInfo = { symbol: pos.symbol, mint: pos.mint };
      const result = await Trading.sell(pct, "Quick Sell", tokenInfo);
      if (result.success) {
        console.log(`[PnlHud] Quick sell ${pct}% of ${pos.symbol} successful`);
        if (result.trade && result.trade.id) {
          const fullTrade = Store.state.trades && Store.state.trades[result.trade.id] ? Store.state.trades[result.trade.id] : Store.state.fills ? Store.state.fills.find((f) => f.id === result.trade.id) : null;
          if (fullTrade) {
            const bridgeTrade = {
              ...fullTrade,
              side: fullTrade.side === "ENTRY" ? "BUY" : fullTrade.side === "EXIT" ? "SELL" : fullTrade.side,
              priceUsd: fullTrade.fillPriceUsd || fullTrade.priceUsd,
              marketCap: fullTrade.marketCapUsdAtFill || fullTrade.marketCap
            };
            window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade: bridgeTrade }, "*");
          }
        }
        if (window.ZeroHUD && window.ZeroHUD.updateAll) {
          window.ZeroHUD.updateAll();
        }
      } else {
        console.error("[PnlHud] Quick sell failed:", result.error);
      }
    }
  };

  // src/modules/ui/buy-hud.js
  init_store();
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
    tradePlanExpanded: false,
    lastEmotionTradeId: null,
    // Debounce: one prompt per trade
    // State for reuse
    makeDraggableRef: null,
    mountBuyHud(makeDraggable, force = false) {
      if (makeDraggable) this.makeDraggableRef = makeDraggable;
      const dragger = makeDraggable || this.makeDraggableRef;
      const container = OverlayManager.getContainer();
      const rootId = IDS.buyHud;
      let root = container.querySelector("#" + rootId);
      if (!Store.state.settings.enabled) {
        if (root) root.style.display = "none";
        return;
      }
      if (root) root.style.display = "";
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
        this.renderBuyHudContent(root, dragger);
        this.setupBuyHudInteractions(root);
      } else if (force) {
        this.renderBuyHudContent(root, dragger);
      } else {
        this.refreshMarketContext(root);
      }
    },
    refreshMarketContext(root) {
      const container = root.querySelector(".market-context-container");
      if (container) {
        container.innerHTML = this.renderMarketContext().replace('<div class="market-context-container" style="margin-bottom:12px;">', "").replace(/<\/div>\s*$/, "");
      }
    },
    renderBuyHudContent(root, makeDraggable) {
      const isBuy = this.buyHudTab === "buy";
      const actionText = isBuy ? "ZER\xD8 BUY" : "ZER\xD8 SELL";
      const actionClass = isBuy ? "action" : "action sell";
      const label = isBuy ? "Amount (SOL)" : "Amount (%)";
      const oldField = root.querySelector('input[data-k="field"]');
      const oldVal = oldField ? oldField.value : "";
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
                    <input class="field" type="text" inputmode="decimal" data-k="field" placeholder="0.0" value="${oldVal}">

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
      if (!header || !makeDraggable) return;
      makeDraggable(header, (dx, dy) => {
        if (Store.state.settings.buyHudDocked) return;
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
        if (!Store.state.settings.buyHudDocked) await Store.save();
      });
    },
    setupBuyHudInteractions(root) {
      root.addEventListener("click", async (e) => {
        const t = e.target;
        if (t.matches("input") || t.matches("select")) return;
        const actEl = t.closest("[data-act]");
        if (!actEl) return;
        const act = actEl.getAttribute("data-act");
        e.preventDefault();
        if (act === "dock") {
          Store.state.settings.buyHudDocked = !Store.state.settings.buyHudDocked;
          await Store.save();
          this.updateBuyHud();
        }
        if (act === "tab-buy") {
          this.buyHudTab = "buy";
          this.mountBuyHud(null, true);
        }
        if (act === "tab-sell") {
          this.buyHudTab = "sell";
          this.mountBuyHud(null, true);
        }
        if (act === "quick") {
          const val = actEl.getAttribute("data-val");
          const field2 = root.querySelector('input[data-k="field"]');
          if (field2) {
            field2.value = val;
            await this.executeTrade(root);
          }
        }
        if (act === "action") {
          await this.executeTrade(root);
        }
        if (act === "upgrade-plan") {
          Paywall.showUpgradeModal("TRADE_PLAN");
        }
        if (act === "edit") {
          this.buyHudEdit = !this.buyHudEdit;
          this.mountBuyHud();
        }
        if (act === "toggle-plan") {
          this.tradePlanExpanded = !this.tradePlanExpanded;
          this.mountBuyHud();
        }
      });
    },
    showEmotionSelector(tradeId) {
      const emoFlags = FeatureManager.resolveFlags(Store.state, "EMOTION_TRACKING");
      if (!emoFlags.enabled || Store.state.settings.showJournal === false) return;
      if (!tradeId || tradeId === this.lastEmotionTradeId) return;
      this.lastEmotionTradeId = tradeId;
      const container = OverlayManager.getContainer();
      const existing = container.querySelector(".emotion-modal-overlay");
      if (existing) existing.remove();
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
        { id: "calm", label: "Calm", icon: ICONS.EMO_CALM },
        { id: "anxious", label: "Anxious", icon: ICONS.EMO_ANXIOUS },
        { id: "excited", label: "Excited", icon: ICONS.EMO_EXCITED },
        { id: "angry", label: "Angry/Rev", icon: ICONS.EMO_ANGRY },
        { id: "bored", label: "Bored", icon: ICONS.EMO_BORED },
        { id: "confident", label: "Confident", icon: ICONS.EMO_CONFIDENT }
      ];
      overlay.innerHTML = `
            <div class="emotion-modal" style="position:absolute; pointer-events:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(20,184,166,0.2); width:320px;">
                <div class="emotion-title">POST-TRADE CHECK</div>
                <div class="emotion-subtitle">How are you feeling right now?</div>
                <div class="emotion-grid">
                    ${emotions.map((e) => `
                        <button class="emotion-btn" data-emo="${e.id}">
                            <span class="emotion-icon">${e.icon}</span> ${e.label}
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
      if (!root || !Store.state) return;
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
      if (!Store.state) return "";
      const flags = FeatureManager.resolveFlags(Store.state, "MARKET_CONTEXT");
      if (!flags.visible) return "";
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
      if (!Store.state) return "";
      const flags = FeatureManager.resolveFlags(Store.state, "TRADE_PLAN");
      if (!flags.visible) return "";
      const isGated = flags.gated;
      const isExpanded = this.tradePlanExpanded;
      const plan = Store.state.pendingPlan || {};
      if (!isExpanded) {
        return `
                <div class="plan-toggle" data-act="toggle-plan" style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="display:flex; align-items:center; gap:6px;">
                        ${ICONS.TARGET} ${isGated ? "TRADE PLAN (ELITE)" : "ADD TRADE PLAN"}
                    </span>
                    ${ICONS.CHEVRON_DOWN}
                </div>
            `;
      }
      if (isGated) {
        return `
                <div class="trade-plan-section gated">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span class="plan-title">${ICONS.TARGET} Trade Plan</span>
                        <div class="plan-collapse-arrow" data-act="toggle-plan">${ICONS.CHEVRON_UP}</div>
                    </div>
                    <div data-act="upgrade-plan">
                        <div class="plan-gated-badge">
                            ${ICONS.LOCK}
                            <span>TRADE PLAN (ELITE)</span>
                        </div>
                        <div class="plan-gated-hint">Define stop loss, targets & thesis</div>
                    </div>
                </div>
            `;
      }
      return `
            <div class="trade-plan-section">
                <div class="plan-header">
                    <span class="plan-title">${ICONS.TARGET} Trade Plan</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="plan-tag">ELITE</span>
                        <div class="plan-collapse-arrow" data-act="toggle-plan">${ICONS.CHEVRON_UP}</div>
                    </div>
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
      if (stopEl) stopEl.value = "";
      if (targetEl) targetEl.value = "";
      if (thesisEl) thesisEl.value = "";
    },
    async executeTrade(root) {
      const field2 = root.querySelector('input[data-k="field"]');
      const val = parseFloat(field2?.value || "0");
      const status = root.querySelector('[data-k="status"]');
      const strategyEl = root.querySelector('select[data-k="strategy"]');
      const strategy = strategyEl ? strategyEl.value : "Trend";
      if (val <= 0) {
        if (status) status.textContent = "Invalid amount";
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
        status.textContent = "Trade logged!";
        field2.value = "";
        if (res.trade && res.trade.id) {
          const fullTrade = Store.state.trades && Store.state.trades[res.trade.id] ? Store.state.trades[res.trade.id] : Store.state.fills ? Store.state.fills.find((f) => f.id === res.trade.id) : null;
          if (fullTrade) {
            const bridgeTrade = {
              ...fullTrade,
              side: fullTrade.side === "ENTRY" ? "BUY" : fullTrade.side === "EXIT" ? "SELL" : fullTrade.side,
              priceUsd: fullTrade.fillPriceUsd || fullTrade.priceUsd,
              marketCap: fullTrade.marketCapUsdAtFill || fullTrade.marketCap
            };
            window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade: bridgeTrade }, "*");
          }
        }
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
  };

  // src/modules/ui/shadow-hud.js
  init_store();

  // src/services/socialx/types.js
  var FIELD_STATUS = {
    OK: "ok",
    MISSING_IDENTIFIER: "missing_identifier",
    NOT_SUPPORTED: "not_supported",
    PROVIDER_ERROR: "provider_error",
    RATE_LIMITED: "rate_limited",
    STALE_CACHED: "stale_cached"
  };
  var SOCIALX_SOURCE = {
    OBSERVED: "observed",
    API: "api",
    SCRAPE: "scrape",
    AGGREGATOR: "aggregator"
  };
  var SCHEMA_VERSION2 = "1.0";

  // src/services/context/client.js
  var CONTEXT_API_BASE = "https://api.get-zero.xyz";
  var CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
  var MAX_CACHE = 30;
  var STORAGE_PREFIX = "zero_ctx_";
  var _cache = {};
  var _inflight = {};
  async function fetchContext({ ca, existingDexInfo }) {
    if (!ca) return _emptyResponse("");
    const cached = _cache[ca];
    if (cached && Date.now() - cached.fetchedTs < CACHE_TTL_MS) {
      return cached.response;
    }
    if (_inflight[ca]) {
      return _inflight[ca];
    }
    const promise = _fetchContextImpl({ ca, existingDexInfo });
    _inflight[ca] = promise;
    try {
      return await promise;
    } finally {
      delete _inflight[ca];
    }
  }
  async function _fetchContextImpl({ ca }) {
    try {
      const url = `${CONTEXT_API_BASE}/context?chain=solana&ca=${encodeURIComponent(ca)}`;
      const response = await proxyFetch(url);
      if (response.ok && response.data) {
        const ctx = (
          /** @type {ContextResponseV1} */
          response.data
        );
        if (!ctx.schemaVersion) ctx.schemaVersion = SCHEMA_VERSION2;
        if (!ctx.fetchedAt) ctx.fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
        _cacheAndPersist(ca, ctx);
        console.log("[MarketContext] context loaded", ca.slice(0, 8));
        return ctx;
      }
      console.warn("[MarketContext] API response not ok, attempting rehydration");
      const stored = await _rehydrateFromStorage(ca);
      if (stored) {
        _markStale(stored);
        return stored;
      }
      return _emptyResponse(ca);
    } catch (e) {
      const msg = e?.message || "";
      console.warn("[MarketContext] Fetch failed, attempting rehydration:", msg);
      const stored = await _rehydrateFromStorage(ca);
      if (stored) {
        _markStale(stored);
        return stored;
      }
      return _emptyResponse(ca);
    }
  }
  function _markStale(ctx) {
    if (ctx.links?.website?.status === FIELD_STATUS.OK) {
      ctx.links.website.status = FIELD_STATUS.STALE_CACHED;
    }
    if (ctx.links?.x?.status === FIELD_STATUS.OK) {
      ctx.links.x.status = FIELD_STATUS.STALE_CACHED;
    }
    if (ctx.website?.status === FIELD_STATUS.OK) {
      ctx.website.status = FIELD_STATUS.STALE_CACHED;
    }
    if (ctx.dev?.status === FIELD_STATUS.OK) {
      ctx.dev.status = FIELD_STATUS.STALE_CACHED;
    }
    if (ctx.x?.communities?.status === FIELD_STATUS.OK) {
      ctx.x.communities.status = FIELD_STATUS.STALE_CACHED;
    }
    if (ctx.x?.profile?.status === FIELD_STATUS.OK) {
      ctx.x.profile.status = FIELD_STATUS.STALE_CACHED;
    }
    if (ctx.x?.profile?.enrichmentStatus === FIELD_STATUS.OK) {
      ctx.x.profile.enrichmentStatus = FIELD_STATUS.STALE_CACHED;
    }
  }
  function _emptyResponse(ca) {
    return {
      schemaVersion: SCHEMA_VERSION2,
      token: { ca: ca || "" },
      links: {
        website: { url: null, status: FIELD_STATUS.MISSING_IDENTIFIER },
        x: { url: null, status: FIELD_STATUS.MISSING_IDENTIFIER }
      },
      website: {
        url: null,
        domain: null,
        title: null,
        metaDescription: null,
        domainAgeDays: null,
        statusCode: null,
        tls: null,
        redirects: null,
        lastFetched: null,
        status: FIELD_STATUS.MISSING_IDENTIFIER
      },
      x: {
        profile: { url: null, handle: null, status: FIELD_STATUS.MISSING_IDENTIFIER },
        communities: { items: [], status: FIELD_STATUS.MISSING_IDENTIFIER, lastFetched: null }
      },
      dev: {
        mintAgeDays: null,
        deployer: null,
        deployerMints30d: null,
        mintAuthority: void 0,
        freezeAuthority: void 0,
        metadataMutable: null,
        devHoldingsPct: null,
        deployerBalanceSol: null,
        deployerAgeDays: null,
        recentMints7d: null,
        status: FIELD_STATUS.NOT_SUPPORTED,
        lastFetched: null
      },
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function _cacheAndPersist(ca, response) {
    _cache[ca] = { response, fetchedTs: Date.now() };
    const keys = Object.keys(_cache);
    if (keys.length > MAX_CACHE) {
      const sorted = keys.sort((a, b) => _cache[a].fetchedTs - _cache[b].fetchedTs);
      sorted.slice(0, keys.length - MAX_CACHE).forEach((k) => delete _cache[k]);
    }
    _persistToStorage(ca, response);
  }
  function _persistToStorage(ca, response) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return;
      const key = STORAGE_PREFIX + ca.slice(0, 12);
      chrome.storage.local.set({ [key]: { response, ts: Date.now() } });
    } catch (_) {
    }
  }
  async function _rehydrateFromStorage(ca) {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
      const key = STORAGE_PREFIX + ca.slice(0, 12);
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const stored = res[key];
          if (stored && stored.response && Date.now() - stored.ts < CACHE_TTL_MS) {
            _cache[ca] = { response: stored.response, fetchedTs: stored.ts };
            resolve(stored.response);
          } else {
            resolve(null);
          }
        });
      });
    } catch (_) {
      return null;
    }
  }

  // src/services/socialx/observed-adapter.js
  function parseXHandle(url) {
    if (!url || typeof url !== "string") return null;
    try {
      const cleaned = url.trim().replace(/\/+$/, "").split("?")[0].split("#")[0];
      const match = cleaned.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})$/i);
      if (match) return match[1].toLowerCase();
    } catch (_) {
    }
    return null;
  }
  var ObservedSocialXAdapter = {
    /**
     * Get an observed social profile for a token.
     * @param {{ ca: string, discoveredXUrl?: string|null, discoveredSiteUrl?: string|null, discoveredFrom?: string[] }} input
     * @returns {Promise<import('./types.js').SocialXProfile>}
     */
    async getProfile(input) {
      const { discoveredXUrl, discoveredFrom } = input || {};
      const handle = parseXHandle(discoveredXUrl);
      const presence = !!(handle && discoveredXUrl);
      return {
        handle: handle ? `@${handle}` : null,
        url: discoveredXUrl || null,
        presence,
        ageBucket: "unknown",
        activityBucket: "unknown",
        followerCount: null,
        verified: null,
        caDetected: null,
        evidence: {
          discoveredFrom: discoveredFrom || (discoveredXUrl ? ["context_links"] : []),
          notes: presence ? ["Handle parsed from discovered URL"] : ["No X URL discovered"]
        },
        source: SOCIALX_SOURCE.OBSERVED,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        status: presence ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER
      };
    }
  };

  // src/services/context/statusText.js
  function statusToText(status) {
    switch (status) {
      case FIELD_STATUS.OK:
        return "";
      // Caller uses the actual value
      case FIELD_STATUS.MISSING_IDENTIFIER:
        return "Not detected";
      case FIELD_STATUS.NOT_SUPPORTED:
        return "Not detected";
      case FIELD_STATUS.PROVIDER_ERROR:
        return "Temporarily unavailable";
      case FIELD_STATUS.RATE_LIMITED:
        return "Temporarily unavailable";
      case FIELD_STATUS.STALE_CACHED:
        return "Cached (updating\u2026)";
      default:
        return "Not detected";
    }
  }

  // src/services/context/view-model.js
  function field(value, display, status) {
    return { value, display, status };
  }
  function phase1NotFetched() {
    return field(null, "Not fetched in Phase 1", FIELD_STATUS.NOT_SUPPORTED);
  }
  function enrichmentField(enrichmentStatus) {
    return field(null, statusToText(enrichmentStatus || FIELD_STATUS.NOT_SUPPORTED), enrichmentStatus || FIELD_STATUS.NOT_SUPPORTED);
  }
  function truncateUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 20) + "..." : "");
    } catch (_) {
      return url.slice(0, 30) + "...";
    }
  }
  function truncateAddress(addr) {
    if (!addr || addr.length < 12) return addr || "";
    return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
  }
  function formatCount(n) {
    if (n == null) return "";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function buildMarketContextViewModel(context, social) {
    return {
      xAccount: _buildXAccountVM(context, social),
      website: _buildWebsiteVM(context),
      developer: _buildDeveloperVM(context),
      lastUpdated: context?.fetchedAt || null
    };
  }
  function _buildXAccountVM(context, social) {
    const presence = social?.presence || false;
    const xStatus = context?.links?.x?.status || FIELD_STATUS.MISSING_IDENTIFIER;
    const profile = context?.x?.profile;
    const enrichStatus = profile?.enrichmentStatus || FIELD_STATUS.NOT_SUPPORTED;
    const isEnriched = enrichStatus === FIELD_STATUS.OK || enrichStatus === FIELD_STATUS.STALE_CACHED;
    const xComm = context?.x?.communities;
    const commStatus = xComm?.status || FIELD_STATUS.NOT_SUPPORTED;
    const commItems = (xComm?.items || []).map((item) => ({
      name: item.name || "X Community",
      url: item.url || "",
      display: item.name || "X Community",
      memberCount: item.memberCount ?? null,
      activityLevel: item.activityLevel || "unknown"
    }));
    let ageField;
    if (isEnriched && profile.accountAgeDays != null) {
      const days = profile.accountAgeDays;
      const display = days >= 365 ? `${(days / 365).toFixed(1)} years` : `${days} days`;
      ageField = field(days, display, enrichStatus);
    } else {
      ageField = enrichmentField(enrichStatus);
    }
    let followersField;
    if (isEnriched && profile.followerCount != null) {
      followersField = field(profile.followerCount, formatCount(profile.followerCount), enrichStatus);
    } else {
      followersField = enrichmentField(enrichStatus);
    }
    let caMentionsField;
    if (isEnriched && profile.caMentionCount != null) {
      const cnt = profile.caMentionCount;
      const display = cnt === 0 ? "None found in recent tweets" : `${cnt} mention${cnt !== 1 ? "s" : ""} in recent tweets`;
      caMentionsField = field(cnt, display, enrichStatus);
    } else {
      caMentionsField = enrichmentField(enrichStatus);
    }
    let renameCountField;
    if (isEnriched && profile.renameCount != null) {
      const cnt = profile.renameCount;
      const display = cnt === 0 ? "No renames observed" : `${cnt} rename${cnt !== 1 ? "s" : ""} observed`;
      renameCountField = field(cnt, display, enrichStatus);
    } else {
      renameCountField = enrichmentField(enrichStatus);
    }
    return {
      handle: field(
        social?.handle || null,
        social?.handle || statusToText(social?.status || FIELD_STATUS.MISSING_IDENTIFIER),
        presence ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER
      ),
      url: field(
        social?.url || null,
        social?.url ? truncateUrl(social.url) : statusToText(xStatus),
        social?.url ? FIELD_STATUS.OK : xStatus
      ),
      age: ageField,
      followers: followersField,
      bio: phase1NotFetched(),
      caInBio: phase1NotFetched(),
      caInPinned: phase1NotFetched(),
      recentTweets: phase1NotFetched(),
      caMentions: caMentionsField,
      renameCount: renameCountField,
      communities: {
        items: commItems,
        status: commStatus,
        statusDisplay: statusToText(commStatus)
      }
    };
  }
  function _buildWebsiteVM(context) {
    const ws = context?.website;
    const hasUrl = !!ws?.url;
    return {
      domain: field(
        ws?.domain || null,
        ws?.domain || statusToText(FIELD_STATUS.MISSING_IDENTIFIER),
        ws?.domain ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER
      ),
      url: field(
        ws?.url || null,
        ws?.url ? truncateUrl(ws.url) : statusToText(FIELD_STATUS.MISSING_IDENTIFIER),
        hasUrl ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER
      ),
      domainAge: field(
        ws?.domainAgeDays ?? null,
        ws?.domainAgeDays != null ? `${ws.domainAgeDays} days` : statusToText(hasUrl ? FIELD_STATUS.NOT_SUPPORTED : FIELD_STATUS.MISSING_IDENTIFIER),
        ws?.domainAgeDays != null ? FIELD_STATUS.OK : hasUrl ? FIELD_STATUS.NOT_SUPPORTED : FIELD_STATUS.MISSING_IDENTIFIER
      ),
      contentSummary: field(
        ws?.title || ws?.metaDescription || null,
        ws?.title || ws?.metaDescription || statusToText(hasUrl ? FIELD_STATUS.NOT_SUPPORTED : FIELD_STATUS.MISSING_IDENTIFIER),
        ws?.title || ws?.metaDescription ? FIELD_STATUS.OK : hasUrl ? FIELD_STATUS.NOT_SUPPORTED : FIELD_STATUS.MISSING_IDENTIFIER
      ),
      narrativeConsistency: field(
        null,
        statusToText(FIELD_STATUS.NOT_SUPPORTED),
        FIELD_STATUS.NOT_SUPPORTED
      )
    };
  }
  function _buildDeveloperVM(context) {
    const dev = context?.dev;
    const devStatus = dev?.status || FIELD_STATUS.NOT_SUPPORTED;
    const nullFallback = devStatus === FIELD_STATUS.OK ? "Unknown" : statusToText(devStatus);
    const nullStatus = devStatus === FIELD_STATUS.OK ? FIELD_STATUS.NOT_SUPPORTED : devStatus;
    let mintAuthField;
    if (dev?.mintAuthority === null) {
      mintAuthField = field(null, "Revoked", FIELD_STATUS.OK);
    } else if (typeof dev?.mintAuthority === "string") {
      mintAuthField = field(dev.mintAuthority, `Active \u2014 ${truncateAddress(dev.mintAuthority)}`, FIELD_STATUS.OK);
    } else {
      mintAuthField = field(null, nullFallback, nullStatus);
    }
    let freezeAuthField;
    if (dev?.freezeAuthority === null) {
      freezeAuthField = field(null, "Revoked", FIELD_STATUS.OK);
    } else if (typeof dev?.freezeAuthority === "string") {
      freezeAuthField = field(dev.freezeAuthority, `Active \u2014 ${truncateAddress(dev.freezeAuthority)}`, FIELD_STATUS.OK);
    } else {
      freezeAuthField = field(null, nullFallback, nullStatus);
    }
    let metadataField;
    if (dev?.metadataMutable === false) {
      metadataField = field(false, "Immutable", FIELD_STATUS.OK);
    } else if (dev?.metadataMutable === true) {
      metadataField = field(true, "Mutable", FIELD_STATUS.OK);
    } else {
      metadataField = field(null, nullFallback, nullStatus);
    }
    let devHoldingsField;
    if (dev?.devHoldingsPct != null) {
      const pct = dev.devHoldingsPct;
      const display = pct < 0.01 ? "< 0.01%" : pct < 1 ? `${pct.toFixed(2)}%` : `${pct.toFixed(1)}%`;
      devHoldingsField = field(pct, display, FIELD_STATUS.OK);
    } else {
      devHoldingsField = field(null, nullFallback, nullStatus);
    }
    let deployerBalanceField;
    if (dev?.deployerBalanceSol != null) {
      const sol = dev.deployerBalanceSol;
      const display = sol < 0.01 ? "< 0.01 SOL" : `${sol.toFixed(2)} SOL`;
      deployerBalanceField = field(sol, display, FIELD_STATUS.OK);
    } else {
      deployerBalanceField = field(null, nullFallback, nullStatus);
    }
    let deployerAgeField;
    if (dev?.deployerAgeDays != null) {
      const days = dev.deployerAgeDays;
      const display = days >= 365 ? `${(days / 365).toFixed(1)} years` : days === 0 ? "< 1 day" : `${days} days`;
      deployerAgeField = field(days, display, FIELD_STATUS.OK);
    } else {
      deployerAgeField = field(null, nullFallback, nullStatus);
    }
    let recentMints7dField;
    if (dev?.recentMints7d != null) {
      const cnt = dev.recentMints7d;
      recentMints7dField = field(cnt, `${cnt} token${cnt !== 1 ? "s" : ""} in 7d`, FIELD_STATUS.OK);
    } else {
      recentMints7dField = field(null, nullFallback, nullStatus);
    }
    return {
      // Identity
      knownLaunches: field(
        dev?.deployer || null,
        dev?.deployer ? truncateAddress(dev.deployer) : nullFallback,
        dev?.deployer ? FIELD_STATUS.OK : nullStatus
      ),
      // Tier 1: Authority signals
      mintAuthority: mintAuthField,
      freezeAuthority: freezeAuthField,
      metadataMutable: metadataField,
      // Tier 1b: Holdings
      devHoldings: devHoldingsField,
      // Tier 2: Deployer context
      deployerBalance: deployerBalanceField,
      deployerAge: deployerAgeField,
      // History
      recentLaunches: field(
        dev?.deployerMints30d ?? null,
        dev?.deployerMints30d != null ? `${formatCount(dev.deployerMints30d)} tokens` : nullFallback,
        dev?.deployerMints30d != null ? FIELD_STATUS.OK : nullStatus
      ),
      recentMints7d: recentMints7dField,
      historicalSummary: field(
        dev?.mintAgeDays ?? null,
        dev?.mintAgeDays != null ? `Token created ${dev.mintAgeDays} days ago` : nullFallback,
        dev?.mintAgeDays != null ? FIELD_STATUS.OK : nullStatus
      )
    };
  }

  // src/modules/core/narrative-trust.js
  var NarrativeTrust = {
    currentMint: null,
    listeners: [],
    initialized: false,
    loading: false,
    // Current data state
    data: {
      mint: null,
      score: null,
      confidence: "low",
      availableSignals: 0,
      totalSignals: 7,
      lastFetchTs: 0,
      // Phase 1: Structured service data
      context: null,
      // ContextResponseV1
      social: null,
      // SocialXProfile
      vm: null,
      // MarketContextVM
      // Signal dots (collapsed view)
      signals: {
        xAccountAge: "unavailable",
        recentActivity: "unavailable",
        xCommunities: "unavailable",
        developerHistory: "unavailable"
      }
    },
    init() {
      if (this.initialized) return;
      this.initialized = true;
      Market.subscribe(() => {
        const mint = Market.currentMint;
        if (!mint) return;
        if (mint !== this.currentMint || this.data.score === null) {
          this.fetchForMint(mint);
        }
      });
      if (Market.currentMint) {
        this.fetchForMint(Market.currentMint);
      }
    },
    subscribe(callback) {
      this.listeners.push(callback);
    },
    notify() {
      this.listeners.forEach((cb) => cb(this.data));
    },
    getData() {
      return this.data;
    },
    getScore() {
      return { score: this.data.score, confidence: this.data.confidence };
    },
    getSignals() {
      return this.data.signals;
    },
    /**
     * Get the view model for rendering (null during loading/before first fetch).
     * @returns {import('../../services/context/view-model.js').MarketContextVM|null}
     */
    getViewModel() {
      return this.data.vm;
    },
    /**
     * Fetch and score narrative trust for a given mint.
     * Orchestrates: Context API → SocialX Adapter → View Model → Score.
     *
     * No longer requires DexScreener info — the live API handles everything.
     */
    async fetchForMint(mint) {
      if (!mint) return;
      this.currentMint = mint;
      this.loading = true;
      this._setEmptyState(mint);
      this.notify();
      try {
        const context = await fetchContext({ ca: mint });
        const social = await ObservedSocialXAdapter.getProfile({
          ca: mint,
          discoveredXUrl: context.links?.x?.url || null,
          discoveredSiteUrl: context.links?.website?.url || null,
          discoveredFrom: context.links?.x?.url ? ["context_links"] : []
        });
        const vm = buildMarketContextViewModel(context, social);
        const scoring = this._calculateScore(context, social);
        const signals = this._buildSignals(context, social);
        this.loading = false;
        this.data = {
          mint,
          score: scoring.score,
          confidence: scoring.confidence,
          availableSignals: scoring.availableSignals,
          totalSignals: scoring.totalSignals,
          lastFetchTs: Date.now(),
          context,
          social,
          vm,
          signals
        };
        this.notify();
      } catch (e) {
        console.warn("[NarrativeTrust] Fetch failed:", e?.message || e);
        this.loading = false;
        if (this.data.mint !== mint) {
          this._setEmptyState(mint);
        }
        this.notify();
      }
    },
    /**
     * Set empty/loading state for a given mint.
     */
    _setEmptyState(mint) {
      this.data = {
        mint,
        score: null,
        confidence: "low",
        availableSignals: 0,
        totalSignals: 7,
        lastFetchTs: 0,
        context: null,
        social: null,
        vm: null,
        signals: {
          xAccountAge: "unavailable",
          recentActivity: "unavailable",
          xCommunities: "unavailable",
          developerHistory: "unavailable"
        }
      };
    },
    /**
     * Build signal dot map from context and social data.
     * Values: 'detected' (green), 'not_detected' (yellow/neutral), 'unavailable' (gray)
     */
    _buildSignals(context, social) {
      const xStatus = social?.presence ? "detected" : "not_detected";
      const enrichStatus = context?.x?.profile?.enrichmentStatus;
      const accountAge = context?.x?.profile?.accountAgeDays;
      const activityStatus = enrichStatus === FIELD_STATUS.OK && accountAge != null ? accountAge > 30 ? "established" : "new" : social?.activityBucket === "recent" ? "detected" : social?.activityBucket === "stale" ? "not_detected" : "unavailable";
      const xCommStatus = context?.x?.communities?.status;
      const xCommSignal = xCommStatus === FIELD_STATUS.OK ? "detected" : xCommStatus === FIELD_STATUS.NOT_SUPPORTED ? "unavailable" : xCommStatus === FIELD_STATUS.MISSING_IDENTIFIER ? "not_detected" : "unavailable";
      const devStatus = context?.dev?.status === FIELD_STATUS.OK ? "detected" : context?.dev?.status === FIELD_STATUS.NOT_SUPPORTED ? "unavailable" : "not_detected";
      return {
        xAccountAge: xStatus,
        recentActivity: activityStatus,
        xCommunities: xCommSignal,
        developerHistory: devStatus
      };
    },
    /**
     * Calculate trust score based on available data.
     * Fields with NOT_SUPPORTED or unavailable status are excluded
     * from both numerator and denominator.
     */
    _calculateScore(context, social) {
      let earned = 0;
      let possible = 0;
      let checked = 0;
      const enriched = context?.x?.profile?.enrichmentStatus === FIELD_STATUS.OK || context?.x?.profile?.enrichmentStatus === FIELD_STATUS.STALE_CACHED;
      const rules = [
        // X/Twitter presence (from SocialX adapter)
        {
          weight: 15,
          available: social?.status !== FIELD_STATUS.NOT_SUPPORTED,
          passes: social?.presence === true
        },
        // Website URL detected (from Context API)
        {
          weight: 10,
          available: true,
          // Always checked
          passes: context?.links?.website?.status === FIELD_STATUS.OK
        },
        // Website domain resolved
        {
          weight: 5,
          available: !!context?.website?.domain,
          passes: !!context?.website?.domain
        },
        // Multiple social/project links detected (>= 2)
        {
          weight: 5,
          available: true,
          passes: _countDetectedLinks(context) >= 2
        },
        // X Communities detected (from Context API)
        {
          weight: 10,
          available: context?.x?.communities?.status !== FIELD_STATUS.NOT_SUPPORTED,
          passes: context?.x?.communities?.status === FIELD_STATUS.OK && (context?.x?.communities?.items?.length || 0) > 0
        },
        // Token has image/logo (from Context API)
        {
          weight: 5,
          available: true,
          passes: !!context?.token?.hasImage
        },
        // Dev: mint age known
        {
          weight: 10,
          available: context?.dev?.status === FIELD_STATUS.OK,
          passes: context?.dev?.mintAgeDays != null
        },
        // Dev: deployer known
        {
          weight: 5,
          available: context?.dev?.status === FIELD_STATUS.OK,
          passes: !!context?.dev?.deployer
        },
        // Enriched: X account age > 30 days (established account)
        {
          weight: 10,
          available: enriched && context?.x?.profile?.accountAgeDays != null,
          passes: (context?.x?.profile?.accountAgeDays || 0) > 30
        },
        // Enriched: CA mentioned in recent tweets
        {
          weight: 10,
          available: enriched && context?.x?.profile?.caMentionCount != null,
          passes: (context?.x?.profile?.caMentionCount || 0) > 0
        },
        // Enriched: No excessive renames (< 3)
        {
          weight: 5,
          available: enriched && context?.x?.profile?.renameCount != null,
          passes: (context?.x?.profile?.renameCount || 0) < 3
        },
        // Dev: Mint authority revoked (strongest rug protection signal)
        {
          weight: 15,
          available: context?.dev?.status === FIELD_STATUS.OK && context?.dev?.mintAuthority !== void 0,
          passes: context?.dev?.mintAuthority === null
        },
        // Dev: Freeze authority revoked
        {
          weight: 10,
          available: context?.dev?.status === FIELD_STATUS.OK && context?.dev?.freezeAuthority !== void 0,
          passes: context?.dev?.freezeAuthority === null
        },
        // Dev: Metadata immutable
        {
          weight: 5,
          available: context?.dev?.status === FIELD_STATUS.OK && context?.dev?.metadataMutable != null,
          passes: context?.dev?.metadataMutable === false
        },
        // Dev: Dev holdings < 10% of supply
        {
          weight: 10,
          available: context?.dev?.status === FIELD_STATUS.OK && context?.dev?.devHoldingsPct != null,
          passes: (context?.dev?.devHoldingsPct ?? 100) < 10
        }
      ];
      rules.forEach((rule) => {
        if (!rule.available) return;
        possible += rule.weight;
        checked++;
        if (rule.passes) {
          earned += rule.weight;
        }
      });
      const maxPossible = rules.reduce((sum, r) => sum + r.weight, 0);
      const coverage = maxPossible > 0 ? possible / maxPossible : 0;
      let score = possible > 0 ? Math.round(earned / possible * 100) : null;
      const hasAge = context?.x?.profile?.accountAgeDays != null;
      const hasCAProof = (context?.x?.profile?.caMentionCount || 0) > 0;
      const dataCapped = score !== null && (!hasAge || !hasCAProof);
      if (dataCapped) {
        score = Math.min(score, 70);
      }
      let confidence = coverage >= 0.7 ? "high" : coverage >= 0.4 ? "medium" : "low";
      if (dataCapped && confidence === "high") {
        confidence = "medium";
      }
      return {
        score,
        confidence,
        availableSignals: checked,
        totalSignals: rules.length
      };
    }
  };
  function _countDetectedLinks(context) {
    if (!context?.links) return 0;
    let count = 0;
    if (context.links.x?.status === FIELD_STATUS.OK) count++;
    if (context.links.website?.status === FIELD_STATUS.OK) count++;
    return count;
  }

  // src/modules/core/trade-notes.js
  init_store();
  var MAX_NOTES = 50;
  var MAX_NOTE_LENGTH = 280;
  var TradeNotes = {
    /**
     * Add a new note for the current session and token.
     */
    async addNote(text) {
      if (!Store.state?.shadow) return null;
      if (!text || !text.trim()) return null;
      const trimmed = text.trim().slice(0, MAX_NOTE_LENGTH);
      const note = {
        id: `note_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
        ts: Date.now(),
        text: trimmed,
        mint: Market.currentMint || null,
        symbol: Market.currentSymbol || null,
        sessionId: Store.state.session?.id || null,
        edited: false,
        editedTs: null
      };
      const notes = Store.state.shadow.notes || [];
      notes.push(note);
      while (notes.length > MAX_NOTES) {
        notes.shift();
      }
      Store.state.shadow.notes = notes;
      await Store.save();
      return note;
    },
    /**
     * Edit an existing note by ID.
     */
    async editNote(noteId, text) {
      if (!Store.state?.shadow) return false;
      if (!text || !text.trim()) return false;
      const notes = Store.state.shadow.notes || [];
      const note = notes.find((n) => n.id === noteId);
      if (!note) return false;
      note.text = text.trim().slice(0, MAX_NOTE_LENGTH);
      note.edited = true;
      note.editedTs = Date.now();
      await Store.save();
      return true;
    },
    /**
     * Delete a note by ID.
     */
    async deleteNote(noteId) {
      if (!Store.state?.shadow) return false;
      const notes = Store.state.shadow.notes || [];
      const idx = notes.findIndex((n) => n.id === noteId);
      if (idx === -1) return false;
      notes.splice(idx, 1);
      await Store.save();
      return true;
    },
    /**
     * Get notes for the current session.
     */
    getSessionNotes() {
      if (!Store.state?.shadow) return [];
      const sessionId = Store.state.session?.id;
      if (!sessionId) return [];
      return (Store.state.shadow.notes || []).filter((n) => n.sessionId === sessionId).sort((a, b) => b.ts - a.ts);
    },
    /**
     * Get notes tagged with a specific token mint.
     */
    getNotesForMint(mint) {
      if (!Store.state?.shadow || !mint) return [];
      return (Store.state.shadow.notes || []).filter((n) => n.mint === mint).sort((a, b) => b.ts - a.ts);
    }
  };

  // src/modules/ui/shadow-hud.js
  function px3(n) {
    return n + "px";
  }
  function clamp3(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  var ShadowHud = {
    // UI state (not persisted — resets each page load)
    marketContextExpanded: false,
    strategyExpanded: true,
    notesExpanded: false,
    activeTab: "xAccount",
    // 'xAccount' | 'website' | 'developer'
    makeDraggableRef: null,
    // ==================== Lifecycle ====================
    mountShadowHud(makeDraggable) {
      if (makeDraggable) this.makeDraggableRef = makeDraggable;
      const dragger = makeDraggable || this.makeDraggableRef;
      const container = OverlayManager.getContainer();
      if (!container) return;
      const rootId = IDS.shadowHud;
      let root = container.querySelector("#" + rootId);
      if (!Store.state?.settings?.enabled) {
        if (root) root.style.display = "none";
        return;
      }
      if (root) {
        root.style.display = "";
        return;
      }
      root = document.createElement("div");
      root.id = rootId;
      const shadow = Store.state.shadow || {};
      root.className = shadow.hudDocked ? "docked" : "floating";
      if (!shadow.hudDocked) {
        const pos = shadow.hudPos || { x: 20, y: 400 };
        root.style.left = px3(pos.x);
        root.style.top = px3(pos.y);
      }
      container.appendChild(root);
      this.renderContent(root, dragger);
      this.bindEvents(root);
      NarrativeTrust.subscribe(() => {
        this._updateMarketContext(root);
      });
    },
    removeShadowHud() {
      const container = OverlayManager.getContainer();
      if (!container) return;
      const root = container.querySelector("#" + IDS.shadowHud);
      if (root) root.remove();
    },
    updateShadowHud() {
      const container = OverlayManager.getContainer();
      if (!container) return;
      const root = container.querySelector("#" + IDS.shadowHud);
      if (!root || !Store.state) return;
      if (!Store.state.settings.enabled) {
        root.style.display = "none";
        return;
      }
      root.style.display = "";
      const shadow = Store.state.shadow || {};
      root.className = shadow.hudDocked ? "docked" : "floating";
      if (!shadow.hudDocked) {
        const pos = shadow.hudPos || { x: 20, y: 400 };
        root.style.left = px3(pos.x);
        root.style.top = px3(pos.y);
      }
      this._updateMarketContext(root);
      this._updateNotesList(root);
    },
    // ==================== Rendering ====================
    renderContent(root, makeDraggable) {
      const shadow = Store.state?.shadow || {};
      const strategies = Store.state?.settings?.strategies || ["Trend", "Breakout", "Reversal", "Scalp", "News", "Other"];
      const currentStrategy = shadow.declaredStrategy || strategies[0];
      root.innerHTML = `
            <div class="sh-card">
                <!-- Header -->
                <div class="sh-header">
                    <div class="sh-header-left">
                        <div class="sh-header-icon">${ICONS.SHADOW_HUD_ICON}</div>
                        <div class="sh-header-title">ZER\xD8 \u2014 Shadow Mode</div>
                    </div>
                    <div class="sh-header-btns">
                        <button class="sh-btn" data-act="dock">${shadow.hudDocked ? "Float" : "Dock"}</button>
                    </div>
                </div>
                <div class="sh-subtitle">Real trade analysis \xB7 Observation only</div>

                <!-- Section 1: Market Context -->
                <div class="sh-section" data-section="marketContext">
                    <div class="sh-section-header" data-act="toggle-section" data-target="marketContext">
                        <div class="sh-section-header-left">
                            <div class="sh-section-icon">${ICONS.TRUST_SHIELD}</div>
                            <div class="sh-section-title">Market Context</div>
                        </div>
                        <div class="sh-section-chevron ${this.marketContextExpanded ? "expanded" : ""}">${ICONS.CHEVRON_DOWN}</div>
                    </div>
                    ${this._renderTrustSummary()}
                    ${this._renderSignals()}
                    <div class="sh-section-body ${this.marketContextExpanded ? "" : "collapsed"}" data-body="marketContext">
                        ${this._renderTabs()}
                        <div class="sh-tab-content" data-tab-content>
                            ${this._renderTabContent()}
                        </div>
                    </div>
                </div>

                <!-- Section 2: Strategy (Declared) -->
                <div class="sh-section" data-section="strategy">
                    <div class="sh-section-header" data-act="toggle-section" data-target="strategy">
                        <div class="sh-section-header-left">
                            <div class="sh-section-icon">${ICONS.STRATEGY_COMPASS}</div>
                            <div class="sh-section-title">Strategy (declared)</div>
                        </div>
                        <div class="sh-section-chevron ${this.strategyExpanded ? "expanded" : ""}">${ICONS.CHEVRON_DOWN}</div>
                    </div>
                    <div class="sh-section-body ${this.strategyExpanded ? "" : "collapsed"}" data-body="strategy">
                        <div class="sh-strategy-label">Current strategy</div>
                        <select class="sh-strategy-select" data-act="strategy-change">
                            ${strategies.map((s) => `<option value="${s}" ${s === currentStrategy ? "selected" : ""}>${s}</option>`).join("")}
                        </select>
                    </div>
                </div>

                <!-- Section 3: Trade Notes -->
                <div class="sh-section" data-section="notes">
                    <div class="sh-section-header" data-act="toggle-section" data-target="notes">
                        <div class="sh-section-header-left">
                            <div class="sh-section-icon">${ICONS.NOTES_DOC}</div>
                            <div class="sh-section-title">Trade Notes</div>
                        </div>
                        <div class="sh-section-chevron ${this.notesExpanded ? "expanded" : ""}">${ICONS.CHEVRON_DOWN}</div>
                    </div>
                    <div class="sh-section-body ${this.notesExpanded ? "" : "collapsed"}" data-body="notes">
                        <div class="sh-notes-input">
                            <textarea class="sh-notes-textarea" data-act="note-input" placeholder="Add a note..." maxlength="280" rows="1"></textarea>
                            <button class="sh-notes-add" data-act="add-note">Add</button>
                        </div>
                        <div class="sh-note-char-count" data-char-count></div>
                        <div class="sh-notes-list" data-notes-list>
                            ${this._renderNotesList()}
                        </div>
                    </div>
                </div>
            </div>
        `;
      this.bindDrag(root, makeDraggable);
    },
    // ==================== Market Context Rendering ====================
    _renderTrustSummary() {
      const data = NarrativeTrust.getData();
      const score = data.score;
      const confidence = data.confidence;
      const isLoading = NarrativeTrust.loading;
      if (isLoading) {
        return `
                <div class="sh-trust-summary sh-trust-loading-state">
                    <div class="sh-loading-text">Scanning market context...</div>
                    <div class="sh-loading-bar"><div class="sh-loading-bar-fill"></div></div>
                </div>
            `;
      }
      if (score === null) {
        return `
                <div class="sh-trust-summary">
                    <div class="sh-trust-score">Trust: <span class="score-val">--</span>/100</div>
                    <div class="sh-trust-bar"><div class="sh-trust-bar-fill" style="width:0%"></div></div>
                    <span class="sh-confidence-badge low">no data</span>
                </div>
            `;
      }
      const barClass = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
      return `
            <div class="sh-trust-summary">
                <div class="sh-trust-score">Trust: <span class="score-val">${score}</span>/100</div>
                <div class="sh-trust-bar"><div class="sh-trust-bar-fill ${barClass}" style="width:${score}%"></div></div>
                <span class="sh-confidence-badge ${confidence}">${confidence}</span>
            </div>
        `;
    },
    _renderSignals() {
      const isLoading = NarrativeTrust.loading;
      if (isLoading) {
        return `<div class="sh-signals"><span class="sh-signal-label sh-signal-loading">Waiting for data...</span></div>`;
      }
      const signals = NarrativeTrust.getSignals();
      const items = [
        { key: "xAccountAge", label: "X" },
        { key: "recentActivity", label: "Activity" },
        { key: "xCommunities", label: "X Comm" },
        { key: "developerHistory", label: "Dev" }
      ];
      const presentCount = items.filter((item) => signals[item.key] !== "unavailable").length;
      return `
            <div class="sh-signals">
                ${items.map((item) => {
        const val = signals[item.key];
        const cls = val === "unavailable" ? "unavailable" : val === "detected" || val === "active" || val === "established" || val === "known" ? "positive" : "neutral";
        return `<div class="sh-signal-dot ${cls}" title="${item.label}: ${val}"></div>`;
      }).join("")}
                <span class="sh-signal-label">${presentCount} of ${items.length} signals</span>
            </div>
        `;
    },
    _renderTabs() {
      const tabs = [
        { id: "xAccount", label: "X", icon: ICONS.TAB_X_ACCOUNT },
        { id: "website", label: "Website", icon: ICONS.TAB_WEBSITE },
        { id: "developer", label: "Dev", icon: ICONS.TAB_DEVELOPER }
      ];
      return `
            <div class="sh-tabs">
                ${tabs.map((t) => `
                    <div class="sh-tab ${t.id === this.activeTab ? "active" : ""}" data-act="tab" data-tab="${t.id}">
                        <span class="sh-tab-icon">${t.icon}</span> ${t.label}
                    </div>
                `).join("")}
            </div>
        `;
    },
    _renderTabContent() {
      const vm = NarrativeTrust.getViewModel();
      if (!vm) {
        return '<div class="sh-empty">Fetching context data...</div>';
      }
      switch (this.activeTab) {
        case "xAccount":
          return this._renderXAccountTab(vm.xAccount);
        case "website":
          return this._renderWebsiteTab(vm.website);
        case "developer":
          return this._renderDeveloperTab(vm.developer);
        default:
          return "";
      }
    },
    _renderXAccountTab(x) {
      if (!x) return "";
      const enrichedRows = [
        { label: "Age", f: x.age },
        { label: "Followers", f: x.followers },
        { label: "CA Mentions", f: x.caMentions },
        { label: "Renames", f: x.renameCount }
      ].filter((r) => r.f && r.f.status === "ok").map((r) => this._field(r.label, r.f)).join("");
      let commHtml;
      const comm = x.communities;
      if (comm && comm.status === "ok" && comm.items.length > 0) {
        const itemsHtml = comm.items.map((item) => {
          const meta = [];
          if (item.memberCount != null) meta.push(`${item.memberCount} members`);
          if (item.activityLevel && item.activityLevel !== "unknown") meta.push(item.activityLevel);
          const metaStr = meta.length > 0 ? ` <span style="opacity:0.6; font-size:10px;">(${meta.join(" \xB7 ")})</span>` : "";
          return `<div class="nt-community-item"><a href="${item.url}" target="_blank" rel="noopener" style="color:#a78bfa; text-decoration:none;">${this._escapeHtml(item.name)}</a>${metaStr}</div>`;
        }).join("");
        commHtml = `
                <div class="nt-section-divider" style="margin:8px 0 4px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                    <div class="nt-label" style="font-weight:600; margin-bottom:4px;">X Communities</div>
                    ${itemsHtml}
                </div>
            `;
      } else {
        commHtml = `
                <div class="nt-section-divider" style="margin:8px 0 4px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                    <div class="nt-field unavailable"><div class="nt-label">X Communities</div><div class="nt-value">No X community detected</div></div>
                </div>
            `;
      }
      return `
            ${this._field("Account", x.handle)}
            ${this._field("URL", x.url)}
            ${enrichedRows}
            ${commHtml}
        `;
    },
    _renderWebsiteTab(w) {
      if (!w) return "";
      return `
            ${this._field("Domain", w.domain)}
            ${this._field("URL", w.url)}
            ${this._field("Domain Age", w.domainAge)}
            ${this._field("Content", w.contentSummary)}
            ${this._field("Narrative", w.narrativeConsistency)}
        `;
    },
    _renderDeveloperTab(d) {
      if (!d) return "";
      return `
            ${this._field("Deployer", d.knownLaunches)}
            ${this._field("Mint Auth", d.mintAuthority)}
            ${this._field("Freeze Auth", d.freezeAuthority)}
            ${this._field("Metadata", d.metadataMutable)}
            ${this._field("Dev Holdings", d.devHoldings)}
            ${this._field("Dev SOL", d.deployerBalance)}
            ${this._field("Wallet Age", d.deployerAge)}
            ${this._field("Dev Tokens", d.recentLaunches)}
            ${this._field("Recent (7d)", d.recentMints7d)}
            ${this._field("Mint Age", d.historicalSummary)}
        `;
    },
    /**
     * Render a key-value field. Accepts a VMField { display, status } or a raw string.
     * Never outputs "Data unavailable". Uses status-aware display text.
     */
    _field(label, vmField) {
      let display, isUnavailable, isStale;
      if (vmField && typeof vmField === "object" && "display" in vmField) {
        display = vmField.display;
        isUnavailable = vmField.status !== "ok" && vmField.status !== "stale_cached";
        isStale = vmField.status === "stale_cached";
      } else {
        display = vmField || "Not detected";
        isUnavailable = !vmField || vmField === "unavailable";
        isStale = false;
      }
      const cls = isUnavailable ? "unavailable" : isStale ? "stale" : "";
      return `
            <div class="nt-field ${cls}">
                <div class="nt-label">${label}</div>
                <div class="nt-value">${display}</div>
            </div>
        `;
    },
    // ==================== Notes Rendering ====================
    _renderNotesList() {
      const notes = TradeNotes.getSessionNotes();
      if (notes.length === 0) {
        return '<div class="sh-empty">No notes this session</div>';
      }
      return notes.map((note) => {
        const time = new Date(note.ts);
        const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
        return `
                <div class="sh-note" data-note-id="${note.id}">
                    <div class="sh-note-time">${timeStr}</div>
                    <div class="sh-note-text">${this._escapeHtml(note.text)}</div>
                    <div class="sh-note-actions">
                        <button class="sh-note-action" data-act="delete-note" data-note-id="${note.id}" title="Delete">${ICONS.X}</button>
                    </div>
                </div>
            `;
      }).join("");
    },
    _escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    },
    // ==================== Partial Updates ====================
    _updateMarketContext(root) {
      if (!root) return;
      const summaryEl = root.querySelector(".sh-trust-summary");
      if (summaryEl) {
        summaryEl.outerHTML = this._renderTrustSummary();
      }
      const signalsEl = root.querySelector(".sh-signals");
      if (signalsEl) {
        signalsEl.outerHTML = this._renderSignals();
      }
      if (this.marketContextExpanded) {
        const tabContent = root.querySelector("[data-tab-content]");
        if (tabContent) {
          tabContent.innerHTML = this._renderTabContent();
        }
      }
    },
    _updateNotesList(root) {
      if (!root) return;
      const listEl = root.querySelector("[data-notes-list]");
      if (listEl) {
        listEl.innerHTML = this._renderNotesList();
      }
    },
    // ==================== Event Binding ====================
    bindEvents(root) {
      root.addEventListener("click", async (e) => {
        const t = e.target;
        if (t.matches("input, select, textarea, option")) return;
        const actEl = t.closest("[data-act]");
        if (!actEl) return;
        const act = actEl.getAttribute("data-act");
        e.preventDefault();
        e.stopPropagation();
        if (act === "toggle-section") {
          const target = actEl.getAttribute("data-target");
          this._toggleSection(root, target);
        }
        if (act === "tab") {
          const tab = actEl.getAttribute("data-tab");
          this._switchTab(root, tab);
        }
        if (act === "dock") {
          const shadow = Store.state.shadow || {};
          shadow.hudDocked = !shadow.hudDocked;
          Store.state.shadow = shadow;
          await Store.save();
          root.className = shadow.hudDocked ? "docked" : "floating";
          actEl.textContent = shadow.hudDocked ? "Float" : "Dock";
          if (!shadow.hudDocked) {
            const pos = shadow.hudPos || { x: 20, y: 400 };
            root.style.left = px3(pos.x);
            root.style.top = px3(pos.y);
          }
        }
        if (act === "add-note") {
          const textarea = root.querySelector(".sh-notes-textarea");
          if (textarea && textarea.value.trim()) {
            await TradeNotes.addNote(textarea.value);
            textarea.value = "";
            this._updateNotesList(root);
            const charCount = root.querySelector("[data-char-count]");
            if (charCount) charCount.textContent = "";
          }
        }
        if (act === "delete-note") {
          const noteId = actEl.getAttribute("data-note-id");
          if (noteId) {
            await TradeNotes.deleteNote(noteId);
            this._updateNotesList(root);
          }
        }
      });
      root.addEventListener("change", async (e) => {
        if (e.target.matches(".sh-strategy-select")) {
          if (!Store.state.shadow) Store.state.shadow = {};
          Store.state.shadow.declaredStrategy = e.target.value;
          await Store.save();
        }
      });
      root.addEventListener("input", (e) => {
        if (e.target.matches(".sh-notes-textarea")) {
          const charCount = root.querySelector("[data-char-count]");
          if (charCount) {
            const len = e.target.value.length;
            charCount.textContent = len > 0 ? `${len}/280` : "";
          }
        }
      });
    },
    _toggleSection(root, section) {
      if (section === "marketContext") this.marketContextExpanded = !this.marketContextExpanded;
      if (section === "strategy") this.strategyExpanded = !this.strategyExpanded;
      if (section === "notes") this.notesExpanded = !this.notesExpanded;
      const body = root.querySelector(`[data-body="${section}"]`);
      if (body) {
        body.classList.toggle("collapsed");
      }
      const header = root.querySelector(`[data-target="${section}"]`);
      if (header) {
        const chevron = header.querySelector(".sh-section-chevron");
        if (chevron) chevron.classList.toggle("expanded");
      }
    },
    _switchTab(root, tab) {
      this.activeTab = tab;
      root.querySelectorAll(".sh-tab").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-tab") === tab);
      });
      const tabContent = root.querySelector("[data-tab-content]");
      if (tabContent) {
        tabContent.innerHTML = this._renderTabContent();
      }
    },
    // ==================== Drag ====================
    bindDrag(root, makeDraggable) {
      const header = root.querySelector(".sh-header");
      if (!header || !makeDraggable) return;
      makeDraggable(header, (dx, dy) => {
        if (!Store.state.shadow || Store.state.shadow.hudDocked) return;
        const pos = Store.state.shadow.hudPos || { x: 20, y: 400 };
        pos.x = clamp3(pos.x + dx, 0, window.innerWidth - 40);
        pos.y = clamp3(pos.y + dy, 34, window.innerHeight - 40);
        Store.state.shadow.hudPos = pos;
        root.style.left = px3(pos.x);
        root.style.top = px3(pos.y);
      }, async () => {
        if (Store.state.shadow && !Store.state.shadow.hudDocked) {
          await Store.save();
        }
      });
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
        const trades = Object.values(Store.state.trades).map((t) => ({
          ...t,
          side: t.side === "ENTRY" ? "BUY" : t.side === "EXIT" ? "SELL" : t.side,
          priceUsd: t.fillPriceUsd || t.priceUsd,
          marketCap: t.marketCapUsdAtFill || t.marketCap
        }));
        setTimeout(() => {
          window.postMessage({ __paper: true, type: "PAPER_DRAW_ALL", trades }, "*");
        }, 2e3);
      }
      Market.subscribe(async () => {
        this.scheduleRender();
      });
      if (ModeManager.getMode() === MODES.SHADOW) {
        NarrativeTrust.init();
      }
      ModesUI.showSessionBanner();
    },
    scheduleRender() {
      if (this.renderScheduled) return;
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        this.renderAll();
        this.renderScheduled = false;
        this.lastRenderAt = Date.now();
      });
    },
    renderAll() {
      if (!Store.state) return;
      Banner.mountBanner();
      PnlHud.mountPnlHud(this.makeDraggable.bind(this));
      if (ModeManager.shouldShowBuyHud()) {
        BuyHud.mountBuyHud(this.makeDraggable.bind(this));
      } else {
        const container = OverlayManager.getContainer();
        const buyRoot = container.querySelector("#" + IDS.buyHud);
        if (buyRoot) buyRoot.remove();
      }
      if (ModeManager.shouldShowShadowHud()) {
        ShadowHud.mountShadowHud(this.makeDraggable.bind(this));
      } else {
        ShadowHud.removeShadowHud();
      }
      this.updateAll();
    },
    async updateAll() {
      ModesUI.applyContainerClass();
      Banner.updateBanner();
      await PnlHud.updatePnlHud();
      if (ModeManager.shouldShowBuyHud()) {
        BuyHud.updateBuyHud();
      }
      if (ModeManager.shouldShowShadowHud()) {
        ShadowHud.updateShadowHud();
      }
    },
    // Shared utility for making elements draggable
    makeDraggable(handle, onMove, onStop) {
      if (!handle) return;
      let dragging = false;
      let startX = 0, startY = 0;
      const down = (e) => {
        if (e.button !== 0) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      };
      const move = (e) => {
        if (!dragging) return;
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
        if (onStop) onStop();
      };
      handle.addEventListener("mousedown", down);
    }
  };

  // src/platforms/padre/boot.padre.js
  init_diagnostics_store();
  (async () => {
    "use strict";
    const PLATFORM = "Padre";
    Logger.info(`ZER\xD8 v1.11.14 (${PLATFORM} Platform)`);
    TokenContextResolver.init(PLATFORM);
    try {
      Logger.info("Loading Store...");
      const state = await Store.load();
      if (!state) throw new Error("Store state is null");
      if (!state.settings.enabled) {
        Logger.info("Force-enabling for Beta test...");
        state.settings.enabled = true;
        await Store.save();
      }
      Logger.info("Store loaded:", state.settings?.enabled ? "Enabled" : "Disabled");
    } catch (e) {
      Logger.error("Store Load Failed:", e);
    }
    try {
      if (License.needsRevalidation()) {
        Logger.info("License revalidation needed...");
        await License.revalidate();
      }
    } catch (e) {
      Logger.error("License revalidation failed:", e);
    }
    try {
      Logger.info("Loading DiagnosticsStore...");
      await DiagnosticsStore.load();
      DiagnosticsStore.logEvent("SESSION_STARTED", {
        platform: "PADRE"
      }, { platform: "PADRE" });
    } catch (e) {
      Logger.error("DiagnosticsStore Init Failed:", e);
    }
    try {
      const { DiagnosticsManager: DiagnosticsManager2 } = await Promise.resolve().then(() => (init_diagnostics_manager(), diagnostics_manager_exports));
      DiagnosticsManager2.init();
    } catch (e) {
      Logger.error("DiagnosticsManager Init Failed:", e);
    }
    try {
      Logger.info("Init Overlay...");
      OverlayManager.init(PLATFORM);
      Professor.init();
    } catch (e) {
      Logger.error("Overlay Init Failed:", e);
    }
    try {
      Logger.info("Init Market...");
      Market.init();
    } catch (e) {
      Logger.error("Market Init Failed:", e);
    }
    try {
      Logger.info("Init PNL Calculator...");
      PnlCalculator.init();
    } catch (e) {
      Logger.error("PNL Calculator Init Failed:", e);
    }
    try {
      Logger.info("Init HUD...");
      await HUD.init();
    } catch (e) {
      Logger.error("HUD Init Failed:", e);
    }
    window.addEventListener("message", async (e) => {
      if (e.source !== window || !e.data?.__paper_cmd) return;
      const { type, val } = e.data;
      if (type === "SET_TIER") {
        const state = Store.state;
        if (state && state.settings) {
          Logger.info(`Admin: Setting tier to ${val}...`);
          state.settings.tier = val;
          await Store.save();
          location.reload();
        }
      }
      if (type === "RESET_STORE") {
        Logger.warn("Admin: Resetting store...");
        await Store.clear();
        location.reload();
      }
    });
    Logger.info("Boot sequence finished.");
  })();
})();
