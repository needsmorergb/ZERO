/**
 * Shared Market Context CSS
 * Scoped to .zero-market-context wrapper class.
 * Used by both BuyHud and ShadowHud.
 */

export const MARKET_CONTEXT_CSS = `

/* ===== Section Common ===== */
.zero-market-context .sh-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: pointer;
    transition: background 0.15s;
    user-select: none;
}

.zero-market-context .sh-section-header:hover {
    background: rgba(139, 92, 246, 0.04);
}

.zero-market-context .sh-section-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.zero-market-context .sh-section-icon {
    color: #8b5cf6;
    opacity: 0.7;
    display: flex;
    align-items: center;
}

.zero-market-context .sh-section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
}

.zero-market-context .sh-section-chevron {
    color: #475569;
    display: flex;
    align-items: center;
    transition: transform 0.2s;
}

.zero-market-context .sh-section-chevron.expanded {
    transform: rotate(180deg);
}

.zero-market-context .sh-section-body {
    padding: 0 14px 12px;
}

.zero-market-context .sh-section-body.collapsed {
    display: none;
}

/* ===== Trust Score Bar ===== */
.zero-market-context .sh-trust-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 14px 8px;
}

.zero-market-context .sh-trust-score {
    font-size: 13px;
    font-weight: 800;
    color: #e2e8f0;
}

.zero-market-context .sh-trust-score .score-val {
    color: #a78bfa;
}

.zero-market-context .sh-trust-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
}

.zero-market-context .sh-trust-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
}

.zero-market-context .sh-trust-bar-fill.low {
    background: #ef4444;
}

.zero-market-context .sh-trust-bar-fill.mid {
    background: #f59e0b;
}

.zero-market-context .sh-trust-bar-fill.high {
    background: #10b981;
}

/* ===== Micro-Signals ===== */
.zero-market-context .sh-signals {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px 8px;
}

.zero-market-context .sh-signal-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    position: relative;
}

.zero-market-context .sh-signal-dot.positive {
    background: #10b981;
}

.zero-market-context .sh-signal-dot.neutral {
    background: #f59e0b;
}

.zero-market-context .sh-signal-dot.unavailable {
    background: #475569;
}

.zero-market-context .sh-signal-label {
    font-size: 9px;
    color: #64748b;
    margin-left: 2px;
}

/* ===== Tabs ===== */
.zero-market-context .sh-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 8px;
}

.zero-market-context .sh-tab {
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

.zero-market-context .sh-tab:hover {
    color: #94a3b8;
    background: rgba(139, 92, 246, 0.04);
}

.zero-market-context .sh-tab.active {
    color: #a78bfa;
    border-bottom-color: #8b5cf6;
}

.zero-market-context .sh-tab-icon {
    display: flex;
    align-items: center;
    color: inherit;
}

.zero-market-context .sh-tab-content {
    max-height: 250px;
    overflow-y: auto;
}

/* ===== Trust Fields (Key-Value Pairs) ===== */
.zero-market-context .nt-field {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 5px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.zero-market-context .nt-field:last-child {
    border-bottom: none;
}

.zero-market-context .nt-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 80px;
}

.zero-market-context .nt-value {
    font-size: 10px;
    color: #cbd5e1;
    text-align: right;
    word-break: break-word;
}

.zero-market-context .nt-field.unavailable .nt-value {
    color: #475569;
    font-style: italic;
}

/* ===== Confidence Badge ===== */
.zero-market-context .sh-confidence-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.zero-market-context .sh-confidence-badge.low {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

.zero-market-context .sh-confidence-badge.medium {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
}

.zero-market-context .sh-confidence-badge.high {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
}

/* ===== Loading State ===== */
.zero-market-context .sh-trust-loading-state {
    flex-direction: column;
    gap: 6px;
}

.zero-market-context .sh-loading-text {
    font-size: 10px;
    color: #8b5cf6;
    font-weight: 600;
    letter-spacing: 0.3px;
}

.zero-market-context .sh-loading-bar {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
}

.zero-market-context .sh-loading-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, #8b5cf6, #a78bfa, #8b5cf6);
    background-size: 200% 100%;
    animation: shLoadProgress 4s ease-out forwards, shLoadShimmer 1.5s ease-in-out infinite;
}

.zero-market-context .sh-signal-loading {
    color: #8b5cf6;
    font-style: italic;
}

/* ===== Empty State ===== */
.zero-market-context .sh-empty {
    font-size: 10px;
    color: #475569;
    text-align: center;
    padding: 12px 0;
    font-style: italic;
}

/* ===== Scrollbar ===== */
.zero-market-context ::-webkit-scrollbar {
    width: 4px;
}

.zero-market-context ::-webkit-scrollbar-track {
    background: transparent;
}

.zero-market-context ::-webkit-scrollbar-thumb {
    background: rgba(139, 92, 246, 0.2);
    border-radius: 2px;
}

.zero-market-context ::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 92, 246, 0.4);
}
`;
