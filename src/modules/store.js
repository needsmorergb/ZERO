export const EXT_KEY = "sol_paper_trader_v1";

const DEFAULTS = {
    settings: {
        tier: 'free',
        enabled: true,
        buyHudDocked: true,
        pnlDocked: true,
        buyHudPos: { x: 20, y: 120 },
        pnlPos: { x: 20, y: 60 },
        startSol: 10,
        quickBuySols: [0.01, 0.05, 0.1, 0.25, 0.5, 1],
        quickSellPcts: [10, 25, 50, 75, 100],
        strategies: ["Trend", "Breakout", "Reversal", "Scalp", "News", "Other"], // Phase 2: Context
        tokenDisplayUsd: false,
        sessionDisplayUsd: false,
        tutorialCompleted: false,
        tradingMode: 'paper', // 'paper' | 'shadow'
        showProfessor: true, // Show trade analysis popup
        rolloutPhase: 'full', // 'beta' | 'preview' | 'full'
        featureOverrides: {}, // For remote kill-switches
        behavioralAlerts: true // Phase 9: Elite Guardrails
    },
    // Session as first-class object
    session: {
        id: null,              // Unique session ID
        startTime: 0,          // Session start timestamp
        endTime: null,         // Session end timestamp (null if active)
        balance: 10,
        equity: 10,
        realized: 0,
        trades: [],            // Trade IDs in this session
        equityHistory: [],     // [{ts, equity}]
        winStreak: 0,
        lossStreak: 0,
        tradeCount: 0,
        disciplineScore: 100,
        activeAlerts: [],      // {type, message, ts}
        status: 'active'       // 'active' | 'completed' | 'abandoned'
    },
    // Session history (archived sessions)
    sessionHistory: [],        // Array of completed session objects
    trades: {}, // Map ID -> Trade Object { id, strategy, emotion, plannedStop, plannedTarget, entryThesis, riskDefined, ... }
    positions: {},
    // Pending trade plan (cleared after trade execution)
    pendingPlan: {
        stopLoss: null,      // Price in USD or % below entry
        target: null,        // Price in USD or % above entry
        thesis: '',          // Entry reasoning
        maxRiskPct: null     // Max % of balance to risk
    },
    behavior: {
        tiltFrequency: 0,
        panicSells: 0,
        fomoTrades: 0,
        sunkCostFrequency: 0,
        overtradingFrequency: 0,
        profitNeglectFrequency: 0,
        strategyDriftFrequency: 0,
        profile: 'Disciplined'
    },
    // Persistent Event Log (up to 100 events)
    eventLog: [], // { ts, type, category, message, data }
    // Categories: TRADE, ALERT, DISCIPLINE, SYSTEM, MILESTONE
    schemaVersion: 2,
    version: '1.11.5'
};

// Helper utils
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

