import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Market } from '../core/market.js';
import { Banner } from './banner.js';
import { PnlHud } from './pnl-hud.js';
import { BuyHud } from './buy-hud.js';

export const HUD = {
    renderScheduled: false,
    lastRenderAt: 0,

    async init() {
        // Make HUD globally accessible for callbacks
        window.ZeroHUD = this;

        this.renderAll();
        window.addEventListener('resize', () => this.scheduleRender());

        // Draw historical markers (normalize side names for bridge)
        if (Store.state.trades) {
            const trades = Object.values(Store.state.trades).map(t => ({
                ...t,
                side: t.side === 'ENTRY' ? 'BUY' : (t.side === 'EXIT' ? 'SELL' : t.side),
                priceUsd: t.fillPriceUsd || t.priceUsd,
                marketCap: t.marketCapUsdAtFill || t.marketCap
            }));
            setTimeout(() => {
                window.postMessage({ __paper: true, type: "PAPER_DRAW_ALL", trades }, "*");
            }, 2000); // Wait for TV to load
        }

        // Listen for price/context updates to update HUDs
        Market.subscribe(async () => {
            this.scheduleRender();
        });
    },

    scheduleRender() {
        if (this.renderScheduled) return;
        this.renderScheduled = true;
        requestAnimationFrame(() => {
            this.renderAll();
            this.renderScheduled = false;
            this.lastRenderAt = Date.now();
        });
    },

    renderAll() {
        if (!Store.state) return; // Wait for state load
        Banner.mountBanner();
        PnlHud.mountPnlHud(this.makeDraggable.bind(this));
        BuyHud.mountBuyHud(this.makeDraggable.bind(this));
        this.updateAll();
    },

    async updateAll() {
        if (Store.state && Store.state.settings) {
            const container = OverlayManager.getContainer();
            if (Store.state.settings.tradingMode === 'shadow') {
                container.classList.add('zero-shadow-mode');
            } else {
                container.classList.remove('zero-shadow-mode');
            }
        }
        Banner.updateBanner();
        await PnlHud.updatePnlHud();
        BuyHud.updateBuyHud();
    },

    // Shared utility for making elements draggable
    makeDraggable(handle, onMove, onStop) {
        if (!handle) return;
        let dragging = false;
        let startX = 0, startY = 0;

        const down = (e) => {
            if (e.button !== 0) return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        };

        const move = (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            startX = e.clientX; // Incremental
            startY = e.clientY;
            onMove(dx, dy);
            e.preventDefault();
        };

        const up = () => {
            dragging = false;
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            if (onStop) onStop();
        };

        handle.addEventListener('mousedown', down);
    }
};
