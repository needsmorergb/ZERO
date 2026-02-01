/**
 * ZERO Modes UI
 * Renders mode badges, session banners, tooltips, and session summary headers.
 * All mode-related UI lives in this file as a separate module.
 */

import { Store } from "../store.js";
import { ModeManager, MODES, MODE_META } from "../mode-manager.js";
import { FeatureManager } from "../featureManager.js";
import { OverlayManager } from "./overlay.js";
import { ICONS } from "./icons.js";

// Track per-session banner display
let sessionBannerShownForSession = null;

/**
 * Get the correct icon SVG string for a mode.
 */
function getModeIcon(mode) {
  if (mode === MODES.ANALYSIS) return ICONS.MODE_ANALYSIS;
  if (mode === MODES.SHADOW) return ICONS.MODE_SHADOW;
  return ICONS.MODE_PAPER;
}

export const ModesUI = {
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

    // Only show once per session ID
    const sessionId = Store.state?.session?.id;
    if (sessionBannerShownForSession === sessionId) return;
    sessionBannerShownForSession = sessionId;

    const container = OverlayManager.getContainer();
    if (!container) return;

    // Don't double-show
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

    // Shadow mode
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

    // Remove all mode classes first
    container.classList.remove("zero-shadow-mode", "zero-analysis-mode");

    // Apply current
    const cls = ModeManager.getContainerClass();
    if (cls) container.classList.add(cls);

    // Also apply to shadow host for :host() CSS selectors (banner lives outside container)
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
    // 'real' = analysis + shadow
    return trades.filter((t) => t.mode === "analysis" || t.mode === "shadow");
  },
};
