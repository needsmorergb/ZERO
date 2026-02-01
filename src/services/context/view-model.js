/**
 * Market Context View Model Builder
 * Transforms ContextResponseV1 + SocialXProfile into a renderable view model.
 *
 * Guarantee: No field in the output ever contains "Data unavailable".
 * Every field has a deterministic { display, status } pair based on FieldStatus.
 *
 * @typedef {import('../socialx/types.js').FieldStatus} FieldStatus
 * @typedef {import('../socialx/types.js').SocialXProfile} SocialXProfile
 * @typedef {import('./client.js').ContextResponseV1} ContextResponseV1
 */

import { FIELD_STATUS } from "../socialx/types.js";
import { statusToText } from "./statusText.js";

/**
 * @typedef {Object} VMField
 * @property {*} value - Raw value (may be null)
 * @property {string} display - User-facing display string (never "Data unavailable")
 * @property {FieldStatus} status - Field-level status
 */

/**
 * @typedef {Object} MarketContextVM
 * @property {{ handle: VMField, url: VMField, age: VMField, followers: VMField, bio: VMField, caInBio: VMField, caInPinned: VMField, recentTweets: VMField, caMentions: VMField, renameCount: VMField, communities: { items: Array<{ name: string, url: string, display: string }>, status: FieldStatus, statusDisplay: string } }} xAccount
 * @property {{ domain: VMField, url: VMField, domainAge: VMField, contentSummary: VMField, narrativeConsistency: VMField }} website
 * @property {{ knownLaunches: VMField, recentLaunches: VMField, historicalSummary: VMField }} developer
 * @property {string|null} lastUpdated
 */

/**
 * Create a VMField.
 * @param {*} value
 * @param {string} display
 * @param {FieldStatus} status
 * @returns {VMField}
 */
function field(value, display, status) {
  return { value, display, status };
}

/**
 * Create a VMField for a "not supported" Phase 1 field.
 * @returns {VMField}
 */
function phase1NotFetched() {
  return field(null, "Not fetched in Phase 1", FIELD_STATUS.NOT_SUPPORTED);
}

/**
 * Create a VMField whose status depends on enrichment availability.
 * @param {FieldStatus} enrichmentStatus
 * @returns {VMField}
 */
function enrichmentField(enrichmentStatus) {
  return field(
    null,
    statusToText(enrichmentStatus || FIELD_STATUS.NOT_SUPPORTED),
    enrichmentStatus || FIELD_STATUS.NOT_SUPPORTED
  );
}

/**
 * Truncate a URL for display.
 * @param {string} url
 * @returns {string}
 */
function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 20) + "..." : "");
  } catch (_) {
    return url.slice(0, 30) + "...";
  }
}

/**
 * Truncate a Solana address for display.
 * @param {string} addr
 * @returns {string}
 */
function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr || "";
  return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
}

/**
 * Format a large number with K/M suffix.
 * @param {number} n
 * @returns {string}
 */
