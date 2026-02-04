# CLAUDE.md — ZERO Project Rules

## Project Identity

ZERO is a Chrome extension for zero-risk paper trading on Solana (Axiom + Padre platforms). It provides paper trading overlays, analysis/shadow modes for observing real trades with full PnL, and market context with trust scoring powered by X/Twitter enrichment.

## Architecture

- **Content scripts** are per-platform bundles built with esbuild (`content.bundle.axiom.js`, `content.bundle.padre.js`)
- **Bridge scripts** run in page context (MAIN world, not isolated) for DOM scraping, TradingView API access, and network interception. Note: Padre uses SES lockdown which kills fetch/XHR overrides — see "Padre-Specific Pitfalls" below
- **Background service worker** (`background.js`) handles price fetching, API proxying, caching
- **Context API** lives in `worker-context/` — a Cloudflare Worker that enriches tokens via twitter154 and Helius DAS/RPC
- **Modules** follow a core/ui split: `src/modules/core/` for logic, `src/modules/ui/` for HUD rendering

## Build

```bash
npm run build          # Both platforms
npm run build:axiom    # Axiom only
npm run build:padre    # Padre only
```

Bundles are committed to git (Chrome loads them directly). Always rebuild and verify both bundles before committing changes to `src/`.

## Code Conventions

- Vanilla JS only — no TypeScript, no React, no frameworks
- IIFE bundles via esbuild — all imports resolve at build time
- Chrome extension APIs (`chrome.storage`, `chrome.runtime`, `chrome.alarms`) — never use web-only equivalents
- All state persistence goes through `src/modules/store.js` which wraps `chrome.storage.local`
- Feature gating via `src/modules/featureManager.js` — check tier before exposing features
- Mode switching (Paper / Analysis / Shadow) via `src/modules/mode-manager.js`

## Trust Scoring System

- Trust scores are computed in `narrative-trust.js` from weighted signals (max possible: 130)
- Scores cap at 70 when missing account age or CA proof — never bypass this cap
- X enrichment data comes from the Context API worker, not directly from twitter154 in the extension
- DEV signals (authorities, holdings, wallet age) come from the Context API worker via Helius — never call Helius directly from the extension
- FieldStatus enum (`src/services/socialx/types.js`) tracks data availability per field

## DEV Tab Signals

The DEV tab in Shadow Mode displays 10 fields from the Context API worker (`fetchDevEnrichment` in `worker-context/src/index.js`):

- **Deployer** — token creator address (from creation tx fee payer)
- **Mint Auth** — mint authority status: "Revoked" (safe) or "Active" (inflation risk)
- **Freeze Auth** — freeze authority status: "Revoked" (safe) or "Active" (rug risk)
- **Metadata** — "Immutable" (locked) or "Mutable" (can change name/image)
- **Dev Holdings** — deployer's % of total token supply
- **Dev SOL** — deployer wallet SOL balance
- **Wallet Age** — age of deployer wallet (not the token)
- **Dev Tokens** — total tokens ever created by deployer
- **Recent (7d)** — tokens created by deployer in last 7 days
- **Mint Age** — days since token creation

Authority signals (mint/freeze/metadata) are extracted from the existing `getAsset` response at zero extra API cost. Deployer-dependent signals (holdings, balance, wallet age, recent mints) run in parallel via `Promise.all` after the deployer is resolved.

### Authority signal semantics
- `mintAuthority === null` → revoked (safe), `string` → active (risk), `undefined` → not fetched
- Same pattern for `freezeAuthority`
- `metadataMutable === false` → immutable, `true` → mutable, `null` → unknown

## Real Trading PnL (Analysis & Shadow Modes)

Both Analysis Mode (free) and Shadow Mode (elite) track real buys/sells with full PnL, completely separate from Paper Mode. They share the same `shadow*` state keys — the "shadow" prefix is historical; these are really "real-trading observation" state. Shadow adds elite behavioral analytics and NarrativeTrust on top of Analysis.

