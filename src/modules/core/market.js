export const Market = {
    price: 0,
    marketCap: 0,
    lastPriceTs: 0,
    priceIsFresh: false, // Tracks if price was updated recently (< 2s ago)
    context: null, // { vol24h, priceChange24h, liquidity, fdv }
    currentMint: null,
    lastContextFetch: 0,
    listeners: [],

    init() {
        this.startPolling();

        // Mark prices as stale after 2 seconds
        setInterval(() => {
            if (Date.now() - this.lastPriceTs > 2000) {
                this.priceIsFresh = false;
            }
        }, 1000);

        window.addEventListener("message", (event) => {
            if (event.source !== window || !event.data?.__paper) return;
            if (event.data.type === "PRICE_TICK") {
                this.updatePrice(event.data.price);
            }
        });
    },

    subscribe(callback) {
        this.listeners.push(callback);
    },

    startPolling() {
        setInterval(() => {
            const isTradePage = window.location.pathname.includes('/trade/')
                || window.location.pathname.includes('/token/')
                || window.location.pathname.includes('/meme/'); // Fix for Axiom Meme pages
            if (!isTradePage) return;

            // 1. Poll for Mint changes (from URL)
            this.pollMint();

            // 2. Poll for DOM price updates
            this.pollDOM();
        }, 250);
    },

    pollMint() {
        const url = window.location.href;

        // 1. Precise match for trade/token routes (common on Axiom/Padre)
        let mintMatch = url.match(/\/trade\/(?:solana\/)?([a-zA-Z0-9]{32,44})/) ||
            url.match(/\/token\/(?:solana\/)?([a-zA-Z0-9]{32,44})/);

        // 2. Fallback: Any long base58 string in the URL (TokenDetector style)
        if (!mintMatch) {
            const allMints = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
            if (allMints) {
                const candidate = allMints[allMints.length - 1];
                if (candidate && candidate.length > 30) {
                    mintMatch = [null, candidate];
                }
            }
        }

        const mint = mintMatch ? mintMatch[1] : null;

        if (mint && mint !== this.currentMint) {
            console.log(`[Market] New token detected: ${mint}`);
            this.currentMint = mint;
            this.context = null; // Clear old context
            this.lastContextFetch = 0;
            this.fetchMarketContext(mint);

            // Trigger UI refresh immediately
            this.notify();
        } else if (mint && (!this.context || Date.now() - this.lastContextFetch > 60000)) {
            // Periodic refresh every minute
            this.fetchMarketContext(mint);
        }
    },

    pollDOM() {
        // PADRE SPECIFIC LOOP
        if (window.location.hostname.includes('padre.gg')) {
            const candidates = Array.from(document.querySelectorAll('h2'))
                .filter(el => {
                    const txt = el.textContent || '';
                    return txt.includes('$') && /\d/.test(txt) && !txt.includes('SOL') && !txt.includes('%') && !txt.includes('+') && !txt.includes('-') && txt.length < 30;
                });

            this.processCandidates(candidates);
            return;
        }

        // AXIOM SPECIFIC LOOP (Complex but working)
        if (window.location.hostname.includes('axiom.trade')) {
            // 1. Find the main header bar (stats container)
            // It consistently has max-h-[64px]
            const headers = document.querySelectorAll('div.flex.max-h-\\[64px\\]');

            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                // 2. Iterate through children to find the one with "Price" label
                // This avoids hardcoding "nth-child(3)" which breaks on Meme pages
                const children = Array.from(header.children);
                // Log only if verbose debugging needed, but for now let's be targeted

                const priceContainer = children.find(child =>
                    child.textContent.includes('Price') &&
                    Array.from(child.querySelectorAll('span, div')).some(el => el.textContent.trim() === 'Price')
                );

                if (priceContainer) {
                    // console.log(`[Market] Found Price Container in Header ${i}`);

                    const label = Array.from(priceContainer.querySelectorAll('span, div')).find(el => el.textContent.trim() === 'Price');

                    // Strategy A: Find specific value keying off the label
                    if (label) {
                        const allSpans = Array.from(priceContainer.querySelectorAll('span'));
                        // CRITICAL FIX: Only look for spans AFTER the label
                        // This prevents picking up "Viewers" count which appears BEFORE "Price" in Header 0
                        const labelIndex = allSpans.indexOf(label);
                        const candidateSpans = allSpans.slice(labelIndex + 1);

                        const valueSpan = candidateSpans.find(s =>
                            // Must contain digits
                            /\d/.test(s.textContent) &&
                            // Must NOT be just "%" or "+" or "-"
                            !s.textContent.includes('%') &&
                            // Exclude Timeframes (5d, 1h, 15m, 4H) and Time dates (Jan 24, 12:00)
                            !/^\d+[dhm]$/i.test(s.textContent.trim()) &&
                            !s.textContent.includes(':') &&
                            // Avoids "Liquidity" values if container is wrong
                            (s.textContent.includes('$') || /^[0-9.]+/.test(s.textContent))
                        );

                        if (valueSpan) {
                            // console.log(`[Market] Strategy A Candidate: "${valueSpan.textContent}"`);

                            // CORRECT SUB-TAG PARSING
                            // TextContent strips <sub> tags (e.g. $0.0<sub>4</sub>2 -> $0.042)
                            // We must detect and expand the subscript manually.

                            let raw = valueSpan.textContent;

                            // If it contains a native subscript char (handled by parsePriceStr)
                            if (/[₀-₉]/.test(raw)) {
                                this.processCandidates([valueSpan], true);
                                return;
                            }

                            // If it uses HTML <sub> tags (common on pump/axiom)
                            // Since we don't have easy access to innerHTML here easily in this loop structure without query
                            // Let's assume if the price is weirdly high for a meme coin compared to expectations
                            // OR check if innerHTML has "sub".
                            // The `valueSpan` is a DOM element, so we CAN check innerHTML.

                            if (valueSpan.innerHTML && valueSpan.innerHTML.includes('<sub')) {
                                const subMatch = valueSpan.innerHTML.match(/<sub[^>]*>(\d+)<\/sub>/i);
                                if (subMatch) {
                                    const zeros = parseInt(subMatch[1]);
                                    // Reconstruct string: "0.0" + zeros + "digits"
                                    // Typically: $0.0[sub]4[/sub]234 -> $0.00000234

                                    // Remove non-numeric/dot prefix ($0.0) from the START of textContent
                                    // But textContent is "0.04234". 
                                    // Strategy: Use the known pattern for Axiom: $0.0{zeros}{digits}

                                    const parts = valueSpan.innerText.split('\n'); // innerText might break lines?
                                    // Safer: Regex on innerHTML?

                                    // Let's rely on the fact that if we see a <sub>, it usually means ZEROS count.
                                    // And the visible text starts with $.0.0

                                    const digits = valueSpan.textContent.replace(/[^\d]/g, ''); // 004234...
                                    // This is messy.
                                    // A cleaner way: "0.0" + "0".repeat(zeros) + rest

                                    // Get the text node AFTER the sub tag?
                                    // Let's try a heuristic: if we see <sub>, expand it.

                                    // Simple parse:
                                    // Split by <sub...
                                    const htmlParts = valueSpan.innerHTML.split(/<sub[^>]*>/i);
                                    if (htmlParts.length > 1) {
                                        const prefix = htmlParts[0].replace(/<[^>]+>/g, '').trim(); // "$0.0"
                                        const suffix = htmlParts[1].replace(/<\/sub>/i, '').trim(); // "4234" (if sub was just 4?)
                                        // Wait, suffix might include the closing sub and the rest: "4</sub>234"

                                        const subContent = subMatch[1]; // "4"
                                        const afterSub = valueSpan.innerHTML.split('</sub>')[1] || '';

                                        // Clean up
                                        const cleanPrefix = prefix.replace(/[^\d.]/g, ''); // "0.0"
                                        const cleanSuffix = afterSub.replace(/[^\d]/g, ''); // "234"

                                        const expanded = `${cleanPrefix}${'0'.repeat(parseInt(subContent))}${cleanSuffix}`;
                                        const val = parseFloat(expanded);
                                        if (val > 0) {
                                            this.updatePrice(val);
                                            return;
                                        }
                                    }
                                }
                            }

                            this.processCandidates([valueSpan], true);
                            return;
                        }
                    }

                    // Strategy B: Brute force container text parsing
                    const rawText = priceContainer.textContent.replace('Price', '').trim();

                    if (rawText) {
                        const val = this.parsePriceStr(rawText);
                        const isTimeframe = /^\d+[dhm]$/i.test(rawText.replace(/[^\w]/g, ''));

                        if (!isTimeframe && val > 0) {
                            this.updatePrice(val);
                            return;
                        }
                    }
                }

                // Explicitly look for Market Cap in the same header loop
                const mcContainer = children.find(child => {
                    const text = child.textContent || '';
                    // Look for "MC" or "Market Cap" label but exclude Price and Liquidity containers
                    return (text.includes('MC') || text.includes('Market Cap')) &&
                           !text.includes('Price') && // Don't confuse with price container
                           !text.includes('Liquidity') && // Don't confuse with liquidity
                           Array.from(child.querySelectorAll('span, div')).some(el =>
                               ['MC', 'Market Cap', 'MarketCap'].includes(el.textContent.replace(/[^\w ]/g, '').trim())
                           );
                });

                if (mcContainer) {
                    const label = Array.from(mcContainer.querySelectorAll('span, div')).find(el =>
                        ['MC', 'Market Cap', 'MarketCap'].includes(el.textContent.replace(/[^\w ]/g, '').trim())
                    );
                    if (label) {
                        const allSpans = Array.from(mcContainer.querySelectorAll('span'));
                        const labelIndex = allSpans.indexOf(label);
                        const candidateSpans = allSpans.slice(labelIndex + 1);

                        const valSpan = candidateSpans.find(s =>
                            /\d/.test(s.textContent) &&
                            (/[KMB]/i.test(s.textContent) || parseFloat(s.textContent.replace(/[^0-9.]/g, '')) > 10000)
                        );
                        if (valSpan) {
                            const raw = valSpan.textContent;
                            const val = this.parsePriceStr(raw);
                            // Validate: MC must be > $10,000 (meme coins usually > $100K)
                            if (val > 10000) {
                                this.marketCap = val;
                                console.log(`[Market] MC: $${val.toLocaleString()} (${raw})`);
                            } else if (val > 0) {
                                console.warn(`[Market] Rejected MC candidate: $${val} (likely liquidity, not MC)`);
                            }
                        }
                    }
                }
            }

            // AGGRESSIVE AXIOM FALLBACK: Search ALL spans for price-like values
            // This catches order book prices and other price displays
            console.log('[Market] Axiom complex logic found no price, trying aggressive fallback...');
            const allSpans = Array.from(document.querySelectorAll('span, div'))
                .filter(el => {
                    const txt = el.textContent || '';
                    // Must have $ and digits, be short, no children, not be SOL/BTC pairs
                    return txt.includes('$') && /\d/.test(txt) &&
                           txt.length < 20 &&
                           el.children.length === 0 &&
                           !txt.includes('SOL') && !txt.includes('BTC') &&
                           !txt.includes('%') && !txt.includes('+') && !txt.includes('-') &&
                           !txt.includes('K') && !txt.includes('M') && !txt.includes('B'); // Exclude MC
                })
                .slice(0, 20); // Take first 20 candidates

            if (allSpans.length > 0) {
                console.log(`[Market] Axiom fallback found ${allSpans.length} price candidates:`,
                    allSpans.map(el => el.textContent.trim()).slice(0, 10));
            }

            this.processCandidates(allSpans, true);
            return;
        }

        // GENERIC FALLBACK (Other sites)
        const candidates = Array.from(document.querySelectorAll('h1, h2, .price'))
            .filter(el => {
                const txt = el.textContent || '';
                return txt.includes('$') && /\d/.test(txt) && !txt.includes('%') && !txt.includes('+') && !txt.includes('-') && txt.length < 30;
            });
        this.processCandidates(candidates);
    },

    processCandidates(candidates, isExplicitAxiom = false) {
        for (const el of candidates) {
            const raw = el.textContent.trim();
            const val = this.parsePriceStr(raw);

            // STRICT RULES:
            // - Price: < $10,000 AND no K/M/B suffix AND NOT $50-$500 (SOL price range)
            // - Market Cap: > $10,000 OR has K/M/B suffix
            const hasUnit = /[KMB]/.test(raw.toUpperCase());

            if (hasUnit || val > 10000) {
                // Market Cap logic (store if needed)
                if (val > 0) this.marketCap = val;
            } else if (val > 0 && val < 50000) { // Slight bump to 50k for strict check
                // SOL PRICE REJECTION: Reject if it looks like SOL price ($50-$500)
                if (this.isSolPrice(val)) {
                    console.warn(`[Market] REJECTED SOL PRICE: $${val}`);
                    continue;
                }

                // SPIKE DETECTION: If price changes >100x in one second, reject it
                // UNLESS: The last price update was stale (>5s ago) OR it is explicit Axiom source
                if (!isExplicitAxiom && this.price > 0 && (Date.now() - this.lastPriceTs < 5000)) {
                    const ratio = val / this.price;
                    if (ratio > 100 || ratio < 0.01) {
                        console.warn(`[Market] SPIKE REJECTED: $${val} (${ratio.toFixed(1)}x change)`);
                        continue;
                    }
                }

                // This is price
                this.updatePrice(val);
                // fetchMarketContext is now managed by pollMint on a 1s interval
            }
        }
    },

    async fetchMarketContext(mintOverride) {
        const query = mintOverride || this.currentMint;
        if (!query) return;

        // Prevent double-fetching within 10s
        if (this.lastContextFetch && (Date.now() - this.lastContextFetch < 10000) && this.context) return;
        this.lastContextFetch = Date.now();

        try {
            console.log(`[Market] Searching context for ${query}...`);
            // Use PROXY_FETCH to avoid CORS on Axiom
            const res = await chrome.runtime.sendMessage({
                type: 'PROXY_FETCH',
                url: `https://api.dexscreener.com/latest/dex/search?q=${query}`
            });

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status || res.error}`);
            const data = res.data;

            // Pick the pair with the highest liquidity
            const pairs = (data.pairs || []).sort((a, b) => {
                return (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0);
            });

            const pair = pairs[0];

            if (pair) {
                this.context = {
                    vol24h: pair.volume?.h24 || 0,
                    priceChange24h: pair.priceChange?.h24 || 0,
                    liquidity: pair.liquidity?.usd || 0,
                    fdv: pair.fdv || 0,
                    symbol: pair.baseToken?.symbol || '',
                    dex: pair.dexId,
                    ts: Date.now()
                };
                console.log(`[Market] Context Ready: ${this.context.symbol} on ${this.context.dex} (Vol: $${(this.context.vol24h / 1000).toFixed(0)}K)`);
                this.notify();
            } else {
                console.warn(`[Market] No results found for ${query}`);
            }
        } catch (e) {
            console.error('[Market] Context fetch failed:', e);
        }
    },

    notify() {
        this.listeners.forEach(cb => cb({
            price: this.price,
            context: this.context,
            mint: this.currentMint
        }));
    },

    parsePriceStr(text) {
        if (!text) return 0;
        let clean = text.trim();

        const subscriptMap = {
            '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4,
            '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9
        };

        let processed = clean.replace(/[$,]/g, '');
        const match = processed.match(/0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);
        if (match) {
            const numZeros = subscriptMap[match[1]];
            const digits = match[2];
            processed = '0.0' + '0'.repeat(numZeros) + digits;
        }

        let val = parseFloat(processed);
        const low = processed.toLowerCase();
        if (low.includes('k')) val *= 1000;
        else if (low.includes('m')) val *= 1000000;
        else if (low.includes('b')) val *= 1000000000;

        return isNaN(val) ? 0 : val;
    },

    isSolPrice(price) {
        // SOL typically trades between $50-$500
        // Token prices are usually much lower or much higher
        return price >= 50 && price <= 500;
    },

    updatePrice(val) {
        if (!val || val <= 0.000000000001) return;
        if (val !== this.price) {
            const oldPrice = this.price || 0;
            console.log(`[Market] Price: $${val.toFixed(8)} (was $${oldPrice.toFixed(8)}) | MC: $${this.marketCap.toFixed(0)}`);
            this.price = val;
            this.lastPriceTs = Date.now();
            this.priceIsFresh = true; // Mark as fresh
            this.notify();
        }
    }
};
