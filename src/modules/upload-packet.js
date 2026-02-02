/**
 * ZERØ Upload Packet Generator
 * Builds delta-based upload packets from the diagnostics store.
 */

import { DiagnosticsStore } from "./diagnostics-store.js";
import { uuid, SCHEMA_VERSION } from "./schemas.js";
import { Store } from "./store.js";

const MAX_EVENTS_PER_PACKET = 2000;
const MAX_PAYLOAD_BYTES = 300 * 1024; // 300 KB target

// Solana base58 address pattern (32-44 chars)
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Defense-in-depth: strip sensitive fields from event payloads before upload.
 * Prevents accidental leakage if future event types include wallet data, notes, etc.
 */
function sanitizeEvent(evt) {
  if (!evt || !evt.payload) return evt;
  const p = { ...evt.payload };

  // Remove keys that could contain sensitive data
  delete p.walletAddress;
  delete p.wallet;
  delete p.privateKey;
  delete p.notes;
  delete p.thesis;

  // Redact any string value that looks like a wallet address
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" && WALLET_RE.test(v)) {
      p[k] = "***REDACTED***";
    }
    // Strip full URLs with query params
    if (typeof v === "string" && v.startsWith("http") && v.includes("?")) {
      p[k] = v.split("?")[0] + "?***";
    }
  }

  // Coarsen exact trade sizes to buckets if present
  if (typeof p.qty === "number") p.qty = p.qty > 0 ? "nonzero" : "zero";
  if (typeof p.amount === "number") p.amount = p.amount > 0 ? "nonzero" : "zero";

  return { ...evt, payload: p };
}

/**
 * Build one or more upload packets from unsynced events.
 * @returns {{ packets: object[], totalEvents: number }}
 */
export function buildUploadPackets() {
  const events = DiagnosticsStore.getEventsDelta();
  if (events.length === 0) return { packets: [], totalEvents: 0 };

  const clientId = DiagnosticsStore.getClientId();
  const version = Store.state?.version || "0.0.0";

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
      eventsDelta: chunk.map(sanitizeEvent),
    };

    // Check serialized size and trim if needed
    const serialized = JSON.stringify(packet);
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
