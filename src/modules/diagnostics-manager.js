/**
 * ZERØ Diagnostics Manager
 * Orchestrates background uploads of diagnostic packets.
 * Strictly respects the 'autoSendDiagnostics' setting.
 */

import { DiagnosticsStore } from './diagnostics-store.js';
import { buildUploadPackets, enqueueUploadPackets } from './upload-packet.js';

const UPLOAD_INTERVAL_MS = 60000; // Check every minute
const RETRY_DELAY_MS = 30000;     // Wait 30s on error

export const DiagnosticsManager = {
    _timer: null,

    init() {
        if (this._timer) return;
        console.log('[DiagnosticsManager] Initialized. Status:', DiagnosticsStore.isAutoSendEnabled() ? 'ENABLED' : 'DISABLED');
        this._scheduleNextTick();
    },

    _scheduleNextTick(delay = UPLOAD_INTERVAL_MS) {
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => this._tick(), delay);
    },

    async _tick() {
        try {
            // 1. Check if enabled
            if (!DiagnosticsStore.isAutoSendEnabled()) {
                // If disabled, just wait. We don't build or send anything.
                this._scheduleNextTick();
                return;
            }

            // 2. Check backoff
            if (DiagnosticsStore.isInBackoff()) {
                // Determine remaining sync time
                const state = await DiagnosticsStore.load(); // refresh state
                const now = Date.now();
                if (now < state.upload.backoffUntilTs) {
                    this._scheduleNextTick(UPLOAD_INTERVAL_MS);
                    return;
                }
            }

            // 3. Build Packets (from local events delta)
            // This moves events from 'unsynced' to 'queued' state
            const enqueuedCount = enqueueUploadPackets();
            if (enqueuedCount > 0) {
                console.log(`[DiagnosticsManager] Enqueued ${enqueuedCount} packets.`);
            }

            // 4. Notify background worker to process queue
            chrome.runtime.sendMessage({ type: "ZERO_TRIGGER_UPLOAD" });

        } catch (e) {
            console.error('[DiagnosticsManager] Loop error:', e);
        }

        // Schedule next (always run loop to catch re-enables)
        this._scheduleNextTick();
    },

    async _processQueue() {
        // Legacy: processing moved to background.js to prevent cross-tab collisions.
        // Content script now just triggers the background process.
        chrome.runtime.sendMessage({ type: "ZERO_TRIGGER_UPLOAD" });
    }
};
