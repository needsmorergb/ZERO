import { Store } from "../store.js";
import { OverlayManager } from "./overlay.js";
import { Analytics } from "../core/analytics.js";
import { FeatureManager } from "../featureManager.js";
import { Paywall } from "./paywall.js";
import { ICONS } from "./icons.js";

const PROFILE_CSS = `
.trader-profile-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.trader-profile-modal {
    background: linear-gradient(145deg, #0d1117, #161b22);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    width: 90%;
    max-width: 800px;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(139, 92, 246, 0.1);
}

.profile-header {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.1));
    padding: 20px 24px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.profile-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.profile-avatar {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.profile-title-section h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: #f8fafc;
    letter-spacing: -0.5px;
}

.profile-subtitle {
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.profile-close {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.profile-close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
}

.profile-content {
    padding: 24px;
    overflow-y: auto;
    max-height: calc(85vh - 90px);
}

.profile-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
}

.profile-card {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 18px;
}

.profile-card.full-width {
    grid-column: span 2;
}

.profile-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}

.profile-card-header svg {
    color: #8b5cf6;
}

.profile-card-title {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.strategy-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.strategy-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}

.strategy-name {
    font-weight: 700;
    color: #f8fafc;
    font-size: 13px;
}

.strategy-stats {
    display: flex;
    gap: 12px;
    font-size: 11px;
}

.strategy-stat {
    display: flex;
    align-items: center;
    gap: 4px;
}

.strategy-stat .label {
    color: #64748b;
}

.strategy-stat .value {
    font-weight: 600;
}

.strategy-stat .value.positive {
    color: #10b981;
}

.strategy-stat .value.negative {
    color: #ef4444;
}

.condition-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.condition-item {
    padding: 12px;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 8px;
}

.condition-item.medium {
    background: rgba(245, 158, 11, 0.05);
    border-color: rgba(245, 158, 11, 0.15);
}

.condition-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.condition-label {
    font-weight: 700;
    font-size: 12px;
    color: #f8fafc;
}

.condition-severity {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
}

.condition-severity.high {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
}

.condition-severity.medium {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
}

.condition-stat {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 6px;
}

.condition-advice {
    font-size: 11px;
    color: #64748b;
    font-style: italic;
}

.time-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.time-slot {
    padding: 12px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    text-align: center;
}

.time-slot.best {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.time-slot.worst {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.time-range {
    font-size: 10px;
    color: #64748b;
    margin-bottom: 4px;
}

.time-winrate {
    font-size: 14px;
    font-weight: 800;
    color: #f8fafc;
}

.time-pnl {
    font-size: 10px;
    margin-top: 2px;
}

.session-buckets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.session-bucket {
    padding: 12px 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    text-align: center;
}

.session-bucket.optimal {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
}

.bucket-range {
    font-size: 10px;
    color: #64748b;
    margin-bottom: 4px;
}

.bucket-pnl {
    font-size: 13px;
    font-weight: 700;
}

.bucket-winrate {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
}

.style-display {
    display: flex;
    align-items: center;
    gap: 16px;
}

.style-badge {
    padding: 12px 20px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 10px;
    color: white;
    font-size: 16px;
    font-weight: 800;
}

.style-details {
    flex: 1;
}

.style-description {
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 4px;
}

.style-hold {
    font-size: 11px;
    color: #64748b;
}

.risk-display {
    display: flex;
    gap: 20px;
}

.risk-badge {
    padding: 14px 20px;
    border-radius: 10px;
    text-align: center;
}

.risk-badge.Conservative { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); }
.risk-badge.Moderate { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); }
.risk-badge.Aggressive { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); }
.risk-badge.HighRisk { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }

.risk-label {
    font-size: 14px;
    font-weight: 800;
    color: #f8fafc;
}

.risk-stats {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

.risk-stat {
    text-align: center;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}

.risk-stat .k {
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 4px;
}

.risk-stat .v {
    font-size: 14px;
    font-weight: 700;
    color: #f8fafc;
}

.emotional-patterns {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pattern-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 8px;
}

.pattern-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.pattern-type {
    font-weight: 700;
    font-size: 12px;
    color: #f8fafc;
}

.pattern-freq {
    font-size: 10px;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.2);
    padding: 2px 8px;
    border-radius: 4px;
}

.pattern-advice {
    font-size: 10px;
    color: #64748b;
    max-width: 200px;
    text-align: right;
}

.no-data {
    color: #64748b;
    font-size: 12px;
    text-align: center;
    padding: 20px;
}

.profile-locked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
}

.locked-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.locked-icon svg {
    width: 32px;
    height: 32px;
    color: #8b5cf6;
}

.locked-title {
    font-size: 18px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 8px;
}

.locked-desc {
    font-size: 13px;
    color: #64748b;
    max-width: 400px;
    line-height: 1.6;
    margin-bottom: 24px;
}

.unlock-btn {
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
}

.unlock-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
}

.profile-building {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
}

.building-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: rgba(99, 102, 241, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.building-icon svg {
    width: 32px;
    height: 32px;
    color: #6366f1;
}

.building-title {
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 8px;
}

.building-desc {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 16px;
}

.building-progress {
    width: 200px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
}

.building-progress-bar {
    height: 100%;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 3px;
    transition: width 0.3s;
}
`;

