/**
 * ZERØ License Module
 * Manages Whop membership verification for Elite tier access.
 *
 * Primary flow (OAuth):
 *   User clicks "Sign in with Whop" → License.loginWithWhop()
 *     → WHOP_OAUTH_LOGIN message to background.js
 *     → background opens OAuth popup, exchanges code via worker
 *     → Worker checks has_access, returns userId + membership
 *     → License stores whopUserId + tier
 *
 * Legacy flow (license key — backward compat):
 *   User enters license key → License.activate(key)
 *     → VERIFY_LICENSE message to background.js
 *     → Worker calls Whop memberships API
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
   * Check if the user is signed in with Whop OAuth.
   * @returns {boolean}
   */
  isWhopLinked() {
    return !!Store.state?.settings?.license?.whopUserId;
  },

  /**
   * Get the stored license key (legacy).
   * @returns {string|null}
   */
  getKey() {
    return Store.state?.settings?.license?.key || null;
  },

  /**
   * Get license status for UI display.
   * @returns {{ status: string, plan: string|null, expiresAt: string|null, lastVerified: number|null, maskedKey: string|null, whopLinked: boolean }}
   */
  getStatus() {
    const license = Store.state?.settings?.license;
    if (!license) {
      return { status: "none", plan: null, expiresAt: null, lastVerified: null, maskedKey: null, whopLinked: false };
    }

    const whopLinked = !!license.whopUserId;
    const hasKey = !!license.key;

    if (!whopLinked && !hasKey) {
      return { status: "none", plan: null, expiresAt: null, lastVerified: null, maskedKey: null, whopLinked: false };
    }

    let maskedKey = null;
    if (hasKey) {
      maskedKey = license.key.length > 4 ? "****" + license.key.slice(-4) : "****";
    }

    return {
      status: license.status || "none",
      plan: license.plan || null,
      expiresAt: license.expiresAt || null,
      lastVerified: license.lastVerified || null,
      maskedKey,
      whopLinked,
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
   * Sign in with Whop OAuth — opens popup, verifies membership.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async loginWithWhop() {
    Logger.info("[License] Starting Whop OAuth login...");

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "WHOP_OAUTH_LOGIN" },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(res || { ok: false, error: "no_response" });
          }
        );
      });

      if (response.ok && response.userId) {
        const m = response.membership || {};
        Store.state.settings.license.whopUserId = response.userId;
        Store.state.settings.license.key = null; // Clear legacy key if any
        Store.state.settings.license.valid = m.valid || false;
        Store.state.settings.license.status = m.status || (m.valid ? "active" : "no_access");
        Store.state.settings.license.plan = m.plan || null;
        Store.state.settings.license.expiresAt = m.expiresAt || null;
        Store.state.settings.license.lastVerified = Date.now();
        Store.state.settings.tier = m.valid ? "elite" : "free";
        await Store.save();

        if (m.valid) {
          Logger.info("[License] Whop OAuth login successful — Elite activated");
          return { ok: true };
        } else {
          Logger.warn("[License] Whop OAuth login succeeded but no membership found");
          return { ok: false, error: "no_membership" };
        }
      }

      Logger.warn("[License] Whop OAuth login failed:", response.error);
      return { ok: false, error: response.error || "login_failed" };
    } catch (e) {
      Logger.error("[License] Whop OAuth login error:", e);
      return { ok: false, error: "network_error" };
    }
  },

  /**
   * Activate a license key — stores it and triggers verification.
   * Legacy flow for backward compatibility.
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
   * Sign out — clears Whop user ID and license key, reverts to Free.
   * @returns {Promise<void>}
   */
  async signOut() {
    Logger.info("[License] Signing out...");
    Store.state.settings.license = {
      key: null,
      whopUserId: null,
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
   * Deactivate the license — alias for signOut (backward compat).
   * @returns {Promise<void>}
   */
  async deactivate() {
    return this.signOut();
  },

  /**
   * Re-validate the stored membership against the server.
   * Uses whopUserId if available, falls back to licenseKey.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async revalidate() {
    const license = Store.state?.settings?.license;
    const userId = license?.whopUserId;
    const key = license?.key;

    if (!userId && !key) return { ok: false, error: "no_key" };

    Logger.info("[License] Revalidating...");

    try {
      const msg = userId
        ? { type: "VERIFY_LICENSE", userId }
        : { type: "VERIFY_LICENSE", licenseKey: key };

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (res) => {
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
    if (!license) return false;
    if (!license.whopUserId && !license.key) return false;
    if (!license.lastVerified) return true;
    return (Date.now() - license.lastVerified) > REVALIDATION_INTERVAL_MS;
  },

  /**
   * Open the Whop product page for purchase.
   */
  openPurchasePage() {
    window.open(WHOP_PRODUCT_URL, "_blank");
    Logger.info("[License] Opened Whop purchase page");
  },
};