export const Store = {
    state: null,

    async load() {
        // Safety timeout to prevent hanging forever if storage callback dies
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
                    // Clear timeout immediately upon callback
                    if (timeoutId) clearTimeout(timeoutId);

                    if (chrome.runtime.lastError) {
                        const msg = chrome.runtime.lastError.message;
                        if (msg && !msg.includes('context invalidated')) {
                            console.warn('[ZERØ] Storage load error:', msg);
                        }
                        this.state = JSON.parse(JSON.stringify(DEFAULTS));
                        resolve(this.state);
                        return;
                    }

                    const saved = res[EXT_KEY];
                    if (!saved) {
                        this.state = JSON.parse(JSON.stringify(DEFAULTS));
                    } else if (!saved.schemaVersion || saved.schemaVersion < 2) {
                        console.log('[ZERØ] Migrating storage schema v1 -> v2');
                        this.state = this.migrateV1toV2(saved);
                        this.save();
                    } else {
                        this.state = deepMerge(DEFAULTS, saved);
                    }

                    this.validateState();
                    resolve(this.state);
                });
            } catch (e) {
                console.error('[ZERØ] Storage load exception:', e);
                if (timeoutId) clearTimeout(timeoutId);
                resolve(JSON.parse(JSON.stringify(DEFAULTS)));
            }
        });

        // Timeout fallback (1 second)
        const timeout = new Promise((resolve) => {
            timeoutId = setTimeout(() => {
                console.warn('[ZERØ] Storage load timed out, using defaults.');
                if (!this.state) this.state = JSON.parse(JSON.stringify(DEFAULTS));
                resolve(this.state);
            }, 1000);
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
                        if (msg && !msg.includes('context invalidated')) {
                            console.warn('[ZERØ] Storage save error:', msg);
                        }
                    }
                    resolve();
                });
            } catch (e) {
                if (!e.message.includes('context invalidated')) {
                    console.error('[ZERØ] Storage save exception:', e);
                }
                resolve();
            }
        });
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
        // Create fresh V2 state
        const newState = JSON.parse(JSON.stringify(DEFAULTS));

        // Migrate Settings
        newState.settings.enabled = oldState.enabled ?? true;
        newState.settings.buyHudDocked = oldState.buyHudDocked ?? true;
        newState.settings.pnlDocked = oldState.pnlDocked ?? true;
        newState.settings.buyHudPos = oldState.buyHudPos ?? { x: 20, y: 120 };
        newState.settings.pnlPos = oldState.pnlPos ?? { x: 20, y: 60 };
        newState.settings.startSol = oldState.startSol ?? 10;
        newState.settings.tutorialCompleted = oldState.tutorialCompleted ?? false;

        // Migrate Session/Balance
        newState.session.balance = oldState.cashSol ?? 10;
        newState.session.equity = oldState.equitySol ?? 10;
        newState.session.realized = oldState.realizedSol ?? 0;
        newState.session.winStreak = oldState.winStreak ?? 0;
        newState.session.lossStreak = oldState.lossStreak ?? 0;
        newState.session.disciplineScore = oldState.disciplineScore ?? 100;

        // Migrate Trades (Array -> Map)
        if (Array.isArray(oldState.trades)) {
            oldState.trades.forEach((t, idx) => {
                const id = t.id || `legacy_${idx}_${Date.now()}`;
                newState.trades[id] = t;
                newState.session.trades.push(id);
            });
        }

        // Migrate Positions
        newState.positions = oldState.positions || {};

        return newState;
    },

    validateState() {
        if (this.state) {
            this.state.settings.startSol = parseFloat(this.state.settings.startSol) || 10;

            // Ensure session has an ID
            if (!this.state.session.id) {
                this.state.session.id = this.generateSessionId();
                this.state.session.startTime = Date.now();
            }
        }
    },

    generateSessionId() {
        return `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    },

    // Start a new session (archive current if it has trades)
    async startNewSession() {
        const currentSession = this.state.session;

        // Archive current session if it has trades
        if (currentSession.trades && currentSession.trades.length > 0) {
            currentSession.endTime = Date.now();
            currentSession.status = 'completed';

            if (!this.state.sessionHistory) this.state.sessionHistory = [];
            this.state.sessionHistory.push({ ...currentSession });

            // Keep only last 10 sessions
            if (this.state.sessionHistory.length > 10) {
                this.state.sessionHistory = this.state.sessionHistory.slice(-10);
            }
        }

        // Create fresh session
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
            status: 'active'
        };

        // Don't clear trades/positions - they're still valid for history
        // But clear milestone flags
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
        return Math.floor((endTime - session.startTime) / 60000);
    },

    // Get session summary
    getSessionSummary() {
        const session = this.state?.session;
        if (!session) return null;

        const trades = session.trades || [];
        const sellTrades = trades
            .map(id => this.state.trades[id])
            .filter(t => t && t.side === 'SELL');

        const wins = sellTrades.filter(t => (t.realizedPnlSol || 0) > 0).length;
        const losses = sellTrades.filter(t => (t.realizedPnlSol || 0) < 0).length;
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
