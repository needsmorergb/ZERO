# ZERO Data Disclosure

## Summary

ZERO collects **no data by default**. All paper trading data is stored locally in your browser via `chrome.storage.local`.

## Optional Diagnostics (Opt-In Only)

If you manually enable "Share anonymous diagnostics" in the extension settings, the following data is collected:

### What Is Collected

| Data | Example | Purpose |
|------|---------|---------|
| Event type | `SESSION_STARTED`, `UI_LOCKED_FEATURE_CLICKED` | Understand usage patterns |
| Timestamp | `1706800000000` (Unix ms) | Event ordering |
| Platform | `AXIOM` or `PADRE` | Platform-specific debugging |
| Extension version | `2.0.0` | Version-specific bug tracking |
| Anonymous client ID | UUID (no link to identity) | Deduplicate events |
| Feature ID (if clicked) | `DISCIPLINE_SCORING` | Prioritize feature development |

### What Is NOT Collected

- Wallet addresses or public keys
- Private keys, seed phrases, or credentials
- Real trade amounts, balances, or transaction signatures
- Token mint addresses or contract addresses
- Raw DOM content, page HTML, or screenshots
- Keystrokes, clipboard data, or form inputs
- Browsing history or URLs beyond the two supported platforms
- User-entered notes, strategy text, or trade thesis

### Why

- Improve extension stability and fix bugs faster
- Understand which features are used to prioritize development
- Detect error patterns across extension versions

### Retention

- Diagnostic data is retained for **90 days** on the server, then automatically purged.
- Local event data is capped at 20,000 events (oldest events are discarded).

### How to Disable

Open the extension overlay -> Settings (gear icon) -> Toggle "Enable diagnostics" to OFF. Uploads stop immediately. You can also:
- **Delete queued uploads** -- clears any pending data before it is sent
- **Delete local ZERO data** -- wipes all diagnostic event history from your browser

### Data Deletion Request

Email **privacy@get-zero.xyz** with your anonymous client ID (visible in the "View sample payload" dialog) to request server-side deletion. We will process requests within 30 days.
