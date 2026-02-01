/**
 * ZERO Modes CSS
 * Styles for mode badges, session banners, tooltips, and mode indicators.
 */

export const MODES_CSS = `
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
