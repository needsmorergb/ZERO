/**
 * ZERØ Diagnostics Store
 * Manages the "zero_state" root key in chrome.storage.local.
 * Handles: event ring buffer, upload queue, privacy settings, client identity.
 */

import { SCHEMA_VERSION, createEvent, uuid } from "./schemas.js";

const STORAGE_KEY = "zero_state";
const EVENTS_CAP = 20000;
const UPLOAD_QUEUE_CAP = 200;
const DEBOUNCE_MS = 400;
const ERROR_COOLDOWN_MS = 5000; // rate-limit repeated ERROR events

// ---------------------------------------------------------------------------
// Default state shape
// ---------------------------------------------------------------------------
function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    clientId: uuid(),
    events: [],
    settings: {
      privacy: {
        autoSendDiagnostics: false,
        diagnosticsConsentAcceptedAt: null,
        includeFeatureClicks: true,
      },
      diagnostics: {
        endpointUrl: "https://zero-diagnostics.zerodata1.workers.dev/v1/zero/ingest",
        lastUploadedEventTs: 0,
      },
    },
    upload: {
      queue: [],
      backoffUntilTs: 0,
      lastError: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Chrome storage helpers
// ---------------------------------------------------------------------------
function isStorageAvailable() {
  try {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  } catch {
    return false;
  }
}

async function chromeStorageGet(key) {
  if (!isStorageAvailable()) return null;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([key], (res) => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || "";
          if (!msg.includes("context invalidated")) {
            console.warn("[DiagStore] get error:", msg);
          }
          resolve(null);
          return;
        }
        resolve(res[key] || null);
      });
    } catch (e) {
      if (!String(e).includes("context invalidated")) {
        console.error("[DiagStore] get exception:", e);
      }
      resolve(null);
    }
  });
}

async function chromeStorageSet(key, value) {
  if (!isStorageAvailable()) return;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || "";
          if (!msg.includes("context invalidated")) {
            console.warn("[DiagStore] set error:", msg);
          }
        }
        resolve();
      });
    } catch (e) {
      if (!String(e).includes("context invalidated")) {
        console.error("[DiagStore] set exception:", e);
      }
      resolve();
    }
  });
}

