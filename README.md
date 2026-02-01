# ZERØ — Solana Paper Trading

A Chrome extension that provides zero-risk paper trading, real trade observation, and market context analysis for Solana on Axiom and Terminal (Padre) platforms.

## Features

- **Paper Trading Overlay**: Simulated trading without risking real funds
- **Shadow Mode**: Observe and analyze real trades with behavioral coaching
- **Market Context**: Trust scoring with X account enrichment, community detection, and developer history
- **Real-time Price Tracking**: Monitors SOL/USD prices from multiple sources (Coinbase, Kraken)
- **Multi-Platform Support**: Works with Axiom and Terminal (Padre)
- **Safe**: Your real wallet is never touched by this extension

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the project directory

## Usage

1. Click the ZERØ extension icon in your browser toolbar
2. Choose either "Launch Axiom" or "Launch Terminal" to open the trading platform
3. The extension will automatically activate on supported platforms
4. Use the HUD controls to switch between Paper, Analysis, and Shadow modes

## Architecture

### Directory Structure

```
├── assets/                  # Extension icons and mode SVGs
├── src/
│   ├── background.js        # Service worker for price fetching and proxy
│   ├── content.bundle.axiom.js  # Bundled content script (Axiom)
│   ├── content.bundle.padre.js  # Bundled content script (Padre)
│   ├── bridge.bundle.axiom.js   # Page-context bridge (Axiom)
│   ├── bridge.bundle.padre.js   # Page-context bridge (Padre)
│   ├── modules/
│   │   ├── core/
│   │   │   ├── analytics.js         # Trade analytics, discipline scoring, behavioral detection
│   │   │   ├── market.js            # Market state (price, mcap, mint tracking)
│   │   │   ├── narrative-trust.js   # Trust scoring orchestrator
│   │   │   ├── order-execution.js   # Buy/sell execution with WAC PnL
│   │   │   ├── pnl-calculator.js    # PnL computation
│   │   │   ├── token-market-data.js # Token data aggregation
│   │   │   └── trade-notes.js       # Session trade notes
│   │   ├── ui/
│   │   │   ├── shadow-hud.js        # Shadow Mode HUD (Market Context, Strategy, Notes)
│   │   │   ├── shadow-hud-styles.js # Shadow HUD styles
│   │   │   ├── hud.js               # Main trading HUD
│   │   │   ├── settings-panel.js    # Settings panel
│   │   │   └── ...                  # Icons, styles, overlay, professor
│   │   ├── store.js             # Chrome storage persistence
│   │   ├── featureManager.js    # Feature flags and tier gating
│   │   └── mode-manager.js      # Paper / Analysis / Shadow mode switching
│   ├── services/
│   │   ├── context/
│   │   │   ├── client.js        # Context API client (api.get-zero.xyz)
│   │   │   ├── view-model.js    # Status-aware VM builder for UI
│   │   │   └── statusText.js    # FieldStatus → display string mapping
│   │   ├── socialx/
│   │   │   ├── observed-adapter.js  # X handle parsing from page
│   │   │   └── types.js             # FieldStatus enum
│   │   └── providers/           # DexScreener, Helius adapters
│   ├── platforms/               # Platform boot and bridge scripts
│   │   ├── axiom/
│   │   └── padre/
│   └── popup/                   # Extension popup UI
│       ├── popup.html
│       ├── popup.css
│       └── popup.js
├── worker-context/              # Cloudflare Worker: Context API
│   ├── src/index.js             # X enrichment (twitter154), KV rename tracking
│   └── wrangler.toml
├── worker/                      # Cloudflare Worker: Diagnostics
└── manifest.json
```

### How It Works

1. **Background Service Worker** (`background.js`)
   - Fetches SOL/USD prices from Coinbase and Kraken APIs
   - Proxies requests to external APIs (DexScreener, Context API)
   - Caches prices and provides data to content scripts on demand

2. **Content Scripts** (`content.bundle.axiom.js`, `content.bundle.padre.js`)
   - Detect which trading platform is active
   - Mount the ZERØ HUD overlay
   - Track market state (price, mcap, mint) in real time

3. **Market Context** (`narrative-trust.js` → `shadow-hud.js`)
   - Fetches context from the ZERØ Context API for the current token
   - Resolves X account via page observation
   - Builds a trust score from weighted signals (X presence, account age, communities, developer history)
   - Caps score to 70 when missing account age or CA proof

4. **Context API Worker** (`worker-context/`)
   - Enriches tokens with twitter154 data (account age, followers, CA mentions)
   - Tracks X handle renames via Cloudflare KV
   - Detects X Communities from linked URLs
   - Returns structured `ContextResponseV1` with status-aware fields

5. **Platform Bridges** (`bridge.bundle.*.js`)
   - Run in the page context (not isolated extension context)
   - Hook into fetch, XMLHttpRequest, and WebSocket APIs
   - Intercept price updates and relay them to the content script

## Configuration

### Customizing URLs

Edit `src/popup/popup.js` to change the default platform URLs:

```javascript
const CONFIG = {
  AXIOM_URL: "https://axiom.trade/@yourhandle",
  TERMINAL_URL: "https://trade.padre.gg/rk/yourhandle",
  WEBSITE_URL: "https://get-zero.xyz",
  X_URL: "https://x.com/get_zero_xyz",
};
```

### Context API Worker

The Context API worker requires:
- A RapidAPI key for twitter154 (set via `wrangler secret put TWITTER154_API_KEY`)
- A Cloudflare KV namespace for handle rename tracking

See `worker-context/wrangler.toml` for configuration.

## Development

### Building

ZERØ uses esbuild to bundle content scripts per platform:

```bash
npm run build
```

This builds both Axiom and Padre bundles. To build individually:

```bash
npm run build:axiom
npm run build:padre
```

### Adding a New Platform

1. Create a new directory in `src/platforms/`
2. Implement boot and bridge scripts following the Axiom/Padre pattern
3. Add content script entries to `manifest.json`
4. Add the platform URL to `host_permissions`

## Security and Privacy

- All paper trading is simulated — no real transactions are made
- Your wallet private keys are never accessed
- Only monitors public price data from exchanges
- Market context data is fetched from the ZERØ API (api.get-zero.xyz)
- X enrichment data is processed server-side and cached

## Permissions

The extension requires the following permissions:

- `storage`: To persist settings, positions, and trade history
- `alarms`: To schedule periodic price updates
- `tabs`: To open trading platforms from the popup
- `host_permissions`: To inject scripts on Axiom and Terminal, and fetch from price/context APIs

## Support

For questions or issues, visit [get-zero.xyz](https://get-zero.xyz) or follow [@get_zero_xyz](https://x.com/get_zero_xyz) on X.

## License

This is a personal/educational project. Use at your own risk.

## Disclaimer

**IMPORTANT**: ZERØ is for paper trading (simulation) and trade observation only. It does not execute real trades or interact with your wallet. Always verify any trading decisions independently. The developers are not responsible for any financial losses.
