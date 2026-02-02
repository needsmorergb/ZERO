# ZERO -- Chrome Web Store Safety Note

## How ZERO Works

ZERO injects **locally bundled scripts** onto two specific trading platform websites (Axiom and Padre) to display a paper trading overlay. All scripts are included in the extension package -- no code is fetched from external servers at runtime.

## Technical Details

- **No remote code execution.** All JavaScript is bundled at build time using esbuild and shipped in the extension package.
- **No `eval()` or `new Function()`.** The extension does not dynamically generate or execute code.
- **No third-party script injection.** Bridge scripts intercept and read (but do not modify) network responses on the supported platforms to detect price updates and swap confirmations.
- **Content scripts run only on two domains:** `https://axiom.trade/*` and `https://trade.padre.gg/*`. No other websites are affected.
- **Minimal permissions.** The extension requests `storage`, `alarms`, and `activeTab` -- no access to browsing history, bookmarks, downloads, or other sensitive browser data.

## What the Overlay Does

- Displays a simulated trading HUD (Buy/Sell buttons, PnL tracker, session stats)
- Reads publicly available price data from on-page network responses
- Stores all data locally in `chrome.storage.local`
- Does not interact with wallets, sign transactions, or access funds
