# ZERO Privacy Policy

**Effective date:** [INSERT DATE]
**Extension name:** ZERO - Solana Paper Trading
**Publisher:** [INSERT PUBLISHER NAME]
**Contact:** privacy@get-zero.xyz

## Overview

ZERO is a Chrome extension that overlays a paper (simulated) trading interface on supported Solana trading platforms. It does **not** execute real trades, access wallets, or manage funds.

## Data Stored Locally

All trading session data (simulated trades, PnL calculations, session history, settings) is stored in `chrome.storage.local` on your device. This data never leaves your browser unless you explicitly enable optional diagnostics (see below).

## Optional Diagnostics

ZERO includes an **opt-in** diagnostics system that is **off by default**. If you enable it:

- **What is collected:** Anonymous event types (e.g., "session started", "feature clicked"), timestamps, platform identifier (Axiom/Padre), and the extension version. Events contain only scalar metadata -- no raw text, DOM content, or personally identifiable information.
- **What is NOT collected:** Wallet addresses, private keys, real trade data, real balances, page content, keystrokes, browsing history, or any data from sites other than Axiom and Padre.
- **Where it is sent:** A first-party Cloudflare Worker endpoint (`zero-diagnostics.zerodata1.workers.dev`). Data is not sold, shared with third parties, or used for advertising.
- **Retention:** Diagnostic data is retained for up to 90 days, then automatically deleted.
- **Control:** You can disable diagnostics at any time in the extension settings. You can also delete all locally stored diagnostic data and clear the upload queue from the settings panel.

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Persist settings and simulated trade data locally |
| `alarms` | Schedule periodic background tasks (price refresh, license check) |
| `activeTab` | Navigate the active tab when you click platform links in the popup |

The extension injects content scripts **only** on `https://axiom.trade/*` and `https://trade.padre.gg/*` to display the paper trading overlay. No scripts are injected on other sites.

## Network Requests

The background service worker fetches public price data from Coinbase, Kraken, and DexScreener APIs. It also contacts `api.get-zero.xyz` for license verification. All requests use HTTPS. No authentication tokens or cookies from the user's browser sessions are transmitted.

## Remote Code

ZERO does **not** load or execute remote code. All scripts are bundled locally. No `eval()`, `new Function()`, or dynamic script injection from external sources is used.

## Children's Privacy

ZERO is not directed at children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this policy. The effective date at the top will reflect the latest revision.

## Contact

For questions or data deletion requests, email: **privacy@get-zero.xyz**
