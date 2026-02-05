export const DASHBOARD_CSS = `
.paper-dashboard-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #f8fafc;
    pointer-events: auto;
}

.paper-dashboard-modal {
    width: 680px;
    max-width: 95vw;
    max-height: 88vh;
    background: #0f1218;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px -16px rgba(0, 0, 0, 0.7);
}

/* HEADER */
.dash-header {
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}

.dash-title {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
}

.dash-subtitle {
    font-size: 11px;
    color: #475569;
    margin-top: 2px;
    font-weight: 500;
}

.dash-close {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #64748b;
    font-size: 13px;
    cursor: pointer;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    line-height: 1;
}

.dash-close:hover {
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
}

/* SCROLLABLE CONTENT */
.dash-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px 24px;
}

.dash-scroll::-webkit-scrollbar { width: 4px; }
.dash-scroll::-webkit-scrollbar-track { background: transparent; }
.dash-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }

/* HERO SECTION */
.dash-hero {
    text-align: center;
    padding: 28px 20px 24px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 14px;
    margin-bottom: 16px;
}

.dash-hero.win-bg {
    background: rgba(16, 185, 129, 0.03);
    border-color: rgba(16, 185, 129, 0.08);
}

.dash-hero.loss-bg {
    background: rgba(239, 68, 68, 0.03);
    border-color: rgba(239, 68, 68, 0.08);
}

.dash-hero-label {
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    letter-spacing: 1.5px;
    margin-bottom: 10px;
}

.dash-hero-value {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.5px;
}

.dash-hero-pct {
    font-size: 15px;
    font-weight: 600;
    margin-top: 4px;
    opacity: 0.75;
}

.dash-hero-meta {
    font-size: 11px;
    color: #475569;
    margin-top: 10px;
    font-weight: 500;
}

/* METRIC GROUPS */
.dash-metrics-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
}

.dash-group-label {
    font-size: 9px;
    font-weight: 700;
    color: #3f4a5a;
    letter-spacing: 1.2px;
    margin-bottom: 6px;
    padding-left: 2px;
}

.dash-metric-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.dash-metric-card {
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.025);
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
}

.dash-metric-k {
    font-size: 9px;
    color: #4b5563;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
}

.dash-metric-v {
    font-size: 18px;
    font-weight: 800;
    color: #e2e8f0;
}

/* GENERIC CARD */
.dash-card {
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.025);
    border-radius: 12px;
    padding: 16px;
}

.dash-section-label {
    font-size: 9px;
    font-weight: 700;
    color: #3f4a5a;
    letter-spacing: 1.2px;
    margin-bottom: 12px;
}

/* EQUITY CHART */
.dash-equity-section {
    margin-bottom: 16px;
}

canvas#equity-canvas {
    width: 100%;
    height: 120px;
    border-radius: 6px;
}

/* BOTTOM ROW (FACTS + NOTES) */
.dash-bottom-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
}

/* FACTS */
.dash-facts-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.dash-fact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
}

.dash-fact-k {
    color: #64748b;
    font-weight: 500;
}

.dash-fact-v {
    font-weight: 700;
    color: #cbd5e1;
}

/* NOTES */
.dash-notes-input {
    width: 100%;
    height: 72px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    color: #e2e8f0;
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 12px;
    padding: 10px;
    resize: none;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    line-height: 1.5;
}

.dash-notes-input:focus {
    border-color: rgba(20, 184, 166, 0.25);
}

.dash-notes-input::placeholder {
    color: #2d3748;
}

.dash-notes-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
}

.dash-notes-count {
    font-size: 10px;
    color: #2d3748;
    font-weight: 500;
}

.dash-notes-save {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
}

.dash-notes-save:hover {
    color: #e2e8f0;
    border-color: rgba(20, 184, 166, 0.25);
}

/* SHARE SECTION */
.dash-share-section {
    text-align: center;
}

.dash-share-btn {
    width: 100%;
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
    padding: 11px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.15s;
    font-family: inherit;
}

.dash-share-btn:hover {
    background: #1e293b;
    border-color: rgba(255, 255, 255, 0.08);
}

.dash-share-sub {
    font-size: 10px;
    color: #2d3748;
    margin-top: 6px;
    font-weight: 500;
}

/* ELITE INSIGHTS SECTION */
.dash-elite-section {
    margin-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    padding-top: 16px;
}

.dash-elite-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 8px 4px;
    border-radius: 8px;
    transition: background 0.15s;
}

.dash-elite-toggle:hover {
    background: rgba(139, 92, 246, 0.04);
}

.dash-elite-toggle-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.dash-elite-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.dash-elite-chevron {
    color: #475569;
    font-size: 14px;
    transition: transform 0.15s;
}

.dash-elite-content {
    padding-top: 12px;
}

.dash-elite-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* SESSION HISTORY */
.dash-history-row {
    display: flex;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.dash-history-row:last-child { border-bottom: none; }
.dash-history-date { font-size: 11px; color: #94a3b8; font-weight: 600; }
.dash-history-trades { font-size: 10px; color: #64748b; }
.dash-history-pnl { font-size: 12px; font-weight: 700; text-align: right; flex: 1; }
.dash-history-replay {
    font-size: 10px;
    padding: 4px 10px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 4px;
    color: #a78bfa;
    cursor: pointer;
    font-weight: 600;
    margin-left: 8px;
    transition: all 0.15s;
}
.dash-history-replay:hover { background: rgba(139, 92, 246, 0.25); }
.dash-history-empty { text-align: center; color: #64748b; font-size: 11px; padding: 12px 0; font-style: italic; }

/* SHARED UTILITIES */
.win { color: #10b981; }
.loss { color: #ef4444; }
`;
