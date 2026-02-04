/**
 * ZERO Mode Manager
 * Central definitions and logic for the three trading modes.
 *
 * Modes:
 *   paper    - Simulated trades, BUY/SELL HUD visible (Free)
 *   analysis - Observes real trades only, no HUD, no interpretation (Free)
 *   shadow   - Observes real trades, elite behavioral analysis, no HUD (Elite)
 */

import { Store } from "./store.js";
import { FeatureManager } from "./featureManager.js";

export const MODES = {
  PAPER: "paper",
  ANALYSIS: "analysis",
  SHADOW: "shadow",
};

export const MODE_META = {
  [MODES.PAPER]: {
    label: "PAPER MODE",
    badge: "PAPER MODE",
    tier: "free",
    showBuyHud: true,
    isRealTrading: false,
    shareCopy: "Paper trading session tracked with ZERO.",
    sessionBanner: null, // Paper mode has no session disclaimer
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
      footer: "No execution. No automation. Analysis only.",
    },
    tooltip: "ZERO does not execute or automate trades in this mode.",
    subtext: "Observing real trades only",
    summaryHeader: "Session Summary \u2014 Real Trades",
    summarySubheader: "Observed \u2022 No interpretation applied",
    summaryFooter: "Advanced behavioral insights are available in Shadow Mode.",
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
      footer: "No execution. No automation. Elite analysis active.",
    },
    tooltip: "ZERO observes and analyzes your real trades using advanced behavioral patterns.",
    subtext: "Elite behavioral analysis active",
  },
};

export const ModeManager = {
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

    // Shadow requires Elite
    if (mode === MODES.SHADOW && !FeatureManager.isElite(Store.state)) {
      return false;
    }

    Store.state.settings.tradingMode = mode;

    // Ensure shadow session is initialized on first entry
    if (mode === MODES.SHADOW) {
      const ss = Store.state.shadowSession;
      if (!ss.id) {
        ss.id = "shadow_" + Date.now();
        ss.startTime = Date.now();
        ss.status = "active";
        console.log("[ModeManager] Shadow session initialized:", ss.id);
      }
    }

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
    if (FeatureManager.isElite(Store.state)) return "zero-shadow-mode";
    if (this.getMode() === MODES.ANALYSIS) return "zero-analysis-mode";
    return "";
  },

  /**
   * Whether the Shadow HUD should be rendered in the DOM.
   */
  shouldShowShadowHud() {
    return FeatureManager.isElite(Store.state);
  },

  /**
   * Check if Shadow Mode first-session aha moment should show.
   * Returns true only once per user (first shadow session completion).
   */
  shouldShowShadowAha() {
    if (!FeatureManager.isElite(Store.state)) return false;
    return !Store.state.settings._shadowAhaShown;
  },

  /**
   * Mark Shadow aha moment as shown.
   */
  async markShadowAhaShown() {
    Store.state.settings._shadowAhaShown = true;
    await Store.save();
  },
};
