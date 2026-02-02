# PnL Troubleshooting Decision Tree

Use this tree to diagnose PnL issues in ZERO. Start at the top-level symptom and follow the branches.

---

## 1. PnL Shows Wrong Number

```
PnL shows wrong number
├── 1A. Unrealized PnL is wrong
│   ├── 1A1. Price is stale or incorrect
│   │   ├── Check Market.price vs actual token price on DEX
│   │   │   ├── Market.price is stale
│   │   │   │   ├── TokenMarketDataService polling stopped?
│   │   │   │   │   → Check console for DexScreener/Jupiter API errors
│   │   │   │   ├── Bridge price intercept not firing?
│   │   │   │   │   → Check bridge-utils.js: is extractPriceUsd() matching responses?
│   │   │   │   │   → Verify SWAP_URL_PATTERNS matches current platform URLs
│   │   │   │   └── PositionPriceManager not running?
│   │   │   │       → Check background.js: 15-second interval for batch price updates
│   │   │   │       → Verify DexScreener batch endpoint returning valid data
│   │   │   └── Market.price is for wrong token
│   │   │       → TokenDetector.getCurrentToken() returning wrong mint
│   │   │       → Check DOM selectors for the current platform (Axiom vs Padre)
│   │   │
│   │   ├── Check SOL/USD price (PnlCalculator.getSolPrice())
│   │   │   ├── Both Kraken + Coinbase APIs failing?
│   │   │   │   → Falls back to lastValidSolPrice (default: $200 if never fetched)
│   │   │   │   → Check chrome.alarms: 5-min SOL price refresh running?
│   │   │   ├── SOL price stuck at $200?
│   │   │   │   → First-ever fetch failed → cachedSolPrice never set
│   │   │   │   → Check network tab for Kraken/Coinbase 4.5s timeout
│   │   │   └── SOL price lagging?
│   │   │       → Cache is 5 min; check lastSolPriceFetch timestamp
│   │   │
│   │   └── Check pos.lastMarkPriceUsd
│   │       ├── Value is 0 or undefined?
│   │       │   → Token never got a price update from PositionPriceManager
│   │       │   → Mint may not be in DexScreener → WAC method returns 0
│   │       └── Value is old (check pos timestamp)?
│   │           → PositionPriceManager batch may have excluded this mint
│   │           → Max 30 tokens per batch — position may be dropping off
│   │
│   ├── 1A2. MC Ratio method producing bad results
│   │   ├── entryMarketCapUsdReference is wrong
│   │   │   ├── Was it set from chart MCap or API MCap?
│   │   │   │   → Chart MCap has 3s protection window (market.js)
│   │   │   │   → If chart was active at entry, chart MCap was used
│   │   │   ├── Entry MC is 0 or undefined?
│   │   │   │   → Falls back to WAC method (may diverge from MC ratio)
│   │   │   └── Entry MC was FDV not actual MC?
│   │   │       → Check Market.marketCap source at time of entry
│   │   │
│   │   ├── Current MC is wrong
│   │   │   ├── API MCap overwriting chart MCap?
│   │   │   │   → Check lastChartMCapTs: 3s window should protect
│   │   │   │   → Race condition if API arrives within 3s of chart update
│   │   │   └── MCap is 0 (token delisted/low liquidity)?
│   │   │       → Falls back to WAC method
│   │   │
│   │   └── MC ratio > 100,000x sanity check triggered?
│   │       → Falls back to WAC silently (console warn only)
│   │       → Check console for "MC ratio sanity check" warnings
│   │
│   └── 1A3. WAC fallback method producing bad results
│       ├── costBasisUsd is wrong
│       │   ├── Multiple buys accumulated floating point errors?
│       │   │   → No precision rounding in WAC updates
│       │   │   → Compounds after 100+ trades on same token
│       │   └── costBasisUsd went negative after partial sells?
│       │       → Check if costRemovedUsd > costBasisUsd on a sell
│       │
│       ├── qtyTokens is wrong
│       │   ├── Sell removed more qty than position had?
│       │   │   → Shadow mode clamps to position qty (line 193)
│       │   │   → Paper mode: check pct calculation in sell()
│       │   └── Tiny residual qty (< 0.000001) not cleaned up?
│       │       → Position should auto-close at this threshold
│       │       → If not closing: check closure logic in order-execution.js:135-141
│       │
│       └── avgCostUsdPerToken is NaN or Infinity?
│           → Division by zero: qtyTokens was 0 when avgCost was computed
│           → Check: is there a guard before costBasisUsd / qtyTokens?
│
├── 1B. Realized PnL is wrong
│   ├── 1B1. Single trade realized PnL is wrong
│   │   ├── avgCostUsdPerToken was wrong at time of sell
│   │   │   → Check position state BEFORE the sell occurred
│   │   │   → costBasisUsd / qtyTokens at that point
│   │   │   → Floating point drift from many prior trades?
│   │   │
│   │   ├── Sell price was wrong
│   │   │   ├── Paper mode: Market.price at time of sell?
│   │   │   │   → Check fill record: fillPriceUsd, priceSource
│   │   │   └── Shadow mode: bridge-reported price?
│   │   │       → Check fill record: fillPriceUsd, priceSource = "shadow_swap"
│   │   │       → Bridge may have used derived price (buyUsd / tokenAmount)
│   │   │
│   │   ├── Sell quantity was wrong
│   │   │   ├── Paper: percentage-based sell miscalculated?
│   │   │   │   → qtyDelta = pct × pos.qtyTokens
│   │   │   └── Shadow: bridge reported wrong tokenAmount?
│   │   │       → Check bridge extraction logic in bridge-utils.js
│   │   │       → Lamports vs SOL confusion (> 1000 threshold)
│   │   │
│   │   └── SOL conversion was wrong
│   │       → pnlEventSol = pnlEventUsd / solUsd
│   │       → If solUsd was stale, SOL-denominated PnL is off
│   │
│   ├── 1B2. Session realized total is wrong
│   │   ├── session.realized not matching sum of trade PnLs?
│   │   │   → session.realized += pnlEventSol on each sell
│   │   │   → Check if any sell skipped the session.realized update
│   │   │   → Check order-execution.js:171 and shadow-trade-ingestion.js
│   │   │
│   │   └── session.realized was reset unexpectedly?
│   │       → New session started mid-trading?
│   │       → Check startNewSession() calls and triggers
│   │
│   └── 1B3. Realized PnL sign is inverted
│       → Formula: proceedsUsd - costRemovedUsd
│       → If cost > proceeds → negative (loss) — correct
│       → If showing opposite sign: check if formula was accidentally flipped
│
└── 1C. Total/Session PnL is wrong
    ├── totalPnl = session.realized + unrealizedPnlSol
    │   ├── session.realized is wrong → go to 1B
    │   └── unrealizedPnlSol is wrong → go to 1A
    │
    ├── Session percentage denominator is wrong
    │   ├── Paper mode: uses settings.startSol
    │   │   → Check if startSol was changed after trades started
    │   │   → User edited start SOL mid-session?
    │   └── Shadow mode: uses totalInvestedSol (sum of pos.totalSolSpent)
    │       → If all positions closed, totalInvestedSol = 0 → division by zero
    │       → Check: is there a guard for this case?
    │
    └── Display unit mismatch (SOL vs USD)
        ├── tokenDisplayUsd toggle flipped?
        │   → Check settings.tokenDisplayUsd and sessionDisplayUsd
        └── SOL/USD conversion using stale solUsd?
            → Go to SOL price checks in 1A1
```

