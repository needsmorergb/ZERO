export const Market = {
    price: 0,
    marketCap: 0,
    lastPriceTs: 0,
    context: null, // { vol24h, priceChange24h, liquidity, fdv }
    currentMint: null,
    lastContextFetch: 0,
    listeners: [],

    init() {
        this.startPolling();

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
            const isTradePage = window.location.pathname.includes('/trade/') || window.location.pathname.includes('/token/');
            if (!isTradePage) return;

            // 1. Poll for Mint changes (from URL)
            this.pollMint();

            // 2. Poll for DOM price updates
            this.pollDOM();
        }, 1000);
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
        let candidates = [];
        const isPadre = window.location.hostname.includes('padre.gg');

        if (isPadre) {
            // MUCH MORE SPECIFIC: Only look for h2 elements (main price display)
            // Ignore all the MuiTypography noise (order book, volume, etc.)
            candidates = Array.from(document.querySelectorAll('h2'))
                .filter(el => {
                    const txt = el.textContent || '';
                    // STRICT: Must contain '$' and a digit, no 'SOL', no '%'
                    return txt.includes('$') && /\d/.test(txt) && !txt.includes('SOL') && !txt.includes('%') && txt.length < 30;
                });
        } else {
            candidates = Array.from(document.querySelectorAll('h1, h2, .price'))
                .filter(el => {
                    const txt = el.textContent || '';
                    return txt.includes('$') && /\d/.test(txt) && !txt.includes('%') && txt.length < 30;
                });
        }

        for (const el of candidates) {
            const raw = el.textContent.trim();
            const val = this.parsePriceStr(raw);

            // STRICT RULES:
            // - Price: < $10,000 AND no K/M/B suffix AND NOT $50-$500 (SOL price range)
            // - Market Cap: > $10,000 OR has K/M/B suffix
            const hasUnit = /[KMB]/.test(raw.toUpperCase());

            if (hasUnit || val > 10000) {
                // This is market cap
                if (val > 0) this.marketCap = val;
            } else if (val > 0 && val < 10000) {
                // CRITICAL FIX: Reject $50-$500 range - those are SOL prices, not token prices!
                if (val >= 50 && val <= 500) {
                    continue;
                }

                // SPIKE DETECTION: If price changes >100x in one second, reject it
                if (this.price > 0) {
                    const ratio = val / this.price;
                    if (ratio > 100 || ratio < 0.01) {
                        console.warn(`[Market] SPIKE REJECTED: $${val} (${(ratio * 100).toFixed(0)}x change from $${this.price})`);
                        continue;
                    }
                }

                // This is price (most tokens are < $10k per token)
                this.updatePrice(val);
                // fetchMarketContext is now managed by pollMint on a 1s interval
            }
        }
    },

    async fetchMarketContext(mintOverride) {
        const mint = mintOverride || this.currentMint;
        if (!mint) return;

        // Prevent double-fetching within 10s
        if (this.lastContextFetch && (Date.now() - this.lastContextFetch < 10000) && this.context) return;
        this.lastContextFetch = Date.now();

        try {
            console.log(`[Market] Fetching context for ${mint}...`);
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const pair = data.pairs?.[0];

            if (pair) {
                this.context = {
                    vol24h: pair.volume?.h24 || 0,
                    priceChange24h: pair.priceChange?.h24 || 0,
                    liquidity: pair.liquidity?.usd || 0,
                    fdv: pair.fdv || 0,
                    symbol: pair.baseToken?.symbol || '',
                    ts: Date.now()
                };
                console.log(`[Market] Context Ready: Vol=$${(this.context.vol24h / 1000000).toFixed(1)}M, Chg=${this.context.priceChange24h}%`);
                this.notify();
            } else {
                console.warn(`[Market] No DexScreener pair found for ${mint}`);
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

    updatePrice(val) {
        if (!val || val <= 0.000000000001) return;
        if (val !== this.price) {
            console.log(`[Market] Price: $${val.toFixed(8)} (MC: $${this.marketCap.toFixed(0)})`);
            this.price = val;
            this.lastPriceTs = Date.now();
            this.notify();
        }
    }
};
