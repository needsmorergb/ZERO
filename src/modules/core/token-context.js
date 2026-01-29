/**
 * Token Context Resolver
 * Determines the active token mint and source site.
 */

export const TokenContextResolver = {
    // Resolve the current context
    resolve() {
        const url = window.location.href;
        const hostname = window.location.hostname;
        let sourceSite = 'unknown';
        let activeMint = null;
        let activeSymbol = null;

        if (hostname.includes('axiom.trade')) {
            sourceSite = 'axiom';
            const title = document.title || "";
            const words = title.replace(/[|$-]/g, ' ').trim().split(/\s+/);
            for (const w of words) {
                if (w.length >= 2 && w.length <= 10 && /^[A-Z0-9]+$/.test(w)) {
                    activeSymbol = w;
                    break;
                }
            }
        } else if (hostname.includes('padre.gg')) {
            sourceSite = 'padre';
            const title = document.title || "";
            const m = title.match(/([A-Z0-9]+)\s*\//i);
            if (m) activeSymbol = m[1].toUpperCase();
        }

        // 1. "CA:" Link/Label Scanner
        try {
            const labels = Array.from(document.querySelectorAll('div, span, p, a, button'))
                .filter(el => el.textContent.includes('CA:') || el.textContent.includes('DA:'));

            for (const label of labels) {
                const neighborhood = [label, label.parentElement, ...(label.parentElement ? Array.from(label.parentElement.querySelectorAll('a')) : [])];
                for (const node of neighborhood) {
                    if (!node) continue;
                    if (node.tagName === 'A' && node.href) {
                        const m = node.href.match(/([a-zA-Z0-9]{32,44})/);
                        if (m && m[1] && !node.href.includes('/account/')) {
                            activeMint = m[1];
                            return { activeMint, activeSymbol, sourceSite };
                        }
                    }
                    if (node.title && node.title.length >= 32 && node.title.length <= 44) {
                        activeMint = node.title;
                        return { activeMint, activeSymbol, sourceSite };
                    }
                }
            }
        } catch (e) { }

        // 2. Explorer Links
        try {
            const links = document.querySelectorAll('a');
            for (const link of links) {
                if (/solscan|solana\.fm|birdeye|bullx/.test(link.href)) {
                    const match = link.href.match(/([a-zA-Z0-9]{32,44})/);
                    if (match && match[1] && !link.href.includes('/account/')) {
                        activeMint = match[1];
                        return { activeMint, activeSymbol, sourceSite };
                    }
                }
            }
        } catch (e) { }

        // 3. URL Logic
        const mintMatch = url.match(/\/trade\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) ||
            url.match(/\/token\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) ||
            url.match(/\/meme\/([a-zA-Z0-9]{32,44})/);

        if (mintMatch && mintMatch[1]) {
            activeMint = mintMatch[1];
        } else {
            const allMints = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
            if (allMints) activeMint = allMints.find(m => m.length >= 32 && m.length <= 44);
        }

        return { activeMint, activeSymbol, sourceSite };
    }
};
