import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Analytics } from '../core/analytics.js';
import { Trading } from '../core/trading.js';
import { DASHBOARD_CSS } from './dashboard-styles.js';
import { IDS } from './ids.js';
import { Paywall } from './paywall.js';
import { FeatureManager } from '../featureManager.js';

export const Dashboard = {
    isOpen: false,

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    },

    open() {
        this.isOpen = true;
        this.render();
    },

    close() {
        this.isOpen = false;
        const overlay = OverlayManager.getShadowRoot().querySelector('.paper-dashboard-overlay');
        if (overlay) overlay.remove();
    },

    render() {
        const root = OverlayManager.getShadowRoot();
        let overlay = root.querySelector('.paper-dashboard-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'paper-dashboard-overlay';

            // Inject styles once
            if (!root.getElementById('paper-dashboard-styles')) {
                const style = document.createElement('style');
                style.id = 'paper-dashboard-styles';
                style.textContent = DASHBOARD_CSS;
                root.appendChild(style);
            }

            root.appendChild(overlay);
        }

        const state = Store.state;
        const stats = Analytics.analyzeRecentTrades(state) || { winRate: "0.0", totalTrades: 0, wins: 0, losses: 0, totalPnlSol: 0 };
        const debrief = Analytics.getProfessorDebrief(state);
        const isFree = state.settings.tier === 'free';

        overlay.innerHTML = `
            <div class="paper-dashboard-modal">
                <div class="dashboard-header">
                    <div class="dashboard-title">PRO PERFORMANCE DASHBOARD ${isFree ? '<span style="color:#64748b; font-size:10px; margin-left:10px;">(FREE TIER)</span>' : ''}</div>
                    <div style="display:flex; align-items:center; gap:16px;">
                        ${isFree ? '<button class="dashboard-upgrade-btn" style="background:#14b8a6; color:#0d1117; border:none; padding:6px 14px; border-radius:6px; font-weight:800; font-size:11px; cursor:pointer;">UPGRADE TO PRO</button>' : ''}
                        <button class="dashboard-close">×</button>
                    </div>
                </div>
                <div class="dashboard-content">
                    <div class="main-stats">
                        <div class="stat-grid">
                            <div class="dashboard-card big-stat">
                                <div class="k">Win Rate</div>
                                <div class="v win">${stats.winRate}%</div>
                            </div>
                            <div class="dashboard-card big-stat">
                                <div class="k">Total Trades</div>
                                <div class="v">${stats.totalTrades}</div>
                            </div>
                            <div class="dashboard-card big-stat">
                                <div class="k">Profits</div>
                                <div class="v ${stats.totalPnlSol >= 0 ? 'win' : 'loss'}">${stats.totalPnlSol.toFixed(4)} SOL</div>
                            </div>
                        </div>

                        <div class="dashboard-card" id="dashboard-equity-chart">
                            <div class="dashboard-title" style="font-size:14px; margin-bottom:16px;">EQUITY CURVE</div>
                            <div class="equity-chart-placeholder">
                                [ Chart visualization coming in ZERØ v2.0 ]
                            </div>
                        </div>
                    </div>

                    <div class="side-panel">
                        <div class="professor-critique-box" id="dashboard-professor-box">
                            <div class="professor-title">Professor's Debrief</div>
                            <div class="professor-text">"${debrief.critique}"</div>
                            
                            <div style="margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:12px; color:#64748b;">DISCIPLINE SCORE</span>
                                    <span style="font-size:18px; font-weight:800; color:${debrief.score >= 90 ? '#10b981' : '#f59e0b'}">${debrief.score}</span>
                                </div>
                                <div style="height:6px; background:#1e293b; border-radius:3px; margin-top:8px; overflow:hidden;">
                                    <div style="width:${debrief.score}%; height:100%; background:${debrief.score >= 90 ? '#10b981' : '#f59e0b'};"></div>
                                </div>
                            </div>
                        </div>

                        <div class="trade-mini-list" id="dashboard-recent-logs">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">RECENT LOGS</div>
                            ${this.renderRecentMiniRows(state)}
                        </div>

                        <div style="margin-top:20px;">
                            <button id="dashboard-share-btn" style="width:100%; background:#1d9bf0; color:white; border:none; padding:10px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                                <span>𝕏</span> Share Session
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind events
        overlay.querySelector('.dashboard-close').onclick = () => this.close();

        const upgradeBtn = overlay.querySelector('.dashboard-upgrade-btn');
        if (upgradeBtn) upgradeBtn.onclick = () => Paywall.showUpgradeModal();

        const shareBtn = overlay.querySelector('#dashboard-share-btn');
        if (shareBtn) {
            shareBtn.onclick = () => {
                const text = Analytics.generateXShareText(state);
                const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
            };
        }

        overlay.onclick = (e) => { if (e.target === overlay) this.close(); };

        // Apply Locking
        if (isFree) {
            Paywall.lockFeature(overlay.querySelector('#dashboard-equity-chart'), FeatureManager.FEATURES.EQUITY_CHARTS);
            Paywall.lockFeature(overlay.querySelector('#dashboard-recent-logs'), FeatureManager.FEATURES.DETAILED_LOGS);
            Paywall.lockFeature(overlay.querySelector('#dashboard-professor-box'), FeatureManager.FEATURES.ADVANCED_ANALYTICS);
        }
    },

    renderRecentMiniRows(state) {
        const trades = Object.values(state.trades || {}).sort((a, b) => b.ts - a.ts).slice(0, 5);
        if (trades.length === 0) return '<div style="color:#475569; font-size:12px;">No trade history.</div>';

        return trades.map(t => `
            <div class="mini-row">
                <span style="color:#64748b;">${new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span style="font-weight:700; color:${t.side === 'BUY' ? '#14b8a6' : '#ef4444'}">${t.side}</span>
                <span>${t.symbol}</span>
                <span class="${(t.realizedPnlSol || 0) >= 0 ? 'win' : 'loss'}" style="font-weight:600;">
                    ${t.realizedPnlSol ? (t.realizedPnlSol > 0 ? '+' : '') + t.realizedPnlSol.toFixed(4) : t.solAmount.toFixed(2)}
                </span>
            </div>
        `).join('');
    }
};
