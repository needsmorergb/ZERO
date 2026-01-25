export const Market = {
    price: 0,
    marketCap: 0,
    lastPriceTs: 0,
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
            if (!window.location.pathname.includes('/trade/')) return;
            this.pollDOM();
        }, 1000);
    },

    pollDOM() {
        let candidates = [];
        const isPadre = window.location.hostname.includes('padre.gg');

        if (isPadre) {
            candidates = Array.from(document.querySelectorAll('h2, span[class*="MuiTypography"], div[class*="MuiTypography"]'))
                .filter(el => {
                    const txt = el.textContent || '';
                    return /\d/.test(txt) && !txt.includes('%') && !txt.includes('SOL') && txt.length < 30;
                });
        } else {
            candidates = Array.from(document.querySelectorAll('h1, h2, .price'))
                .filter(el => /\d/.test(el.textContent) && !el.textContent.includes('%') && el.textContent.length < 30);
        }

        for (const el of candidates) {
            const raw = el.textContent.trim();
            const val = this.parsePriceStr(raw);

            // STRICT RULES:
            // - Price: < $10,000 AND no K/M/B suffix
            // - Market Cap: > $10,000 OR has K/M/B suffix
            const hasUnit = /[KMB]/.test(raw.toUpperCase());

            if (hasUnit || val > 10000) {
                // This is market cap
                if (val > 0) this.marketCap = val;
            } else if (val > 0 && val < 10000) {
                // This is price (most tokens are < $10k per token)
                this.updatePrice(val);
            }
        }
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
            console.log(`[Market] Price updated: $${val.toFixed(8)} (MC: $${this.marketCap.toFixed(0)})`);
            this.price = val;
            this.lastPriceTs = Date.now();
            this.listeners.forEach(cb => cb(val));
        }
    }
};
