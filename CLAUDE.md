# CLAUDE.md — ZERO Project Rules

## Project Identity

ZERO is a Chrome extension for zero-risk paper trading on Solana (Axiom + Padre platforms). It provides paper trading overlays, shadow mode for observing real trades, and market context with trust scoring powered by X/Twitter enrichment.

## Architecture

- **Content scripts** are per-platform bundles built with esbuild (`content.bundle.axiom.js`, `content.bundle.padre.js`)
- **Bridge scripts** run in page context (not isolated) to intercept fetch/XHR/WebSocket
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

## Shadow Mode PnL Tracking

Shadow Mode tracks real buys/sells with full PnL, completely separate from Paper Mode. Both modes share the same features (stats, insights, trades, Share X) but operate on independent data.

### State Separation

Parallel shadow state objects live alongside paper state in `store.js`:
- `shadowSession` / `session` — active session (balance, trades, realized PnL)
- `shadowTrades` / `trades` — trade fill records
- `shadowPositions` / `positions` — open positions with WAC cost basis
- `shadowBehavior` / `behavior` — behavioral analytics state
- `shadowEventLog` / `eventLog` — session event timeline
- `shadowSessionHistory` / `sessionHistory` — archived sessions (shadow is uncapped)

### Accessor Pattern

All UI and analytics code uses mode-aware accessors instead of reading state directly:
- `Store.isShadowMode()` — checks `settings.tradingMode === 'shadow'`
- `Store.getActiveSession()` — returns shadow or paper session
- `Store.getActivePositions()` / `getActiveTrades()` / `getActiveBehavior()` / `getActiveEventLog()` / `getActiveSessionHistory()`

Analytics uses an internal `_resolve(state)` helper that returns `{ session, trades, positions, behavior, eventLog }` routed by mode.

### Shadow Trade Ingestion (`src/modules/core/shadow-trade-ingestion.js`)

Listens for `SHADOW_TRADE_DETECTED` messages from bridge scripts and records real trades into shadow state using identical WAC PnL math as `OrderExecution`:
- BUY: `buyUsd = solAmount * solUsd`, `qtyDelta = buyUsd / priceUsd`, update WAC cost basis
- SELL: `costRemovedUsd = qtyDelta * avgCostUsdPerToken`, `realizedPnl = proceedsUsd - costRemovedUsd`
- Deduplicates by transaction signature
- Auto-detects wallet SOL balance on first BUY via `GET_WALLET_BALANCE` → Helius RPC

### Swap Detection (`bridge-utils.js`)

Bridge scripts intercept fetch/XHR responses matching `SWAP_URL_PATTERNS` (swap, execute, submit, send-tx, etc.) and extract:
- Transaction signature (proof of on-chain execution)
- Input/output mints → determine BUY (SOL in) vs SELL (SOL out)
- SOL amount (auto-detects lamports vs SOL)
- Token amount and price

Sends `SHADOW_TRADE_DETECTED` via `window.postMessage` for the content script to process.

### Key Rules
- Shadow and Paper PnL use the exact same WAC math — never diverge these
- Start SOL input is disabled/grayed in Shadow Mode (balance is auto-detected)
- Shadow session history is uncapped (real traders have fewer sessions)
- Always use accessors (`Store.getActiveSession()` etc.) — never read `state.session` directly in UI/analytics code
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
