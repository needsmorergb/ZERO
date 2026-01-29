import { IDS, CSS } from './styles.js';

export const OverlayManager = {
    shadowHost: null,
    shadowRoot: null,

    init(platformName) {
        console.log(`[ZERØ] OverlayManager.init() called with platform: "${platformName}"`);
        this.createShadowRoot();
        this.injectStyles();

        // Platform-specific initialization
        if (platformName === 'Padre') {
            console.log('[ZERØ] Padre detected - using DOM polling only');
            this.injectPadreOffset();
        }
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
          html, body {
            scroll-padding-top: 28px;
          }
          body {
            padding-top: 28px !important;
            box-sizing: border-box;
            min-height: calc(100vh + 28px);
          }
          header, nav, [class*="Header"], [class*="Nav"], .MuiAppBar-root, [style*="sticky"], [style*="fixed"], [data-testid="top-bar"] {
            top: 28px !important;
            margin-top: 28px !important;
          }
          .MuiBox-root[style*="top: 0"], .MuiBox-root[style*="top:0"] {
            top: 28px !important;
          }
        `;
        document.head.appendChild(style);
    }
};
