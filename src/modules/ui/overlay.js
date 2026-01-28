import { IDS, CSS } from './styles.js';

export const OverlayManager = {
    shadowHost: null,
    shadowRoot: null,

    init(platformName) {
        this.createShadowRoot();
        this.injectStyles();
        this.injectPageBridge(); // Inject network price interceptor
        if (platformName === 'Padre') {
            // this.injectPadreOffset(); // DEBUG: Disabled to test if causing blank screen
        }
    },

    injectPageBridge() {
        // Inject page-bridge.js for network-level price interception
        if (document.getElementById('paper-page-bridge')) return;

        const script = document.createElement('script');
        script.id = 'paper-page-bridge';
        script.src = chrome.runtime.getURL('src/page-bridge.js');
        script.onload = () => console.log('[ZERØ] Page bridge injected for network price interception');
        script.onerror = (e) => console.error('[ZERØ] Failed to inject page bridge:', e);
        (document.head || document.documentElement).appendChild(script);
    },

    getShadowRoot() {
        if (this.shadowRoot && this.shadowHost && this.shadowHost.isConnected) {
            return this.shadowRoot;
        }
        return this.createShadowRoot();
    },

    getContainer() {
        const root = this.getShadowRoot();
        return root.getElementById('paper-shadow-container') || root;
    },

    createShadowRoot() {
        this.shadowHost = document.createElement('paper-trader-host');
        this.shadowHost.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;';

        this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });

        const container = document.createElement('div');
        container.id = 'paper-shadow-container';
        container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;';

        this.shadowRoot.appendChild(container);
        document.documentElement.appendChild(this.shadowHost);

        return this.shadowRoot;
    },

    injectStyles() {
        const root = this.getShadowRoot();
        if (root.getElementById(IDS.style)) return;

        const s = document.createElement("style");
        s.id = IDS.style;
        s.textContent = CSS;
        root.appendChild(s);
    },

    injectPadreOffset() {
        const styleId = 'paper-padre-offset-style';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          header, nav, [class*="Header"], [class*="Nav"], .MuiAppBar-root, [style*="sticky"], [style*="fixed"], [data-testid="top-bar"] {
            top: 28px !important;
            margin-top: 28px !important;
          }
          .MuiBox-root[style*="top: 0"], .MuiBox-root[style*="top:0"] {
            top: 28px !important;
          }
          #root, main, [class*="main"], body > div:first-child {
            padding-top: 28px !important;
          }
        `;
        document.head.appendChild(style);
    }
};
