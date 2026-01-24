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

            // Logic: 
            // 1. If it looks like a high-precision price (0.00... or < 1000 without unit), it's Price.
            // 2. If it has K/M/B or is a huge number, it's Market Cap.
            const hasUnit = /[KMB]/.test(raw.toUpperCase());

            if (hasUnit || val > 100000) {
                if (val > 0) this.marketCap = val;
            } else if (val > 0) {
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
            this.price = val;
            this.lastPriceTs = Date.now();
            this.listeners.forEach(cb => cb(val));
        }
    }
};
