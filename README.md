# Solana Paper Trader Overlay

A Chrome extension that provides paper trading functionality for Solana spot trading on Axiom and Terminal (Padre) platforms.

## Features

- 📊 **Paper Trading Overlay**: Simulated trading without risking real funds
- 💰 **Real-time Price Tracking**: Monitors SOL/USD prices from multiple sources (Coinbase, Kraken)
- 🎯 **Multi-Platform Support**: Works with Axiom and Terminal (Padre)
- 🔒 **Safe**: Your real wallet is never touched by this extension

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `sol-paper-ext` directory

## Usage

1. Click the extension icon in your browser toolbar
2. Choose either "Launch Axiom" or "Launch Terminal" to open the trading platform
3. The extension will automatically activate on supported platforms
4. Look for the "Paper mode active" badge in the bottom-right corner

## Architecture

### Directory Structure

```
sol-paper-ext/
├── assets/              # Extension icons and logos
├── src/
│   ├── background.js    # Service worker for price fetching
│   ├── content.js       # Content script entry point
│   ├── content.bundle.js # Bundled content script
│   ├── page-bridge.js   # Page context bridge for API hooking
│   ├── inject/          # Injection utilities
│   │   ├── bridge.js    # Message bridge setup
│   │   └── ws_hook.js   # WebSocket hooking
│   ├── popup/           # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── terminals/       # Platform-specific adapters
│   │   ├── adapters.js
│   │   ├── axiom.js
│   │   └── padre.js
│   └── ui/              # UI components
│       └── overlay.js   # Badge overlay
└── manifest.json        # Extension manifest
```

### How It Works

1. **Background Service Worker** (`background.js`)
   - Fetches SOL/USD prices from Coinbase and Kraken APIs
   - Caches prices for 5 minutes
   - Provides price data to content scripts on demand

2. **Content Script** (`content.js`)
   - Detects which trading platform is active (Axiom or Padre)
   - Injects the page bridge script
   - Displays the "Paper mode active" badge

3. **Page Bridge** (`page-bridge.js`)
   - Runs in the page context (not isolated extension context)
   - Hooks into fetch, XMLHttpRequest, and WebSocket APIs
   - Intercepts price updates and relays them to the content script

4. **Platform Adapters** (`terminals/`)
   - Platform-specific logic for extracting token information
   - Currently supports Axiom with Padre support planned

## Configuration

### Customizing URLs

Edit `src/popup/popup.js` to change the default platform URLs:

```javascript
const CONFIG = {
  AXIOM_URL: "https://axiom.trade/@yourhandle",
  TERMINAL_URL: "https://trade.padre.gg/rk/yourhandle",
  DISCORD_URL: "https://discord.gg/yourinvite",
};
```

## Development

### Building

The extension uses ES6 modules. The `content.bundle.js` file is a bundled version of the content script and its dependencies.

To rebuild the bundle, you'll need a bundler like Rollup or esbuild. Example with esbuild:

```bash
npm install -g esbuild
esbuild src/content.js --bundle --outfile=src/content.bundle.js --format=iife
```

### Adding a New Platform

1. Create a new adapter file in `src/terminals/`
2. Implement the adapter interface:
   ```javascript
   export const myPlatformAdapter = {
     name: "Platform Name",
     getCurrentMint() { /* ... */ },
     findMainBuyButton() { /* ... */ },
     findQuickBuyAmountButtons() { /* ... */ }
   };
   ```
3. Register it in `src/terminals/adapters.js`
4. Add the platform URL to `manifest.json` permissions

## Security & Privacy

- ✅ All trading is simulated - no real transactions are made
- ✅ Your wallet private keys are never accessed
- ✅ Only monitors public price data from exchanges
- ✅ No data is sent to external servers (except public price APIs)

## Permissions

The extension requires the following permissions:

- `storage`: To cache price data and settings
- `alarms`: To schedule periodic price updates
- `tabs`: To open trading platforms from the popup
- `host_permissions`: To inject scripts on Axiom and Terminal platforms

## Support

For questions or issues, join our Discord community (link in the extension popup).

## Security & Distribution

### 1. Protection (Minification & Obfuscation)
To protect your code from casual inspection and theft, you should minify and obfuscate it before sharing. This makes the code difficult to reverse-engineer.

**Prerequisites:**
- [Node.js](https://nodejs.org/) installed.

**Steps:**
1. Open a terminal in the project folder.
2. Run `npm install` (only needed once).
3. Run the secure build command:
   ```bash
   npm run build:secure
   ```
   This will regenerate `src/content.bundle.js` locally using minification.

### 2. Packing the Extension
For a cleaner distribution that prevents users from easily editing files:

1. Go to `chrome://extensions` in Chrome.
2. Click **"Pack extension"** at the top.
3. Select the `sol-paper-ext` root directory.
4. Click **"Pack extension"**.
   - Chrome will create two files: `sol-paper-ext.crx` (The extension file) and `sol-paper-ext.pem` (Your private key).
5. **Share the `.crx` file** with users. They can drag-and-drop it into their browser to install.
   - *Note: Keep the `.pem` file safe! You need it to create updates.*

### 3. Clean Distribution
If sending the source folder manually (unpacked), you can delete the `node_modules` folder and `.git` folder to reduce size and "noise". The `manifest.json`, `assets/`, and `src/` folders are all that is strictly required.

## Disclaimer

**IMPORTANT**: This extension is for paper trading (simulation) only. It does not execute real trades. Always verify any trading decisions independently. The developers are not responsible for any financial losses.