async function chromeStorageRemove(key) {
  if (!isStorageAvailable()) return;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(key, () => resolve());
    } catch {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------
// Diagnostics Store
// ---------------------------------------------------------------------------
export const DiagnosticsStore = {
  /** @type {ReturnType<typeof defaultState>|null} */
  state: null,

  _saveTimer: null,
  _lastErrorTs: 0,

  // ------ Lifecycle ------

  async load() {
    const saved = await chromeStorageGet(STORAGE_KEY);
    if (!saved) {
      this.state = defaultState();
      await this._persist();
    } else {
      this.state = this._migrate(saved);
    }
    return this.state;
  },

  _migrate(saved) {
    const s = { ...defaultState(), ...saved };
    // Ensure nested defaults
    s.settings = { ...defaultState().settings, ...s.settings };
    s.settings.privacy = { ...defaultState().settings.privacy, ...s.settings?.privacy };
    s.settings.diagnostics = { ...defaultState().settings.diagnostics, ...s.settings?.diagnostics };
    s.upload = { ...defaultState().upload, ...s.upload };
    if (!s.clientId) s.clientId = uuid();
    if (!Array.isArray(s.events)) s.events = [];
    if (!Array.isArray(s.upload.queue)) s.upload.queue = [];
    s.schemaVersion = SCHEMA_VERSION;
    return s;
  },

  // ------ Debounced persist ------

  save() {
    if (this._saveTimer) return; // already scheduled
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._persist();
    }, DEBOUNCE_MS);
  },

  async _persist() {
    if (!this.state) return;
    await chromeStorageSet(STORAGE_KEY, this.state);
  },

  async forceSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    await this._persist();
  },

  // ------ Events ring buffer ------

  /**
   * Append an event to the ring buffer.
   * @param {string} type - EventType value
   * @param {Record<string, any>} payload
   * @param {{ sessionId?: string, tradeId?: string, platform?: string }} ctx
   */
  logEvent(type, payload = {}, ctx = {}) {
    if (!this.state) return;

    // Rate-limit ERROR events
    if (type === "ERROR") {
      const now = Date.now();
      if (now - this._lastErrorTs < ERROR_COOLDOWN_MS) return;
      this._lastErrorTs = now;
    }

    const evt = createEvent(type, payload, {
      sessionId: ctx.sessionId,
      tradeId: ctx.tradeId,
      platform: ctx.platform || "UNKNOWN",
    });

    this.state.events.push(evt);

    // Trim ring buffer
    if (this.state.events.length > EVENTS_CAP) {
      this.state.events = this.state.events.slice(-EVENTS_CAP);
    }

    this.save();
  },

  // ------ Upload queue ------

  enqueuePacket(packet) {
    if (!this.state) return;
    this.state.upload.queue.push({
      uploadId: packet.uploadId,
      createdAt: packet.createdAt,
      eventCount: (packet.eventsDelta || []).length,
      payload: packet,
    });
    // Bound queue
    if (this.state.upload.queue.length > UPLOAD_QUEUE_CAP) {
      this.state.upload.queue = this.state.upload.queue.slice(-UPLOAD_QUEUE_CAP);
    }
    this.logEvent("UPLOAD_PACKET_ENQUEUED", { uploadId: packet.uploadId });
    this.save();
  },

  dequeuePacket() {
    if (!this.state || !this.state.upload.queue.length) return null;
    const item = this.state.upload.queue.shift();
    this.save();
    return item;
  },

  peekPacket() {
    if (!this.state || !this.state.upload.queue.length) return null;
    return this.state.upload.queue[0];
  },

  // ------ Privacy settings ------

  isAutoSendEnabled() {
    return !!this.state?.settings?.privacy?.autoSendDiagnostics;
  },

  enableAutoSend() {
    if (!this.state) return;
    this.state.settings.privacy.autoSendDiagnostics = true;
    this.state.settings.privacy.diagnosticsConsentAcceptedAt = Date.now();
    this.save();
  },

  disableAutoSend() {
    if (!this.state) return;
    this.state.settings.privacy.autoSendDiagnostics = false;
    this.save();
  },

  getEndpointUrl() {
    return this.state?.settings?.diagnostics?.endpointUrl || "";
  },

  setEndpointUrl(url) {
    if (!this.state) return;
    this.state.settings.diagnostics.endpointUrl = url;
    this.save();
  },

  getLastUploadedEventTs() {
    return this.state?.settings?.diagnostics?.lastUploadedEventTs || 0;
  },

  setLastUploadedEventTs(ts) {
    if (!this.state) return;
    this.state.settings.diagnostics.lastUploadedEventTs = ts;
    this.save();
  },

  // ------ Backoff ------

  isInBackoff() {
    return Date.now() < (this.state?.upload?.backoffUntilTs || 0);
  },

  setBackoff(delayMs) {
    if (!this.state) return;
    this.state.upload.backoffUntilTs = Date.now() + delayMs;
    this.save();
  },

  clearBackoff() {
    if (!this.state) return;
    this.state.upload.backoffUntilTs = 0;
    this.state.upload.lastError = null;
    this.save();
  },

  setLastError(msg) {
    if (!this.state) return;
    this.state.upload.lastError = msg;
    this.save();
  },

  // ------ Data management ------

  async clearAllData() {
    await chromeStorageRemove(STORAGE_KEY);
    this.state = defaultState();
    await this._persist();
  },

  async clearUploadQueue() {
    if (!this.state) return;
    this.state.upload.queue = [];
    this.state.upload.backoffUntilTs = 0;
    this.state.upload.lastError = null;
    await this.forceSave();
  },

  // ------ Delta query ------

  getEventsDelta() {
    if (!this.state) return [];
    const lastTs = this.getLastUploadedEventTs();
    return this.state.events.filter((e) => e.ts > lastTs);
  },

  getClientId() {
    return this.state?.clientId || "";
  },
};
