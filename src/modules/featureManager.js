export const TIERS = {
    FREE: 'free',
    PRO: 'pro',
    ELITE: 'elite'
};

export const FEATURES = {
    // Phase 1-2: Core
    BASIC_TRADING: 'free',
    REAL_TIME_PNL: 'free',

    // Phase 2-4: Pro Foundations
    STRATEGY_TAGGING: 'pro',
    EMOTION_TRACKING: 'pro',
    DISCIPLINE_SCORING: 'pro',
    AI_DEBRIEF: 'pro',
    TRADE_PLAN: 'pro',  // Stop loss, targets, thesis capture

    // Phase 5-6: Advanced Pro
    EQUITY_CHARTS: 'pro',
    DETAILED_LOGS: 'pro',
    ADVANCED_ANALYTICS: 'pro',
    RISK_ADJUSTED_METRICS: 'pro',
    SHARE_TO_X: 'pro',

    // Phase 6+: Elite
    TILT_DETECTION: 'elite',
    SESSION_REPLAY: 'elite',
    ADVANCED_COACHING: 'elite',
    BEHAVIOR_BASELINE: 'elite',
    MARKET_CONTEXT: 'elite',
    TRADER_PROFILE: 'elite',  // Personal Trader Profile dashboard

    // Explicit tease-card keys (alias existing features for Settings UI)
    PRO_TRADE_PLAN: 'pro',
    PRO_DISCIPLINE: 'pro',
    PRO_STRATEGY_ANALYTICS: 'pro',
    PRO_EMOTION_ANALYTICS: 'pro',
    PRO_AI_DEBRIEF: 'pro',
    ELITE_TILT_DETECTION: 'elite',
    ELITE_RISK_METRICS: 'elite',
    ELITE_SESSION_REPLAY: 'elite',
    ELITE_TRADER_PROFILE: 'elite',
    ELITE_MARKET_CONTEXT: 'elite'
};

/**
 * Display metadata for teased Pro/Elite feature cards.
 * Used by the Settings UI to render locked cards with descriptions.
 */
export const TEASED_FEATURES = {
    PRO: [
        { id: 'PRO_TRADE_PLAN', name: 'Trade Planning', desc: 'Set stop losses, targets, and capture your thesis before every trade.' },
        { id: 'PRO_DISCIPLINE', name: 'Discipline Scoring', desc: 'Track how well you stick to your trading rules with an objective score.' },
        { id: 'PRO_STRATEGY_ANALYTICS', name: 'Strategy Analytics', desc: 'See which strategies perform best and refine your edge.' },
        { id: 'PRO_EMOTION_ANALYTICS', name: 'Emotion Analytics', desc: 'Understand how your emotional state affects your trading outcomes.' },
        { id: 'PRO_AI_DEBRIEF', name: 'AI Trade Debrief', desc: 'Get AI-powered post-trade analysis to accelerate your learning.' },
    ],
    ELITE: [
        { id: 'ELITE_TILT_DETECTION', name: 'Tilt Detection', desc: 'Real-time alerts when your behavior signals emotional trading.' },
        { id: 'ELITE_RISK_METRICS', name: 'Risk Metrics', desc: 'Advanced risk-adjusted performance metrics for serious traders.' },
        { id: 'ELITE_SESSION_REPLAY', name: 'Session Replay', desc: 'Replay your sessions to review decisions and improve execution.' },
        { id: 'ELITE_TRADER_PROFILE', name: 'Trader Profile', desc: 'Your personal trading identity — strengths, weaknesses, and growth.' },
        { id: 'ELITE_MARKET_CONTEXT', name: 'Market Context', desc: 'Overlay market conditions to see how context affected your trades.' },
    ],
};

/**
 * Feature Flag States:
 * - enabled: Background logic/data collection runs
 * - visible: UI elements are rendered in the DOM
 * - interactive: User can click/input/use the feature
 * - gated: Shows upgrade messaging/locking overlay
 */
export const FeatureManager = {
    TIERS,
    FEATURES,

    resolveFlags(state, featureName) {
        const userTier = state.settings?.tier || TIERS.FREE;
        const requiredTier = FEATURES[featureName];

        // Default flags (Kill-switch check first)
        const flags = {
            enabled: false,
            visible: false,
            interactive: false,
            gated: false
        };

        if (!requiredTier) return flags;

        // 1. Tier Entitlement Logic
        const hasEntitlement = this.hasTierAccess(userTier, requiredTier);

        // 2. Rollout Phase Logic (Simulated for Now)
        // Phases: 'beta', 'preview', 'full'
        const phase = state.settings?.rolloutPhase || 'full';

        // 3. Flag Resolution based on Entitlement + Phase
        if (requiredTier === TIERS.FREE) {
            flags.enabled = true;
            flags.visible = true;
            flags.interactive = true;
            flags.gated = false;
        } else {
            // Premium Features
            flags.enabled = true; // Always collect data for analytics if feature exists

            if (hasEntitlement) {
                flags.visible = true;
                flags.interactive = true;
                flags.gated = false;
            } else {
                // Not entitled
                if (phase === 'preview') {
                    flags.visible = true;
                    flags.interactive = true; // Allow preview
                    flags.gated = false;
                } else if (phase === 'beta') {
                    flags.visible = false; // Hidden in silent beta
                    flags.interactive = false;
                } else {
                    // Standard 'full' rollout behavior
                    flags.visible = true;
                    flags.interactive = false;
                    flags.gated = true;
                }
            }
        }

        // 4. Remote Kill-Switch Override (from Store)
        if (state.settings?.featureOverrides?.[featureName] === false) {
            flags.enabled = false;
            flags.visible = false;
            flags.interactive = false;
        }

        return flags;
    },

    hasTierAccess(userTier, requiredTier) {
        if (requiredTier === TIERS.FREE) return true;
        if (requiredTier === TIERS.PRO) return [TIERS.PRO, TIERS.ELITE].includes(userTier);
        if (requiredTier === TIERS.ELITE) return userTier === TIERS.ELITE;
        return false;
    }
};
