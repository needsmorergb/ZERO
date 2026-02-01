/**
 * ZERØ License Module
 * Manages Whop membership verification for Elite tier access.
 *
 * Flow:
 *   User enters license key → License.activate(key)
 *     → VERIFY_LICENSE message to background.js
 *     → background.js POSTs to api.get-zero.xyz/verify-membership
 *     → Worker calls Whop API, validates, caches, returns result
 *     → License updates Store with tier + validation timestamp
 *
 * Revalidation:
 *   On boot (if lastVerified > 24h) and periodically via chrome.alarm.
 *   72h grace period if API is unreachable.
 */

import { Store } from "./store.js";
import { Logger } from "./logger.js";

const WHOP_PRODUCT_URL = "https://whop.com/crowd-ctrl/zero-elite/";
const REVALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const License = {
  /**
   * Check if the user has a valid Elite license (from cached state).
   * Does NOT call any API — reads Store only.
   * @returns {boolean}
   */
  isValid() {
    const license = Store.state?.settings?.license;
    if (!license || !license.valid || !license.lastVerified) return false;

    const GRACE_MS = 72 * 60 * 60 * 1000;
    const elapsed = Date.now() - license.lastVerified;
    return elapsed < GRACE_MS;
  },

  /**
   * Get the stored license key.
   * @returns {string|null}
   */
  getKey() {
    return Store.state?.settings?.license?.key || null;
  },

  /**
   * Get license status for UI display.
   * @returns {{ status: string, plan: string|null, expiresAt: string|null, lastVerified: number|null, maskedKey: string|null }}
   */
  getStatus() {
    const license = Store.state?.settings?.license;
    if (!license || !license.key) {
      return { status: "none", plan: null, expiresAt: null, lastVerified: null, maskedKey: null };
    }

    const key = license.key;
    const maskedKey = key.length > 4 ? "****" + key.slice(-4) : "****";

    return {
      status: license.status || "none",
      plan: license.plan || null,
      expiresAt: license.expiresAt || null,
      lastVerified: license.lastVerified || null,
      maskedKey,
    };
  },

  /**
   * Get a human-readable plan label.
   * @returns {string}
   */
  getPlanLabel() {
    const plan = Store.state?.settings?.license?.plan;
    if (plan === "founders") return "Founders Lifetime";
    if (plan === "annual") return "Annual";
    if (plan === "monthly") return "Monthly";
    return "";
  },

  /**
   * Activate a license key — stores it and triggers verification.
   * @param {string} key - Whop license key or membership ID
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async activate(key) {
    if (!key || typeof key !== "string" || key.trim().length < 4) {
      return { ok: false, error: "Invalid license key" };
    }

    key = key.trim();
    Logger.info("[License] Activating key...");

    // Store key temporarily
    Store.state.settings.license.key = key;
    Store.state.settings.license.status = "pending";
    await Store.save();

    // Verify
    const result = await this.revalidate();

    if (result.ok) {
      Logger.info("[License] Activation successful");
    } else {
      Logger.warn("[License] Activation failed:", result.error);
      // Clear the key on hard failure (invalid key)
      if (result.error === "invalid_key" || result.error === "invalid_product") {
        Store.state.settings.license.key = null;
        Store.state.settings.license.valid = false;
        Store.state.settings.license.status = "error";
        Store.state.settings.tier = "free";
        await Store.save();
      }
    }

    return result;
  },

  /**
   * Deactivate the license — clears key and reverts to Free.
   * @returns {Promise<void>}
   */
  async deactivate() {
    Logger.info("[License] Deactivating...");
    Store.state.settings.license = {
      key: null,
      valid: false,
      lastVerified: null,
      expiresAt: null,
      status: "none",
      plan: null,
    };
    Store.state.settings.tier = "free";
    await Store.save();
  },

  /**
   * Re-validate the stored license key against the server.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async revalidate() {
    const key = Store.state?.settings?.license?.key;
    if (!key) return { ok: false, error: "no_key" };

    Logger.info("[License] Revalidating...");

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "VERIFY_LICENSE", licenseKey: key }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(res || { ok: false, error: "no_response" });
        });
      });

      if (response.ok && response.membership) {
        const m = response.membership;
        Store.state.settings.license.valid = m.valid;
        Store.state.settings.license.status = m.status || (m.valid ? "active" : "expired");
        Store.state.settings.license.plan = m.plan || null;
        Store.state.settings.license.expiresAt = m.expiresAt || null;
        Store.state.settings.license.lastVerified = Date.now();
        Store.state.settings.tier = m.valid ? "elite" : "free";
        await Store.save();
        return { ok: m.valid, error: m.valid ? undefined : "membership_inactive" };
      }

      // API error — keep cached validity within grace period
      const license = Store.state.settings.license;
      if (license.valid && license.lastVerified) {
        const GRACE_MS = 72 * 60 * 60 * 1000;
        const elapsed = Date.now() - license.lastVerified;
        if (elapsed < GRACE_MS) {
          Logger.warn("[License] Verification failed, using cached (grace period)");
          return { ok: true };
        }
      }

      // Grace period expired or never verified
      Store.state.settings.license.valid = false;
      Store.state.settings.license.status = "error";
      Store.state.settings.tier = "free";
      await Store.save();
      return { ok: false, error: response.error || "verification_failed" };
    } catch (e) {
      Logger.error("[License] Revalidation error:", e);
      return { ok: false, error: "network_error" };
    }
  },

  /**
   * Check if revalidation is needed (called on boot).
   * @returns {boolean}
   */
  needsRevalidation() {
    const license = Store.state?.settings?.license;
    if (!license || !license.key) return false;
    if (!license.lastVerified) return true;
    return Date.now() - license.lastVerified > REVALIDATION_INTERVAL_MS;
  },

  /**
   * Open the Whop product page for purchase.
   */
  openPurchasePage() {
    window.open(WHOP_PRODUCT_URL, "_blank");
    Logger.info("[License] Opened Whop purchase page");
  },
};
