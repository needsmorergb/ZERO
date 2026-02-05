// Build-time dev override — flip to false before shipping.
// Baked into the bundle as a literal; cannot be changed from the console.
const DEV_FORCE_ELITE = true;

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
        tradingMode: 'paper', // 'paper' | 'analysis' | 'shadow'
        showProfessor: true, // Show trade analysis popup
        rolloutPhase: 'full', // 'beta' | 'preview' | 'full'
        featureOverrides: {}, // For remote kill-switches
        behavioralAlerts: true, // Phase 9: Elite Guardrails

        // Onboarding State
        onboardingSeen: false,
        onboardingVersion: null,
        onboardingCompletedAt: null,

        // License / Whop Membership
        license: {
            key: null,           // Whop license key (mem_xxx or license string)
            valid: false,        // Last known validation result
            lastVerified: null,  // Timestamp (ms) of last successful verification
            expiresAt: null,     // ISO string or null (founders = lifetime)
            status: 'none',      // 'none' | 'active' | 'expired' | 'cancelled' | 'error'
            plan: null           // 'monthly' | 'annual' | 'founders'
        },

        // Promo Trial (5-session Elite trial via promo code)
        trial: {
            promoCode: null,     // Redeemed promo code string
            activated: false,    // Has a promo ever been redeemed? (one-time only)
            activatedAt: null,   // Timestamp (ms) of activation
            sessionsUsed: 0,     // Sessions started since activation
            sessionsLimit: 5,    // Max sessions (server can override per campaign)
            expired: false,      // true once sessionsUsed >= sessionsLimit
            expiredAt: null      // Timestamp when trial expired
        }
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
        status: 'active',      // 'active' | 'completed' | 'abandoned'
        notes: ''              // Session notes (max 280 chars, stored locally)
    },
    // Session history (archived sessions)
    sessionHistory: [],        // Array of completed session objects
    trades: {}, // Map ID -> Trade Object { id, strategy, emotion, plannedStop, plannedTarget, entryThesis, riskDefined, ... }
    positions: {},
    // Pending trade plan (cleared after trade is recorded)
    pendingPlan: {
        stopLoss: null,      // Price in USD or % below entry
        target: null,        // Price in USD or % above entry
        thesis: '',          // Entry reasoning
        maxRiskPct: null     // Max % of balance to risk
    },
    shadow: {
        declaredStrategy: 'Trend',
        notes: [],
        hudDocked: false,
        hudPos: { x: 20, y: 400 },
        narrativeTrustCache: {},
        walletAddress: null
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

    // --- Shadow Mode Session State (separate from paper) ---
    shadowSession: {
        id: null,
        startTime: 0,
        endTime: null,
        balance: 0, // Auto-detected from wallet on first trade
        equity: 0,
        realized: 0,
        trades: [],
        equityHistory: [],
        winStreak: 0,
        lossStreak: 0,
        tradeCount: 0,
        disciplineScore: 100,
        activeAlerts: [],
        status: 'active',
        notes: ''
    },
    shadowSessionHistory: [], // Uncapped — real sessions can be long
    shadowTrades: {},
    shadowPositions: {},
    shadowBehavior: {
        tiltFrequency: 0,
        panicSells: 0,
        fomoTrades: 0,
        sunkCostFrequency: 0,
        overtradingFrequency: 0,
        profitNeglectFrequency: 0,
        strategyDriftFrequency: 0,
        profile: 'Disciplined'
    },
    shadowEventLog: [],

    schemaVersion: 3,
    version: '2.0.0'
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

    // --- Mode-aware accessors ---
    isShadowMode() {
        return this.state?.settings?.tradingMode === 'shadow';
    },

    isRealTradingMode() {
        const mode = this.state?.settings?.tradingMode;
        return mode === 'shadow' || mode === 'analysis';
    },

    getActiveSession() {
        return this.isRealTradingMode() ? this.state.shadowSession : this.state.session;
    },

    getActivePositions() {
        return this.isRealTradingMode() ? this.state.shadowPositions : this.state.positions;
    },

    getActiveTrades() {
        return this.isRealTradingMode() ? this.state.shadowTrades : this.state.trades;
    },

    getActiveBehavior() {
        return this.isRealTradingMode() ? this.state.shadowBehavior : this.state.behavior;
    },

    getActiveEventLog() {
        return this.isRealTradingMode() ? this.state.shadowEventLog : this.state.eventLog;
    },

    getActiveSessionHistory() {
        return this.isRealTradingMode() ? this.state.shadowSessionHistory : this.state.sessionHistory;
    },

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
                        // v2 -> v3: license + trial state fields
                        // deepMerge handles missing keys via DEFAULTS, but bump version
                        if (this.state.schemaVersion < 3) {
                            console.log('[ZERØ] Migrating schema v2 -> v3 (license + trial state)');
                            this.state.schemaVersion = 3;
                            this.save();
                        }
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
        newState.settings.onboardingSeen = oldState.onboardingSeen ?? false;
        newState.settings.onboardingVersion = oldState.onboardingVersion ?? null;
        newState.settings.onboardingCompletedAt = oldState.onboardingCompletedAt ?? null;

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

            // Migrate Pro tier to Free (Pro tier removed in 2-tier model)
            if (this.state.settings.tier === 'pro') {
                this.state.settings.tier = 'free';
            }

            // --- Tier derivation chain: DEV_FORCE → license → trial → free ---
            if (DEV_FORCE_ELITE) {
                // Build-time Elite override for dev testing (highest priority)
                this.state.settings.tier = 'elite';
            } else if (this.state.settings.license?.valid && this.state.settings.license?.lastVerified) {
                // License-based tier (72h grace period)
                const GRACE_MS = 72 * 60 * 60 * 1000;
                const elapsed = Date.now() - this.state.settings.license.lastVerified;
                if (elapsed < GRACE_MS) {
                    this.state.settings.tier = 'elite';
                } else {
                    this.state.settings.tier = 'free';
                    this.state.settings.license.valid = false;
                    this.state.settings.license.status = 'expired';
                }
            } else if (
                this.state.settings.trial?.activated &&
                !this.state.settings.trial?.expired &&
                (this.state.settings.trial?.sessionsUsed || 0) < (this.state.settings.trial?.sessionsLimit || 5)
            ) {
                // Active promo trial — grant Elite
                this.state.settings.tier = 'elite';
            } else {
                this.state.settings.tier = 'free';
            }

            // Migrate old ENTRY/EXIT side values to BUY/SELL
            if (this.state.fills) {
                this.state.fills.forEach(f => {
                    if (f.side === 'ENTRY') f.side = 'BUY';
                    if (f.side === 'EXIT') f.side = 'SELL';
                });
            }
            if (this.state.trades) {
                Object.values(this.state.trades).forEach(t => {
                    if (t.side === 'ENTRY') t.side = 'BUY';
                    if (t.side === 'EXIT') t.side = 'SELL';
                });
            }

            // Ensure session has an ID
            if (!this.state.session.id) {
                this.state.session.id = this.generateSessionId();
                this.state.session.startTime = Date.now();
            }

            // Ensure shadow session has an ID when in shadow mode
            if (
                this.state.settings.tradingMode === 'shadow' &&
                this.state.shadowSession &&
                !this.state.shadowSession.id
            ) {
                this.state.shadowSession.id = this.generateSessionId();
                this.state.shadowSession.startTime = Date.now();
            }
        }
    },

    generateSessionId() {
        return `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    },

    // Start a new session (archive current if it has trades)
    // options.shadow: force shadow session reset (otherwise uses current mode)
    async startNewSession(options = {}) {
        // --- Trial session counting (paper sessions only) ---
        const isShadow = options.shadow !== undefined ? options.shadow : this.isShadowMode();
        if (!isShadow) {
            this._trialJustExpired = false;
            const trial = this.state.settings.trial;
            if (trial?.activated && !trial?.expired) {
                trial.sessionsUsed = (trial.sessionsUsed || 0) + 1;
                if (trial.sessionsUsed >= (trial.sessionsLimit || 5)) {
                    trial.expired = true;
                    trial.expiredAt = Date.now();
                    this.validateState(); // Re-derive tier to 'free'
                    this._trialJustExpired = true;
                }
            }
        }

        const sessionKey = isShadow ? 'shadowSession' : 'session';
        const historyKey = isShadow ? 'shadowSessionHistory' : 'sessionHistory';
        const currentSession = this.state[sessionKey];

        // Archive current session if it has trades
        if (currentSession && currentSession.trades && currentSession.trades.length > 0) {
            currentSession.endTime = Date.now();
            currentSession.status = 'completed';

            if (!this.state[historyKey]) this.state[historyKey] = [];
            this.state[historyKey].push({ ...currentSession });

            // Paper: keep last 10 sessions. Shadow: uncapped.
            if (!isShadow && this.state[historyKey].length > 10) {
                this.state[historyKey] = this.state[historyKey].slice(-10);
            }
        }

        // Create fresh session
        const startBalance = isShadow ? 0 : (this.state.settings.startSol || 10);
        this.state[sessionKey] = {
            id: this.generateSessionId(),
            startTime: Date.now(),
            endTime: null,
            balance: startBalance,
            equity: startBalance,
            realized: 0,
            trades: [],
            equityHistory: [],
            winStreak: 0,
            lossStreak: 0,
            tradeCount: 0,
            disciplineScore: 100,
            activeAlerts: [],
            status: 'active',
            notes: ''
        };

        // Clear milestone flags
        const prefix = isShadow ? '_shadow_milestone_' : '_milestone_';
        delete this.state[prefix + '2x'];
        delete this.state[prefix + '3x'];
        delete this.state[prefix + '5x'];
        // Also clean legacy paper milestone keys
        if (!isShadow) {
            delete this.state._milestone_2x;
            delete this.state._milestone_3x;
            delete this.state._milestone_5x;
        }

        await this.save();
        return this.state[sessionKey];
    },

    // Get current session duration in minutes
    isElite() {
        return (this.state?.settings?.tier || 'free') === 'elite';
    },

    // Get current session duration in minutes (mode-aware)
    getSessionDuration() {
        const session = this.getActiveSession();
        if (!session || !session.startTime) return 0;
        const endTime = session.endTime || Date.now();
        return Math.floor((endTime - session.startTime) / 60000);
    },

    // Get session summary (mode-aware)
    getSessionSummary() {
        const session = this.getActiveSession();
        const tradesMap = this.getActiveTrades();
        if (!session) return null;

        const tradeIds = session.trades || [];
        const sellTrades = tradeIds.map(id => tradesMap[id]).filter(t => t && t.side === 'SELL');

        const wins = sellTrades.filter(t => (t.realizedPnlSol || 0) > 0).length;
        const losses = sellTrades.filter(t => (t.realizedPnlSol || 0) < 0).length;
        const winRate = sellTrades.length > 0 ? ((wins / sellTrades.length) * 100).toFixed(1) : 0;

        return {
            id: session.id,
            duration: this.getSessionDuration(),
            tradeCount: tradeIds.length,
            wins,
            losses,
            winRate,
            realized: session.realized,
            disciplineScore: session.disciplineScore,
            status: session.status
        };
    }
};