| Mode | Tier | Real Trade PnL | Behavioral Analytics | NarrativeTrust |
|------|------|----------------|---------------------|----------------|
| Paper | Free | No (simulated) | Basic | No |
| Analysis | Free | Yes | Recorded but not displayed | No |
| Shadow | Elite | Yes | Full display | Yes |

### State Separation

Parallel real-trading state objects live alongside paper state in `store.js`:
- `shadowSession` / `session` — active session (balance, trades, realized PnL)
- `shadowTrades` / `trades` — trade fill records
- `shadowPositions` / `positions` — open positions with WAC cost basis
- `shadowBehavior` / `behavior` — behavioral analytics state
- `shadowEventLog` / `eventLog` — session event timeline
- `shadowSessionHistory` / `sessionHistory` — archived sessions (real trading is uncapped)

Both Analysis and Shadow use the `shadow*` keys. Switching between them preserves data (same wallet, same trades).

### Accessor Pattern

All UI and analytics code uses mode-aware accessors instead of reading state directly:
- `Store.isShadowMode()` — checks `settings.tradingMode === 'shadow'` (use for Shadow-only UI: NarrativeTrust, Shadow HUD badge)
- `Store.isRealTradingMode()` — returns `true` for both `'shadow'` and `'analysis'` (use for **all data routing**: state accessors, trade ingestion gates, PnL calculator, start SOL input)
- `Store.getActiveSession()` — returns real-trading or paper session (uses `isRealTradingMode()`)
- `Store.getActivePositions()` / `getActiveTrades()` / `getActiveBehavior()` / `getActiveEventLog()` / `getActiveSessionHistory()`

**Critical rule**: When adding new mode checks, use `isRealTradingMode()` for data routing and `isShadowMode()` only for Shadow-exclusive features (NarrativeTrust init, shadow HUD). Never gate trade ingestion or PnL on `isShadowMode()` — Analysis mode must also process real trades.

Analytics uses an internal `_resolve(state)` helper that returns `{ session, trades, positions, behavior, eventLog, isRealTrading }` routed by mode.

### Trade Ingestion (`src/modules/core/shadow-trade-ingestion.js`)

Listens for `SHADOW_TRADE_DETECTED` messages from bridge scripts and records real trades into shadow state using identical WAC PnL math as `OrderExecution`. Gates on `Store.isRealTradingMode()` — processes trades in both Analysis and Shadow modes:
- BUY: `buyUsd = solAmount * solUsd`, `qtyDelta = buyUsd / priceUsd`, update WAC cost basis
- SELL: `costRemovedUsd = qtyDelta * avgCostUsdPerToken`, `realizedPnl = proceedsUsd - costRemovedUsd`
- Deduplicates by transaction signature
- Auto-detects wallet SOL balance on first BUY via `GET_WALLET_BALANCE` → Helius RPC

### Swap Detection — Multi-Layer Architecture (`bridge-utils.js`, `bridge.padre.js`)

Trade detection uses platform-appropriate methods. **The detection layer varies by platform** due to SES lockdown and wallet adapter differences.

#### Padre: Header Delta Detection (Primary)

Padre uses SES (Secure EcmaScript) lockdown that **replaces `window.fetch` and `XMLHttpRequest.prototype.send` after our bridge script runs**. This makes all fetch/XHR interception silently non-functional. Additionally, Padre's wallet adapter caches method references at initialization time, so `signTransaction`/`signAndSendTransaction` hooks are installed but never called (the adapter calls the cached original).

**What works on Padre:**
- `scrapePadreHeader()` reads cumulative "Invested" and "Sold" USD values from the header DOM
- `detectHeaderTrade()` tracks deltas: invested increase → BUY, sold increase → SELL
- MutationObserver triggers re-scrape within ~100ms of DOM changes
- TradingView `createExecutionShape` hook logs Padre's B/S markers (secondary diagnostic)
- `PerformanceObserver` (Resource Timing API) detects swap-related network requests even after SES — triggers aggressive deep scan

