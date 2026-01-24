import { axiomAdapter } from "./axiom.js";
import { padreAdapter } from "./padre.js";

/**
 * Finds the appropriate platform adapter based on hostname
 * @param {string} hostname - The hostname to match (e.g., "axiom.trade")
 * @returns {object|null} Platform adapter object or null if not supported
 */
export function findAdapter(hostname) {
  if (hostname === "axiom.trade") return axiomAdapter;
  if (hostname === "trade.padre.gg") return padreAdapter;
  return null;
}