---

## 2. PnL Shows Zero When It Shouldn't

```
PnL shows 0.0000 when it shouldn't
├── 2A. Position exists but PnL is zero
│   ├── pos.qtyTokens <= 0?
│   │   → Position was fully sold but not cleaned up
│   │   → Check closure threshold: qtyTokens < 0.000001
│   │
│   ├── pos.lastMarkPriceUsd is 0 or missing?
│   │   → Token never received a price update
│   │   → PositionPriceManager couldn't find mint on DexScreener
│   │   → WAC method returns 0 when markPrice = 0
│   │
│   ├── costBasisUsd is 0?
│   │   → Position was bought with 0 USD value
│   │   → Check if solUsd was 0 at time of buy
│   │
│   └── fmtSol() returned "0.0000" for non-finite number?
│       → NaN or Infinity in PnL calculation
│       → fmtSol() silently returns "0.0000" for non-finite values
│       → Root cause: division by zero or undefined field upstream
│
├── 2B. No position found for current token
│   ├── TokenDetector returning wrong mint?
│   │   → DOM selector not matching current platform
│   │   → Token switched but event didn't fire
│   │
│   ├── Position stored under different mint?
│   │   → Check state.positions keys vs current mint
│   │
│   └── Wrong mode's positions being read?
│       → Store.getActivePositions() returning paper positions in shadow mode?
│       → Check Store.isShadowMode() vs state.settings.tradingMode
│
└── 2C. Session realized is 0 after selling
    ├── Sell executed but PnL wasn't recorded?
    │   → Check fill record: does it have realizedPnlSol?
    │   → Check if session.realized was updated
    │
    └── Session was reset between buy and sell?
        → startNewSession() archives old session
        → New session has realized = 0
```

