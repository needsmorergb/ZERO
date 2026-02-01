export const TIERS = {
  FREE: "free",
  ELITE: "elite",
};

export const FEATURES = {
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
  ELITE_MARKET_CONTEXT: "elite",
};

/**
 * Display metadata for Elite feature cards.
 * Used by Settings, Dashboard, and Insights UI to render locked cards.
 */
export const TEASED_FEATURES = {
  ELITE: [
    {
      id: "ELITE_TRADE_PLAN",
      name: "Trade Planning",
      desc: "Set stop losses, targets, and capture your thesis before every trade.",
    },
    {
      id: "ELITE_DISCIPLINE",
      name: "Discipline Scoring",
      desc: "Track how well you stick to your trading rules with an objective score.",
    },
    {
      id: "ELITE_STRATEGY_ANALYTICS",
      name: "Strategy Insights",
      desc: "See which strategies perform best across sessions.",
    },
    {
      id: "ELITE_EMOTION_ANALYTICS",
      name: "Emotion Insights",
      desc: "Understand how your emotional state affects your trading outcomes.",
    },
    {
      id: "ELITE_AI_DEBRIEF",
      name: "AI Trade Debrief",
      desc: "Post-session behavioral analysis to accelerate your learning.",
    },
    {
      id: "ELITE_TILT_DETECTION",
      name: "Tilt Detection",
      desc: "Real-time alerts when your behavior signals emotional trading.",
    },
    {
      id: "ELITE_RISK_METRICS",
      name: "Risk Metrics",
      desc: "Advanced risk-adjusted performance metrics for serious traders.",
    },
    {
      id: "ELITE_SESSION_REPLAY",
      name: "Session Replay",
      desc: "Replay your sessions to review decisions and improve execution.",
    },
    {
      id: "ELITE_TRADER_PROFILE",
      name: "Trader Profile",
      desc: "Your personal trading identity \u2014 strengths, weaknesses, and growth.",
    },
    {
      id: "ELITE_MARKET_CONTEXT",
      name: "Market Context",
      desc: "Overlay market conditions to see how context affected your trades.",
    },
    {
      id: "ELITE_NARRATIVE_TRUST",
      name: "Narrative Trust",
      desc: "Observe social signals, community presence, and developer history for any token.",
    },
  ],
};

/**
 * Feature Flag States:
 * - enabled: Background logic/data collection runs
 * - visible: UI elements are rendered in the DOM (may show locked card)
 * - interactive: User can click/input/use the feature
 * - gated: Shows locked card / upgrade messaging
 */
export const FeatureManager = {
  TIERS,
  FEATURES,

  resolveFlags(state, featureName) {
    const userTier = state.settings?.tier || TIERS.FREE;
    const requiredTier = FEATURES[featureName];

    const flags = {
      enabled: false,
      visible: false,
      interactive: false,
      gated: false,
    };

    if (!requiredTier) return flags;

    const hasEntitlement = this.hasTierAccess(userTier, requiredTier);

    // Flag Resolution
    if (requiredTier === TIERS.FREE) {
      flags.enabled = true;
      flags.visible = true;
      flags.interactive = true;
      flags.gated = false;
    } else {
      // Elite Features
      flags.enabled = true; // Always collect data for analytics

      if (hasEntitlement) {
        flags.visible = true;
        flags.interactive = true;
        flags.gated = false;
      } else {
        // Not entitled — visible but locked (enables locked card rendering)
        flags.visible = true;
        flags.interactive = false;
        flags.gated = true;
      }
    }

    // Remote Kill-Switch Override
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
  },
};