**Header scraper architecture (`scrapePadreHeader`):**
- **Fast scan** (2000-element limit): reliably finds price, MC, liquidity in the header bar (early in DOM)
- **Cache-first reads** (`_posCache`): after first discovery of invested/sold elements, reads directly from cached DOM element references (instant, bypasses element limit)
- **Deep scan** (8000-element limit, every 3s fallback): re-discovers position field elements that are beyond the 2000 fast-scan limit after TradingView chart renders. Also triggered aggressively (every 200ms) for 5s after PerfObs detects a swap URL
- **Cache invalidation** (`invalidatePosCache()`): called after every detected trade — Padre's React may re-render the position panel, making cached element references stale

**What does NOT work on Padre (do not retry these approaches):**
- `window.fetch` override — SES replaces it (confirmed: `fetch override was REPLACED`)
- `XMLHttpRequest.prototype.send` override — same SES issue
- `signTransaction` / `signAndSendTransaction` hooks — wallet adapter caches method references before hooks are installed; hooks fire but are never called by Padre's code
- `tryDetectRpcSignature()` — depends on fetch override which is dead

**Header delta detection emits `usdAmount` instead of `solAmount`** (SOL price unavailable in bridge context). The content script (`ShadowTradeIngestion.handleDetectedTrade()`) converts USD→SOL using `PnlCalculator.getSolPrice()`.

#### Axiom: Fetch/XHR Interception (Primary)

Axiom does NOT use SES lockdown, so fetch/XHR interception works normally:
- `tryHandleSwap()` intercepts swap API responses matching `SWAP_URL_PATTERNS`
- Extracts tx signature, mints, amounts directly from response JSON
- `cacheSwapQuote()` caches recent quotes for wallet hook correlation

#### Shared: Wallet Hooks (Backup)

`setupSwapDetection()` in `bridge-utils.js` hooks `signAndSendTransaction`, `sendTransaction`, and `signTransaction` on wallet providers. These work as the primary detection on platforms without SES. On Padre they are installed but non-functional (see above).

The `_bs58encode()` function converts `Uint8Array(64)` signatures from `signTransaction` results to base58 txid strings.

#### Shared: RPC Resolution (Backup)

When only a tx signature is available (no quote data), `SHADOW_SWAP_SIGNATURE` is emitted. The content script's `resolveSwapSignature()` sends `RESOLVE_SWAP_TX` to the background service worker, which calls `getTransaction` RPC and parses with `parseSwapFromTx()`. Retry loop: 3 attempts at [1.5s, 3s, 5s] delays.

#### Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `SHADOW_TRADE_DETECTED` | bridge → content | Full trade data (side, mint, solAmount/usdAmount, price, signature) |
| `SHADOW_SWAP_SIGNATURE` | bridge → content | Signature-only, needs RPC resolution |
| `RESOLVE_SWAP_TX` | content → background | Single `getTransaction` RPC call |
| `PADRE_PNL_TICK` | bridge → content | Platform T.PNL from header scraping |

#### Deduplication

- By tx signature in `shadowTrades` (prevents recording same trade twice)
- `_pendingSignatures` Set prevents concurrent resolve loops
- Header-detected trades use synthetic signatures (`hdr-B-{mint}-{ts}`, `hdr-S-{mint}-{ts}`)

### Key Rules
- Shadow, Analysis, and Paper PnL all use the exact same WAC math — never diverge these
- Start SOL input is disabled/grayed in both Analysis and Shadow modes (balance is auto-detected)
- Real-trading session history is uncapped (real traders have fewer sessions)
- Always use accessors (`Store.getActiveSession()` etc.) — never read `state.session` directly in UI/analytics code
- Use `isRealTradingMode()` for data routing, `isShadowMode()` only for Shadow-exclusive UI
- Trade fills are tagged with `mode: "analysis"` or `mode: "shadow"` and `tradeSource: "REAL_ANALYSIS"` or `"REAL_SHADOW"` for filtering
- Schema migration v2→v3 initializes shadow fields for existing users

