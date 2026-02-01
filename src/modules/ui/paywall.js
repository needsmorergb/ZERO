import { Store } from "../store.js";
import { OverlayManager } from "./overlay.js";
import { FeatureManager } from "../featureManager.js";
import { License } from "../license.js";
import { ICONS } from "./icons.js";

export const Paywall = {
  showUpgradeModal(lockedFeature = null) {
    const root = OverlayManager.getShadowRoot();

    // Remove existing modal if any
    const existing = root.getElementById("paywall-modal-overlay");
    if (existing) existing.remove();

    // Create modal overlay
    const overlay = document.createElement("div");
    overlay.id = "paywall-modal-overlay";
    overlay.className = "paywall-modal-overlay";

    // Feature-specific messaging
    let featureTitle = "ZERØ Elite";
    let featureDesc = "Advanced behavioral analytics and cross-session insights";

    if (lockedFeature === "TRADE_PLAN") {
      featureTitle = "Trade Planning";
      featureDesc = "Set stop losses, targets, and capture your thesis before every trade.";
    } else if (lockedFeature === "DETAILED_LOGS") {
      featureTitle = "Detailed Logs";
      featureDesc = "Export comprehensive trade logs for analysis.";
    } else if (lockedFeature === "AI_DEBRIEF") {
      featureTitle = "AI Debrief";
      featureDesc = "Post-session behavioral analysis to accelerate your learning.";
    } else if (lockedFeature === "BEHAVIOR_BASELINE") {
      featureTitle = "Behavioral Profile";
      featureDesc = "Deep psychological profiling and real-time intervention.";
    } else if (lockedFeature === "DISCIPLINE_SCORING") {
      featureTitle = "Discipline Scoring";
      featureDesc = "Track how well you stick to your trading rules.";
    } else if (lockedFeature === "MARKET_CONTEXT") {
      featureTitle = "Market Context";
      featureDesc = "Overlay market conditions to see how context affected your trades.";
    }

    overlay.innerHTML = `
            <div class="paywall-modal">
                <div class="paywall-header">
                    <div class="paywall-badge">
                        ${ICONS.ZERO}
                        <span>ZERØ ELITE</span>
                    </div>
                    <button class="paywall-close" data-act="close">${ICONS.X}</button>
                </div>

                <div class="paywall-hero">
                    <h2 class="paywall-title">${featureTitle}</h2>
                    <p class="paywall-subtitle">${featureDesc}</p>
                </div>

                <div class="paywall-features">
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Trade Planning</div>
                            <div class="feature-desc">Stop losses, targets, and thesis capture</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                        <div class="feature-text">
                            <div class="feature-name">Discipline Scoring</div>
                            <div class="feature-desc">Track how well you follow your rules</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        <div class="feature-text">
                            <div class="feature-name">Tilt Detection</div>
                            <div class="feature-desc">Real-time alerts for emotional trading</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        <div class="feature-text">
                            <div class="feature-name">Risk Metrics</div>
                            <div class="feature-desc">Advanced risk-adjusted performance analytics</div>
                        </div>
                    </div>
                    <div class="feature-item">
                        <svg class="feature-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <div class="feature-text">
                            <div class="feature-name">AI Trade Debrief</div>
                            <div class="feature-desc">Post-session behavioral analysis</div>
                        </div>
                    </div>
                </div>

                <div class="paywall-pricing" style="text-align:center; margin:16px 0 8px; font-size:12px; color:#94a3b8; line-height:1.6;">
                    <span style="color:#f8fafc; font-weight:600;">$19/mo</span> &middot;
                    <span style="color:#f8fafc; font-weight:600;">$149/yr</span>
                </div>

                <div class="paywall-actions" style="display:flex; flex-direction:column; gap:8px;">
                    <button class="paywall-btn primary" data-act="purchase" style="background:linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color:white; border:none; padding:12px 20px; border-radius:8px; font-weight:700; font-size:14px; cursor:pointer;">
                        Get Elite on Whop
                    </button>
                    <button class="paywall-btn text" data-act="show-key-input" style="background:none; border:none; color:#8b5cf6; font-size:12px; cursor:pointer; padding:6px;">
                        I have a license key
                    </button>
                </div>

                <div class="paywall-key-section" style="display:none; margin-top:12px;">
                    <div style="display:flex; gap:8px;">
                        <input type="text" class="paywall-license-input" placeholder="Enter license key (mem_xxx...)" maxlength="64"
                            style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:10px 12px; color:#f8fafc; font-size:13px; outline:none;">
                        <button class="paywall-btn" data-act="activate" style="background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); color:#a78bfa; padding:10px 16px; border-radius:6px; font-weight:600; font-size:13px; cursor:pointer; white-space:nowrap;">
                            Activate
                        </button>
                    </div>
                    <div class="paywall-key-status" style="margin-top:8px; font-size:12px; min-height:18px;"></div>
                </div>

                <div class="paywall-footer">
                    <p style="font-size:11px; color:#475569; margin-top:12px;">Manage your membership at whop.com/orders</p>
                </div>
            </div>
        `;

    // Event handlers
    overlay.addEventListener("click", async (e) => {
      if (e.target === overlay || e.target.closest('[data-act="close"]')) {
        overlay.remove();
      }

      if (e.target.closest('[data-act="purchase"]')) {
        License.openPurchasePage();
      }

      if (e.target.closest('[data-act="show-key-input"]')) {
        const keySection = overlay.querySelector(".paywall-key-section");
        if (keySection) {
          keySection.style.display = keySection.style.display === "none" ? "block" : "none";
          const input = keySection.querySelector(".paywall-license-input");
          if (input) input.focus();
        }
      }

      if (e.target.closest('[data-act="activate"]')) {
        const input = overlay.querySelector(".paywall-license-input");
        const statusEl = overlay.querySelector(".paywall-key-status");
        const key = input?.value?.trim();
        if (!key) {
          if (statusEl) {
            statusEl.textContent = "Please enter a license key";
            statusEl.style.color = "#f59e0b";
          }
          return;
        }

        // Show loading state
        const btn = e.target.closest('[data-act="activate"]');
        const origText = btn.textContent;
        btn.textContent = "Verifying...";
        btn.disabled = true;
        if (statusEl) {
          statusEl.textContent = "Verifying your license...";
          statusEl.style.color = "#94a3b8";
        }

        const result = await License.activate(key);

        btn.textContent = origText;
        btn.disabled = false;

        if (result.ok) {
          if (statusEl) {
            statusEl.textContent = "Elite activated!";
            statusEl.style.color = "#10b981";
          }
          this._showSuccessToast(License.getPlanLabel());
          setTimeout(() => overlay.remove(), 1500);
        } else {
          const errorMsg =
            result.error === "invalid_key"
              ? "Invalid license key"
              : result.error === "invalid_product"
                ? "Key not for this product"
                : result.error === "membership_inactive"
                  ? "Membership is not active"
                  : "Verification failed — try again";
          if (statusEl) {
            statusEl.textContent = errorMsg;
            statusEl.style.color = "#ef4444";
          }
        }
      }
    });

    root.appendChild(overlay);
  },

  handleUpgrade() {
    License.openPurchasePage();
  },

  _showSuccessToast(planLabel = "") {
    const root = OverlayManager.getShadowRoot();
    const toast = document.createElement("div");
    toast.className = "paywall-toast";
    toast.textContent = planLabel ? `Elite Activated (${planLabel})` : "Elite Activated";
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
        `;
    root.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  isFeatureLocked(featureName) {
    if (!FeatureManager) return false;
    const flags = FeatureManager.resolveFlags(Store.state, featureName);
    return flags.gated;
  },
};
