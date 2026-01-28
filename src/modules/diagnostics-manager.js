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

            // 4. Process Queue (send pending packets)
            await this._processQueue();

        } catch (e) {
            console.error('[DiagnosticsManager] Loop error:', e);
        }

        // Schedule next (always run loop to catch re-enables)
        this._scheduleNextTick();
    },

    async _processQueue() {
        const endpoint = DiagnosticsStore.getEndpointUrl();
        if (!endpoint) return;

        // Process one at a time
        let packet = DiagnosticsStore.peekPacket();
        while (packet) {
            if (!DiagnosticsStore.isAutoSendEnabled()) return; // Stop if disabled mid-loop

            try {
                console.log(`[DiagnosticsManager] Uploading packet ${packet.uploadId}...`);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(packet.payload)
                });

                if (response.ok) {
                    // Success!
                    DiagnosticsStore.dequeuePacket();
                    DiagnosticsStore.setLastUploadedEventTs(Date.now()); // Rough approximation, ideally use max ts in packet
                    DiagnosticsStore.clearBackoff();
                    console.log(`[DiagnosticsManager] Upload success.`);
                } else {
                    // Fail (Server Error)
                    const txt = await response.text();
                    throw new Error(`Server ${response.status}: ${txt.slice(0, 100)}`);
                }
            } catch (err) {
                // Network/Other Fail
                console.warn(`[DiagnosticsManager] Upload failed:`, err);
                DiagnosticsStore.setLastError(String(err));
                DiagnosticsStore.setBackoff(RETRY_DELAY_MS);
                return; // Stop processing queue
            }

            // Peek next
            packet = DiagnosticsStore.peekPacket();
        }
    }
};
