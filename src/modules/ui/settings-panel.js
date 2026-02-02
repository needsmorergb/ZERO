/**
 * ZERØ Settings Panel
 * Extended settings with Elite feature cards and Privacy & Data panel.
 */

import { Professor } from "./professor.js";
import { Store } from "../store.js";
import { DiagnosticsStore } from "../diagnostics-store.js";
import { OverlayManager } from "./overlay.js";
import { TEASED_FEATURES, FeatureManager } from "../featureManager.js";
import { renderEliteLockedCard } from "./elite-helpers.js";
import { ModeManager, MODES } from "../mode-manager.js";
import { License } from "../license.js";
import { Paywall } from "./paywall.js";
import { ICONS } from "./icons.js";

export const SettingsPanel = {
  /**
   * Show the full settings modal (replaces old mini-settings).
   */
  show() {
    const container = OverlayManager.getContainer();
    const existing = container.querySelector(".zero-settings-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "confirm-modal-overlay zero-settings-overlay";

    const currentMode = Store.state.settings.tradingMode || "paper";
    const isElite = FeatureManager.isElite(Store.state);
    const isDebugLogs = !!Store.state.settings?.debugLogs;
    const diagState = DiagnosticsStore.state || {};
    const isAutoSend = diagState.settings?.privacy?.autoSendDiagnostics || false;
    const lastUpload = diagState.settings?.diagnostics?.lastUploadedEventTs || 0;
    const lastError = diagState.upload?.lastError || null;
    const queueLen = (diagState.upload?.queue || []).length;

    overlay.innerHTML = `
            <div class="settings-modal" style="width:440px; max-height:85vh; overflow-y:auto;">
                <div class="settings-header">
                    <div class="settings-title">${ICONS.MODE_PAPER} Settings</div>
                    <button class="settings-close">\u00D7</button>
                </div>

                <!-- Mode Selection -->
                <div class="settings-section-title">Trading Mode</div>

                <div class="setting-row" style="flex-direction:column; align-items:stretch; gap:8px;">
                    <label class="mode-option ${currentMode === "paper" ? "active" : ""}" data-mode="paper" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid ${currentMode === "paper" ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.06)"}; background:${currentMode === "paper" ? "rgba(20,184,166,0.06)" : "transparent"};">
                        <input type="radio" name="tradingMode" value="paper" ${currentMode === "paper" ? "checked" : ""} style="accent-color:#14b8a6;">
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:600; color:#f8fafc; display:flex; align-items:center; gap:6px;">
                                ${ICONS.MODE_PAPER} Paper Mode
                                <span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(20,184,166,0.12); color:#14b8a6; font-weight:700;">FREE</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-top:3px;">Simulated trades. BUY / SELL HUD visible.</div>
                        </div>
                    </label>

                    <label class="mode-option ${currentMode === "analysis" ? "active" : ""}" data-mode="analysis" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid ${currentMode === "analysis" ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.06)"}; background:${currentMode === "analysis" ? "rgba(96,165,250,0.06)" : "transparent"};">
                        <input type="radio" name="tradingMode" value="analysis" ${currentMode === "analysis" ? "checked" : ""} style="accent-color:#60a5fa;">
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:600; color:#f8fafc; display:flex; align-items:center; gap:6px;">
                                ${ICONS.MODE_ANALYSIS} Analysis Mode
                                <span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(96,165,250,0.12); color:#60a5fa; font-weight:700;">FREE</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-top:3px;">Observes real trades only. No BUY / SELL HUD.</div>
                        </div>
                    </label>

                    <label class="mode-option ${currentMode === "shadow" ? "active" : ""}" data-mode="shadow" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid ${currentMode === "shadow" ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}; background:${currentMode === "shadow" ? "rgba(139,92,246,0.06)" : "transparent"}; ${!isElite ? "opacity:0.6;" : ""}">
                        <input type="radio" name="tradingMode" value="shadow" ${currentMode === "shadow" ? "checked" : ""} ${!isElite ? "disabled" : ""} style="accent-color:#a78bfa;">
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:600; color:#f8fafc; display:flex; align-items:center; gap:6px;">
                                ${ICONS.MODE_SHADOW} Shadow Mode
                                <span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(139,92,246,0.12); color:#a78bfa; font-weight:700;">ELITE</span>
                            </div>
                            <div style="font-size:11px; color:#64748b; margin-top:3px;">Observes real trades with elite behavioral analysis.${!isElite ? " Requires Elite." : ""}</div>
                        </div>
                    </label>
                </div>

                <div class="setting-row">
                     <div class="setting-info">
                        <div class="setting-name">Walkthrough</div>
                        <div class="setting-desc">Replay the introductory walkthrough.</div>
                    </div>
                    <button class="settings-action-btn" data-setting-act="replayWalkthrough" style="width:auto; padding:6px 12px; font-size:12px;">View walkthrough</button>
                </div>

                <!-- Privacy & Data -->
                <div class="settings-section-title">Share anonymous diagnostics</div>

                <div class="privacy-info-box">
                    <p>ZERØ stores your paper trading data locally on your device by default.</p>
                    <p>You can optionally enable diagnostics to help improve ZERØ and unlock deeper features over time. Diagnostics help us understand session flow, feature usage, and where tools break down — not your private trading decisions.</p>
                    <ul style="margin:8px 0 8px 16px; padding:0; list-style-type:disc; color:#94a3b8; font-size:11px;">
                        <li>Improves Elite features</li>
                        <li>Helps analytics become more accurate</li>
                        <li>Helps fix bugs faster</li>
                        <li>Shapes future tools based on real usage</li>
                    </ul>
                    <p style="margin-top:12px; font-weight:600; color:#f8fafc;">What is NOT included:</p>
                    <ul style="margin:4px 0 8px 16px; padding:0; list-style-type:disc; color:#ef4444; font-size:11px;">
                        <li>Real funds or wallet access</li>
                        <li>Private keys or credentials</li>
                        <li>Raw page content or keystrokes</li>
                        <li>Any data sold or shared with third parties</li>
                    </ul>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">Enable diagnostics</div>
                        <div class="setting-desc">Helps improve stability. Off by default.</div>
                        <div class="setting-desc" style="opacity:0.6; margin-top:4px;">Some future features may improve faster with anonymized diagnostics enabled.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="autoSend" ${isAutoSend ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="diag-status">
                    <div class="diag-status-row">
                        <span class="diag-label">Uploads</span>
                        <span class="diag-value ${isAutoSend ? "enabled" : "disabled"}">${isAutoSend ? "Enabled" : "Disabled"}</span>
                    </div>
                    ${
                      lastUpload > 0
                        ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Last upload</span>
                        <span class="diag-value">${new Date(lastUpload).toLocaleString()}</span>
                    </div>`
                        : ""
                    }
                    ${
                      lastError
                        ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Last error</span>
                        <span class="diag-value error">${lastError}</span>
                    </div>`
                        : ""
                    }
                    ${
                      queueLen > 0
                        ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Queued packets</span>
                        <span class="diag-value">${queueLen}</span>
                    </div>`
                        : ""
                    }
                </div>

                <div class="settings-btn-row">
                    <button class="settings-action-btn" data-setting-act="viewPayload">View sample payload</button>
                    <button class="settings-action-btn danger" data-setting-act="deleteQueue">Delete queued uploads</button>
                    <button class="settings-action-btn danger" data-setting-act="deleteLocal">Delete local ZERØ data</button>
                </div>

                <!-- Debug Logging -->
                <div class="settings-section-title">Developer</div>
                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">Debug logs</div>
                        <div class="setting-desc">Enable verbose logging to the browser console. Off by default.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="debugLogs" ${isDebugLogs ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>
                </div>

                <!-- Elite -->
                <div class="settings-section-title" style="display:flex; align-items:center; gap:8px;">
                    Elite
                    <span style="font-size:9px; font-weight:800; padding:2px 8px; border-radius:4px; background:${FeatureManager.isElite(Store.state) ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)"}; color:${FeatureManager.isElite(Store.state) ? "#10b981" : "#8b5cf6"}; letter-spacing:0.5px; text-transform:uppercase;">
                        ${FeatureManager.isElite(Store.state) ? "Active" : "Free"}
                    </span>
                </div>

                ${
                  FeatureManager.isElite(Store.state)
                    ? (() => {
                        const ls = License.getStatus();
                        const planLabel = License.getPlanLabel();
                        const hasLicense = ls.status !== "none" && ls.maskedKey;
                        return `
                <div style="padding:12px 16px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); border-radius:10px; margin-bottom:12px;">
                    <div style="font-size:12px; font-weight:600; color:#10b981; display:flex; align-items:center; gap:8px;">
                        Elite Active
                        ${planLabel ? `<span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(139,92,246,0.12); color:#a78bfa; font-weight:700;">${planLabel}</span>` : ""}
                    </div>
                    ${
                      hasLicense
                        ? `
                    <div style="font-size:11px; color:#64748b; margin-top:6px; display:flex; flex-direction:column; gap:3px;">
                        <div>License: <span style="color:#94a3b8; font-family:monospace;">${ls.maskedKey}</span></div>
                        ${ls.lastVerified ? `<div>Verified: ${new Date(ls.lastVerified).toLocaleDateString()}</div>` : ""}
                        ${ls.expiresAt ? `<div>Renews: ${new Date(ls.expiresAt).toLocaleDateString()}</div>` : ""}
                        ${ls.plan === "founders" ? `<div style="color:#a78bfa;">Lifetime access</div>` : ""}
                    </div>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        <button data-setting-act="manageMembership" class="settings-action-btn" style="font-size:11px; padding:5px 10px;">Manage on Whop</button>
                        <button data-setting-act="deactivateLicense" class="settings-action-btn danger" style="font-size:11px; padding:5px 10px;">Deactivate</button>
                    </div>
                    `
                        : `
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">All advanced insights and behavioral analytics are unlocked.</div>
                    `
                    }
                </div>`;
                      })()
                    : `
                <div style="font-size:11px; color:#64748b; margin-bottom:12px; line-height:1.5;">
                    Unlock cross-session context and behavioral analytics.
                </div>
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                    ${TEASED_FEATURES.ELITE.map((f) => renderEliteLockedCard(f.name, f.desc)).join("")}
                </div>
                <button data-setting-act="showUpgradeModal" style="width:100%; background:linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; margin-bottom:8px;">
                    Upgrade to Elite
                </button>
                `
                }

                <div style="margin-top:20px; text-align:center; font-size:11px; color:#64748b;">
                    ZERØ v${Store.state.version || "2.0.0"}
                </div>
            </div>
        `;

    container.appendChild(overlay);
    this._bind(overlay);
  },

  _bind(overlay) {
    const close = () => {
      overlay.remove();
      if (window.ZeroHUD && window.ZeroHUD.updateAll) window.ZeroHUD.updateAll();
    };

    // Close
    overlay.querySelector(".settings-close").onclick = close;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    // Mode radio buttons
    const modeRadios = overlay.querySelectorAll('input[name="tradingMode"]');
    modeRadios.forEach((radio) => {
      radio.onchange = async (e) => {
        const newMode = e.target.value;
        const success = await ModeManager.setMode(newMode);
        if (!success) {
          // Revert radio to current mode if gated
          const currentRadio = overlay.querySelector(
            `input[name="tradingMode"][value="${ModeManager.getMode()}"]`
          );
          if (currentRadio) currentRadio.checked = true;
          return;
        }
        // Update visual state of mode options
        overlay.querySelectorAll(".mode-option").forEach((opt) => {
          const mode = opt.getAttribute("data-mode");
          const isActive = mode === newMode;
          const colors = { paper: "20,184,166", analysis: "96,165,250", shadow: "139,92,246" };
          const c = colors[mode] || colors.paper;
          opt.style.borderColor = isActive ? `rgba(${c},0.3)` : "rgba(255,255,255,0.06)";
          opt.style.background = isActive ? `rgba(${c},0.06)` : "transparent";
        });
        // Trigger HUD update
        if (window.ZeroHUD && window.ZeroHUD.renderAll) window.ZeroHUD.renderAll();
      };
    });

    // Auto-send diagnostics toggle
    const autoSendToggle = overlay.querySelector('[data-setting="autoSend"]');
    if (autoSendToggle) {
      autoSendToggle.onchange = (e) => {
        if (e.target.checked) {
          this._showConsentModal(
            overlay,
            () => {
              DiagnosticsStore.enableAutoSend();
              this._refreshDiagStatus(overlay, true);
            },
            () => {
              e.target.checked = false;
            }
          );
        } else {
          DiagnosticsStore.disableAutoSend();
          this._refreshDiagStatus(overlay, false);
        }
      };
    }

    // Debug logs toggle
    const debugToggle = overlay.querySelector('[data-setting="debugLogs"]');
    if (debugToggle) {
      debugToggle.onchange = async (e) => {
        const enabled = e.target.checked;
        Store.state.settings.debugLogs = enabled;
        await Store.save();
        const { Logger } = await import("../logger.js");
        Logger.configure(enabled);
      };
    }

    // Action buttons
    overlay.addEventListener("click", async (e) => {
      const act = e.target.getAttribute("data-setting-act");
      if (!act) {
        // Check for feature card click
        const card = e.target.closest(".feature-card.locked");
        if (card) {
          const featureId = card.getAttribute("data-feature");
          this._logFeatureClick(featureId);
          this._showComingSoonModal(overlay, featureId);
        }
        return;
      }

      if (act === "viewPayload") {
        this._showSamplePayload(overlay);
      }
      if (act === "replayWalkthrough") {
        overlay.remove(); // Close settings to show walkthrough
        Professor.startWalkthrough(true);
      }
      if (act === "deleteQueue") {
        await DiagnosticsStore.clearUploadQueue();
        this._refreshDiagStatus(overlay, DiagnosticsStore.isAutoSendEnabled());
      }
      if (act === "deleteLocal") {
        this._showDeleteConfirm(overlay);
      }
      if (act === "showUpgradeModal") {
        overlay.remove();
        Paywall.showUpgradeModal();
      }
      if (act === "manageMembership") {
        window.open("https://whop.com/orders/", "_blank");
      }
      if (act === "deactivateLicense") {
        this._showDeactivateConfirm(overlay);
      }
    });
  },

  _refreshDiagStatus(overlay, isEnabled) {
    const statusEl = overlay.querySelector(".diag-status");
    if (!statusEl) return;
    const diagState = DiagnosticsStore.state || {};
    const lastUpload = diagState.settings?.diagnostics?.lastUploadedEventTs || 0;
    const lastError = diagState.upload?.lastError || null;
    const queueLen = (diagState.upload?.queue || []).length;

    statusEl.innerHTML = `
            <div class="diag-status-row">
                <span class="diag-label">Uploads</span>
                <span class="diag-value ${isEnabled ? "enabled" : "disabled"}">${isEnabled ? "Enabled" : "Disabled"}</span>
            </div>
            ${lastUpload > 0 ? `<div class="diag-status-row"><span class="diag-label">Last upload</span><span class="diag-value">${new Date(lastUpload).toLocaleString()}</span></div>` : ""}
            ${lastError ? `<div class="diag-status-row"><span class="diag-label">Last error</span><span class="diag-value error">${lastError}</span></div>` : ""}
            ${queueLen > 0 ? `<div class="diag-status-row"><span class="diag-label">Queued packets</span><span class="diag-value">${queueLen}</span></div>` : ""}
        `;
  },

  _showConsentModal(parent, onAccept, onDecline) {
    const modal = document.createElement("div");
    modal.className = "confirm-modal-overlay";
    modal.style.zIndex = "2147483648";
    modal.innerHTML = `
            <div class="confirm-modal" style="max-width:420px;">
                <h3>Help improve ZERØ (optional)</h3>
                <p style="font-size:13px; line-height:1.6;">
                    By enabling diagnostics, ZERØ will automatically send anonymized session logs, simulated trades, and feature interaction events to help improve accuracy, performance, and future features.
                </p>
                <p style="font-size:13px; line-height:1.6; margin-top:8px;">
                    This is optional, off by default, and can be disabled at any time.
                </p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm" style="background:rgba(20,184,166,0.8);">Enable diagnostics</button>
                </div>
            </div>
        `;
    parent.appendChild(modal);

    modal.querySelector(".cancel").onclick = () => {
      modal.remove();
      onDecline();
    };
    modal.querySelector(".confirm").onclick = () => {
      modal.remove();
      onAccept();
    };
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
        onDecline();
      }
    });
  },

  _showComingSoonModal(parent, featureId) {
    const feat = TEASED_FEATURES.ELITE.find((f) => f.id === featureId);

    const modal = document.createElement("div");
    modal.className = "confirm-modal-overlay";
    modal.style.zIndex = "2147483648";
    modal.innerHTML = `
            <div class="confirm-modal" style="max-width:380px; text-align:center;">
                <h3 style="color:#8b5cf6;">Available in Elite</h3>
                <p style="font-size:14px; font-weight:600; color:#f8fafc; margin-bottom:6px;">
                    ${feat ? feat.name : featureId}
                </p>
                <p style="font-size:13px; color:#94a3b8; margin-bottom:16px;">
                    ${feat ? feat.desc : ""} This feature is part of <strong style="color:#8b5cf6;">Elite</strong>.
                </p>
                <div class="confirm-modal-buttons" style="justify-content:center;">
                    <button class="confirm-modal-btn cancel">Close</button>
                </div>
            </div>
        `;
    parent.appendChild(modal);

    modal.querySelector(".cancel").onclick = () => modal.remove();
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  _showSamplePayload(parent) {
    const sample = {
      uploadId: "sample-xxxxx",
      clientId: "<redacted>",
      createdAt: Date.now(),
      schemaVersion: 3,
      extensionVersion: Store.state.version || "2.0.0",
      eventsDelta: [
        {
          eventId: "evt_sample1",
          ts: Date.now() - 60000,
          type: "SESSION_STARTED",
          platform: "AXIOM",
          payload: {},
        },
        {
          eventId: "evt_sample2",
          ts: Date.now() - 30000,
          type: "TRADE_OPENED",
          platform: "AXIOM",
          payload: { side: "BUY", symbol: "TOKEN" },
        },
        {
          eventId: "evt_sample3",
          ts: Date.now(),
          type: "TRADE_CLOSED",
          platform: "AXIOM",
          payload: { side: "SELL", pnl: 0.05 },
        },
      ],
    };

    const modal = document.createElement("div");
    modal.className = "confirm-modal-overlay";
    modal.style.zIndex = "2147483648";
    modal.innerHTML = `
            <div class="confirm-modal" style="max-width:500px;">
                <h3>Sample upload payload</h3>
                <pre style="background:#0d1117; border:1px solid rgba(20,184,166,0.15); border-radius:8px; padding:12px; font-size:11px; color:#94a3b8; overflow-x:auto; max-height:300px; white-space:pre-wrap; word-break:break-all;">${JSON.stringify(sample, null, 2)}</pre>
                <p style="font-size:11px; color:#64748b; margin-top:8px;">
                    This is a sample of what would be sent. Real payloads contain only event IDs, timestamps, types, and small scalar values. No DOM content, keystrokes, wallet data, or personal information.
                </p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Close</button>
                </div>
            </div>
        `;
    parent.appendChild(modal);
    modal.querySelector(".cancel").onclick = () => modal.remove();
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  _showDeleteConfirm(parent) {
    const modal = document.createElement("div");
    modal.className = "confirm-modal-overlay";
    modal.style.zIndex = "2147483648";
    modal.innerHTML = `
            <div class="confirm-modal">
                <h3>Delete all local data?</h3>
                <p>This will permanently delete all ZERØ diagnostics data, event logs, and upload queue from your browser. Your trading session data (stored under a separate key) is unaffected.</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">Delete</button>
                </div>
            </div>
        `;
    parent.appendChild(modal);
    modal.querySelector(".cancel").onclick = () => modal.remove();
    modal.querySelector(".confirm").onclick = async () => {
      await DiagnosticsStore.clearAllData();
      modal.remove();
    };
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  _showDeactivateConfirm(parent) {
    const modal = document.createElement("div");
    modal.className = "confirm-modal-overlay";
    modal.style.zIndex = "2147483648";
    modal.innerHTML = `
            <div class="confirm-modal">
                <h3>Deactivate Elite?</h3>
                <p>This will remove your license key from this browser and revert to the Free tier. You can re-activate anytime with your license key.</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">Deactivate</button>
                </div>
            </div>
        `;
    parent.appendChild(modal);
    modal.querySelector(".cancel").onclick = () => modal.remove();
    modal.querySelector(".confirm").onclick = async () => {
      await License.deactivate();
      modal.remove();
      parent.remove();
      // Re-open settings to reflect new state
      this.show();
    };
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  _logFeatureClick(featureId) {
    DiagnosticsStore.logEvent("UI_LOCKED_FEATURE_CLICKED", { featureId });
  },
};
