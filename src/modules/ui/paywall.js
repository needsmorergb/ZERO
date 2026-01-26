import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { FeatureManager } from '../featureManager.js';

export const Paywall = {
    showUpgradeModal(lockedFeature = null) {
        const root = OverlayManager.getShadowRoot();

        // Remove existing modal if any
        const existing = root.getElementById('paywall-modal-overlay');
        if (existing) existing.remove();

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'paywall-modal-overlay';
        overlay.className = 'paywall-modal-overlay';

        // Feature-specific messaging
        let featureTitle = 'Upgrade to PRO';
        let featureDesc = 'Unlock advanced trading features';

        if (lockedFeature === 'EQUITY_CHARTS') {
            featureTitle = 'Equity Chart - PRO Feature';
            featureDesc = 'Track your equity curve over time with advanced charting';
        } else if (lockedFeature === 'DETAILED_LOGS') {
            featureTitle = 'Detailed Logs - PRO Feature';
            featureDesc = 'Export comprehensive trade logs for analysis';
        } else if (lockedFeature === 'AI_DEBRIEF') {
            featureTitle = 'AI Debrief - PRO Feature';
            featureDesc = 'Get AI-powered insights on your trading patterns';
        } else if (lockedFeature === 'BEHAVIOR_BASELINE') {
            featureTitle = 'Behavioral Profile - ELITE Feature';
            featureDesc = 'Deep psychological profiling and real-time intervention';
        }

        overlay.innerHTML = `
            <div class="paywall-modal">
                <div class="paywall-header">
                    <div class="paywall-badge">
                        <svg class="badge-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        <span>ZERØ PRO</span>
                    </div>
                    <button class="paywall-close" data-act="close">✕</button>
                </div>

                <div class="paywall-hero">
                    <h2 class="paywall-title">${featureTitle}</h2>
                    <p class="paywall-subtitle">${featureDesc}</p>
                </div>

                <div class="paywall-features">
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
                        <div class="feature-text">
                            <div class="feature-name">Equity Charts</div>
                            <div class="feature-desc">Visualize your performance over time</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Advanced AI Debrief</div>
                            <div class="feature-desc">Deep analysis of your trading psychology</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Multi-Token P&L</div>
                            <div class="feature-desc">Track multiple positions simultaneously</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Detailed Trade Logs</div>
                            <div class="feature-desc">Export comprehensive trade history</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Real Trading Mode</div>
                            <div class="feature-desc">Log and track your real trades</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Discipline Tracking</div>
                            <div class="feature-desc">Stay accountable with real-time scoring</div>
                        </div>
                    </div>
                </div>

                <div class="paywall-pricing">
                    <div class="price-tag">
                        <span class="price-amount">$19</span>
                        <span class="price-period">/month</span>
                    </div>
                    <div class="price-subtext">Cancel anytime • 7-day money back guarantee</div>
                </div>

                <div class="paywall-actions">
                    <button class="paywall-btn primary" data-act="upgrade">
                        <span>Upgrade to PRO</span>
                        <span class="btn-icon">→</span>
                    </button>
                    <button class="paywall-btn secondary" data-act="unlock-elite">
                        <span>Unlock ELITE (Dev)</span>
                    </button>
                    <button class="paywall-btn secondary" data-act="demo">
                        <span>Unlock PRO (Dev)</span>
                    </button>
                </div>

                <div class="paywall-footer">
                    <p>Join hundreds of traders improving their discipline</p>
                </div>
            </div>
        `;

        // Event handlers
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('[data-act="close"]')) {
                overlay.remove();
            }

            if (e.target.closest('[data-act="upgrade"]')) {
                this.handleUpgrade();
            }

            if (e.target.closest('[data-act="demo"]')) {
                this.unlockDemo('pro');
                overlay.remove();
            }

            if (e.target.closest('[data-act="unlock-elite"]')) {
                this.unlockDemo('elite');
                overlay.remove();
            }
        });

        root.appendChild(overlay);
    },

    handleUpgrade(tier = 'pro') {
        // Open upgrade page in new tab
        const url = tier === 'elite' ? 'https://zero-trading.com/elite' : 'https://zero-trading.com/pro';
        window.open(url, '_blank');
        console.log(`[Paywall] Redirecting to ${tier.toUpperCase()} upgrade page`);
    },

    unlockDemo(tier = 'pro') {
        // Dev mode: Unlock tier for testing
        Store.state.settings.tier = tier;
        Store.save();
        console.log(`[Paywall] Demo mode unlocked - ${tier.toUpperCase()} tier activated`);

        // Show success message
        const root = OverlayManager.getShadowRoot();
        const toast = document.createElement('div');
        toast.className = 'paywall-toast';
        toast.textContent = `✓ ${tier.toUpperCase()} Demo Unlocked`;
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(16,185,129,0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            z-index: 2147483647;
            pointer-events: none;
            animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;
        root.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    },

    isFeatureLocked(featureName) {
        if (!FeatureManager) return false;
        const flags = FeatureManager.resolveFlags(Store.state, featureName);
        return flags.gated;
    }
};
