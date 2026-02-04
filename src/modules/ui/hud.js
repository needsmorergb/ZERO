import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Market } from '../core/market.js';
import { Banner } from './banner.js';
import { PnlHud } from './pnl-hud.js';
import { BuyHud } from './buy-hud.js';
import { ModeManager, MODES } from '../mode-manager.js';
import { FeatureManager } from '../featureManager.js';
import { ModesUI } from './modes-ui.js';
import { IDS } from './ids.js';
import { ShadowHud } from './shadow-hud.js';
import { NarrativeTrust } from '../core/narrative-trust.js';

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

        // Initialize Narrative Trust service for Elite users (any mode)
        if (FeatureManager.isElite(Store.state)) {
            NarrativeTrust.init();
        }

        // Show mode session banner (once per session for Analysis/Shadow)
        ModesUI.showSessionBanner();
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

        // BUY/SELL HUD: only mount in Paper Mode; remove from DOM in Analysis/Shadow
        if (ModeManager.shouldShowBuyHud()) {
            BuyHud.mountBuyHud(this.makeDraggable.bind(this));
        } else {
            const container = OverlayManager.getContainer();
            const buyRoot = container.querySelector('#' + IDS.buyHud);
            if (buyRoot) buyRoot.remove();
        }

        // SHADOW HUD: mount for Elite users (any mode); remove from DOM otherwise
        if (ModeManager.shouldShowShadowHud()) {
            ShadowHud.mountShadowHud(this.makeDraggable.bind(this));
            // Lazy-init NarrativeTrust for mid-session tier upgrades
            if (!NarrativeTrust.initialized) {
                NarrativeTrust.init();
            }
        } else {
            ShadowHud.removeShadowHud();
        }

        this.updateAll();
    },

    async updateAll() {
        // Apply correct mode class to container
        ModesUI.applyContainerClass();

        Banner.updateBanner();
        await PnlHud.updatePnlHud();

        // Only update BuyHud if it should be visible
        if (ModeManager.shouldShowBuyHud()) {
            BuyHud.updateBuyHud();
        }

        // Only update ShadowHud if it should be visible
        if (ModeManager.shouldShowShadowHud()) {
            ShadowHud.updateShadowHud();
        }
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
