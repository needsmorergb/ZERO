import { Store } from "../store.js";
import { OverlayManager } from "./overlay.js";
import { IDS } from "./ids.js";
import { FeatureManager } from "../featureManager.js";
import { ICONS } from "./icons.js";
import { ModeManager, MODES } from "../mode-manager.js";
import { ModesUI } from "./modes-ui.js";

export const Banner = {
  ensurePageOffset() {
    const body = document.body;
    if (!body) return;

    // Padre uses a full-height app layout — never add body padding there
    // The ZERØ banner is position:fixed and floats without displacing content
    const isPadre = window.location.hostname.includes("padre.gg");
    if (isPadre) return;

    const offset = 44;
    const html = document.documentElement;
    const bodyStyle = getComputedStyle(body);
    const htmlStyle = getComputedStyle(html);
    const isOverflowLocked =
      ["hidden", "clip"].includes(bodyStyle.overflowY) ||
      ["hidden", "clip"].includes(bodyStyle.overflow) ||
      ["hidden", "clip"].includes(htmlStyle.overflowY) ||
      ["hidden", "clip"].includes(htmlStyle.overflow);

    if (isOverflowLocked) return;

    const prev = body.getAttribute("data-paper-prev-padding-top");
    if (!prev) {
      body.setAttribute("data-paper-prev-padding-top", bodyStyle.paddingTop || "0px");
    }
    const currentPadding = Number.parseFloat(bodyStyle.paddingTop || "0") || 0;
    if (currentPadding < offset) {
      body.style.paddingTop = `${offset}px`;
    }
  },

  mountBanner() {
    const root = OverlayManager.getShadowRoot();
    if (!root) return;

    let bar = root.getElementById(IDS.banner);
    if (bar) return;

    bar = document.createElement("div");
    bar.id = IDS.banner;
    const modeHint = ModesUI.getBannerHint();
    bar.innerHTML = `
            <div class="inner" style="cursor:pointer;" title="Click to toggle ZERØ Mode">
                <div class="dot"></div>
                <div class="label">ZERØ MODE</div>
                <div class="state">ENABLED</div>
                <div class="hint" style="margin-left:8px; opacity:0.5; font-size:11px;">${modeHint}</div>
            </div>
            <div style="position:absolute; right:20px; font-size:10px; color:#334155; pointer-events:none;">v${Store.state?.version || "0.9.1"}</div>
        `;

    bar.addEventListener("click", async () => {
      if (!Store.state) return;
      Store.state.settings.enabled = !Store.state.settings.enabled;
      await Store.save();
      // Trigger full update through HUD
      if (window.ZeroHUD && window.ZeroHUD.updateAll) {
        window.ZeroHUD.updateAll();
      }
    });

    root.insertBefore(bar, root.firstChild);
    this.ensurePageOffset();
  },

  updateBanner() {
    const root = OverlayManager.getShadowRoot();
    const bar = root?.getElementById(IDS.banner);
    if (!bar || !Store.state) return;

    const enabled = Store.state.settings.enabled;
    const stateEl = bar.querySelector(".state");
    if (stateEl) stateEl.textContent = enabled ? "ENABLED" : "DISABLED";
    bar.classList.toggle("disabled", !enabled);

    // Update mode hint dynamically
    const hintEl = bar.querySelector(".hint");
    if (hintEl) hintEl.textContent = ModesUI.getBannerHint();

    this.updateAlerts();
  },

  updateAlerts() {
    const root = OverlayManager.getShadowRoot();
    if (!root || !Store.state) return;

    const flags = FeatureManager.resolveFlags(Store.state, "TILT_DETECTION");
    if (!flags.visible || !Store.state.settings.behavioralAlerts) {
      const existing = root.getElementById("elite-alert-container");
      if (existing) existing.remove();
      return;
    }

    let container = root.getElementById("elite-alert-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "elite-alert-container";
      container.className = "elite-alert-overlay";
      root.appendChild(container);
    }

    const alerts = Store.getActiveSession().activeAlerts || [];
    const existingIds = Array.from(container.children).map((c) => c.dataset.ts);

    alerts.forEach((alert) => {
      if (!existingIds.includes(alert.ts.toString())) {
        const el = document.createElement("div");
        el.className = `elite-alert ${alert.type}`;
        el.dataset.ts = alert.ts;
        el.innerHTML = `
                    <div class="alert-icon" style="flex-shrink:0; display:flex;">
                        ${ICONS[alert.type] || ICONS.TILT}
                    </div>
                    <div class="alert-msg">${alert.message}</div>
                    <button class="elite-alert-close">${ICONS.X}</button>
                `;

        el.querySelector(".elite-alert-close").onclick = () => {
          el.style.animation = "alertFadeOut 0.3s forwards";
          setTimeout(() => el.remove(), 300);
        };

        container.appendChild(el);

        // Auto-remove after 5 seconds
        setTimeout(() => {
          if (el.parentNode) {
            el.style.animation = "alertFadeOut 0.3s forwards";
            setTimeout(() => el.remove(), 300);
          }
        }, 5000);
      }
    });
  },
};