---

## 3. PnL Not Updating / Frozen

```
PnL display is frozen / not updating
├── 3A. HUD not re-rendering
│   ├── Market.subscribe() not firing?
│   │   → Check if Market module is receiving price updates
│   │   → Bridge script may have disconnected from page context
│   │
│   ├── HUD.scheduleRender() not being called?
│   │   → Check if updatePnlHud() is being triggered
│   │   → DOM may have been removed by platform page navigation
│   │
│   └── window.ZeroHUD.updateAll() not wired?
│       → Shadow trade ingestion calls this after recording
│       → Check if ZeroHUD was initialized on the window object
│
├── 3B. Price feed stopped
│   ├── Bridge script crashed?
│   │   → Bridge runs in page context — page navigation kills it
│   │   → Check if content script re-injects bridge on navigation
│   │
│   ├── TokenMarketDataService stopped polling?
│   │   → Check for API errors (rate limiting, 429 responses)
│   │   → DexScreener/Jupiter may be down
│   │
│   └── PositionPriceManager stopped?
│       → 15-second interval in background.js
│       → Service worker may have gone idle (MV3 lifecycle)
│       → Check chrome.alarms for keepalive
│
├── 3C. State not persisting
│   ├── chrome.storage.local quota exceeded?
│   │   → Save silently fails
│   │   → State reverts on reload
│   │   → Check: chrome.storage.local.getBytesInUse()
│   │
│   ├── Extension context invalidated?
│   │   → Extension was updated/reloaded while tab was open
│   │   → chrome.runtime calls throw "Extension context invalidated"
│   │   → Must reload the tab
│   │
│   └── Concurrent save race condition?
│       → Multiple rapid trades → multiple Store.save() calls
│       → No locking → last write wins
│       → Some trades may be lost
│
└── 3D. Shadow mode specific
    ├── ShadowTradeIngestion not initialized?
    │   → Only starts when Store.isShadowMode() === true at HUD init
    │   → If mode switched after init, listener may not be active
    │
    ├── Bridge not detecting swaps?
    │   → SWAP_URL_PATTERNS may not match current platform endpoints
    │   → Platform updated their swap API URLs
    │   → Check bridge-utils.js regex patterns
    │
    └── postMessage not reaching content script?
        → Bridge uses window.postMessage with __paper: true flag
        → Content script listener checks for __paper flag
        → If flag missing or changed, messages are dropped
```

---

## 4. PnL Percentage is Wrong (But SOL Amount Looks Right)

