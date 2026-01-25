import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { IDS } from './ids.js';

export const Banner = {
    mountBanner() {
        const root = OverlayManager.getShadowRoot();
        if (!root) return;

        let bar = root.getElementById(IDS.banner);
        if (bar) return;

        bar = document.createElement('div');
        bar.id = IDS.banner;
        bar.innerHTML = `
            <div class="inner" style="cursor:pointer;" title="Click to toggle ZERØ Mode">
                <div class="dot"></div>
                <div class="label">ZERØ MODE</div>
                <div class="state">ENABLED</div>
                <div class="hint" style="margin-left:8px; opacity:0.5; font-size:11px;">(Paper Trading Overlay)</div>
            </div>
            <div style="position:absolute; right:20px; font-size:10px; color:#334155; pointer-events:none;">v${Store.state?.version || '0.9.1'}</div>
        `;

        bar.addEventListener('click', async () => {
            if (!Store.state) return;
            Store.state.settings.enabled = !Store.state.settings.enabled;
            await Store.save();
            // Trigger full update through HUD
            if (window.ZeroHUD && window.ZeroHUD.updateAll) {
                window.ZeroHUD.updateAll();
            }
        });

        root.insertBefore(bar, root.firstChild);
    },

    updateBanner() {
        const root = OverlayManager.getShadowRoot();
        const bar = root?.getElementById(IDS.banner);
        if (!bar || !Store.state) return;

        const enabled = Store.state.settings.enabled;
        const stateEl = bar.querySelector(".state");
        if (stateEl) stateEl.textContent = enabled ? "ENABLED" : "DISABLED";
        bar.classList.toggle("disabled", !enabled);
    }
};
