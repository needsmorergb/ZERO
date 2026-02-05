/**
 * ZERO Shadow Insights Modal CSS
 * Styles for the Shadow Mode "aha moment" modal shown after first session.
 */

export const SHADOW_INSIGHTS_CSS = `
/* ==========================================
   SHADOW INSIGHTS MODAL
   ========================================== */

.zero-shadow-insights-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    animation: modeFadeIn 0.3s ease-out;
}

.zero-shadow-insights-modal {
    width: 400px;
    background: #0f172a;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 14px;
    padding: 28px 24px 20px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: modeSlideIn 0.35s ease-out;
}

.zero-shadow-insights-modal .si-header {
    margin-bottom: 20px;
}

.zero-shadow-insights-modal .si-title {
    font-size: 16px;
    font-weight: 700;
    color: #a78bfa;
    letter-spacing: 0.3px;
    margin-bottom: 6px;
}

.zero-shadow-insights-modal .si-subtitle {
    font-size: 12px;
    color: #64748b;
    line-height: 1.5;
}

/* Individual insight card */
.zero-shadow-insights-modal .si-insight {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: rgba(139, 92, 246, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.1);
    border-radius: 10px;
    margin-bottom: 8px;
}

.zero-shadow-insights-modal .si-insight-num {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #a78bfa;
}

.zero-shadow-insights-modal .si-insight-text {
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.55;
}

.zero-shadow-insights-modal .si-insight-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #64748b;
    margin-bottom: 3px;
}

/* Footer disclaimer */
.zero-shadow-insights-modal .si-footer {
    font-size: 11px;
    color: #475569;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-style: italic;
}

/* Action button */
.zero-shadow-insights-modal .si-action {
    display: block;
    width: 100%;
    margin-top: 16px;
    padding: 11px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
    letter-spacing: 0.2px;
}

.zero-shadow-insights-modal .si-action:hover {
    background: rgba(139, 92, 246, 0.2);
}

/* Dual CTA buttons for Replay + Review */
.zero-shadow-insights-modal .si-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
}

.zero-shadow-insights-modal .si-action-primary {
    display: block;
    width: 100%;
    padding: 11px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.12));
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 8px;
    color: #e9d5ff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
    letter-spacing: 0.2px;
}

.zero-shadow-insights-modal .si-action-primary:hover {
    background: rgba(139, 92, 246, 0.3);
}

.zero-shadow-insights-modal .si-action-secondary {
    display: block;
    width: 100%;
    padding: 11px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
    letter-spacing: 0.2px;
}

.zero-shadow-insights-modal .si-action-secondary:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #94a3b8;
}
`;
