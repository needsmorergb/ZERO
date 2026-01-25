export const TokenDetector = {
    getCurrentToken() {
        let symbol = 'SOL';
        let mint = 'So11111111111111111111111111111111111111112';

        try {
            // 1. Try URL for Mint (Most reliable on Padre/Axiom)
            const url = window.location.href;

            // Try URL for Mint (Regex Scanner)
            const mintMatch = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
            if (mintMatch) {
                // Usually the last long string is the mint
                const candidate = mintMatch[mintMatch.length - 1];
                if (candidate && candidate.length > 30) {
                    mint = candidate;
                }
            }

            // 2. Try Title for Symbol (e.g. "APEPE $2.47K | Terminal")
            const title = document.title;
            const titleParts = title.trim().split(/[\s|/]+/);

            // Check for specific "Ticker | Platform" format
            if (titleParts.length > 0) {
                let first = titleParts[0].toUpperCase();
                // Exclude generic platform names
                const generics = ['PADRE', 'TERMINAL', 'AXIOM', 'SOLANA', 'TRADE', 'DEX', 'CHART'];

                if (!generics.includes(first) && first.length < 15 && first.length > 1) {
                    symbol = first;
                }
            }

            // 3. Fallback: Search for Ticker in Header/MUI Elements
            if (symbol === 'SOL' || symbol === 'TERMINAL' || symbol.includes('SEARCH')) {
                // Look for standard Padre ticker spans
                const tickerSpans = document.querySelectorAll('span[class*="css-1oo1vsz"]');
                for (const s of tickerSpans) {
                    const txt = s.textContent.trim().toUpperCase();
                    // Filter out known generics and placeholders
                    const bad = ['PADRE', 'TERMINAL', 'AXIOM', 'SOLANA', 'TRADE', 'DEX', 'CHART', 'SEARCH BY NAME OR CA...'];
                    if (txt && !bad.includes(txt) && txt.length < 15 && txt.length > 1) {
                        symbol = txt;
                        break;
                    }
                }

                if (symbol === 'SOL' || symbol.includes('SEARCH')) {
                    // Look for SYMBOL/SOL pattern in all spans
                    const spans = document.querySelectorAll('span, div');
                    for (const s of spans) {
                        const t = s.textContent.trim();
                        if (t.includes('/') && t.includes('SOL') && t.length < 20) {
                            const potential = t.split('/')[0].trim().toUpperCase();
                            if (potential.length > 1 && potential.length < 10) {
                                symbol = potential;
                                break;
                            }
                        }
                    }
                }
            }

        } catch (e) {
            console.warn('[TokenDetector] Token scrape failed', e);
        }

        return { symbol, mint };
    }
};
