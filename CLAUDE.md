# ZERO Browser Extension

A Chrome extension for Solana token trading with PnL tracking, discipline scoring, and market context analysis.

## Project Structure

```
src/
├── modules/
│   ├── core/           # Business logic
│   │   ├── analytics.js      # Session analytics, calculateDiscipline()
│   │   ├── trading.js        # Trade execution logic
│   │   ├── pnl-calculator.js # P&L calculations
│   │   └── market.js         # Market data handling
│   ├── ui/             # UI components
│   │   ├── pnl-hud.js        # Main PnL HUD display
│   │   ├── shadow-hud.js     # Shadow mode HUD with Market Context
│   │   ├── settings-panel.js # Settings UI
│   │   └── *-styles.js       # Corresponding style modules
│   ├── store.js        # State management
│   └── featureManager.js # Feature flags and tier gating
├── services/
│   ├── context/        # Context API client
│   │   ├── client.js         # Fetches from api.get-zero.xyz
│   │   └── view-model.js     # Transforms API response to view model
│   └── socialx/        # Twitter/X integration
│       └── observed-adapter.js # Client-side X handle detection
worker-context/         # Cloudflare Worker for Context API
```

## Key Patterns

### UI Updates
When adding new dynamic values to HUD components:
1. Add element to template with `data-k="fieldName"` attribute
2. Update the corresponding `update*()` function to query and set the value
3. Values come from `state.session.*` - check `store.js` for available fields

Example (discipline score fix):
```javascript
const disciplineEl = root.querySelector('[data-k="discipline"]');
if (disciplineEl) {
    disciplineEl.textContent = s.session.disciplineScore ?? 100;
}
```

### Feature Flags
Use `FeatureManager.resolveFlags(state, 'FEATURE_NAME')` to check visibility/gating:
```javascript
const flags = FeatureManager.resolveFlags(s, 'DISCIPLINE_SCORING');
element.style.display = (flags.visible && !flags.gated) ? '' : 'none';
```

### Context API
- Endpoint: `https://api.get-zero.xyz/context?chain=solana&ca=<mint>`
- Client caches responses for 6 hours with LRU eviction at 30 entries
- Field statuses: `ok`, `missing_identifier`, `not_supported`, `stale_cached`
- UI filters to only show fields with `status === 'ok'`

### Twitter/X Enrichment
- Enabled via `TWITTER154_ENABLED` flag in worker-context
- Provides: accountAgeDays, followerCount, caMentionCount, renameCount
- Rate limited with 10-minute cooldown on 429 responses

## Common Pitfalls

1. **Template vs Update mismatch**: If a value shows static in HUD, check that the `update*()` function actually reads from state and updates the DOM element
2. **Worktree setup**: `main` branch is in `sol-paper-ext-beta` worktree, feature branches here
3. **Field status filtering**: Market Context only shows enriched fields where `status === 'ok'`

## Git Workflow

This is a git worktree. Main branch is at `D:\apaul\Documents\sol-paper-ext-beta`.

To merge feature work to main:
```bash
# Push feature branch
git push origin feature/branch-name

# From main worktree
cd D:\apaul\Documents\sol-paper-ext-beta
git fetch origin
git merge origin/feature/branch-name
git push origin main
```
