/**
 * Token Context Resolver
 * Determines the active token mint and source site.
 * Platform is set once via init() — no hostname checks at resolve time.
 */

export const TokenContextResolver = {
    _platform: null, // 'axiom' | 'padre'
    _cache: {
        lastUrl: null,
        lastResult: { activeMint: null, activeSymbol: null, sourceSite: 'unknown' },
        lastDomScanAt: 0
    },

    init(platformName) {
        if (platformName === 'Axiom') this._platform = 'axiom';
        else if (platformName === 'Padre') this._platform = 'padre';
        else this._platform = 'unknown';
    },

    resolve() {
        const url = window.location.href;
        const now = Date.now();
        const urlChanged = url !== this._cache.lastUrl;
        const sourceSite = this._platform || 'unknown';
        let activeMint = null;
        let activeSymbol = null;

        // --- Platform-specific title parsing ---
        if (sourceSite === 'axiom') {
            const title = document.title || "";
            const words = title.replace(/[|$-]/g, ' ').trim().split(/\s+/);
            for (const w of words) {
                if (w.length >= 2 && w.length <= 10 && /^[A-Z0-9]+$/.test(w)) {
                    activeSymbol = w;
                    break;
                }
            }
        } else if (sourceSite === 'padre') {
            const title = document.title || "";
            const cleaned = title.replace(/\s*[↓↑]\s*\$[\d,.]+[KMB]?\s*$/i, '').trim();
            const m = cleaned.match(/([A-Z0-9]+)\s*\//i);
            if (m) activeSymbol = m[1].toUpperCase();
            if (!activeSymbol && cleaned) {
                const parts = cleaned.split('|')[0]?.trim();
                if (parts && parts.length <= 12) activeSymbol = parts.toUpperCase();
            }
        }

        // On Padre, URL contains pool/pair address, not token mint — skip URL extraction
        // and rely on DOM/link scanning (pump.fun links, data attributes, CA: text)
        if (sourceSite !== 'padre') {
            const mintMatch = url.match(/\/trade\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) ||
                url.match(/\/token\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) ||
                url.match(/\/terminal\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) ||
                url.match(/\/meme\/([a-zA-Z0-9]{32,44})/);

            if (mintMatch && mintMatch[1]) {
                activeMint = mintMatch[1];
            }

            if (!activeMint) {
                const urlParamMatch = url.match(/[?&](?:mint|token|address)=([1-9A-HJ-NP-Za-km-z]{32,44})/i);
                if (urlParamMatch) activeMint = urlParamMatch[1];
            }

            if (!activeMint) {
                const allMints = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
                if (allMints) activeMint = allMints.find(m => m.length >= 32 && m.length <= 44);
            }
        }

        // Padre needs DOM scanning for mint (URL has pool address, not token mint)
        // Use shorter throttle (500ms) on Padre vs 1500ms on other platforms
        const domScanThrottle = sourceSite === 'padre' ? 500 : 1500;
        const shouldScanDom = urlChanged || (!activeMint && now - this._cache.lastDomScanAt > domScanThrottle);
        if (!activeMint && shouldScanDom) {
            this._cache.lastDomScanAt = now;

            const attrSelectors = [
                '[data-mint]',
                '[data-token]',
                '[data-token-address]',
                '[data-address]',
                '[data-ca]'
            ];

            try {
                const attrNodes = document.querySelectorAll(attrSelectors.join(','));
                for (const node of attrNodes) {
                    for (const attr of ['data-mint', 'data-token', 'data-token-address', 'data-address', 'data-ca']) {
                        const val = node.getAttribute(attr);
                        if (val && /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(val)) {
                            const match = val.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
                            if (match) {
                                activeMint = match[0];
                                break;
                            }
                        }
                    }
                    if (activeMint) break;
                }
            } catch (e) { }

            if (!activeMint) {
                try {
                    const links = document.querySelectorAll('a[href*="solscan"], a[href*="solana.fm"], a[href*="birdeye"], a[href*="bullx"], a[href*="pump.fun"]');
                    for (const link of links) {
                        const match = link.href.match(/([a-zA-Z0-9]{32,44})/);
                        if (match && match[1] && !link.href.includes('/account/')) {
                            activeMint = match[1];
                            break;
                        }
                    }
                } catch (e) { }
            }

            if (!activeMint) {
                try {
                    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
                    let seen = 0;
                    while (walker.nextNode() && seen < 50) {
                        const text = walker.currentNode?.nodeValue || '';
                        if (!text.includes('CA:') && !text.includes('DA:')) {
                            seen += 1;
                            continue;
                        }
                        const mm = text.match(/(?:CA|DA):\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
                        if (mm) {
                            activeMint = mm[1];
                            break;
                        }
                        seen += 1;
                    }
                } catch (e) { }
            }
        }

        if (!activeMint && !urlChanged) {
            activeMint = this._cache.lastResult.activeMint;
        }
        if (!activeSymbol && !urlChanged) {
            activeSymbol = this._cache.lastResult.activeSymbol;
        }

        const result = { activeMint, activeSymbol, sourceSite };
        this._cache.lastUrl = url;
        this._cache.lastResult = result;
        return result;
    }
};
