# Privacy Policy

**ZERO - Solana Paper Trading**
Last updated: February 1, 2026

## Overview

ZERO is a Chrome extension that provides a paper trading overlay for Solana tokens on the Axiom and Terminal (Padre) trading platforms. This extension simulates trades for educational purposes only. Your real wallet is never accessed, modified, or interacted with by this extension.

## Data We Collect

### Data Stored Locally (Never Leaves Your Device)

The following data is stored in your browser's local extension storage (`chrome.storage.local`) and is never transmitted to any server:

- **Paper trade history** — simulated buy/sell records, prices, and profit/loss calculations
- **Extension settings** — your display preferences, mode selection, and feature configuration
- **Session statistics** — win rate, discipline score, and other performance metrics

You can clear all locally stored data at any time through the extension's settings panel.

### Data Transmitted to External Services

**Price feeds (automatic, no personal data sent):**
- [Coinbase API](https://api.coinbase.com) and [Kraken API](https://api.kraken.com) — SOL/USD spot price
- [DexScreener API](https://api.dexscreener.com) — token market data and trading pairs
- [CoinGecko API](https://api.coingecko.com) — token metadata
- [Jupiter API](https://api.jup.ag) — token routing and swap quotes

These are public, unauthenticated API calls containing only token identifiers (e.g., contract addresses). No personal data is included.

**Token enrichment (automatic, no personal data sent):**
- Our context API (`api.get-zero.xyz`) enriches token data with publicly available information from X/Twitter and on-chain data via Helius RPC. Only token contract addresses and public X handles are sent. No user data is included in these requests.

**License verification (only if you activate a paid tier):**
- If you enter a license key for the Elite tier, the key is validated against our membership API (`api.get-zero.xyz/verify-membership`) via Whop. Only the license key is transmitted. No other personal data is sent.

**Diagnostics (opt-in only, disabled by default):**
- If you explicitly enable "Share Usage Stats" in settings, anonymized usage data is periodically sent to our diagnostics endpoint. This includes:
  - A randomly generated anonymous client ID (not linked to your identity)
  - Extension version
  - Anonymized trade event counts and session statistics
- Diagnostics are **disabled by default** on fresh installs. You must actively opt in.
- You can disable diagnostics at any time in the extension's settings panel.

## Data We Do NOT Collect

- Wallet addresses, private keys, or seed phrases
- Browsing history or activity outside of Axiom and Terminal
- Personal information (name, email, IP address)
- Passwords or authentication tokens
- Clipboard contents
- Screenshots or screen recordings
- Keystrokes

## Permissions Explained

| Permission | Why We Need It |
|---|---|
| `storage` | Save your paper trades, settings, and session data locally |
| `alarms` | Periodically refresh SOL/USD price and revalidate licenses |
| `tabs` | Navigate to Axiom or Terminal when you click "Launch" in the popup |
| Host permissions (axiom.trade, trade.padre.gg) | Inject the paper trading overlay on supported platforms |
| Host permissions (price/data APIs) | Fetch real-time token prices and market data |

## Third-Party Services

This extension communicates with the following third-party services solely for the purposes described above:
- Coinbase, Kraken, CoinGecko, DexScreener, Jupiter (market data)
- Helius (on-chain token data, via our context API)
- Whop (license verification, only if you activate Elite tier)

We do not sell, share, or transfer your data to any third parties for advertising, analytics, or any other purpose.

## Data Retention

- All local data persists until you uninstall the extension or clear it via settings.
- Diagnostic data (if opted in) is retained on our servers for up to 90 days and then automatically deleted.
- License validation data is not stored beyond the verification response.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected by updating the "Last updated" date above.

## Contact

If you have questions about this privacy policy, contact us at:
- X/Twitter: [@getzerotrading](https://x.com/getzerotrading)
- Website: [get-zero.xyz](https://get-zero.xyz)
