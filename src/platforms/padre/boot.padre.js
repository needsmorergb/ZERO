import { Professor } from '../../modules/ui/professor.js';
import { Store } from '../../modules/store.js';
import { FeatureManager } from '../../modules/featureManager.js';
import { OverlayManager } from '../../modules/ui/overlay.js';
import { Market } from '../../modules/core/market.js';
import { HUD } from '../../modules/ui/hud.js';
import { PnlCalculator } from '../../modules/core/pnl-calculator.js';
import { DiagnosticsStore } from '../../modules/diagnostics-store.js';
import { Logger } from '../../modules/logger.js';
import { TokenContextResolver } from '../../modules/core/token-context.js';
import { License } from '../../modules/license.js';

(async () => {
    "use strict";
    const PLATFORM = 'Padre';
    Logger.info(`ZERØ v1.11.14 (${PLATFORM} Platform)`);
    TokenContextResolver.init(PLATFORM);

    // Initialize Store
    try {
        Logger.info('Loading Store...');
        const state = await Store.load();
        if (!state) throw new Error("Store state is null");

        // BETA FIX: Force enable in case migration left it disabled
        if (!state.settings.enabled) {
            Logger.info('Force-enabling for Beta test...');
            state.settings.enabled = true;
            await Store.save();
        }

        Logger.info('Store loaded:', state.settings?.enabled ? 'Enabled' : 'Disabled');
    } catch (e) {
        Logger.error('Store Load Failed:', e);
    }

    // License revalidation check (non-blocking)
    try {
        if (License.needsRevalidation()) {
            Logger.info('License revalidation needed...');
            await License.revalidate();
        }
    } catch (e) {
        Logger.error('License revalidation failed:', e);
    }

    // Initialize Diagnostics Store
    try {
        Logger.info('Loading DiagnosticsStore...');
        await DiagnosticsStore.load();
        DiagnosticsStore.logEvent('SESSION_STARTED', {
            platform: 'PADRE',
        }, { platform: 'PADRE' });
    } catch (e) {
        Logger.error('DiagnosticsStore Init Failed:', e);
    }

    // Initialize Diagnostics Manager (Background Uploads)
    try {
        const { DiagnosticsManager } = await import('../../modules/diagnostics-manager.js');
        DiagnosticsManager.init();
    } catch (e) {
        Logger.error('DiagnosticsManager Init Failed:', e);
    }

    // Initialize UI Overlay
    try {
        Logger.info('Init Overlay...');
        OverlayManager.init(PLATFORM);
        Professor.init();
    } catch (e) {
        Logger.error('Overlay Init Failed:', e);
    }

    // Initialize Market (Data)
    try {
        Logger.info('Init Market...');
        Market.init();
    } catch (e) {
        Logger.error('Market Init Failed:', e);
    }

    // Initialize PNL Calculator (Background SOL price fetching)
    try {
        Logger.info('Init PNL Calculator...');
        PnlCalculator.init();
    } catch (e) {
        Logger.error('PNL Calculator Init Failed:', e);
    }

    // Initialize HUD (Render)
    try {
        Logger.info('Init HUD...');
        await HUD.init();
    } catch (e) {
        Logger.error('HUD Init Failed:', e);
    }

    // Command Bridge (for Debugging/Elevated Testing)
    window.addEventListener('message', async (e) => {
        if (e.source !== window || !e.data?.__paper_cmd) return;
        const { type, val } = e.data;

        if (type === 'SET_TIER') {
            const state = Store.state;
            if (state && state.settings) {
                Logger.info(`Admin: Setting tier to ${val}...`);
                state.settings.tier = val;
                await Store.save();
                location.reload();
            }
        }

        if (type === 'RESET_STORE') {
            Logger.warn('Admin: Resetting store...');
            await Store.clear();
            location.reload();
        }
    });

    Logger.info('Boot sequence finished.');

})();