```
PnL % is wrong but absolute value seems correct
├── 4A. Denominator is wrong
│   ├── Paper mode using wrong startSol?
│   │   → Check settings.startSol vs session.balance at start
│   │   → User may have changed startSol after opening positions
│   │
│   ├── Shadow mode: totalInvestedSol = 0?
│   │   → All positions closed → sum of totalSolSpent = 0
│   │   → Division by zero → shows 0% or NaN
│   │
│   └── Using costBasisUsd as denominator but it drifted?
│       → After partial sells, costBasisUsd decreases
│       → Remaining PnL% recalculated against smaller base
│       → This is correct WAC behavior but may surprise users
│
├── 4B. MC ratio % vs WAC % disagreement
│   ├── MC ratio method active but WAC would give different result?
│   │   → MC ratio: pnlPct = (currentMC / entryMC - 1) × 100
│   │   → WAC: pnlPct = unrealizedUsd / costBasisUsd × 100
│   │   → These can diverge if token supply changed or MC data inconsistent
│   │
│   └── Method switched mid-session?
│       → Started with MC ratio, MC became unavailable, fell back to WAC
│       → PnL% jumps discontinuously
│
└── 4C. pos.pnlPct / pos.peakPnlPct not updating
    ├── pnlPct only updates when getUnrealizedPnl() is called
    │   → Check if PnL calculator is being invoked on price changes
    └── peakPnlPct tracks all-time high
        → Should only increase, never decrease
        → If it decreased: state was corrupted or reset
```

---

## 5. Shadow Mode PnL Issues (Specific)

```
Shadow mode PnL problems
├── 5A. Trades not being recorded
│   ├── Not in shadow mode?
│   │   → handleDetectedTrade() checks Store.isShadowMode() first
│   │   → If in paper/analysis mode, shadow trades are ignored
│   │
│   ├── Duplicate signature rejected?
│   │   → Same tx processed twice → second one silently dropped
│   │   → Check if bridge sent multiple messages for one swap
│   │
│   ├── Missing required fields?
│   │   → mint is required (warn + skip if missing)
│   │   → solAmount is required (warn + skip if missing)
│   │   → signature is required for dedup
│   │
│   └── Bridge didn't detect the swap?
│       → URL pattern didn't match → go to 3D
│       → Response parsing failed → check bridge-utils.js extractors
│       → Platform changed response format
│
├── 5B. Balance is wildly wrong
│   ├── Wallet balance auto-detection failed?
│   │   ├── GET_WALLET_BALANCE message not reaching background?
│   │   │   → Check chrome.runtime.sendMessage path
│   │   ├── Background has no wallet address?
│   │   │   → state.shadow.walletAddress not set
│   │   │   → Wallet address detection depends on page context
│   │   ├── Helius RPC call failed?
│   │   │   → API key missing/invalid
│   │   │   → Rate limited
│   │   │   → Network error
│   │   └── Fallback used: balance = firstTradeAmount × 10?
│   │       → This is arbitrary and can be wildly wrong
│   │       → 0.1 SOL trade → 1 SOL balance (if wallet has 50 SOL)
│   │
│   └── Balance not updating after trades?
│       → session.balance -= solAmount (buy) / += proceedsSol (sell)
│       → Check if these updates are being applied to shadowSession
│
├── 5C. Price derivation wrong for shadow trade
│   ├── Bridge-reported price used but was wrong?
│   │   → Check fill record: priceSource = "shadow_swap"
│   │   → Bridge may have extracted wrong field from response
│   │
│   ├── Fell back to Market.price but it was for wrong token?
│   │   → Market.price tracks the currently-viewed token
│   │   → If user trades token A while viewing token B, price is wrong
│   │
│   └── Derived price from amounts was wrong?
│       → buyUsd / tokenAmount can fail if tokenAmount is in wrong units
│       → Lamports vs whole tokens confusion
│
└── 5D. WAC cost basis diverged from actual cost
    ├── Missed a buy trade?
    │   → Cost basis lower than actual → PnL inflated
    │   → Check fills list vs on-chain tx history
    │
    ├── Missed a sell trade?
    │   → Position shows more tokens than wallet has
    │   → Cost basis higher than it should be
    │
    └── Trade amounts were wrong?
        → Bridge extracted wrong SOL amount
        → Lamport conversion: > 1000 threshold may misclassify
        → Very small SOL trades (< 0.001) could be treated as lamports
```

