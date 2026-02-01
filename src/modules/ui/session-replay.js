import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Analytics, EVENT_CATEGORIES } from '../core/analytics.js';
import { FeatureManager } from '../featureManager.js';
import { Paywall } from './paywall.js';
import { ICONS } from './icons.js';

export const SESSION_REPLAY_CSS = `
.replay-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.replay-modal {
    background: linear-gradient(145deg, #0d1117, #161b22);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    width: 800px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
}

.replay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    background: rgba(139, 92, 246, 0.05);
}

.replay-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 800;
    color: #a78bfa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.replay-title svg {
    width: 20px;
    height: 20px;
}

.replay-close {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.replay-close:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
}

.replay-stats {
    display: flex;
    gap: 20px;
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.replay-stat {
    text-align: center;
}

.replay-stat .k {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.replay-stat .v {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
}

.replay-filters {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-wrap: wrap;
}

.filter-btn {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: #64748b;
}

.filter-btn:hover {
    background: rgba(255, 255, 255, 0.05);
}

.filter-btn.active {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: #a78bfa;
}

.filter-btn.trade { --accent: #14b8a6; }
.filter-btn.alert { --accent: #ef4444; }
.filter-btn.discipline { --accent: #f59e0b; }
.filter-btn.milestone { --accent: #10b981; }

.filter-btn.active.trade { background: rgba(20, 184, 166, 0.2); border-color: rgba(20, 184, 166, 0.5); color: #14b8a6; }
.filter-btn.active.alert { background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); color: #ef4444; }
.filter-btn.active.discipline { background: rgba(245, 158, 11, 0.2); border-color: rgba(245, 158, 11, 0.5); color: #f59e0b; }
.filter-btn.active.milestone { background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.5); color: #10b981; }

.replay-timeline {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
}

.timeline-empty {
    text-align: center;
    padding: 40px 20px;
    color: #64748b;
}

.timeline-empty svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
}

.timeline-event {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    transition: background 0.2s;
}

.timeline-event:hover {
    background: rgba(255, 255, 255, 0.02);
    margin: 0 -20px;
    padding: 12px 20px;
}

.timeline-event:last-child {
    border-bottom: none;
}

.event-time {
    flex-shrink: 0;
    width: 60px;
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
}

.event-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.event-icon.trade { background: rgba(20, 184, 166, 0.15); color: #14b8a6; }
.event-icon.alert { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.event-icon.discipline { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.event-icon.milestone { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.event-icon.system { background: rgba(99, 102, 241, 0.15); color: #6366f1; }

.event-content {
    flex: 1;
    min-width: 0;
}

.event-type {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}

.event-type.trade { color: #14b8a6; }
.event-type.alert { color: #ef4444; }
.event-type.discipline { color: #f59e0b; }
.event-type.milestone { color: #10b981; }
.event-type.system { color: #6366f1; }

.event-message {
    font-size: 13px;
    color: #e2e8f0;
    line-height: 1.4;
}

.event-data {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    flex-wrap: wrap;
}

.event-tag {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
}

.event-tag.win { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.event-tag.loss { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.replay-footer {
    padding: 12px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
}

.replay-count {
    font-size: 11px;
    color: #64748b;
}

.replay-elite-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #a78bfa;
    font-weight: 700;
    text-transform: uppercase;
}

.locked-replay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
}

.locked-replay svg {
    width: 64px;
    height: 64px;
    color: #a78bfa;
    margin-bottom: 20px;
}

.locked-replay h3 {
    color: #f8fafc;
    font-size: 18px;
    margin: 0 0 8px;
}

.locked-replay p {
    color: #64748b;
    font-size: 13px;
    margin: 0 0 20px;
    max-width: 300px;
}

.unlock-btn {
    background: linear-gradient(135deg, #8b5cf6, #a78bfa);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.unlock-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(139, 92, 246, 0.3);
}
`;

