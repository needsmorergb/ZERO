export const TIERS = {
    FREE: 'free',
    PRO: 'pro',
    ELITE: 'elite'
};

export const FEATURES = {
    BASIC_TRADING: 'free',
    REAL_TIME_PNL: 'free',
    REAL_TRADING_LOG: 'pro',
    DISCIPLINE_SCORING: 'pro',
    EMOTION_TRACKING: 'pro',
    AI_DEBRIEF: 'pro',
    EQUITY_CHARTS: 'pro',
    DETAILED_LOGS: 'pro',
    ADVANCED_ANALYTICS: 'pro',
    TILT_DETECTION: 'elite',
    SESSION_REPLAY: 'elite',
    ADVANCED_COACHING: 'elite'
};

export const FeatureManager = {
    TIERS,
    FEATURES,
    hasFeature: (userTier, featureName) => {
        const required = FEATURES[featureName];
        if (!required) return false;
        if (required === 'free') return true;

        // Elite includes Pro
        if (required === 'pro') return [TIERS.PRO, TIERS.ELITE].includes(userTier);
        if (required === 'elite') return userTier === TIERS.ELITE;

        return false;
    }
};
