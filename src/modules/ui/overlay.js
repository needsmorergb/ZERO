import { IDS, CSS } from './styles.js';

export const OverlayManager = {
    shadowHost: null,
    shadowRoot: null,
    initialized: false,

    platformName: null,

    init(platformName) {
        if (this.initialized) return;
        if (!document.documentElement && !document.body) {
            document.addEventListener('DOMContentLoaded', () => this.init(platformName), { once: true });
            return;
        }

        this.initialized = true;
        this.platformName = platformName;
        console.log(`[ZERØ] OverlayManager.init() called with platform: "${platformName}"`);

        try { this.createShadowRoot(); } catch (e) {
            console.warn('[ZERØ] Shadow root creation failed:', e);
        }

        try { this.injectStyles(); } catch (e) {
            console.warn('[ZERØ] Style injection failed:', e);
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
        const existingHost = document.querySelector('paper-trader-host');
        if (existingHost?.shadowRoot) {
            this.shadowHost = existingHost;
            this.shadowRoot = existingHost.shadowRoot;
            return this.shadowRoot;
        }

        const mountTarget = document.documentElement || document.body;
        if (!mountTarget) {
            throw new Error('No documentElement/body available for overlay mount');
        }

        this.shadowHost = document.createElement('paper-trader-host');
        this.shadowHost.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;';

        try {
            this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });

            const container = document.createElement('div');
            container.id = 'paper-shadow-container';
            container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;';

            this.shadowRoot.appendChild(container);
            mountTarget.appendChild(this.shadowHost);

            return this.shadowRoot;
        } catch (e) {
            console.warn('[ZERØ] Shadow DOM unavailable, using DOM fallback', e);
            const container = document.createElement('div');
            container.id = 'paper-shadow-container';
            container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;';
            mountTarget.appendChild(container);
            this.shadowHost = container;
            this.shadowRoot = document;
            return this.shadowRoot;
        }
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
