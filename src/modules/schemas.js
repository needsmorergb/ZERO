/**
 * ZERØ Unified Schemas
 * Shared type definitions and factory functions for Trade, Session, and Event.
 */

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------
export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @enum {string} */
export const Platform = {
  AXIOM: "AXIOM",
  PADRE: "PADRE",
  UNKNOWN: "UNKNOWN",
};

/** @enum {string} */
export const TradeSide = {
  BUY: "BUY",
  SELL: "SELL",
};

/** @enum {string} */
export const TradeType = {
  PAPER: "PAPER",
  REAL_SHADOW: "REAL_SHADOW",
};

/** @enum {string} */
export const QuoteCurrency = {
  SOL: "SOL",
  USD: "USD",
  UNKNOWN: "UNKNOWN",
};

/** @enum {string} */
export const EventType = {
  SESSION_STARTED: "SESSION_STARTED",
  SESSION_ENDED: "SESSION_ENDED",
  TRADE_OPENED: "TRADE_OPENED",
  TRADE_CLOSED: "TRADE_CLOSED",
  PLAN_SET: "PLAN_SET",
  STRATEGY_SET: "STRATEGY_SET",
  EMOTION_SET: "EMOTION_SET",
  UI_LOCKED_FEATURE_CLICKED: "UI_LOCKED_FEATURE_CLICKED",
  UPLOAD_PACKET_ENQUEUED: "UPLOAD_PACKET_ENQUEUED",
  UPLOAD_SENT: "UPLOAD_SENT",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  ERROR: "ERROR",
};

// ---------------------------------------------------------------------------
// Factory: Trade
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} TradePlan
 * @property {string|null}   thesis
 * @property {number|null}   plannedStop
 * @property {number[]|null} plannedTargets
 * @property {number|null}   maxRiskPct
 */

/**
 * @typedef {Object} Trade
 * @property {string}      tradeId
 * @property {string}      sessionId
 * @property {string}      platform
 * @property {{ address?: string, symbol?: string, name?: string }} token
 * @property {string}      side
 * @property {number}      entryPrice
 * @property {number}      [exitPrice]
 * @property {number}      qty
 * @property {string}      quoteCurrency
 * @property {number}      openedAt
 * @property {number}      [closedAt]
 * @property {number}      [pnl]
 * @property {number}      [pnlPct]
 * @property {number|null} [rMultiple]
 * @property {string}      tradeType
 * @property {string|null} [strategyTag]
 * @property {string|null} [emotionTag]
 * @property {TradePlan|null} [plan]
 * @property {number|null} [disciplineScore]
 * @property {string|null} [notes]
 */

/**
 * Create a new Trade object with defaults.
 * @param {Partial<Trade>} overrides
 * @returns {Trade}
 */
export function createTrade(overrides = {}) {
  return {
    tradeId: uuid(),
    sessionId: "",
    platform: Platform.UNKNOWN,
    token: { address: "", symbol: "", name: "" },
    side: TradeSide.BUY,
    entryPrice: 0,
    exitPrice: undefined,
    qty: 0,
    quoteCurrency: QuoteCurrency.SOL,
    openedAt: Date.now(),
    closedAt: undefined,
    pnl: undefined,
    pnlPct: undefined,
    rMultiple: null,
    tradeType: TradeType.PAPER,
    strategyTag: null,
    emotionTag: null,
    plan: null,
    disciplineScore: null,
    notes: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: Session
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SessionSummary
 * @property {number}      [totalPnl]
 * @property {number}      [winCount]
 * @property {number}      [lossCount]
 * @property {number}      [streakMaxWin]
 * @property {number}      [streakMaxLoss]
 * @property {number|null} [disciplineScore]
 */

/**
 * @typedef {Object} Session
 * @property {string}   sessionId
 * @property {number}   startedAt
 * @property {number}   [endedAt]
 * @property {string}   platform
 * @property {{ address?: string, symbol?: string }|null} [tokenContext]
 * @property {string[]} tradeIds
 * @property {SessionSummary} summary
 */

/**
 * Create a new Session object with defaults.
 * @param {Partial<Session>} overrides
 * @returns {Session}
 */
export function createSession(overrides = {}) {
  return {
    sessionId: uuid(),
    startedAt: Date.now(),
    endedAt: undefined,
    platform: Platform.UNKNOWN,
    tokenContext: null,
    tradeIds: [],
    summary: {
      totalPnl: 0,
      winCount: 0,
      lossCount: 0,
      streakMaxWin: 0,
      streakMaxLoss: 0,
      disciplineScore: null,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory: Event
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ZeroEvent
 * @property {string} eventId
 * @property {number} ts
 * @property {string} [sessionId]
 * @property {string} [tradeId]
 * @property {string} platform
 * @property {string} type    - One of EventType values
 * @property {Record<string, any>} payload
 */

/**
 * Create a new Event object.
 * @param {string} type - EventType value
 * @param {Record<string, any>} payload
 * @param {Partial<ZeroEvent>} overrides
 * @returns {ZeroEvent}
 */
export function createEvent(type, payload = {}, overrides = {}) {
  return {
    eventId: uuid(),
    ts: Date.now(),
    sessionId: undefined,
    tradeId: undefined,
    platform: Platform.UNKNOWN,
    type,
    payload,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Schema version for the unified storage format
// ---------------------------------------------------------------------------
export const SCHEMA_VERSION = 3;