function formatCount(n) {
  if (n == null) return "";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/**
 * Build the complete Market Context view model.
 * @param {ContextResponseV1|null} context
 * @param {SocialXProfile|null} social
 * @returns {MarketContextVM}
 */
export function buildMarketContextViewModel(context, social) {
  return {
    xAccount: _buildXAccountVM(context, social),
    website: _buildWebsiteVM(context),
    developer: _buildDeveloperVM(context),
    lastUpdated: context?.fetchedAt || null,
  };
}

/**
 * Build X Account tab VM.
 * Maps enriched twitter154 fields when available.
 * Falls back to status-driven text for unenriched fields.
 */
function _buildXAccountVM(context, social) {
  const presence = social?.presence || false;
  const xStatus = context?.links?.x?.status || FIELD_STATUS.MISSING_IDENTIFIER;
  const profile = context?.x?.profile;
  const enrichStatus = profile?.enrichmentStatus || FIELD_STATUS.NOT_SUPPORTED;
  const isEnriched = enrichStatus === FIELD_STATUS.OK || enrichStatus === FIELD_STATUS.STALE_CACHED;

  // X Communities from context API
  const xComm = context?.x?.communities;
  const commStatus = xComm?.status || FIELD_STATUS.NOT_SUPPORTED;
  const commItems = (xComm?.items || []).map((item) => ({
    name: item.name || "X Community",
    url: item.url || "",
    display: item.name || "X Community",
    memberCount: item.memberCount ?? null,
    activityLevel: item.activityLevel || "unknown",
  }));

  // Age: from twitter154 enrichment or fallback
  let ageField;
  if (isEnriched && profile.accountAgeDays != null) {
    const days = profile.accountAgeDays;
    const display = days >= 365 ? `${(days / 365).toFixed(1)} years` : `${days} days`;
    ageField = field(days, display, enrichStatus);
  } else {
    ageField = enrichmentField(enrichStatus);
  }

  // Followers: from twitter154 enrichment
  let followersField;
  if (isEnriched && profile.followerCount != null) {
    followersField = field(profile.followerCount, formatCount(profile.followerCount), enrichStatus);
  } else {
    followersField = enrichmentField(enrichStatus);
  }

  // CA mentions: from twitter154 enrichment
  let caMentionsField;
  if (isEnriched && profile.caMentionCount != null) {
    const cnt = profile.caMentionCount;
    const display =
      cnt === 0
        ? "None found in recent tweets"
        : `${cnt} mention${cnt !== 1 ? "s" : ""} in recent tweets`;
    caMentionsField = field(cnt, display, enrichStatus);
  } else {
    caMentionsField = enrichmentField(enrichStatus);
  }

  // Rename count: from KV tracking
  let renameCountField;
  if (isEnriched && profile.renameCount != null) {
    const cnt = profile.renameCount;
    const display =
      cnt === 0 ? "No renames observed" : `${cnt} rename${cnt !== 1 ? "s" : ""} observed`;
    renameCountField = field(cnt, display, enrichStatus);
  } else {
    renameCountField = enrichmentField(enrichStatus);
  }

  return {
    handle: field(
      social?.handle || null,
      social?.handle || statusToText(social?.status || FIELD_STATUS.MISSING_IDENTIFIER),
      presence ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER
    ),
    url: field(
      social?.url || null,
      social?.url ? truncateUrl(social.url) : statusToText(xStatus),
      social?.url ? FIELD_STATUS.OK : xStatus
    ),
    age: ageField,
    followers: followersField,
    bio: phase1NotFetched(),
    caInBio: phase1NotFetched(),
    caInPinned: phase1NotFetched(),
    recentTweets: phase1NotFetched(),
    caMentions: caMentionsField,
    renameCount: renameCountField,
    communities: {
      items: commItems,
      status: commStatus,
      statusDisplay: statusToText(commStatus),
    },
  };
}

/**
 * Build Website tab VM.
 * Domain and URL come from the Context API.
 * Domain age, content summary come from the API when available.
 * Narrative consistency requires CF worker (NOT_SUPPORTED in Phase 1).
 */
function _buildWebsiteVM(context) {
  const ws = context?.website;
  const hasUrl = !!ws?.url;

  return {
    domain: field(
      ws?.domain || null,
      ws?.domain || statusToText(FIELD_STATUS.MISSING_IDENTIFIER),
      ws?.domain ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER
    ),
    url: field(
      ws?.url || null,
      ws?.url ? truncateUrl(ws.url) : statusToText(FIELD_STATUS.MISSING_IDENTIFIER),
      hasUrl ? FIELD_STATUS.OK : FIELD_STATUS.MISSING_IDENTIFIER
    ),
    domainAge: field(
      ws?.domainAgeDays ?? null,
      ws?.domainAgeDays != null
        ? `${ws.domainAgeDays} days`
        : statusToText(hasUrl ? FIELD_STATUS.NOT_SUPPORTED : FIELD_STATUS.MISSING_IDENTIFIER),
      ws?.domainAgeDays != null
        ? FIELD_STATUS.OK
        : hasUrl
          ? FIELD_STATUS.NOT_SUPPORTED
          : FIELD_STATUS.MISSING_IDENTIFIER
    ),
    contentSummary: field(
      ws?.title || ws?.metaDescription || null,
      ws?.title ||
        ws?.metaDescription ||
        statusToText(hasUrl ? FIELD_STATUS.NOT_SUPPORTED : FIELD_STATUS.MISSING_IDENTIFIER),
      ws?.title || ws?.metaDescription
        ? FIELD_STATUS.OK
        : hasUrl
          ? FIELD_STATUS.NOT_SUPPORTED
          : FIELD_STATUS.MISSING_IDENTIFIER
    ),
    narrativeConsistency: field(
      null,
      statusToText(FIELD_STATUS.NOT_SUPPORTED),
      FIELD_STATUS.NOT_SUPPORTED
    ),
  };
}

/**
 * Build Developer tab VM.
 * Helius enrichment provides authority signals, deployer info, and token history.
 */
function _buildDeveloperVM(context) {
  const dev = context?.dev;
  const devStatus = dev?.status || FIELD_STATUS.NOT_SUPPORTED;
  // When devStatus is OK but a field is null, the API queried successfully
  // but couldn't determine the value — show a meaningful fallback, not "".
  const nullFallback = devStatus === FIELD_STATUS.OK ? "Unknown" : statusToText(devStatus);
  const nullStatus = devStatus === FIELD_STATUS.OK ? FIELD_STATUS.NOT_SUPPORTED : devStatus;

  // --- Authority fields (Tier 1) ---
  // mintAuthority: null = revoked (safe), string = active (risk), undefined = not fetched
  let mintAuthField;
  if (dev?.mintAuthority === null) {
    mintAuthField = field(null, "Revoked", FIELD_STATUS.OK);
  } else if (typeof dev?.mintAuthority === "string") {
    mintAuthField = field(
      dev.mintAuthority,
      `Active \u2014 ${truncateAddress(dev.mintAuthority)}`,
      FIELD_STATUS.OK
    );
  } else {
    mintAuthField = field(null, nullFallback, nullStatus);
  }

  let freezeAuthField;
  if (dev?.freezeAuthority === null) {
    freezeAuthField = field(null, "Revoked", FIELD_STATUS.OK);
  } else if (typeof dev?.freezeAuthority === "string") {
    freezeAuthField = field(
      dev.freezeAuthority,
      `Active \u2014 ${truncateAddress(dev.freezeAuthority)}`,
      FIELD_STATUS.OK
    );
  } else {
    freezeAuthField = field(null, nullFallback, nullStatus);
  }

  let metadataField;
  if (dev?.metadataMutable === false) {
    metadataField = field(false, "Immutable", FIELD_STATUS.OK);
  } else if (dev?.metadataMutable === true) {
    metadataField = field(true, "Mutable", FIELD_STATUS.OK);
  } else {
    metadataField = field(null, nullFallback, nullStatus);
  }

  // --- Holdings field (Tier 1b) ---
  let devHoldingsField;
  if (dev?.devHoldingsPct != null) {
    const pct = dev.devHoldingsPct;
    const display = pct < 0.01 ? "< 0.01%" : pct < 1 ? `${pct.toFixed(2)}%` : `${pct.toFixed(1)}%`;
    devHoldingsField = field(pct, display, FIELD_STATUS.OK);
  } else {
    devHoldingsField = field(null, nullFallback, nullStatus);
  }

  // --- Deployer balance (Tier 2) ---
  let deployerBalanceField;
  if (dev?.deployerBalanceSol != null) {
    const sol = dev.deployerBalanceSol;
    const display = sol < 0.01 ? "< 0.01 SOL" : `${sol.toFixed(2)} SOL`;
    deployerBalanceField = field(sol, display, FIELD_STATUS.OK);
  } else {
    deployerBalanceField = field(null, nullFallback, nullStatus);
  }

  // --- Deployer wallet age (Tier 2) ---
  let deployerAgeField;
  if (dev?.deployerAgeDays != null) {
    const days = dev.deployerAgeDays;
    const display =
      days >= 365 ? `${(days / 365).toFixed(1)} years` : days === 0 ? "< 1 day" : `${days} days`;
    deployerAgeField = field(days, display, FIELD_STATUS.OK);
  } else {
    deployerAgeField = field(null, nullFallback, nullStatus);
  }

  // --- Recent mints in 7 days (Tier 2) ---
  let recentMints7dField;
  if (dev?.recentMints7d != null) {
    const cnt = dev.recentMints7d;
    recentMints7dField = field(cnt, `${cnt} token${cnt !== 1 ? "s" : ""} in 7d`, FIELD_STATUS.OK);
  } else {
    recentMints7dField = field(null, nullFallback, nullStatus);
  }

  return {
    // Identity
    knownLaunches: field(
      dev?.deployer || null,
      dev?.deployer ? truncateAddress(dev.deployer) : nullFallback,
      dev?.deployer ? FIELD_STATUS.OK : nullStatus
    ),
    // Tier 1: Authority signals
    mintAuthority: mintAuthField,
    freezeAuthority: freezeAuthField,
    metadataMutable: metadataField,
    // Tier 1b: Holdings
    devHoldings: devHoldingsField,
    // Tier 2: Deployer context
    deployerBalance: deployerBalanceField,
    deployerAge: deployerAgeField,
    // History
    recentLaunches: field(
      dev?.deployerMints30d ?? null,
      dev?.deployerMints30d != null ? `${formatCount(dev.deployerMints30d)} tokens` : nullFallback,
      dev?.deployerMints30d != null ? FIELD_STATUS.OK : nullStatus
    ),
    recentMints7d: recentMints7dField,
    historicalSummary: field(
      dev?.mintAgeDays ?? null,
      dev?.mintAgeDays != null ? `Token created ${dev.mintAgeDays} days ago` : nullFallback,
      dev?.mintAgeDays != null ? FIELD_STATUS.OK : nullStatus
    ),
  };
}
