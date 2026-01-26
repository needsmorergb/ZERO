import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Analytics } from '../core/analytics.js';
import { Trading } from '../core/trading.js';
import { Market } from '../core/market.js';
import { DASHBOARD_CSS } from './dashboard-styles.js';
import { IDS } from './ids.js';
import { Paywall } from './paywall.js';
import { ICONS } from './icons.js';
import { FeatureManager } from '../featureManager.js';
import { SessionReplay } from './session-replay.js';

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
        const consistency = Analytics.calculateConsistencyScore(state);

        const chartFlags = FeatureManager.resolveFlags(state, 'EQUITY_CHARTS');
        const logFlags = FeatureManager.resolveFlags(state, 'DETAILED_LOGS');
        const aiFlags = FeatureManager.resolveFlags(state, 'ADVANCED_ANALYTICS');
        const shareFlags = FeatureManager.resolveFlags(state, 'SHARE_TO_X');
        const eliteFlags = FeatureManager.resolveFlags(state, 'BEHAVIOR_BASELINE');

        const isFree = state.settings.tier === 'free';

        overlay.innerHTML = `
            <div class="paper-dashboard-modal">
                <div class="dashboard-header">
                    <div class="dashboard-title">PRO PERFORMANCE DASHBOARD ${isFree ? '<span style="color:#64748b; font-size:10px; margin-left:10px;">(FREE TIER)</span>' : ''}</div>
                    <div style="display:flex; align-items:center; gap:16px;">
                        ${isFree ? '<button class="dashboard-upgrade-btn" style="background:#14b8a6; color:#0d1117; border:none; padding:6px 14px; border-radius:6px; font-weight:800; font-size:11px; cursor:pointer;">UPGRADE TO PRO</button>' : ''}
                        <button class="dashboard-close" id="dashboard-close-btn" style="padding:10px; line-height:1; min-width:40px; min-height:40px; display:flex; align-items:center; justify-content:center;">X</button>
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
                                <div class="k">Profit Factor</div>
                                <div class="v" style="color:#6366f1;">${stats.profitFactor}</div>
                            </div>
                            <div class="dashboard-card big-stat">
                                <div class="k">Max Drawdown</div>
                                <div class="v" style="color:#ef4444;">${stats.maxDrawdown} SOL</div>
                            </div>
                            <div class="dashboard-card big-stat">
                                <div class="k">Session P&L</div>
                                <div class="v ${stats.totalPnlSol >= 0 ? 'win' : 'loss'}">${stats.totalPnlSol.toFixed(4)} SOL</div>
                            </div>
                            <div class="dashboard-card big-stat" id="consistency-score-card">
                                <div class="k">Consistency</div>
                                <div class="v" style="color:${consistency.score >= 70 ? '#10b981' : consistency.score >= 50 ? '#f59e0b' : '#64748b'};">
                                    ${consistency.score !== null ? consistency.score : '--'}
                                </div>
                            </div>
                        </div>

                        <div class="dashboard-card" id="dashboard-equity-chart" style="min-height:220px;">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">LIVE EQUITY CURVE</div>
                            <canvas id="equity-canvas"></canvas>
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

                        <div class="behavior-profile-card" id="dashboard-behavior-profile">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">BEHAVIORAL PROFILE</div>
                            <div class="behavior-tag ${state.behavior.profile}">${state.behavior.profile || 'Disciplined'}</div>
                            <div style="font-size:13px; color:#94a3b8; line-height:1.5;">
                                Your trading patterns suggest a **${state.behavior.profile || 'Disciplined'}** archetype this session.
                            </div>
                            <div class="behavior-stats" style="grid-template-columns: repeat(3, 1fr);">
                                <div class="behavior-stat-item">
                                    <div class="k">Tilt</div>
                                    <div class="v">${state.behavior.tiltFrequency || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">FOMO</div>
                                    <div class="v">${state.behavior.fomoTrades || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Panic</div>
                                    <div class="v">${state.behavior.panicSells || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Sunk Cost</div>
                                    <div class="v">${state.behavior.sunkCostFrequency || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Velocity</div>
                                    <div class="v">${state.behavior.overtradingFrequency || 0}</div>
                                </div>
                                <div class="behavior-stat-item">
                                    <div class="k">Neglect</div>
                                    <div class="v">${state.behavior.profitNeglectFrequency || 0}</div>
                                </div>
                            </div>
                        </div>

                        <div class="behavior-profile-card" id="dashboard-market-session" style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1)); border: 1px solid rgba(6, 182, 212, 0.2); margin-top:20px;">
                            <div class="dashboard-title" style="font-size:12px; margin-bottom:12px; opacity:0.6;">MARKET SNAPSHOT</div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                                <div>
                                    <div style="font-size:11px; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Volume (24h)</div>
                                    <div style="font-size:16px; font-weight:800; color:#f8fafc;">
                                        $${Market.context ? (Market.context.vol24h / 1000000).toFixed(1) + 'M' : 'N/A'}
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:11px; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Price Change</div>
                                    <div style="font-size:16px; font-weight:800; color:${Market.context && Market.context.priceChange24h >= 0 ? '#10b981' : '#ef4444'}">
                                        ${Market.context ? Market.context.priceChange24h.toFixed(1) + '%' : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                            <button id="dashboard-share-btn" style="width:100%; background:#1d9bf0; color:white; border:none; padding:10px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                                <span>𝕏</span> Share Session
                            </button>
                            <button id="session-replay-btn" style="width:100%; background:rgba(139,92,246,0.15); color:#a78bfa; border:1px solid rgba(139,92,246,0.3); padding:10px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                                ${ICONS.BRAIN} Session Replay
                                <span style="font-size:9px; background:linear-gradient(135deg,#8b5cf6,#a78bfa); color:white; padding:2px 6px; border-radius:4px; margin-left:4px;">ELITE</span>
                            </button>
                            <div class="export-btns" style="display:flex; gap:8px;">
                                <button id="export-csv-btn" class="export-btn" style="flex:1; background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:8px; border-radius:6px; font-weight:600; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                                    ${ICONS.FILE_CSV} Export CSV
                                </button>
                                <button id="export-json-btn" class="export-btn" style="flex:1; background:rgba(99,102,241,0.1); color:#6366f1; border:1px solid rgba(99,102,241,0.3); padding:8px; border-radius:6px; font-weight:600; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                                    ${ICONS.FILE_JSON} Export JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind events
        const self = this;

        const closeBtn = overlay.querySelector('#dashboard-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Dashboard] Close button clicked');
                self.close();
            });
        }

        const upgradeBtn = overlay.querySelector('.dashboard-upgrade-btn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                Paywall.showUpgradeModal();
            });
        }

        const shareBtn = overlay.querySelector('#dashboard-share-btn');
        if (shareBtn) {
            shareBtn.style.display = shareFlags.visible ? '' : 'none';
            if (shareFlags.gated) {
                shareBtn.style.opacity = '0.5';
                shareBtn.onclick = () => Paywall.showUpgradeModal('SHARE_TO_X');
            } else {
                shareBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const text = Analytics.generateXShareText(state);
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                    window.open(url, '_blank');
                };
            }
        }

        // Export Buttons
        const exportCsvBtn = overlay.querySelector('#export-csv-btn');
        const exportJsonBtn = overlay.querySelector('#export-json-btn');

        if (exportCsvBtn) {
            if (logFlags.gated) {
                exportCsvBtn.style.opacity = '0.5';
                exportCsvBtn.onclick = () => Paywall.showUpgradeModal('DETAILED_LOGS');
            } else {
                exportCsvBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const success = Analytics.exportTradesAsCSV(state);
                    if (success) {
                        exportCsvBtn.textContent = 'Downloaded!';
                        setTimeout(() => { exportCsvBtn.innerHTML = `${ICONS.FILE_CSV} Export CSV`; }, 2000);
                    }
                };
            }
        }

        if (exportJsonBtn) {
            if (logFlags.gated) {
                exportJsonBtn.style.opacity = '0.5';
                exportJsonBtn.onclick = () => Paywall.showUpgradeModal('DETAILED_LOGS');
            } else {
                exportJsonBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    Analytics.exportSessionAsJSON(state);
                    exportJsonBtn.textContent = 'Downloaded!';
                    setTimeout(() => { exportJsonBtn.innerHTML = `${ICONS.FILE_JSON} Export JSON`; }, 2000);
                };
            }
        }

        // Session Replay Button
        const replayBtn = overlay.querySelector('#session-replay-btn');
        if (replayBtn) {
            replayBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                self.close();
                SessionReplay.open();
            };
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                console.log('[Dashboard] Overlay background clicked');
                self.close();
            }
        };

        // Apply Gating
        if (chartFlags.visible) {
            const chartEl = overlay.querySelector('#dashboard-equity-chart');
            if (chartFlags.gated) this.lockSection(chartEl, 'EQUITY_CHARTS');
        } else {
            overlay.querySelector('#dashboard-equity-chart').style.display = 'none';
        }

        if (logFlags.visible) {
            const logEl = overlay.querySelector('#dashboard-recent-logs');
            if (logFlags.gated) this.lockSection(logEl, 'DETAILED_LOGS');
        } else {
            overlay.querySelector('#dashboard-recent-logs').style.display = 'none';
        }

        if (eliteFlags.visible) {
            const eliteEl = overlay.querySelector('#dashboard-behavior-profile');
            if (eliteFlags.gated) this.lockSection(eliteEl, 'BEHAVIOR_BASELINE');
        } else {
            overlay.querySelector('#dashboard-behavior-profile').style.display = 'none';
        }

        if (aiFlags.visible) {
            const aiEl = overlay.querySelector('#dashboard-professor-box');
            if (aiFlags.gated) this.lockSection(aiEl, 'ADVANCED_ANALYTICS');
        } else {
            overlay.querySelector('#dashboard-professor-box').style.display = 'none';
        }

        // Draw Chart if interactive
        if (chartFlags.interactive) {
            setTimeout(() => this.drawEquityCurve(overlay, state), 100);
        }
    },

    drawEquityCurve(root, state) {
        const canvas = root.querySelector('#equity-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const history = state.session.equityHistory || [];
        if (history.length < 2) {
            ctx.fillStyle = "#475569";
            ctx.font = "10px Inter";
            ctx.textAlign = "center";
            ctx.fillText("Need more trades to visualize equity...", canvas.width / 4, canvas.height / 4);
            return;
        }

        // Resize for DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.scale(dpr, dpr);

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const padding = 20;

        const points = history.map(h => h.equity);
        const min = Math.min(...points) * 0.99;
        const max = Math.max(...points) * 1.01;
        const range = max - min;

        ctx.clearRect(0, 0, w, h);

        // Draw Line
        ctx.beginPath();
        ctx.strokeStyle = "#14b8a6";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";

        history.forEach((entry, i) => {
            const x = padding + (i / (history.length - 1)) * (w - padding * 2);
            const y = h - padding - ((entry.equity - min) / range) * (h - padding * 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(20, 184, 166, 0.2)");
        grad.addColorStop(1, "rgba(20, 184, 166, 0)");
        ctx.lineTo(w - padding, h - padding);
        ctx.lineTo(padding, h - padding);
        ctx.fillStyle = grad;
        ctx.fill();
    },

    lockSection(el, featureName) {
        if (!el) return;
        el.style.position = 'relative';
        el.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.className = 'locked-overlay';
        overlay.innerHTML = `
            <div class="locked-icon">${ICONS.LOCK}</div>
            <div class="locked-text">${featureName.includes('ELITE') || featureName === 'BEHAVIOR_BASELINE' ? 'ELITE FEATURE' : 'PRO FEATURE'}</div>
        `;
        overlay.onclick = (e) => {
            e.stopPropagation();
            Paywall.showUpgradeModal(featureName);
        };
        el.appendChild(overlay);
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
