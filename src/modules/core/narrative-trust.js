/**
 * ZERO Narrative Trust Service
 * Orchestrates context fetching, social profile resolution, and trust scoring.
 *
 * Data flow:
 *   Market (mint change)
 *     → fetchContext() [live API: api.get-zero.xyz]
 *     → ObservedSocialXAdapter.getProfile() [X handle parsing]
 *     → buildMarketContextViewModel() [status-aware display fields]
 *     → _calculateScore() [weighted scoring on available data]
 *     → notify() → ShadowHud._updateMarketContext()
 *
 * Language rules: Only neutral, observational terms.
 * Allowed: observed, associated, detected, historical, established, new,
 *          active, dormant, present, absent, linked, not linked, known, unknown.
 * Forbidden: scam, rugpull, safe, unsafe, guaranteed, signals.
 */

import { Market } from "./market.js";
import { fetchContext } from "../../services/context/client.js";
import { ObservedSocialXAdapter } from "../../services/socialx/observed-adapter.js";
import { buildMarketContextViewModel } from "../../services/context/view-model.js";
import { FIELD_STATUS } from "../../services/socialx/types.js";

export const NarrativeTrust = {
  currentMint: null,
  listeners: [],
  initialized: false,
  loading: false,

  // Current data state
  data: {
    mint: null,
    score: null,
    confidence: "low",
    availableSignals: 0,
    totalSignals: 7,
    lastFetchTs: 0,

    // Phase 1: Structured service data
    context: null, // ContextResponseV1
    social: null, // SocialXProfile
    vm: null, // MarketContextVM

    // Signal dots (collapsed view)
    signals: {
      xAccountAge: "unavailable",
      recentActivity: "unavailable",
      xCommunities: "unavailable",
      developerHistory: "unavailable",
    },
  },

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Subscribe to market updates (mint changes AND data refreshes)
    Market.subscribe(() => {
      const mint = Market.currentMint;
      if (!mint) return;

      // Fetch on mint change OR when we have no score yet
      if (mint !== this.currentMint || this.data.score === null) {
        this.fetchForMint(mint);
      }
    });

    // Initial fetch if Market already has a mint
    if (Market.currentMint) {
      this.fetchForMint(Market.currentMint);
    }
  },

  subscribe(callback) {
    this.listeners.push(callback);
  },

  notify() {
    this.listeners.forEach((cb) => cb(this.data));
  },

  getData() {
    return this.data;
  },

  getScore() {
    return { score: this.data.score, confidence: this.data.confidence };
  },

  getSignals() {
    return this.data.signals;
  },

  /**
   * Get the view model for rendering (null during loading/before first fetch).
   * @returns {import('../../services/context/view-model.js').MarketContextVM|null}
   */
  getViewModel() {
    return this.data.vm;
  },

  /**
   * Fetch and score narrative trust for a given mint.
   * Orchestrates: Context API → SocialX Adapter → View Model → Score.
   *
   * No longer requires DexScreener info — the live API handles everything.
   */
  async fetchForMint(mint) {
    if (!mint) return;
    this.currentMint = mint;
    this.loading = true;
    this._setEmptyState(mint);
    this.notify();

    try {
      // 1. Fetch context from live API
      const context = await fetchContext({ ca: mint });

      // 2. Get social profile from observed adapter
      const social = await ObservedSocialXAdapter.getProfile({
        ca: mint,
        discoveredXUrl: context.links?.x?.url || null,
        discoveredSiteUrl: context.links?.website?.url || null,
        discoveredFrom: context.links?.x?.url ? ["context_links"] : [],
      });

      // 3. Build view model (status-aware, never shows "Data unavailable")
      const vm = buildMarketContextViewModel(context, social);

      // 4. Calculate score from context + social data
      const scoring = this._calculateScore(context, social);

      // 5. Build signal dots
      const signals = this._buildSignals(context, social);

      // 6. Update data
      this.loading = false;
      this.data = {
        mint,
        score: scoring.score,
        confidence: scoring.confidence,
        availableSignals: scoring.availableSignals,
        totalSignals: scoring.totalSignals,
        lastFetchTs: Date.now(),
        context,
        social,
        vm,
        signals,
      };

      this.notify();
    } catch (e) {
      console.warn("[NarrativeTrust] Fetch failed:", e?.message || e);
      this.loading = false;
      // Keep previous data if same mint, otherwise reset
      if (this.data.mint !== mint) {
        this._setEmptyState(mint);
      }
      this.notify();
    }
  },

  /**
   * Set empty/loading state for a given mint.
   */
  _setEmptyState(mint) {
    this.data = {
      mint,
      score: null,
      confidence: "low",
      availableSignals: 0,
      totalSignals: 7,
      lastFetchTs: 0,
      context: null,
      social: null,
      vm: null,
      signals: {
        xAccountAge: "unavailable",
        recentActivity: "unavailable",
        xCommunities: "unavailable",
        developerHistory: "unavailable",
      },
    };
  },

  /**
   * Build signal dot map from context and social data.
   * Values: 'detected' (green), 'not_detected' (yellow/neutral), 'unavailable' (gray)
   */
  _buildSignals(context, social) {
    // X presence
    const xStatus = social?.presence ? "detected" : "not_detected";

    // Activity: use enrichment data (account age) when available
    const enrichStatus = context?.x?.profile?.enrichmentStatus;
    const accountAge = context?.x?.profile?.accountAgeDays;
    const activityStatus =
      enrichStatus === FIELD_STATUS.OK && accountAge != null
        ? accountAge > 30
          ? "established"
          : "new"
        : social?.activityBucket === "recent"
          ? "detected"
          : social?.activityBucket === "stale"
            ? "not_detected"
            : "unavailable";

    // X Communities: from context API
    const xCommStatus = context?.x?.communities?.status;
    const xCommSignal =
      xCommStatus === FIELD_STATUS.OK
        ? "detected"
        : xCommStatus === FIELD_STATUS.NOT_SUPPORTED
          ? "unavailable"
          : xCommStatus === FIELD_STATUS.MISSING_IDENTIFIER
            ? "not_detected"
            : "unavailable";

    // Developer: depends on API availability
    const devStatus =
      context?.dev?.status === FIELD_STATUS.OK
        ? "detected"
        : context?.dev?.status === FIELD_STATUS.NOT_SUPPORTED
          ? "unavailable"
          : "not_detected";

    return {
      xAccountAge: xStatus,
      recentActivity: activityStatus,
      xCommunities: xCommSignal,
      developerHistory: devStatus,
    };
  },

  /**
   * Calculate trust score based on available data.
   * Fields with NOT_SUPPORTED or unavailable status are excluded
   * from both numerator and denominator.
   */
  _calculateScore(context, social) {
    let earned = 0;
    let possible = 0;
    let checked = 0;

    const enriched =
      context?.x?.profile?.enrichmentStatus === FIELD_STATUS.OK ||
      context?.x?.profile?.enrichmentStatus === FIELD_STATUS.STALE_CACHED;

    const rules = [
      // X/Twitter presence (from SocialX adapter)
      {
        weight: 15,
        available: social?.status !== FIELD_STATUS.NOT_SUPPORTED,
        passes: social?.presence === true,
      },
      // Website URL detected (from Context API)
      {
        weight: 10,
        available: true, // Always checked
        passes: context?.links?.website?.status === FIELD_STATUS.OK,
      },
      // Website domain resolved
      {
        weight: 5,
        available: !!context?.website?.domain,
        passes: !!context?.website?.domain,
      },
      // Multiple social/project links detected (>= 2)
      {
        weight: 5,
        available: true,
        passes: _countDetectedLinks(context) >= 2,
      },
      // X Communities detected (from Context API)
      {
        weight: 10,
        available: context?.x?.communities?.status !== FIELD_STATUS.NOT_SUPPORTED,
        passes:
          context?.x?.communities?.status === FIELD_STATUS.OK &&
          (context?.x?.communities?.items?.length || 0) > 0,
      },
      // Token has image/logo (from Context API)
      {
        weight: 5,
        available: true,
        passes: !!context?.token?.hasImage,
      },
      // Dev: mint age known
      {
        weight: 10,
        available: context?.dev?.status === FIELD_STATUS.OK,
        passes: context?.dev?.mintAgeDays != null,
      },
      // Dev: deployer known
      {
        weight: 5,
        available: context?.dev?.status === FIELD_STATUS.OK,
        passes: !!context?.dev?.deployer,
      },
      // Enriched: X account age > 30 days (established account)
      {
        weight: 10,
        available: enriched && context?.x?.profile?.accountAgeDays != null,
        passes: (context?.x?.profile?.accountAgeDays || 0) > 30,
      },
      // Enriched: CA mentioned in recent tweets
      {
        weight: 10,
        available: enriched && context?.x?.profile?.caMentionCount != null,
        passes: (context?.x?.profile?.caMentionCount || 0) > 0,
      },
      // Enriched: No excessive renames (< 3)
      {
        weight: 5,
        available: enriched && context?.x?.profile?.renameCount != null,
        passes: (context?.x?.profile?.renameCount || 0) < 3,
      },
      // Dev: Mint authority revoked (strongest rug protection signal)
      {
        weight: 15,
        available:
          context?.dev?.status === FIELD_STATUS.OK && context?.dev?.mintAuthority !== undefined,
        passes: context?.dev?.mintAuthority === null,
      },
      // Dev: Freeze authority revoked
      {
        weight: 10,
        available:
          context?.dev?.status === FIELD_STATUS.OK && context?.dev?.freezeAuthority !== undefined,
        passes: context?.dev?.freezeAuthority === null,
      },
      // Dev: Metadata immutable
      {
        weight: 5,
        available:
          context?.dev?.status === FIELD_STATUS.OK && context?.dev?.metadataMutable != null,
        passes: context?.dev?.metadataMutable === false,
      },
      // Dev: Dev holdings < 10% of supply
      {
        weight: 10,
        available: context?.dev?.status === FIELD_STATUS.OK && context?.dev?.devHoldingsPct != null,
        passes: (context?.dev?.devHoldingsPct ?? 100) < 10,
      },
    ];

    rules.forEach((rule) => {
      if (!rule.available) return; // Exclude from both numerator and denominator
      possible += rule.weight;
      checked++;
      if (rule.passes) {
        earned += rule.weight;
      }
    });

    const maxPossible = rules.reduce((sum, r) => sum + r.weight, 0);
    const coverage = maxPossible > 0 ? possible / maxPossible : 0;
    let score = possible > 0 ? Math.round((earned / possible) * 100) : null;

    // Data completeness cap: if missing account age or CA proof, max 70
    const hasAge = context?.x?.profile?.accountAgeDays != null;
    const hasCAProof = (context?.x?.profile?.caMentionCount || 0) > 0;
    const dataCapped = score !== null && (!hasAge || !hasCAProof);

    if (dataCapped) {
      score = Math.min(score, 70);
    }

    // Confidence: coverage-based, but capped to 'medium' when data-incomplete
    let confidence = coverage >= 0.7 ? "high" : coverage >= 0.4 ? "medium" : "low";
    if (dataCapped && confidence === "high") {
      confidence = "medium";
    }

    return {
      score,
      confidence,
      availableSignals: checked,
      totalSignals: rules.length,
    };
  },
};

/**
 * Count detected (OK status) links in context.
 * @param {import('../../services/context/client.js').ContextResponseV1|null} context
 * @returns {number}
 */
function _countDetectedLinks(context) {
  if (!context?.links) return 0;
  let count = 0;
  if (context.links.x?.status === FIELD_STATUS.OK) count++;
  if (context.links.website?.status === FIELD_STATUS.OK) count++;
  return count;
}
