/**
 * ZERØ Settings Panel
 * Extended settings with Pro/Elite teased cards and Privacy & Data panel.
 */

import { Professor } from './professor.js';
import { Store } from '../store.js';
import { DiagnosticsStore } from '../diagnostics-store.js';
import { OverlayManager } from './overlay.js';
import { TEASED_FEATURES } from '../featureManager.js';

export const SettingsPanel = {
    /**
     * Show the full settings modal (replaces old mini-settings).
     */
    show() {
        const container = OverlayManager.getContainer();
        const existing = container.querySelector('.zero-settings-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay zero-settings-overlay';

        const isShadow = Store.state.settings.tradingMode === 'shadow';
        const diagState = DiagnosticsStore.state || {};
        const isAutoSend = diagState.settings?.privacy?.autoSendDiagnostics || false;
        const lastUpload = diagState.settings?.diagnostics?.lastUploadedEventTs || 0;
        const lastError = diagState.upload?.lastError || null;
        const queueLen = (diagState.upload?.queue || []).length;

        overlay.innerHTML = `
            <div class="settings-modal" style="width:440px; max-height:85vh; overflow-y:auto;">
                <div class="settings-header">
                    <div class="settings-title"><span>⚙️</span> Settings</div>
                    <button class="settings-close">×</button>
                </div>

                <!-- General -->
                <div class="settings-section-title">General</div>

                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">Shadow Real Mode</div>
                        <div class="setting-desc">Tag trades as "Real" for journaling.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="shadow" ${isShadow ? 'checked' : ''}>
                        <span class="slider"></span>
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
                <div class="settings-section-title">Optional diagnostics (off by default)</div>

                <div class="privacy-info-box">
                    <p>ZERØ stores your paper trading data locally on your device by default.</p>
                    <p>You can optionally enable diagnostics to help improve ZERØ and unlock deeper features over time. Diagnostics help us understand session flow, feature usage, and where tools break down — not your private trading decisions.</p>
                    <ul style="margin:8px 0 8px 16px; padding:0; list-style-type:disc; color:#94a3b8; font-size:11px;">
                        <li>Improves Pro and Elite features</li>
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
                        <div class="setting-desc">Enable optional diagnostics to help improve ZERØ and future features.</div>
                        <div class="setting-desc" style="opacity:0.6; margin-top:4px;">Some future features may improve faster with anonymized diagnostics enabled.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="autoSend" ${isAutoSend ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="diag-status">
                    <div class="diag-status-row">
                        <span class="diag-label">Uploads</span>
                        <span class="diag-value ${isAutoSend ? 'enabled' : 'disabled'}">${isAutoSend ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    ${lastUpload > 0 ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Last upload</span>
                        <span class="diag-value">${new Date(lastUpload).toLocaleString()}</span>
                    </div>` : ''}
                    ${lastError ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Last error</span>
                        <span class="diag-value error">${lastError}</span>
                    </div>` : ''}
                    ${queueLen > 0 ? `
                    <div class="diag-status-row">
                        <span class="diag-label">Queued packets</span>
                        <span class="diag-value">${queueLen}</span>
                    </div>` : ''}
                </div>

                <div class="settings-btn-row">
                    <button class="settings-action-btn" data-setting-act="viewPayload">View sample payload</button>
                    <button class="settings-action-btn danger" data-setting-act="deleteQueue">Delete queued uploads</button>
                    <button class="settings-action-btn danger" data-setting-act="deleteLocal">Delete local ZERØ data</button>
                </div>

                <!-- Pro Features (HIDDEN FOR FREE RELEASE) -->
                <!-- Elite Features (HIDDEN FOR FREE RELEASE) -->

                <div style="margin-top:20px; text-align:center; font-size:11px; color:#64748b;">
                    ZERØ v${Store.state.version || '1.11.6'}
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
        overlay.querySelector('.settings-close').onclick = close;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // Shadow toggle
        const shadowToggle = overlay.querySelector('[data-setting="shadow"]');
        if (shadowToggle) {
            shadowToggle.onchange = async (e) => {
                Store.state.settings.tradingMode = e.target.checked ? 'shadow' : 'paper';
                await Store.save();
                const c = OverlayManager.getContainer();
                c.classList.toggle('zero-shadow-mode', e.target.checked);
            };
        }

        // Auto-send diagnostics toggle
        const autoSendToggle = overlay.querySelector('[data-setting="autoSend"]');
        if (autoSendToggle) {
            autoSendToggle.onchange = (e) => {
                if (e.target.checked) {
                    this._showConsentModal(overlay, () => {
                        DiagnosticsStore.enableAutoSend();
                        this._refreshDiagStatus(overlay, true);
                    }, () => {
                        e.target.checked = false;
                    });
                } else {
                    DiagnosticsStore.disableAutoSend();
                    this._refreshDiagStatus(overlay, false);
                }
            };
        }

        // Action buttons
        overlay.addEventListener('click', async (e) => {
            const act = e.target.getAttribute('data-setting-act');
            if (!act) {
                // Check for feature card click
                const card = e.target.closest('.feature-card.locked');
                if (card) {
                    const featureId = card.getAttribute('data-feature');
                    this._logFeatureClick(featureId);
                    this._showComingSoonModal(overlay, featureId);
                }
                return;
            }

            if (act === 'viewPayload') {
                this._showSamplePayload(overlay);
            }
            if (act === 'replayWalkthrough') {
                overlay.remove(); // Close settings to show walkthrough
                Professor.startWalkthrough(true);
            }
            if (act === 'deleteQueue') {
                await DiagnosticsStore.clearUploadQueue();
                this._refreshDiagStatus(overlay, DiagnosticsStore.isAutoSendEnabled());
            }
            if (act === 'deleteLocal') {
                this._showDeleteConfirm(overlay);
            }
        });
    },

    _refreshDiagStatus(overlay, isEnabled) {
        const statusEl = overlay.querySelector('.diag-status');
        if (!statusEl) return;
        const diagState = DiagnosticsStore.state || {};
        const lastUpload = diagState.settings?.diagnostics?.lastUploadedEventTs || 0;
        const lastError = diagState.upload?.lastError || null;
        const queueLen = (diagState.upload?.queue || []).length;

        statusEl.innerHTML = `
            <div class="diag-status-row">
                <span class="diag-label">Uploads</span>
                <span class="diag-value ${isEnabled ? 'enabled' : 'disabled'}">${isEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            ${lastUpload > 0 ? `<div class="diag-status-row"><span class="diag-label">Last upload</span><span class="diag-value">${new Date(lastUpload).toLocaleString()}</span></div>` : ''}
            ${lastError ? `<div class="diag-status-row"><span class="diag-label">Last error</span><span class="diag-value error">${lastError}</span></div>` : ''}
            ${queueLen > 0 ? `<div class="diag-status-row"><span class="diag-label">Queued packets</span><span class="diag-value">${queueLen}</span></div>` : ''}
        `;
    },

    _showConsentModal(parent, onAccept, onDecline) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal-overlay';
        modal.style.zIndex = '2147483648';
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

        modal.querySelector('.cancel').onclick = () => { modal.remove(); onDecline(); };
        modal.querySelector('.confirm').onclick = () => { modal.remove(); onAccept(); };
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); onDecline(); } });
    },

    _showComingSoonModal(parent, featureId) {
        // Find feature info
        const allFeatures = [...TEASED_FEATURES.PRO, ...TEASED_FEATURES.ELITE];
        const feat = allFeatures.find(f => f.id === featureId);
        const tier = featureId.startsWith('ELITE') ? 'Elite' : 'Pro';

        const modal = document.createElement('div');
        modal.className = 'confirm-modal-overlay';
        modal.style.zIndex = '2147483648';
        modal.innerHTML = `
            <div class="confirm-modal" style="max-width:380px; text-align:center;">
                <h3 style="color:#14b8a6;">Coming Soon</h3>
                <p style="font-size:14px; font-weight:600; color:#f8fafc; margin-bottom:6px;">
                    ${feat ? feat.name : featureId}
                </p>
                <p style="font-size:13px; color:#94a3b8; margin-bottom:16px;">
                    ${feat ? feat.desc : ''} This feature is part of <strong style="color:${tier === 'Elite' ? '#f59e0b' : '#6366f1'}">${tier}</strong>.
                </p>
                <div class="confirm-modal-buttons" style="justify-content:center;">
                    <button class="confirm-modal-btn" style="background:rgba(20,184,166,0.2); color:#14b8a6;" data-act="waitlist">Join waitlist</button>
                    <button class="confirm-modal-btn cancel">Close</button>
                </div>
            </div>
        `;
        parent.appendChild(modal);

        modal.querySelector('.cancel').onclick = () => modal.remove();
        modal.querySelector('[data-act="waitlist"]').onclick = () => {
            const subject = encodeURIComponent(`ZERØ ${tier} Waitlist - ${feat ? feat.name : featureId}`);
            const body = encodeURIComponent(`I'm interested in ${feat ? feat.name : featureId} for ZERØ ${tier}.\n\nPlease add me to the waitlist.`);
            const mailTo = `mailto:?subject=${subject}&body=${body}`;
            // Copy to clipboard as fallback
            try {
                navigator.clipboard.writeText(`I'm interested in ZERØ ${tier}: ${feat ? feat.name : featureId}. Please add me to the waitlist.`);
            } catch { /* ignore */ }
            window.open(mailTo);
            modal.remove();
        };
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    _showSamplePayload(parent) {
        const sample = {
            uploadId: 'sample-xxxxx',
            clientId: '<redacted>',
            createdAt: Date.now(),
            schemaVersion: 3,
            extensionVersion: Store.state.version || '1.11.6',
            eventsDelta: [
                { eventId: 'evt_sample1', ts: Date.now() - 60000, type: 'SESSION_STARTED', platform: 'AXIOM', payload: {} },
                { eventId: 'evt_sample2', ts: Date.now() - 30000, type: 'TRADE_OPENED', platform: 'AXIOM', payload: { side: 'BUY', symbol: 'TOKEN' } },
                { eventId: 'evt_sample3', ts: Date.now(), type: 'TRADE_CLOSED', platform: 'AXIOM', payload: { side: 'SELL', pnl: 0.05 } },
            ],
        };

        const modal = document.createElement('div');
        modal.className = 'confirm-modal-overlay';
        modal.style.zIndex = '2147483648';
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
        modal.querySelector('.cancel').onclick = () => modal.remove();
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    _showDeleteConfirm(parent) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal-overlay';
        modal.style.zIndex = '2147483648';
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
        modal.querySelector('.cancel').onclick = () => modal.remove();
        modal.querySelector('.confirm').onclick = async () => {
            await DiagnosticsStore.clearAllData();
            modal.remove();
        };
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    _logFeatureClick(featureId) {
        DiagnosticsStore.logEvent('UI_LOCKED_FEATURE_CLICKED', { featureId });
    },
};
