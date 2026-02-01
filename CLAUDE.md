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
