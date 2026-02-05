# Lessons Learned

## Padre Header Scraper — DOM Element Limit (2025-05)

**Problem:** `scrapePadreHeader()` with a 2000-element `querySelectorAll` limit reliably found invested/sold on page load, but after TradingView chart rendered (adding thousands of DOM elements), position panel labels were pushed past the limit. Price/MC always found (header bar = early in DOM).

**Fix:** Cache-first approach. On first discovery, cache actual DOM element references (`_posCache`). On subsequent polls, read cached refs directly (no scan needed). Deep scan (8000 limit) runs every 3s as fallback to re-discover if cached refs disconnect.

**Rule:** When scanning large DOMs with element limits, always cache discovered element references for repeat reads. Don't re-scan the full DOM on every poll.

---

## SWAP_URL_PATTERNS vs Domain Names (2025-05)

**Problem:** `SWAP_URL_PATTERNS` regex contains `/trade/` which matches the Padre domain `trade.padre.gg`. When used in PerformanceObserver (which gives full URLs including domain), EVERY request triggered as a "swap detected", causing constant aggressive re-scanning and cache invalidation — which prevented SELL detection from working.

**Fix:** Parse `new URL(url).pathname` before testing against swap patterns. Created `PERFOBS_SWAP_PATH` — a tightened regex that only matches URL path segments (e.g., `/swap`, `/execute`), not domain substrings.

**Rule:** Never test `SWAP_URL_PATTERNS` against full URLs that include domain names. Always extract pathname first. The shared regex was designed for API path matching, not full-URL matching.

---

## DOM Scan — First Match vs Last Match (2025-05)

**Problem:** `deepScanPositionFields()` iterated forward through DOM elements and unconditionally overwrote cached refs on each match. Padre's DOM has duplicate labels (e.g., "Sold" appears in both the active position panel and summary sections). The LAST match pointed to a non-updating element, so SELL detection failed — the cached "Sold" element never changed value.

**Fix:** Skip already-cached connected elements: `if (_posCache[key] && _posCache[key].isConnected) continue;`. This preserves the first working match, consistent with the fast scan's `if (results[key] !== undefined) continue` pattern.

**Rule:** When caching DOM element references by label, prefer FIRST match (skip if already cached + connected). Multiple elements may match the same label pattern — the first in DOM order is most likely the active/updating one.

---

## Cache Invalidation After Trade Detection (2025-05)

**Problem:** After detecting a BUY, the cached "Sold" element reference could become disconnected due to React re-rendering the position panel. Without invalidation, the scraper kept reading from a disconnected/stale node and never saw the sold value update.

**Fix:** Call `invalidatePosCache()` after every trade emission to force deep scan re-discovery on the next poll.

**Rule:** Any time a trade is detected on a React-based platform, invalidate cached DOM element references. React re-renders can replace entire subtrees, making element refs stale even if `isConnected` still returns true briefly.

---

## Merge Conflict Resolution — Never Blanket Accept One Side (2026-02)

**Problem:** When merging `feature/dev-tab-improvement` into `main`, 10 files conflicted due to a prior `upgrades` merge. Used `git checkout --theirs` on all conflicted files to accept the feature branch wholesale. This silently dropped changes from the `upgrades` branch (e.g., STATS tab fixes), causing a regression — STATS loaded into a blurred view with no content and no way to exit.

**Fix:** Must review each conflict individually. For source files, manually inspect both sides and combine changes. For generated bundles, resolve source conflicts first then rebuild.

**Rule:** NEVER use `git checkout --theirs` or `--ours` as a blanket resolution for merge conflicts. Always inspect each conflicted file to understand what both sides changed. Blanket resolution silently drops the other side's work and causes regressions that are hard to trace back to the merge.
