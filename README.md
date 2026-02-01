# ZERØ — Solana Paper Trading

A Chrome extension that provides zero-risk paper trading, real trade observation, and market context analysis for Solana on Axiom and Terminal (Padre) platforms.

## Features

- **Paper Trading Overlay**: Simulated trading without risking real funds
- **Shadow Mode**: Observe and analyze real trades with behavioral coaching
- **Market Context**: Trust scoring with X account enrichment, community detection, and developer history
- **Real-time Price Tracking**: Monitors SOL/USD prices from multiple sources (Coinbase, Kraken)
- **Multi-Platform Support**: Works with Axiom and Terminal (Padre)
- **Safe**: Your real wallet is never touched by this extension

## Usage

1. Click the ZERØ extension icon in your browser toolbar
2. Choose either "Launch Axiom" or "Launch Terminal" to open the trading platform
3. The extension will automatically activate on supported platforms
4. Use the HUD controls to switch between Paper, Analysis, and Shadow modes

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

All rights reserved. This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, in whole or in part, is strictly prohibited without prior written permission from the author.

## Disclaimer

**IMPORTANT**: ZERØ is for paper trading (simulation) and trade observation only. It does not execute real trades or interact with your wallet. Always verify any trading decisions independently. The developers are not responsible for any financial losses.
