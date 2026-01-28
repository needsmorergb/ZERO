/**
 * ZERØ Upload Packet Generator
 * Builds delta-based upload packets from the diagnostics store.
 */

import { DiagnosticsStore } from './diagnostics-store.js';
import { uuid, SCHEMA_VERSION } from './schemas.js';
import { Store } from './store.js';

const MAX_EVENTS_PER_PACKET = 2000;
const MAX_PAYLOAD_BYTES = 300 * 1024; // 300 KB target

/**
 * Build one or more upload packets from unsynced events.
 * @returns {{ packets: object[], totalEvents: number }}
 */
export function buildUploadPackets() {
    const events = DiagnosticsStore.getEventsDelta();
    if (events.length === 0) return { packets: [], totalEvents: 0 };

    const clientId = DiagnosticsStore.getClientId();
    const version = Store.state?.version || '0.0.0';

    // Split events into chunks if needed
    const chunks = [];
    for (let i = 0; i < events.length; i += MAX_EVENTS_PER_PACKET) {
        chunks.push(events.slice(i, i + MAX_EVENTS_PER_PACKET));
    }

    const packets = chunks.map((chunk) => {
        const packet = {
            uploadId: uuid(),
            clientId,
            createdAt: Date.now(),
            schemaVersion: SCHEMA_VERSION,
            extensionVersion: version,
            eventsDelta: chunk,
        };

        // Check serialized size and trim if needed
        let serialized = JSON.stringify(packet);
        if (serialized.length > MAX_PAYLOAD_BYTES && chunk.length > 100) {
            // Trim to fit — keep newest events
            const trimmed = chunk.slice(-Math.floor(chunk.length * 0.7));
            packet.eventsDelta = trimmed;
            packet._trimmed = true;
        }

        return packet;
    });

    return { packets, totalEvents: events.length };
}

/**
 * Build and enqueue packets into the DiagnosticsStore upload queue.
 * @returns {number} Number of packets enqueued.
 */
export function enqueueUploadPackets() {
    const { packets } = buildUploadPackets();
    for (const pkt of packets) {
        DiagnosticsStore.enqueuePacket(pkt);
    }
    return packets.length;
}
