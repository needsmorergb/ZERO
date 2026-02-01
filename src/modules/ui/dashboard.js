import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Analytics } from '../core/analytics.js';
import { FeatureManager } from '../featureManager.js';
import { DASHBOARD_CSS } from './dashboard-styles.js';
import { Market } from '../core/market.js';
import { renderEliteLockedCard } from './elite-helpers.js';

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

    computeSessionStats(state) {
        const session = Store.getActiveSession();
        const tradesMap = Store.getActiveTrades();
        const sessionTradeIds = session.trades || [];
        const allSessionTrades = sessionTradeIds
            .map(id => tradesMap[id])
            .filter(Boolean)
            .sort((a, b) => a.ts - b.ts);

        // Exits: SELL, EXIT, or any trade with realizedPnlSol
        const exits = allSessionTrades.filter(t =>
            t.side === 'SELL' || t.side === 'EXIT' || t.realizedPnlSol !== undefined
        );

        const wins = exits.filter(t => (t.realizedPnlSol || 0) > 0).length;
        const losses = exits.filter(t => (t.realizedPnlSol || 0) < 0).length;
        const winRate = exits.length > 0 ? (wins / exits.length * 100) : 0;

        // Profit Factor
        const grossProfits = exits.reduce((sum, t) => sum + Math.max(0, t.realizedPnlSol || 0), 0);
        const grossLosses = Math.abs(exits.reduce((sum, t) => sum + Math.min(0, t.realizedPnlSol || 0), 0));
        const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses) : (grossProfits > 0 ? Infinity : 0);

        // Max Drawdown
        let peak = 0, maxDd = 0, runningBal = 0;
        exits.forEach(t => {
            runningBal += (t.realizedPnlSol || 0);
            if (runningBal > peak) peak = runningBal;
            const dd = peak - runningBal;
            if (dd > maxDd) maxDd = dd;
        });

        // Worst trade
        let worstTradePnl = 0;
        exits.forEach(t => {
            const pnl = t.realizedPnlSol || 0;
            if (pnl < worstTradePnl) worstTradePnl = pnl;
        });

        // Longest streaks
        let maxWinStreak = 0, maxLossStreak = 0;
        let curWin = 0, curLoss = 0;
        exits.forEach(t => {
            const pnl = t.realizedPnlSol || 0;
            if (pnl > 0) {
                curWin++;
                curLoss = 0;
                if (curWin > maxWinStreak) maxWinStreak = curWin;
            } else if (pnl < 0) {
                curLoss++;
                curWin = 0;
                if (curLoss > maxLossStreak) maxLossStreak = curLoss;
            }
        });

        // Avg trade P&L
        const avgPnl = exits.length > 0
            ? exits.reduce((sum, t) => sum + (t.realizedPnlSol || 0), 0) / exits.length
            : 0;

        // Session P&L
        const sessionPnl = session.realized || 0;
        const isShadow = Store.isShadowMode();
        // Shadow: use total invested as denominator. Paper: use startSol.
        const positions = Store.getActivePositions();
        const totalInvestedSol = Object.values(positions || {}).reduce((sum, pos) => sum + (pos.totalSolSpent || 0), 0);
        const startSol = isShadow ? (totalInvestedSol || session.balance || 1) : (state.settings.startSol || 10);
        const sessionPnlPct = startSol > 0 ? (sessionPnl / startSol) * 100 : 0;

        // Duration
        const startTime = session.startTime || Date.now();
        const endTime = session.endTime || Date.now();
        const durationMs = endTime - startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationHr = Math.floor(durationMin / 60);
        const durationRemMin = durationMin % 60;

        let durationStr;
        if (durationHr > 0) {
            durationStr = `${durationHr}h ${durationRemMin}m`;
        } else {
            durationStr = `${durationMin}m`;
        }

        const endTimeStr = new Date(endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
            totalTrades: allSessionTrades.length,
            exitCount: exits.length,
            wins,
            losses,
            winRate,
            profitFactor,
            maxDrawdown: maxDd,
            worstTradePnl,
            maxWinStreak,
            maxLossStreak,
            avgPnl,
            sessionPnl,
            sessionPnlPct,
            durationStr,
            endTimeStr,
            hasExits: exits.length > 0
        };
    },

    render() {
        const root = OverlayManager.getShadowRoot();
        let overlay = root.querySelector('.paper-dashboard-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'paper-dashboard-overlay';

            if (!root.getElementById('paper-dashboard-styles')) {
                const style = document.createElement('style');
                style.id = 'paper-dashboard-styles';
                style.textContent = DASHBOARD_CSS;
                root.appendChild(style);
            }

            root.appendChild(overlay);
        }

        const state = Store.state;
        const session = Store.getActiveSession();
        const behavior = Store.getActiveBehavior();
        const stats = this.computeSessionStats(state);
        const hasEquityData = (session.equityHistory || []).length >= 2;

        // Formatting helpers
        const pnlSign = stats.sessionPnl >= 0 ? '+' : '';
        const pnlClass = stats.sessionPnl >= 0 ? 'win' : 'loss';
        const pnlPctStr = `${stats.sessionPnlPct >= 0 ? '+' : ''}${stats.sessionPnlPct.toFixed(1)}%`;

        const fmtPnl = (v) => {
            if (!Number.isFinite(v) || v === 0) return '\u2014';
            return `${v >= 0 ? '+' : ''}${v.toFixed(4)} SOL`;
        };

        const fmtPf = (v) => {
            if (v === 0) return '\u2014';
            if (v === Infinity) return '\u221E';
            return v.toFixed(2);
        };

        const isEmpty = stats.totalTrades === 0;
        const isElite = FeatureManager.isElite(state);

        // Subtext based on trading mode
        const subtext = state.settings.tradingMode === 'shadow'
            ? 'Real trades analyzed'
            : 'Paper session results';

        overlay.innerHTML = `
            <div class="paper-dashboard-modal">
                <div class="dash-header">
                    <div>
                        <div class="dash-title">Session Summary</div>
                        <div class="dash-subtitle">${subtext}</div>
                    </div>
                    <button class="dash-close" id="dashboard-close-btn">\u2715</button>
                </div>
                <div class="dash-scroll">
                    <div class="dash-hero ${isEmpty ? '' : pnlClass + '-bg'}">
                        <div class="dash-hero-label">SESSION RESULT</div>
                        ${isEmpty
                            ? `<div class="dash-hero-value" style="color:#64748b;">No trades in this session</div>
                               <div class="dash-hero-meta">Duration ${stats.durationStr}</div>`
                            : `<div class="dash-hero-value ${pnlClass}">${pnlSign}${stats.sessionPnl.toFixed(4)} SOL</div>
                               <div class="dash-hero-pct ${pnlClass}">${pnlPctStr}</div>
                               <div class="dash-hero-meta">Duration ${stats.durationStr} \u00B7 ${stats.endTimeStr}</div>`
                        }
                    </div>

                    ${!isEmpty ? `
                    <div class="dash-metrics-row">
                        <div>
                            <div class="dash-group-label">TRADE QUALITY</div>
                            <div class="dash-metric-pair">
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Win Rate</div>
                                    <div class="dash-metric-v ${stats.hasExits && stats.winRate >= 50 ? 'win' : (stats.hasExits && stats.winRate < 50 ? 'loss' : '')}">${stats.hasExits ? stats.winRate.toFixed(1) + '%' : '\u2014'}</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Profit Factor</div>
                                    <div class="dash-metric-v" style="color:#818cf8;">${stats.hasExits ? fmtPf(stats.profitFactor) : '\u2014'}</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="dash-group-label">RISK EXPOSURE</div>
                            <div class="dash-metric-pair">
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Max Drawdown</div>
                                    <div class="dash-metric-v loss">${stats.maxDrawdown > 0 ? '-' + stats.maxDrawdown.toFixed(4) + ' SOL' : '\u2014'}</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Worst Trade</div>
                                    <div class="dash-metric-v loss">${stats.worstTradePnl < 0 ? stats.worstTradePnl.toFixed(4) + ' SOL' : '\u2014'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${hasEquityData ? `
                    <div class="dash-card dash-equity-section">
                        <div class="dash-section-label">EQUITY CURVE</div>
                        <canvas id="equity-canvas"></canvas>
                    </div>
                    ` : ''}

                    <div class="dash-bottom-row">
                        <div class="dash-card dash-facts">
                            <div class="dash-section-label">SESSION FACTS</div>
                            <div class="dash-facts-grid">
                                <div class="dash-fact"><span class="dash-fact-k">Trades taken</span><span class="dash-fact-v">${stats.totalTrades}</span></div>
                                ${stats.hasExits ? `
                                <div class="dash-fact"><span class="dash-fact-k">Wins / Losses</span><span class="dash-fact-v">${stats.wins} / ${stats.losses}</span></div>
                                ${stats.maxWinStreak > 0 ? `<div class="dash-fact"><span class="dash-fact-k">Best win streak</span><span class="dash-fact-v win">${stats.maxWinStreak}</span></div>` : ''}
                                ${stats.maxLossStreak > 0 ? `<div class="dash-fact"><span class="dash-fact-k">Worst loss streak</span><span class="dash-fact-v loss">${stats.maxLossStreak}</span></div>` : ''}
                                <div class="dash-fact"><span class="dash-fact-k">Avg trade P&L</span><span class="dash-fact-v ${stats.avgPnl >= 0 ? 'win' : 'loss'}">${fmtPnl(stats.avgPnl)}</span></div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="dash-card dash-notes">
                            <div class="dash-section-label">SESSION NOTES</div>
                            <textarea class="dash-notes-input" id="dash-session-notes" maxlength="280" placeholder="Add a note about this session...">${session.notes || ''}</textarea>
                            <div class="dash-notes-footer">
                                <span class="dash-notes-count" id="dash-notes-count">${(session.notes || '').length}/280</span>
                                <button class="dash-notes-save" id="dash-notes-save">Save note</button>
                            </div>
                        </div>
                    </div>

                    <div class="dash-share-section">
                        <button class="dash-share-btn" id="dashboard-share-btn">
                            <span style="font-size:16px;">\uD835\uDD4F</span>
                            <span>Share session summary</span>
                        </button>
                        <div class="dash-share-sub">Includes paper session stats only</div>
                    </div>

                    <div class="dash-elite-section">
                        <div class="dash-elite-toggle" id="dash-elite-toggle">
                            <div class="dash-elite-toggle-left">
                                <span class="dash-section-label" style="margin-bottom:0;">ADVANCED INSIGHTS</span>
                                <span class="dash-elite-badge">Elite</span>
                            </div>
                            <span class="dash-elite-chevron" id="dash-elite-chevron">\u25B8</span>
                        </div>
                        <div class="dash-elite-content" id="dash-elite-content" style="display:none;">
                            ${isElite ? `
                            <div class="dash-elite-grid">
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Discipline Score</div>
                                    <div class="dash-metric-v" style="color:#8b5cf6;">${session.disciplineScore || 100}</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Consistency</div>
                                    <div class="dash-metric-v" style="color:#8b5cf6;">\u2014</div>
                                </div>
                                <div class="dash-metric-card">
                                    <div class="dash-metric-k">Behavior Profile</div>
                                    <div class="dash-metric-v" style="color:#8b5cf6;">${behavior?.profile || 'Disciplined'}</div>
                                </div>
                            </div>
                            ` : `
                            <div class="dash-elite-grid">
                                ${renderEliteLockedCard('Discipline Scoring', 'Track how well you stick to your trading rules with an objective score.')}
                                ${renderEliteLockedCard('Risk Metrics', 'Advanced risk-adjusted performance metrics for serious traders.')}
                                ${renderEliteLockedCard('Behavioral Patterns', 'Understand how your emotional state affects your trading outcomes.')}
                            </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event bindings
        const self = this;

        const closeBtn = overlay.querySelector('#dashboard-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                self.close();
            });
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) self.close();
        };

        // Share button
        const shareBtn = overlay.querySelector('#dashboard-share-btn');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const text = Analytics.generateXShareText(state);
                const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
            };
        }

        // Session notes
        const notesInput = overlay.querySelector('#dash-session-notes');
        const notesCount = overlay.querySelector('#dash-notes-count');
        const notesSave = overlay.querySelector('#dash-notes-save');

        if (notesInput) {
            notesInput.addEventListener('input', () => {
                if (notesCount) notesCount.textContent = `${notesInput.value.length}/280`;
            });

            notesInput.addEventListener('blur', async () => {
                session.notes = notesInput.value.slice(0, 280);
                await Store.save();
            });
        }

        if (notesSave) {
            notesSave.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                session.notes = notesInput.value.slice(0, 280);
                await Store.save();
                notesSave.textContent = 'Saved';
                notesSave.style.color = '#10b981';
                setTimeout(() => {
                    notesSave.textContent = 'Save note';
                    notesSave.style.color = '';
                }, 1500);
            });
        }

        // Elite insights toggle
        const eliteToggle = overlay.querySelector('#dash-elite-toggle');
        const eliteContent = overlay.querySelector('#dash-elite-content');
        const eliteChevron = overlay.querySelector('#dash-elite-chevron');
        if (eliteToggle && eliteContent) {
            eliteToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const open = eliteContent.style.display !== 'none';
                eliteContent.style.display = open ? 'none' : 'block';
                if (eliteChevron) eliteChevron.textContent = open ? '\u25B8' : '\u25BE';
            });
        }

        // Draw equity curve if data exists
        if (hasEquityData) {
            setTimeout(() => this.drawEquityCurve(overlay, state), 100);
        }
    },

    drawEquityCurve(root, state) {
        const canvas = root.querySelector('#equity-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const session = Store.getActiveSession();
        const history = session.equityHistory || [];
        if (history.length < 2) return;

        // Resize for DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.scale(dpr, dpr);

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const padding = 16;

        const points = history.map(e => e.equity);
        const min = Math.min(...points) * 0.99;
        const max = Math.max(...points) * 1.01;
        const range = max - min;

        ctx.clearRect(0, 0, w, h);

        // Line
        ctx.beginPath();
        ctx.strokeStyle = '#14b8a6';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';

        history.forEach((entry, i) => {
            const x = padding + (i / (history.length - 1)) * (w - padding * 2);
            const y = h - padding - ((entry.equity - min) / range) * (h - padding * 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(20, 184, 166, 0.15)');
        grad.addColorStop(1, 'rgba(20, 184, 166, 0)');
        ctx.lineTo(w - padding, h - padding);
        ctx.lineTo(padding, h - padding);
        ctx.fillStyle = grad;
        ctx.fill();
    }
};
