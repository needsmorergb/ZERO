/**
 * ZERØ Safe Logger
 * Wraps console logging to strip sensitive data and potentially suppress logs in production.
 */
export const Logger = {
  isProduction: false, // Set to true in prod builds

  info(msg, ...args) {
    if (this.isProduction) return;
    console.log(`[ZERØ] ${msg}`, ...this.cleanArgs(args));
  },

  warn(msg, ...args) {
    console.warn(`[ZERØ] ${msg}`, ...this.cleanArgs(args));
  },

  error(msg, ...args) {
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
        // Shallow clone to avoid mutation
        const clean = { ...arg };
        // Strip potential secrets
        ["key", "secret", "token", "auth", "password"].forEach((k) => {
          if (k in clean) clean[k] = "***REDACTED***";
        });
        return clean;
      }
      return arg;
    });
  },
};