export const TraderProfile = {
  isOpen: false,

  open() {
    this.isOpen = true;
    this.render();
  },

  close() {
    this.isOpen = false;
    const overlay = OverlayManager.getShadowRoot().querySelector(".trader-profile-overlay");
    if (overlay) overlay.remove();
  },

  render() {
    const root = OverlayManager.getShadowRoot();
    let overlay = root.querySelector(".trader-profile-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "trader-profile-overlay";

      if (!root.getElementById("trader-profile-styles")) {
        const style = document.createElement("style");
        style.id = "trader-profile-styles";
        style.textContent = PROFILE_CSS;
        root.appendChild(style);
      }

      root.appendChild(overlay);
    }

    const state = Store.state;
    const flags = FeatureManager.resolveFlags(state, "TRADER_PROFILE");

    // Check if gated
    if (flags.gated) {
      overlay.innerHTML = this.renderLockedState();
      this.bindEvents(overlay);
      return;
    }

    // Generate profile
    const profile = Analytics.generateTraderProfile(state);

    if (!profile.ready) {
      overlay.innerHTML = this.renderBuildingState(profile);
      this.bindEvents(overlay);
      return;
    }

    overlay.innerHTML = this.renderFullProfile(profile);
    this.bindEvents(overlay);
  },

  renderLockedState() {
    return `
            <div class="trader-profile-modal">
                <div class="profile-header">
                    <div class="profile-header-left">
                        <div class="profile-avatar">${ICONS.USER}</div>
                        <div class="profile-title-section">
                            <h2>Personal Trader Profile</h2>
                            <div class="profile-subtitle">Elite Feature</div>
                        </div>
                    </div>
                    <button class="profile-close" id="profile-close-btn">${ICONS.X}</button>
                </div>
                <div class="profile-locked">
                    <div class="locked-icon">${ICONS.LOCK}</div>
                    <div class="locked-title">Unlock Your Trader DNA</div>
                    <div class="locked-desc">
                        Discover your best strategies, worst conditions, optimal session length, and peak trading hours.
                        Your personal trader profile evolves as you trade, giving you data-driven insights to improve.
                    </div>
                    <button class="unlock-btn" id="unlock-profile-btn">Upgrade to ELITE</button>
                </div>
            </div>
        `;
  },

  renderBuildingState(profile) {
    const progress = ((10 - profile.tradesNeeded) / 10) * 100;
    return `
            <div class="trader-profile-modal">
                <div class="profile-header">
                    <div class="profile-header-left">
                        <div class="profile-avatar">${ICONS.USER}</div>
                        <div class="profile-title-section">
                            <h2>Personal Trader Profile</h2>
                            <div class="profile-subtitle">Building Your Profile...</div>
                        </div>
                    </div>
                    <button class="profile-close" id="profile-close-btn">${ICONS.X}</button>
                </div>
                <div class="profile-building">
                    <div class="building-icon">${ICONS.CHART_BAR}</div>
                    <div class="building-title">Profile Under Construction</div>
                    <div class="building-desc">${profile.message}</div>
                    <div class="building-progress">
                        <div class="building-progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
                        ${profile.tradesNeeded} more trades needed
                    </div>
                </div>
            </div>
        `;
  },

  renderFullProfile(profile) {
    return `
            <div class="trader-profile-modal">
                <div class="profile-header">
                    <div class="profile-header-left">
                        <div class="profile-avatar">${ICONS.USER}</div>
                        <div class="profile-title-section">
                            <h2>Personal Trader Profile</h2>
                            <div class="profile-subtitle">${profile.tradeCount} trades analyzed</div>
                        </div>
                    </div>
                    <button class="profile-close" id="profile-close-btn">${ICONS.X}</button>
                </div>
                <div class="profile-content">
                    <div class="profile-grid">
                        <!-- Trading Style -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.TROPHY}
                                <span class="profile-card-title">Trading Style</span>
                            </div>
                            <div class="style-display">
                                <div class="style-badge">${profile.tradingStyle.style}</div>
                                <div class="style-details">
                                    <div class="style-description">${profile.tradingStyle.description}</div>
                                    <div class="style-hold">Avg Hold: ${profile.tradingStyle.avgHold} min</div>
                                </div>
                            </div>
                        </div>

                        <!-- Risk Profile -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.ALERT_CIRCLE}
                                <span class="profile-card-title">Risk Profile</span>
                            </div>
                            <div class="risk-display">
                                <div class="risk-badge ${profile.riskProfile.profile.replace(" ", "")}">
                                    <div class="risk-label">${profile.riskProfile.profile}</div>
                                </div>
                                <div class="risk-stats">
                                    <div class="risk-stat">
                                        <div class="k">Avg Risk</div>
                                        <div class="v">${profile.riskProfile.avgRisk}%</div>
                                    </div>
                                    <div class="risk-stat">
                                        <div class="k">Max Risk</div>
                                        <div class="v">${profile.riskProfile.maxRisk}%</div>
                                    </div>
                                    <div class="risk-stat">
                                        <div class="k">Plan Usage</div>
                                        <div class="v">${profile.riskProfile.planUsageRate}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Best Strategies -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.WIN}
                                <span class="profile-card-title">Best Strategies</span>
                            </div>
                            <div class="strategy-list">
                                ${
                                  profile.bestStrategies.top.length > 0
                                    ? profile.bestStrategies.top
                                        .map(
                                          (s, i) => `
                                    <div class="strategy-item">
                                        <span class="strategy-name">${i + 1}. ${s.name}</span>
                                        <div class="strategy-stats">
                                            <div class="strategy-stat">
                                                <span class="label">Win:</span>
                                                <span class="value positive">${s.winRate}%</span>
                                            </div>
                                            <div class="strategy-stat">
                                                <span class="label">P&L:</span>
                                                <span class="value ${s.totalPnl >= 0 ? "positive" : "negative"}">${s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    </div>
                                `
                                        )
                                        .join("")
                                    : '<div class="no-data">No strategy data yet</div>'
                                }
                            </div>
                        </div>

                        <!-- Worst Conditions -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.TILT}
                                <span class="profile-card-title">Worst Conditions</span>
                            </div>
                            <div class="condition-list">
                                ${
                                  profile.worstConditions.length > 0
                                    ? profile.worstConditions
                                        .map(
                                          (c) => `
                                    <div class="condition-item ${c.severity}">
                                        <div class="condition-header">
                                            <span class="condition-label">${c.label}</span>
                                            <span class="condition-severity ${c.severity}">${c.severity}</span>
                                        </div>
                                        <div class="condition-stat">${c.stat}</div>
                                        <div class="condition-advice">${c.advice}</div>
                                    </div>
                                `
                                        )
                                        .join("")
                                    : '<div class="no-data">No problematic patterns detected</div>'
                                }
                            </div>
                        </div>

                        <!-- Best Time of Day -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.CLOCK}
                                <span class="profile-card-title">Best Time of Day</span>
                            </div>
                            <div class="time-grid">
                                ${
                                  profile.bestTimeOfDay.breakdown &&
                                  profile.bestTimeOfDay.breakdown.length > 0
                                    ? profile.bestTimeOfDay.breakdown
                                        .map(
                                          (t) => `
                                        <div class="time-slot ${t === profile.bestTimeOfDay.best ? "best" : ""} ${t === profile.bestTimeOfDay.worst ? "worst" : ""}">
                                            <div class="time-range">${t.range}</div>
                                            <div class="time-winrate">${t.winRate}%</div>
                                            <div class="time-pnl ${t.pnl >= 0 ? "positive" : "negative"}" style="color: ${t.pnl >= 0 ? "#10b981" : "#ef4444"}">
                                                ${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(3)}
                                            </div>
                                        </div>
                                    `
                                        )
                                        .join("")
                                    : '<div class="no-data" style="grid-column: span 4;">Need more trades across different times</div>'
                                }
                            </div>
                        </div>

                        <!-- Optimal Session Length -->
                        <div class="profile-card">
                            <div class="profile-card-header">
                                ${ICONS.CHART_BAR}
                                <span class="profile-card-title">Optimal Session Length</span>
                            </div>
                            ${
                              profile.optimalSessionLength.optimal
                                ? `
                                <div style="margin-bottom: 12px; font-size: 13px; color: #94a3b8;">
                                    Your best performance: <strong style="color: #8b5cf6;">${profile.optimalSessionLength.optimal}</strong> sessions
                                </div>
                                <div class="session-buckets">
                                    ${Object.entries(profile.optimalSessionLength.buckets)
                                      .map(
                                        ([key, b]) => `
                                        <div class="session-bucket ${b.range === profile.optimalSessionLength.optimal ? "optimal" : ""}">
                                            <div class="bucket-range">${b.range}</div>
                                            <div class="bucket-pnl" style="color: ${parseFloat(b.avgPnl) >= 0 ? "#10b981" : "#ef4444"}">
                                                ${parseFloat(b.avgPnl) >= 0 ? "+" : ""}${b.avgPnl}
                                            </div>
                                            <div class="bucket-winrate">${b.avgWinRate}% WR</div>
                                        </div>
                                    `
                                      )
                                      .join("")}
                                </div>
                            `
                                : '<div class="no-data">Need more session data</div>'
                            }
                        </div>

                        <!-- Emotional Patterns -->
                        ${
                          profile.emotionalPatterns.length > 0
                            ? `
                            <div class="profile-card full-width">
                                <div class="profile-card-header">
                                    ${ICONS.BRAIN}
                                    <span class="profile-card-title">Emotional Patterns to Address</span>
                                </div>
                                <div class="emotional-patterns">
                                    ${profile.emotionalPatterns
                                      .map(
                                        (p) => `
                                        <div class="pattern-item">
                                            <div class="pattern-info">
                                                <span class="pattern-type">${p.type}</span>
                                                <span class="pattern-freq">${p.frequency}x detected</span>
                                            </div>
                                            <div class="pattern-advice">${p.advice}</div>
                                        </div>
                                    `
                                      )
                                      .join("")}
                                </div>
                            </div>
                        `
                            : ""
                        }
                    </div>
                </div>
            </div>
        `;
  },

  bindEvents(overlay) {
    const self = this;

    const closeBtn = overlay.querySelector("#profile-close-btn");
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        self.close();
      };
    }

    const unlockBtn = overlay.querySelector("#unlock-profile-btn");
    if (unlockBtn) {
      unlockBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        self.close();
        Paywall.showUpgradeModal("TRADER_PROFILE");
      };
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        self.close();
      }
    };
  },
};
