import { IDS } from './ids.js';

export const SHADOW_HUD_CSS = `

/* ===== Shadow HUD Root ===== */
#${IDS.shadowHud} {
    z-index: 2147483644;
    pointer-events: auto;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #e2e8f0;
    width: 320px;
}

#${IDS.shadowHud}.floating {
    position: fixed;
    left: 20px;
    top: 400px;
}

#${IDS.shadowHud}.docked {
    position: fixed;
    right: 16px;
    bottom: 100px;
    width: 320px;
}

/* ===== Main Card ===== */
#${IDS.shadowHud} .sh-card {
    background: #0d1117;
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* ===== Header ===== */
#${IDS.shadowHud} .sh-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(139, 92, 246, 0.06);
    border-bottom: 1px solid rgba(139, 92, 246, 0.12);
    cursor: grab;
    user-select: none;
}

#${IDS.shadowHud} .sh-header:active {
    cursor: grabbing;
}

#${IDS.shadowHud} .sh-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

#${IDS.shadowHud} .sh-header-icon {
    color: #a78bfa;
    display: flex;
    align-items: center;
}

#${IDS.shadowHud} .sh-header-title {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #a78bfa;
}

#${IDS.shadowHud} .sh-header-btns {
    display: flex;
    gap: 6px;
}

#${IDS.shadowHud} .sh-header-btns .sh-btn {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.15);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.15s;
}

#${IDS.shadowHud} .sh-header-btns .sh-btn:hover {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
}

#${IDS.shadowHud} .sh-subtitle {
    font-size: 10px;
    color: #64748b;
    padding: 0 14px 8px;
    background: rgba(139, 92, 246, 0.03);
}

/* ===== Section Common ===== */
#${IDS.shadowHud} .sh-section {
    border-top: 1px solid rgba(255, 255, 255, 0.04);
}

#${IDS.shadowHud} .sh-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: pointer;
    transition: background 0.15s;
    user-select: none;
}

#${IDS.shadowHud} .sh-section-header:hover {
    background: rgba(139, 92, 246, 0.04);
}

#${IDS.shadowHud} .sh-section-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

#${IDS.shadowHud} .sh-section-icon {
    color: #8b5cf6;
    opacity: 0.7;
    display: flex;
    align-items: center;
}

#${IDS.shadowHud} .sh-section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
}

#${IDS.shadowHud} .sh-section-chevron {
    color: #475569;
    display: flex;
    align-items: center;
    transition: transform 0.2s;
}

#${IDS.shadowHud} .sh-section-chevron.expanded {
    transform: rotate(180deg);
}

#${IDS.shadowHud} .sh-section-body {
    padding: 0 14px 12px;
}

#${IDS.shadowHud} .sh-section-body.collapsed {
    display: none;
}

/* ===== Market Context — Score Bar ===== */
#${IDS.shadowHud} .sh-trust-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 14px 8px;
}

#${IDS.shadowHud} .sh-trust-score {
    font-size: 13px;
    font-weight: 800;
    color: #e2e8f0;
}

#${IDS.shadowHud} .sh-trust-score .score-val {
    color: #a78bfa;
}

#${IDS.shadowHud} .sh-trust-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
}

#${IDS.shadowHud} .sh-trust-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
}

#${IDS.shadowHud} .sh-trust-bar-fill.low {
    background: #ef4444;
}

#${IDS.shadowHud} .sh-trust-bar-fill.mid {
    background: #f59e0b;
}

#${IDS.shadowHud} .sh-trust-bar-fill.high {
    background: #10b981;
}

/* ===== Micro-Signals ===== */
#${IDS.shadowHud} .sh-signals {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px 8px;
}

#${IDS.shadowHud} .sh-signal-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    position: relative;
}

#${IDS.shadowHud} .sh-signal-dot.positive {
    background: #10b981;
}

#${IDS.shadowHud} .sh-signal-dot.neutral {
    background: #f59e0b;
}

#${IDS.shadowHud} .sh-signal-dot.unavailable {
    background: #475569;
}

#${IDS.shadowHud} .sh-signal-label {
    font-size: 9px;
    color: #64748b;
    margin-left: 2px;
}

/* ===== Tabs (Market Context Expanded) ===== */
#${IDS.shadowHud} .sh-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 8px;
}

#${IDS.shadowHud} .sh-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 4px;
    font-size: 9px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

#${IDS.shadowHud} .sh-tab:hover {
    color: #94a3b8;
    background: rgba(139, 92, 246, 0.04);
}

#${IDS.shadowHud} .sh-tab.active {
    color: #a78bfa;
    border-bottom-color: #8b5cf6;
}

#${IDS.shadowHud} .sh-tab-icon {
    display: flex;
    align-items: center;
    color: inherit;
}

#${IDS.shadowHud} .sh-tab-content {
    max-height: 250px;
    overflow-y: auto;
}

/* ===== Trust Fields (Key-Value Pairs) ===== */
#${IDS.shadowHud} .nt-field {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 5px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

#${IDS.shadowHud} .nt-field:last-child {
    border-bottom: none;
}

#${IDS.shadowHud} .nt-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 80px;
}

#${IDS.shadowHud} .nt-value {
    font-size: 10px;
    color: #cbd5e1;
    text-align: right;
    word-break: break-word;
}

#${IDS.shadowHud} .nt-field.unavailable .nt-value {
    color: #475569;
    font-style: italic;
}

/* ===== Strategy Section ===== */
#${IDS.shadowHud} .sh-strategy-select {
    width: 100%;
    padding: 7px 10px;
    font-size: 11px;
    font-weight: 600;
    background: #0f172a;
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 6px;
    color: #e2e8f0;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 10px;
}

#${IDS.shadowHud} .sh-strategy-select:hover,
#${IDS.shadowHud} .sh-strategy-select:focus {
    border-color: rgba(139, 92, 246, 0.4);
}

#${IDS.shadowHud} .sh-strategy-label {
    font-size: 9px;
    color: #64748b;
    margin-bottom: 6px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

/* ===== Trade Notes Section ===== */
#${IDS.shadowHud} .sh-notes-input {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
}

#${IDS.shadowHud} .sh-notes-textarea {
    flex: 1;
    padding: 7px 10px;
    font-size: 11px;
    font-family: inherit;
    background: #0f172a;
    border: 1px solid rgba(139, 92, 246, 0.12);
    border-radius: 6px;
    color: #e2e8f0;
    resize: none;
    outline: none;
    min-height: 32px;
    max-height: 60px;
    transition: border-color 0.15s;
}

#${IDS.shadowHud} .sh-notes-textarea::placeholder {
    color: #475569;
}

#${IDS.shadowHud} .sh-notes-textarea:focus {
    border-color: rgba(139, 92, 246, 0.4);
}

#${IDS.shadowHud} .sh-notes-add {
    padding: 7px 10px;
    font-size: 10px;
    font-weight: 700;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 6px;
    color: #a78bfa;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
}

#${IDS.shadowHud} .sh-notes-add:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
}

#${IDS.shadowHud} .sh-notes-list {
    max-height: 140px;
    overflow-y: auto;
}

#${IDS.shadowHud} .sh-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

#${IDS.shadowHud} .sh-note:last-child {
    border-bottom: none;
}

#${IDS.shadowHud} .sh-note-time {
    font-size: 9px;
    color: #475569;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 38px;
    padding-top: 1px;
}

#${IDS.shadowHud} .sh-note-text {
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.4;
    flex: 1;
}

#${IDS.shadowHud} .sh-note-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
}

#${IDS.shadowHud} .sh-note:hover .sh-note-actions {
    opacity: 1;
}

#${IDS.shadowHud} .sh-note-action {
    padding: 2px;
    background: none;
    border: none;
    color: #475569;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: color 0.15s;
}

#${IDS.shadowHud} .sh-note-action:hover {
    color: #ef4444;
}

#${IDS.shadowHud} .sh-note-char-count {
    font-size: 9px;
    color: #475569;
    text-align: right;
    margin-top: 2px;
}

/* ===== Loading State ===== */
#${IDS.shadowHud} .sh-trust-loading-state {
    flex-direction: column;
    gap: 6px;
}

#${IDS.shadowHud} .sh-loading-text {
    font-size: 10px;
    color: #8b5cf6;
    font-weight: 600;
    letter-spacing: 0.3px;
}

#${IDS.shadowHud} .sh-loading-bar {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
}

#${IDS.shadowHud} .sh-loading-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, #8b5cf6, #a78bfa, #8b5cf6);
    background-size: 200% 100%;
    animation: shLoadProgress 4s ease-out forwards, shLoadShimmer 1.5s ease-in-out infinite;
}

#${IDS.shadowHud} .sh-signal-loading {
    color: #8b5cf6;
    font-style: italic;
}

@keyframes shLoadProgress {
    0% { width: 5%; }
    30% { width: 35%; }
    60% { width: 55%; }
    80% { width: 70%; }
    100% { width: 80%; }
}

@keyframes shLoadShimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

/* ===== Empty / Loading States ===== */
#${IDS.shadowHud} .sh-empty {
    font-size: 10px;
    color: #475569;
    text-align: center;
    padding: 12px 0;
    font-style: italic;
}

#${IDS.shadowHud} .sh-confidence-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

#${IDS.shadowHud} .sh-confidence-badge.low {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

#${IDS.shadowHud} .sh-confidence-badge.medium {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
}

#${IDS.shadowHud} .sh-confidence-badge.high {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
}

/* ===== Scrollbar ===== */
#${IDS.shadowHud} ::-webkit-scrollbar {
    width: 4px;
}

#${IDS.shadowHud} ::-webkit-scrollbar-track {
    background: transparent;
}

#${IDS.shadowHud} ::-webkit-scrollbar-thumb {
    background: rgba(139, 92, 246, 0.2);
    border-radius: 2px;
}

#${IDS.shadowHud} ::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 92, 246, 0.4);
}
`;
