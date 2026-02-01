/**
 * statusToText — Maps FieldStatus strings to user-facing display text.
 * Single source of truth for all status → display string mappings.
 *
 * Guarantee: Never returns "Data unavailable".
 * Only neutral, observational language.
 */

import { FIELD_STATUS } from "../socialx/types.js";

/**
 * Convert a FieldStatus value to a user-facing display string.
 * @param {import('../socialx/types.js').FieldStatus} status
 * @returns {string}
 */
export function statusToText(status) {
  switch (status) {
    case FIELD_STATUS.OK:
      return ""; // Caller uses the actual value
    case FIELD_STATUS.MISSING_IDENTIFIER:
      return "Not detected";
    case FIELD_STATUS.NOT_SUPPORTED:
      return "Not detected";
    case FIELD_STATUS.PROVIDER_ERROR:
      return "Temporarily unavailable";
    case FIELD_STATUS.RATE_LIMITED:
      return "Temporarily unavailable";
    case FIELD_STATUS.STALE_CACHED:
      return "Cached (updating\u2026)";
    default:
      return "Not detected";
  }
}
