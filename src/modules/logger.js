/**
 * ZERØ Safe Logger
 * Wraps console logging with levels, redaction, and production suppression.
 *
 * Levels (ascending severity): debug=0, info=1, warn=2, error=3, silent=4
 * Default threshold: "warn" — suppresses debug and info.
 * When the user enables "Debug logs" in settings, threshold drops to "debug".
 */

const LEVEL_MAP = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

export const Logger = {
  /** @type {'debug'|'info'|'warn'|'error'|'silent'} */
  level: "warn",

  /**
   * Call once after Store.load() with the user's debugLogs setting.
   * @param {boolean} debugEnabled
   */
  configure(debugEnabled) {
    this.level = debugEnabled ? "debug" : "warn";
  },

  _shouldLog(lvl) {
    return LEVEL_MAP[lvl] >= LEVEL_MAP[this.level];
  },

  debug(msg, ...args) {
    if (!this._shouldLog("debug")) return;
    console.debug(`[ZERØ] ${msg}`, ...this.cleanArgs(args));
  },

  info(msg, ...args) {
    if (!this._shouldLog("info")) return;
    console.log(`[ZERØ] ${msg}`, ...this.cleanArgs(args));
  },

  warn(msg, ...args) {
    if (!this._shouldLog("warn")) return;
    console.warn(`[ZERØ] ${msg}`, ...this.cleanArgs(args));
  },

  error(msg, ...args) {
    if (!this._shouldLog("error")) return;
    console.error(`[ZERØ] ${msg}`, ...this.cleanArgs(args));
  },

  cleanArgs(args) {
    return args.map((arg) => {
      if (arg instanceof Error) {
        return { name: arg.name, message: arg.message, stack: arg.stack };
      }
      if (typeof DOMException !== "undefined" && arg instanceof DOMException) {
        return { name: arg.name, message: arg.message, code: arg.code };
      }
      if (typeof arg === "object" && arg !== null) {
        const clean = { ...arg };
        ["key", "secret", "token", "auth", "password", "walletAddress", "privateKey"].forEach((k) => {
          if (k in clean) clean[k] = "***REDACTED***";
        });
        return clean;
      }
      return arg;
    });
  },
};