---

## 6. PnL Display Issues (Visual)

```
PnL looks wrong visually
├── 6A. Color is wrong
│   ├── Shows green but PnL is negative (or vice versa)
│   │   → Check: color logic uses >= 0 for green, < 0 for red
│   │   → If value is -0.0000, JavaScript -0 === 0 is true
│   │   → fmtSol() may strip the negative sign on very small negatives
│   │
│   └── Win streak shows green but trader is losing?
│       → Streaks track consecutive SELL outcomes only
│       → Can have green streak while unrealized positions are deep red
│
├── 6B. Format / units wrong
│   ├── Showing USD when expecting SOL (or vice versa)
│   │   → Check tokenDisplayUsd / sessionDisplayUsd settings toggle
│   │   → Toggle state persists in settings
│   │
│   ├── Too many / too few decimal places?
│   │   → fmtSol() uses 4 decimals for SOL
│   │   → USD uses 2 decimals
│   │   → Very small values may show as "0.0000"
│   │
│   └── Percentage shows NaN or Infinity?
│       → Division by zero in denominator
│       → costBasisUsd = 0, or startSol = 0, or totalInvestedSol = 0
│
├── 6C. Position panel shows stale data
│   ├── Position price not updating?
│   │   → PositionPriceManager runs every 15s in background
│   │   → DexScreener batch may not include this mint
│   │   → Max 30 mints per batch — excess positions dropped
│   │
│   └── Position shows wrong symbol?
│       → Symbol set at buy time, never updated
│       → If token changed symbol, old one persists
│
└── 6D. Session PnL disagrees with position PnL
    ├── Session PnL includes ALL positions (realized + unrealized)
    │   → But header unrealized shows only CURRENT token
    │   → User may confuse per-token vs session totals
    │
    └── Closed positions still showing in positions panel?
        → qtyTokens should be 0 → filtered out of display
        → Check positions panel filter: pos.qtyTokens > 0
```

---

## 7. PnL Lost After Reload / Session Change

```
PnL data disappeared
├── 7A. State didn't persist
│   ├── chrome.storage.local save failed?
│   │   → Quota exceeded (5MB limit for local storage)
│   │   → Extension context invalidated during save
│   │   → Check console for storage errors
│   │
│   ├── State loaded from defaults instead of storage?
│   │   → Store.load() has 1-second timeout
│   │   → If storage read took > 1s, falls back to DEFAULTS
│   │   → All positions/trades/session lost
│   │
│   └── Schema migration corrupted data?
│       → v2→v3 migration uses deepMerge
│       → If existing state had unexpected shape, merge may corrupt
│
├── 7B. Session was archived
│   ├── startNewSession() called unexpectedly?
│   │   → Archives current session to history
│   │   → Creates fresh session with balance = startSol
│   │   → All unrealized PnL "resets" (positions still exist but session.realized = 0)
│   │
│   ├── Paper: old sessions capped at 10?
│   │   → 11th session pushes oldest out of history
│   │   → That session's stats are permanently lost
│   │
│   └── Session accessible in history but not current?
│       → Check Store.getActiveSessionHistory()
│       → Sessions are archived with full stats
│
└── 7C. Mode switch caused data to "disappear"
    ├── Switched from shadow → paper?
    │   → Shadow data still exists in shadowPositions etc.
    │   → But UI now shows paper mode data
    │   → Switch back to shadow to see shadow data
    │
    └── Accessors returning wrong mode's data?
        → Store.isShadowMode() reads settings.tradingMode
        → If mode wasn't saved, reload reverts to default (paper)
        → Shadow data exists but isn't displayed
```

