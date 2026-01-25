import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Trading } from '../core/trading.js';
import { TokenDetector } from './token-detector.js';
import { IDS } from './ids.js';
import { FeatureManager } from '../featureManager.js';
import { Paywall } from './paywall.js';

function px(n) { return n + 'px'; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export const BuyHud = {
    // UI State
    buyHudTab: 'buy',
    buyHudEdit: false,

    mountBuyHud(makeDraggable) {
        const container = OverlayManager.getContainer();
        const rootId = IDS.buyHud;
        let root = container.querySelector('#' + rootId);

        if (!Store.state.settings.enabled) {
            if (root) root.style.display = 'none';
            return;
        }
        if (root) root.style.display = '';

        if (!root) {
            root = document.createElement('div');
            root.id = rootId;
            root.className = Store.state.settings.buyHudDocked ? 'docked' : 'floating';
            if (!Store.state.settings.buyHudDocked) {
                // Initial float pos (safe default)
                const safeX = window.innerWidth - 340;
                root.style.left = px(safeX > 0 ? safeX : 20);
                root.style.top = '100px';
                root.style.right = 'auto'; // Ensure right is cleared
            }
            container.appendChild(root);
            this.renderBuyHudContent(root, makeDraggable);
            this.setupBuyHudInteractions(root);
        }

        // Always refresh content on mount to sync tabs
        this.renderBuyHudContent(root, makeDraggable);
    },

    renderBuyHudContent(root, makeDraggable) {
        // Re-render inner HTML based on active tab
        const isBuy = this.buyHudTab === 'buy';
        const actionText = isBuy ? "ZERØ BUY" : "ZERØ SELL";
        const actionClass = isBuy ? "action" : "action sell";
        const label = isBuy ? "Amount (SOL)" : "Amount (%)";

        root.innerHTML = `
            <div class="panel">
                <div class="panelHeader">
                    <div class="panelTitle"><span class="dot"></span> ZERØ TRADE</div>
                    <div class="panelBtns">
                        <button class="btn" data-act="edit">${this.buyHudEdit ? 'Done' : 'Edit'}</button>
                        <button class="btn" data-act="dock">${Store.state.settings.buyHudDocked ? 'Float' : 'Dock'}</button>
                    </div>
                </div>
                <div class="tabs">
                    <div class="tab ${isBuy ? 'active' : ''}" data-act="tab-buy">Buy</div>
                    <div class="tab ${!isBuy ? 'active' : ''}" data-act="tab-sell">Sell</div>
                </div>
                <div class="body">
                    <div class="fieldLabel">${label}</div>
                    <input class="field" type="text" inputmode="decimal" data-k="field" placeholder="0.0">

                    <div class="quickRow">
                        ${this.renderQuickButtons(isBuy)}
                    </div>

                    ${isBuy ? `
                    <div class="strategyRow">
                         <div class="fieldLabel">Context / Strategy</div>
                         <select class="strategySelect" data-k="strategy">
                            ${(Store.state.settings.strategies || ["Trend"]).map(s => `<option value="${s}">${s}</option>`).join('')}
                         </select>
                    </div>
                    ` : ''}

                    <button class="${actionClass}" data-act="action">${actionText}</button>
                    <div class="status" data-k="status">Ready to trade</div>
                </div>
            </div>
        `;

        // Re-bind drag listeners since we replaced the DOM
        this.bindHeaderDrag(root, makeDraggable);
    },

    renderQuickButtons(isBuy) {
        const values = isBuy
            ? Store.state.settings.quickBuySols
            : Store.state.settings.quickSellPcts;

        return values.map(v => `
            <button class="qbtn" data-act="quick" data-val="${v}">${v}${isBuy ? ' SOL' : '%'}</button>
        `).join('');
    },

    bindHeaderDrag(root, makeDraggable) {
        const header = root.querySelector('.panelHeader');
        if (!header || !makeDraggable) return;

        makeDraggable(header, (dx, dy) => {
            if (Store.state.settings.buyHudDocked) return;
            const s = Store.state.settings;

            // Initialize pos if it doesn't exist yet (first drag)
            if (!s.buyHudPos) {
                const rect = root.getBoundingClientRect();
                s.buyHudPos = { x: rect.left, y: rect.top };
            }

            s.buyHudPos.x = clamp(s.buyHudPos.x + dx, 0, window.innerWidth - 300);
            s.buyHudPos.y = clamp(s.buyHudPos.y + dy, 34, window.innerHeight - 300);

            root.style.setProperty('left', px(s.buyHudPos.x), 'important');
            root.style.setProperty('top', px(s.buyHudPos.y), 'important');
            root.style.setProperty('right', 'auto', 'important');
        }, async () => {
            if (!Store.state.settings.buyHudDocked) await Store.save();
        });
    },

    setupBuyHudInteractions(root) {
        root.addEventListener('click', async (e) => {
            const t = e.target;
            if (t.matches('input') || t.matches('select')) return;

            const actEl = t.closest('[data-act]');
            if (!actEl) return;
            const act = actEl.getAttribute('data-act');

            e.preventDefault();

            if (act === 'dock') {
                Store.state.settings.buyHudDocked = !Store.state.settings.buyHudDocked;
                await Store.save();
                this.updateBuyHud();
            }
            if (act === 'tab-buy') {
                this.buyHudTab = 'buy';
                this.mountBuyHud(); // Re-render content
            }
            if (act === 'tab-sell') {
                this.buyHudTab = 'sell';
                this.mountBuyHud();
            }
            if (act === 'quick') {
                const val = actEl.getAttribute('data-val');
                const field = root.querySelector('input[data-k="field"]');
                if (field) field.value = val;
            }
            if (act === 'action') {
                const field = root.querySelector('input[data-k="field"]');
                const val = parseFloat(field?.value || '0');
                const status = root.querySelector('[data-k="status"]');
                const strategyEl = root.querySelector('select[data-k="strategy"]');
                const strategyFlags = FeatureManager.resolveFlags(Store.state, 'STRATEGY_TAGGING');
                const strategy = strategyEl && strategyFlags.interactive ? strategyEl.value : "Trend";

                if (val <= 0) {
                    if (status) status.textContent = "Invalid amount";
                    return;
                }

                status.textContent = "Executing...";

                // Capture token info
                const tokenInfo = TokenDetector.getCurrentToken();

                let res;
                try {
                    if (this.buyHudTab === 'buy') {
                        res = await Trading.buy(val, strategy, tokenInfo);
                    } else {
                        res = await Trading.sell(val, strategy, tokenInfo);
                    }
                } catch (err) {
                    status.textContent = 'Error: ' + err.message;
                    status.style.color = "#ef4444";
                    return;
                }

                if (res && res.success) {
                    status.textContent = "Trade executed!";
                    field.value = "";
                    // Trigger update through HUD
                    if (window.ZeroHUD && window.ZeroHUD.updateAll) {
                        window.ZeroHUD.updateAll();
                    }
                    // Trigger Emotion Selector
                    setTimeout(() => {
                        this.showEmotionSelector(res.trade.id);
                    }, 500);
                } else {
                    status.textContent = res.error || "Error executing trade";
                    status.style.color = "#ef4444";
                }
            }
            if (act === 'edit') {
                // Toggle edit mode for quick buttons (Future: implement editing UI)
                this.buyHudEdit = !this.buyHudEdit;
                this.mountBuyHud();
            }
        });
    },

    showEmotionSelector(tradeId) {
        const emoFlags = FeatureManager.resolveFlags(Store.state, 'EMOTION_TRACKING');
        if (!emoFlags.enabled || Store.state.settings.showJournal === false) return;

        const container = OverlayManager.getContainer();
        const existing = container.querySelector('.emotion-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'emotion-modal-overlay';

        // Override styles for non-intrusive look
        overlay.style.position = 'fixed';
        overlay.style.zIndex = '2147483647';
        overlay.style.background = 'transparent'; // No dimming
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.pointerEvents = 'none'; // Background doesn't block clicks
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

        const emotions = [
            { id: 'calm', label: 'Calm', icon: '😌' },
            { id: 'anxious', label: 'Anxious', icon: '😨' },
            { id: 'excited', label: 'Excited', icon: '🤩' },
            { id: 'angry', label: 'Angry/Rev', icon: '😡' },
            { id: 'bored', label: 'Bored', icon: '🥱' },
            { id: 'confident', label: 'Confident', icon: '😎' }
        ];

        overlay.innerHTML = `
            <div class="emotion-modal" style="position:absolute; pointer-events:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(20,184,166,0.2); width:320px;">
                <div class="emotion-title">TRADE EXECUTED</div>
                <div class="emotion-subtitle">How are you feeling right now?</div>
                <div class="emotion-grid">
                    ${emotions.map(e => `
                        <button class="emotion-btn" data-emo="${e.id}">
                            <span>${e.icon}</span> ${e.label}
                        </button>
                    `).join('')}
                </div>
                <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; gap:10px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                     <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#64748b; cursor:pointer;">
                        <input type="checkbox" class="journal-opt-out"> Don't show again
                    </label>
                    <button class="emotion-skip" style="font-size:11px; padding:4px 8px; background:transparent; border:none; color:#94a3b8; cursor:pointer;">Skip</button>
                </div>
            </div>
        `;

        // Position under Buy HUD
        const buyHud = container.querySelector('#' + IDS.buyHud);
        const modal = overlay.querySelector('.emotion-modal');
        if (buyHud) {
            const rect = buyHud.getBoundingClientRect();
            modal.style.top = (rect.bottom + 12) + 'px';
            modal.style.left = rect.left + 'px';
        } else {
            // Fallback
            modal.style.top = '100px';
            modal.style.left = '50%';
            modal.style.transform = 'translateX(-50%)';
        }

        container.appendChild(overlay);

        const close = async () => {
            if (overlay.querySelector('.journal-opt-out').checked) {
                Store.state.settings.showJournal = false;
                await Store.save();
            }
            overlay.remove();
        };

        overlay.querySelectorAll('.emotion-btn').forEach(btn => {
            btn.onclick = async () => {
                const emo = btn.getAttribute('data-emo');
                await Trading.tagTrade(tradeId, { emotion: emo });
                close();
            };
        });

        overlay.querySelector('.emotion-skip').onclick = close;

        if (emoFlags.gated) {
            const modalInner = overlay.querySelector('.emotion-modal');
            modalInner.style.filter = 'grayscale(1) opacity(0.8)';
            const lock = document.createElement('div');
            lock.innerHTML = '<div style="background:rgba(13,17,23,0.8); color:#14b8a6; padding:10px; border-radius:8px; font-weight:800; cursor:pointer;">PRO FEATURE: EMOTION TRACKING</div>';
            lock.style.position = 'absolute';
            lock.style.top = '50%';
            lock.style.left = '50%';
            lock.style.transform = 'translate(-50%, -50%)';
            lock.style.pointerEvents = 'auto';
            lock.onclick = (e) => { e.stopPropagation(); Paywall.showUpgradeModal(); };
            modalInner.appendChild(lock);
        }
    },

    updateBuyHud() {
        const root = OverlayManager.getContainer().querySelector('#' + IDS.buyHud);
        if (!root || !Store.state) return;

        // Visibility Toggle
        if (!Store.state.settings.enabled) {
            root.style.display = 'none';
            return;
        }
        root.style.display = '';

        root.className = Store.state.settings.buyHudDocked ? "docked" : "floating";
        if (!Store.state.settings.buyHudDocked) {
            // If we have pos, use it
            const p = Store.state.settings.buyHudPos;
            if (p) {
                const maxX = window.innerWidth - 300;
                const safeX = clamp(p.x, 0, maxX > 0 ? maxX : 0);
                root.style.setProperty('left', px(safeX), 'important');
                root.style.setProperty('top', px(p.y), 'important');
                root.style.setProperty('right', 'auto', 'important');
            } else {
                // No saved pos? Keep it safe on the right edge dynamically
                const safeX = window.innerWidth - 340;
                root.style.setProperty('left', px(safeX > 0 ? safeX : 20), 'important');
                root.style.setProperty('top', '100px', 'important');
                root.style.setProperty('right', 'auto', 'important');
            }
        } else {
            root.style.left = "";
            root.style.top = "";
            root.style.right = ""; // CSS class handles docked pos
        }
    }
};