export const SessionReplay = {
    isOpen: false,
    activeFilters: ['TRADE', 'ALERT', 'DISCIPLINE', 'MILESTONE'],

    open() {
        this.isOpen = true;
        this.render();
    },

    close() {
        this.isOpen = false;
        const overlay = OverlayManager.getShadowRoot().querySelector('.replay-overlay');
        if (overlay) overlay.remove();
    },

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    },

    render() {
        const root = OverlayManager.getShadowRoot();
        let overlay = root.querySelector('.replay-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'replay-overlay';

            // Inject styles
            if (!root.getElementById('replay-styles')) {
                const style = document.createElement('style');
                style.id = 'replay-styles';
                style.textContent = SESSION_REPLAY_CSS;
                root.appendChild(style);
            }

            root.appendChild(overlay);
        }

        const state = Store.state;
        const flags = FeatureManager.resolveFlags(state, 'SESSION_REPLAY');
        const eventStats = Analytics.getEventStats(state);
        const session = Store.getActiveSession();

        if (flags.gated) {
            overlay.innerHTML = this.renderLockedState();
            this.bindLockedEvents(overlay);
            return;
        }

        const events = this.getFilteredEvents(state);

        overlay.innerHTML = `
            <div class="replay-modal">
                <div class="replay-header">
                    <div class="replay-title">
                        ${ICONS.BRAIN}
                        <span>Session Replay</span>
                    </div>
                    <button class="replay-close">${ICONS.X}</button>
                </div>

                <div class="replay-stats">
                    <div class="replay-stat">
                        <div class="k">Session ID</div>
                        <div class="v" style="font-size:11px; color:#a78bfa;">${session.id ? session.id.split('_')[1] : '--'}</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Duration</div>
                        <div class="v">${Store.getSessionDuration()} min</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Total Events</div>
                        <div class="v">${eventStats.total}</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Trades</div>
                        <div class="v" style="color:#14b8a6;">${eventStats.trades}</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Alerts</div>
                        <div class="v" style="color:#ef4444;">${eventStats.alerts}</div>
                    </div>
                    <div class="replay-stat">
                        <div class="k">Discipline</div>
                        <div class="v" style="color:#f59e0b;">${eventStats.disciplineEvents}</div>
                    </div>
                </div>

                <div class="replay-filters">
                    <button class="filter-btn trade ${this.activeFilters.includes('TRADE') ? 'active' : ''}" data-filter="TRADE">
                        Trades (${eventStats.trades})
                    </button>
                    <button class="filter-btn alert ${this.activeFilters.includes('ALERT') ? 'active' : ''}" data-filter="ALERT">
                        Alerts (${eventStats.alerts})
                    </button>
                    <button class="filter-btn discipline ${this.activeFilters.includes('DISCIPLINE') ? 'active' : ''}" data-filter="DISCIPLINE">
                        Discipline (${eventStats.disciplineEvents})
                    </button>
                    <button class="filter-btn milestone ${this.activeFilters.includes('MILESTONE') ? 'active' : ''}" data-filter="MILESTONE">
                        Milestones (${eventStats.milestones})
                    </button>
                </div>

                <div class="replay-timeline">
                    ${events.length > 0 ? this.renderEvents(events) : this.renderEmpty()}
                </div>

                <div class="replay-footer">
                    <div class="replay-count">Showing ${events.length} of ${eventStats.total} events</div>
                    <div class="replay-elite-badge">
                        ${ICONS.BRAIN} ELITE FEATURE
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(overlay);
    },

    renderLockedState() {
        return `
            <div class="replay-modal">
                <div class="replay-header">
                    <div class="replay-title">
                        ${ICONS.BRAIN}
                        <span>Session Replay</span>
                    </div>
                    <button class="replay-close">${ICONS.X}</button>
                </div>
                <div class="locked-replay">
                    ${ICONS.LOCK}
                    <h3>Session Replay is Elite</h3>
                    <p>Review your entire trading session with a visual timeline of trades, alerts, discipline events, and milestones.</p>
                    <button class="unlock-btn">Upgrade to Elite</button>
                </div>
            </div>
        `;
    },

    renderEmpty() {
        return `
            <div class="timeline-empty">
                ${ICONS.TARGET}
                <div style="font-size:14px; font-weight:600; margin-bottom:4px;">No events yet</div>
                <div style="font-size:12px;">Start trading to build your session timeline</div>
            </div>
        `;
    },

    renderEvents(events) {
        return events.map(event => {
            const time = new Date(event.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const category = event.category.toLowerCase();
            const icon = this.getEventIcon(event.category);
            const dataTags = this.renderEventData(event);

            return `
                <div class="timeline-event">
                    <div class="event-time">${time}</div>
                    <div class="event-icon ${category}">${icon}</div>
                    <div class="event-content">
                        <div class="event-type ${category}">${event.type}</div>
                        <div class="event-message">${event.message}</div>
                        ${dataTags ? `<div class="event-data">${dataTags}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderEventData(event) {
        const data = event.data || {};
        const tags = [];

        if (data.symbol) tags.push(`<span class="event-tag">${data.symbol}</span>`);
        if (data.strategy) tags.push(`<span class="event-tag">${data.strategy}</span>`);
        if (data.realizedPnlSol !== undefined && data.realizedPnlSol !== null) {
            const pnl = data.realizedPnlSol;
            const cls = pnl >= 0 ? 'win' : 'loss';
            tags.push(`<span class="event-tag ${cls}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} SOL</span>`);
        }
        if (data.penalty) tags.push(`<span class="event-tag">-${data.penalty} pts</span>`);
        if (data.winStreak) tags.push(`<span class="event-tag win">${data.winStreak}W Streak</span>`);
        if (data.tradeCount) tags.push(`<span class="event-tag">${data.tradeCount} trades</span>`);

        return tags.join('');
    },

    getEventIcon(category) {
        switch (category) {
            case 'TRADE': return ICONS.TARGET;
            case 'ALERT': return ICONS.TILT;
            case 'DISCIPLINE': return ICONS.BRAIN;
            case 'MILESTONE': return ICONS.WIN;
            default: return ICONS.ZERO;
        }
    },

    getFilteredEvents(state) {
        const allEvents = Analytics.getEventLog(state, { limit: 100 });
        return allEvents.filter(e => this.activeFilters.includes(e.category));
    },

    toggleFilter(category) {
        const idx = this.activeFilters.indexOf(category);
        if (idx > -1) {
            this.activeFilters.splice(idx, 1);
        } else {
            this.activeFilters.push(category);
        }
        this.render();
    },

    bindEvents(overlay) {
        const closeBtn = overlay.querySelector('.replay-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) this.close();
        };

        overlay.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = () => {
                const filter = btn.getAttribute('data-filter');
                this.toggleFilter(filter);
            };
        });
    },

    bindLockedEvents(overlay) {
        const closeBtn = overlay.querySelector('.replay-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        const unlockBtn = overlay.querySelector('.unlock-btn');
        if (unlockBtn) {
            unlockBtn.onclick = () => {
                this.close();
                Paywall.showUpgradeModal('SESSION_REPLAY');
            };
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) this.close();
        };
    }
};
