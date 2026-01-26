import { Store } from './modules/store.js';
import { FeatureManager } from './modules/featureManager.js';
import { OverlayManager } from './modules/ui/overlay.js';
import { Market } from './modules/core/market.js';
import { HUD } from './modules/ui/hud.js';
import { PnlCalculator } from './modules/core/pnl-calculator.js';

(async () => {
    "use strict";
    console.log('%c ZERØ v1.11.4 (Market Context Refined)', 'color: #14b8a6; font-weight: bold; font-size: 14px;');

    const PLATFORM = {
        isAxiom: window.location.hostname.includes('axiom.trade'),
        isPadre: window.location.hostname.includes('padre.gg'),
        name: window.location.hostname.includes('axiom.trade') ? 'Axiom' : 'Padre'
    };

    // Initialize Store
    try {
        console.log('[ZERØ] Loading Store...');
        const state = await Store.load();
        if (!state) throw new Error("Store state is null");

        // BETA FIX: Force enable in case migration left it disabled
        if (!state.settings.enabled) {
            console.log('[ZERØ] Force-enabling for Beta test...');
            state.settings.enabled = true;
            await Store.save();
        }

        console.log('[ZERØ] Store loaded:', state.settings?.enabled ? 'Enabled' : 'Disabled');
    } catch (e) {
        console.error('[ZERØ] Store Load Failed:', e);
    }

    // Initialize UI Overlay
    try {
        console.log('[ZERØ] Init Overlay...');
        OverlayManager.init(PLATFORM.name);
    } catch (e) {
        console.error('[ZERØ] Overlay Init Failed:', e);
    }

    // Initialize Market (Data)
    try {
        console.log('[ZERØ] Init Market...');
        Market.init();
    } catch (e) {
        console.error('[ZERØ] Market Init Failed:', e);
    }

    // Initialize PNL Calculator (Background SOL price fetching)
    try {
        console.log('[ZERØ] Init PNL Calculator...');
        PnlCalculator.init();
    } catch (e) {
        console.error('[ZERØ] PNL Calculator Init Failed:', e);
    }

    // Initialize HUD (Render)
    try {
        console.log('[ZERØ] Init HUD...');
        await HUD.init();
    } catch (e) {
        console.error('[ZERØ] HUD Init Failed:', e);
    }

    // Command Bridge (for Debugging/Elevated Testing)
    window.addEventListener('message', async (e) => {
        if (e.source !== window || !e.data?.__paper_cmd) return;
        const { type, val } = e.data;

        if (type === 'SET_TIER') {
            const state = Store.state;
            if (state && state.settings) {
                console.log(`[ZERØ] Admin: Setting tier to ${val}...`);
                state.settings.tier = val;
                await Store.save();
                location.reload();
            }
        }

        if (type === 'RESET_STORE') {
            console.warn('[ZERØ] Admin: Resetting store...');
            await Store.clear();
            location.reload();
        }
    });

    console.log('[ZERØ] Boot sequence finished.');

})();