## Deployment

- Extension: Load unpacked from project root in `chrome://extensions/`
- Context API Worker: Deploy via `npx wrangler deploy` from `worker-context/`
- Secrets: Set via `wrangler secret put TWITTER154_API_KEY` and `wrangler secret put HELIUS_API_KEY`

## Common Mistakes to Avoid

- Do NOT import modules that assume DOM availability in the service worker
- Do NOT call twitter154 or Helius directly from the extension — always proxy through background.js or the Context API worker
- Do NOT forget to rebuild bundles after editing source files in `src/`
- Bridge scripts run in page context — they cannot access `chrome.*` APIs
- When editing `view-model.js`, always handle all FieldStatus variants (ok, pending, error, skipped)
- For authority fields (`mintAuthority`, `freezeAuthority`), distinguish `null` (revoked) from `undefined` (not fetched) — they have different display meanings

### Padre-Specific Pitfalls (SES Lockdown)

- **Do NOT rely on `window.fetch` or XHR interception on Padre** — SES lockdown (`lockdown-install.js`) runs after bridge scripts and replaces/restores these globals. The override appears to install successfully but is silently non-functional.
- **Do NOT assume wallet hooks will fire on Padre** — Padre's wallet adapter (likely `@solana/wallet-adapter`) caches `signTransaction` method references at initialization. Our hooks replace the property but the cached reference bypasses the hook. The hooks ARE installed (confirmed in logs) but never invoked.
- **Do NOT parse `fetch()` request bodies in response handlers** — `args[1].body` may be a consumed ReadableStream, a locked stream, or undefined (when `fetch(new Request(...))` is used). `parseRequestBody()` returns null in all these cases.
- **Padre's working detection vectors:** DOM scraping (MutationObserver + querySelectorAll), TradingView API (`findTV()`, `chart.createExecutionShape`), `PerformanceObserver` (Resource Timing API), and `window.postMessage` listeners. These are all SES-safe.
- **Always test interception changes on Padre specifically** — what works on Axiom (no SES) will silently fail on Padre. Verify with diagnostic logs that the interceptor actually fires, not just that it installs.
- **`SWAP_URL_PATTERNS` matches the Padre domain** — the shared regex contains `/trade/` which matches `trade.padre.gg` in the full URL. When using `SWAP_URL_PATTERNS` with `PerformanceObserver` (which provides full URLs), always parse `new URL(url).pathname` first and test only the pathname. The bridge's `PERFOBS_SWAP_PATH` regex is a tightened version for this purpose.
- **DOM element caching must prefer FIRST match** — Padre's DOM has duplicate labels (e.g., "Sold" appears in both the position panel and other sections). `deepScanPositionFields()` must skip already-cached connected elements (`if (_posCache[key] && _posCache[key].isConnected) continue`) to avoid overwriting good references with later, potentially non-updating duplicates.
- **Invalidate element cache after trade detection** — Padre uses React, which may re-render the position panel after a trade completes. Cached DOM element references can become disconnected or point to stale nodes. Always call `invalidatePosCache()` after emitting any `SHADOW_TRADE_DETECTED` to force re-discovery on the next poll.
- **2000-element scan limit is too low after TradingView renders** — TradingView's chart adds thousands of DOM elements (canvas wrappers, SVG, legends, axis labels). Position panel fields ("Invested", "Sold") are below the header bar in DOM order and get pushed past any low scan limit. The cache-first approach solves this: discover once via deep scan (8000 limit), then read cached refs on every poll.

## When Editing

- After changing any source in `src/`, run `npm run build` and verify the bundle diff is reasonable
- Test on both Axiom and Padre — they have different DOM structures and interception patterns
- Check the extension popup still loads correctly after manifest changes

## Subagent Usage

- Use subagents for large refactors or multi-file changes to keep main context clean
- Use `plan` mode before implementing features that touch core + ui + worker
- For investigating bugs in the enrichment pipeline, delegate to an explore agent first

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