---

## Quick Diagnostic Commands

Run these in the extension's console (content script context):

```javascript
// 1. Check current mode
chrome.storage.local.get('sol_paper_trader_v1', r => {
  const s = r.sol_paper_trader_v1;
  console.log('Mode:', s.settings.tradingMode);
});

// 2. Dump all positions
chrome.storage.local.get('sol_paper_trader_v1', r => {
  const s = r.sol_paper_trader_v1;
  const mode = s.settings.tradingMode;
  const pos = mode === 'shadow' ? s.shadowPositions : s.positions;
  console.table(Object.values(pos).map(p => ({
    symbol: p.symbol,
    qty: p.qtyTokens,
    costBasis: p.costBasisUsd,
    avgCost: p.avgCostUsdPerToken,
    markPrice: p.lastMarkPriceUsd,
    realizedPnl: p.realizedPnlUsd,
    entryMC: p.entryMarketCapUsdReference
  })));
});

// 3. Check session PnL
chrome.storage.local.get('sol_paper_trader_v1', r => {
  const s = r.sol_paper_trader_v1;
  const mode = s.settings.tradingMode;
  const session = mode === 'shadow' ? s.shadowSession : s.session;
  console.log('Balance:', session.balance);
  console.log('Realized:', session.realized);
  console.log('Trades:', session.tradeCount);
  console.log('Win/Loss:', session.winStreak, '/', session.lossStreak);
});

// 4. Check SOL price
// (run in background service worker console)
console.log('Cached SOL price:', cachedSolPrice);
console.log('Last valid:', lastValidSolPrice);
console.log('Last fetch:', new Date(lastSolPriceFetch));

// 5. Check storage usage
chrome.storage.local.getBytesInUse(null, bytes => {
  console.log('Storage used:', (bytes / 1024).toFixed(1), 'KB');
  console.log('Quota remaining:', ((5 * 1024 * 1024 - bytes) / 1024).toFixed(1), 'KB');
});

// 6. Verify shadow trade dedup cache
// (check for duplicate signatures in fills)
chrome.storage.local.get('sol_paper_trader_v1', r => {
  const s = r.sol_paper_trader_v1;
  const fills = Object.values(s.shadowTrades || {});
  const sigs = fills.map(f => f.signature).filter(Boolean);
  const dupes = sigs.filter((s, i) => sigs.indexOf(s) !== i);
  console.log('Total shadow fills:', fills.length);
  console.log('Duplicate signatures:', dupes.length, dupes);
});
```

---

## Severity Guide

| Severity | Meaning | Example |
|----------|---------|---------|
| **P0 — Data Loss** | Trades/PnL permanently lost | Storage save failure, session capped out |
| **P1 — Wrong PnL** | User sees incorrect profit/loss | Stale SOL price, WAC corruption, missed shadow trade |
| **P2 — Stale Display** | PnL correct in state but display frozen | HUD not re-rendering, price feed stopped |
| **P3 — Cosmetic** | Minor visual issue | Wrong color on -0, NaN%, symbol mismatch |

---

## Root Cause Frequency (Estimated)

Based on code analysis, most likely root causes in order:

1. **SOL price stale/default** — Both APIs fail, $200 fallback used
2. **Token price not updating** — PositionPriceManager batch missing the mint
3. **Shadow trade not detected** — Platform changed swap API URLs
4. **MC ratio method inconsistency** — Entry MC vs current MC from different sources
5. **Session reset confusion** — User started new session, PnL "disappeared"
6. **Mode switch confusion** — Switched modes, looking at wrong dataset
7. **Floating point drift** — Many trades on same token compound rounding errors
8. **Storage failure** — Quota exceeded or context invalidated
9. **Bridge lamport/SOL confusion** — Amount off by 1e9
10. **Wallet balance fallback** — 10x estimate wildly inaccurate
