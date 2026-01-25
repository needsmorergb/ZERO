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
        featureOverrides: {} // For remote kill-switches
    },
    // Runtime state (not always persisted fully, but structure is here)
    session: {
        balance: 10,
        equity: 10,
        realized: 0,
        trades: [], // IDs
        equityHistory: [], // [{ts, equity}]
        winStreak: 0,
        lossStreak: 0,
        startTime: 0,
        tradeCount: 0,
        disciplineScore: 100
    },
    trades: {}, // Map ID -> Trade Object { id, strategy, emotion, ... }
    positions: {},
    behavior: {
        tiltFrequency: 0
    },
    schemaVersion: 2,
    version: '1.10.0'
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
        }
    }
};
