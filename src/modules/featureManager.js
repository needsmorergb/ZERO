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
    MARKET_CONTEXT: 'elite'
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
