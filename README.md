# ZERØ - Solana Paper Trading

A Chrome extension that provides **ZERØ** (zero-risk) paper trading functionality for Solana spot trading on Axiom and Terminal (Padre) platforms.

## Features

- 📊 **ZERØ Trading Overlay**: Simulated trading without risking real funds
- 💰 **Real-time Price Tracking**: Monitors SOL/USD prices from multiple sources
- 🎯 **Multi-Platform Support**: Works with Axiom and Terminal (Padre)
- 🔒 **Safe**: Your real wallet is never touched by this extension

## Recent Changes

### [v0.9.0]
- 🎯 **ZERØ Branding Sync**: Unified branding across all HUDs and UI elements.
- 🧙‍♂️ **Professor Walkthrough Fix**: Walkthrough now only triggers once on first launch.
- 💎 **Visual Polish**: Updated icons and UI cleanup for a cleaner look.

## Installation

### Method 1: Packed Extension (.crx) - Recommended for Users
1. Download the `zero-dist.crx` file.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right.
4. Drag and drop the `.crx` file into the window to install.

### Method 2: Manual Installation (Unpacked)
1. Download the extension folder.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right.
4. Click "Load unpacked".
5. Select the `sol-paper-ext` directory.

## Usage

1. Click the ZERØ icon in your browser toolbar
2. Choose either "Launch Axiom" or "Launch Terminal" to open the trading platform
3. The extension will automatically activate on supported platforms
4. Look for the "ZERØ mode active" badge/HUDs on the screen

## Security & Privacy

- ✅ All trading is simulated - no real transactions are made
- ✅ Your wallet private keys are never accessed
- ✅ Only monitors public price data from exchanges
- ✅ No data is sent to external servers (except public price APIs)

## Permissions

The extension requires the following permissions to function:

- `storage`: To save your paper trading portfolio and history
- `alarms`: To update prices in the background
- `tabs`: To open trading platforms from the popup
- `host_permissions`: To run the overlay on Axiom and Terminal platforms

## Disclaimer

**IMPORTANT**: This extension is for paper trading (simulation) only. It does not execute real trades. Always verify any trading decisions independently. The developers are not responsible for any financial losses.
