import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { Trading } from '../core/trading.js';
import { Market } from '../core/market.js';
import { Professor } from './professor.js';
import { IDS } from './styles.js';

export const HUD = {
    renderScheduled: false,
    lastRenderAt: 0,

    // UI State
    buyHudTab: 'buy',
    buyHudEdit: false,

    async init() {
        this.renderAll();
        window.addEventListener('resize', () => this.scheduleRender());

        // Draw historical markers
        if (Store.state.trades) {
            const trades = Object.values(Store.state.trades);
            setTimeout(() => {
                window.postMessage({ __paper: true, type: "PAPER_DRAW_ALL", trades }, "*");
            }, 2000); // Wait for TV to load
        }

        // Listen for price updates to update HUDs
        Market.subscribe(() => {
            this.updatePnlHud();
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
        this.mountBanner();
        this.mountPnlHud();
        this.mountBuyHud();
        this.updateAll();
    },

    updateAll() {
        if (Store.state && Store.state.settings) {
            const container = OverlayManager.getContainer();
            if (Store.state.settings.tradingMode === 'shadow') {
                container.classList.add('zero-shadow-mode');
            } else {
                container.classList.remove('zero-shadow-mode');
            }
        }
        this.updateBanner();
        this.updatePnlHud();
        this.updateBuyHud();
    },

    // --- BANNER ---
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
            this.updateAll();
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
    },

    // --- PNL HUD ---
    mountPnlHud() {
        const container = OverlayManager.getContainer();
        const rootId = IDS.pnlHud;
        let root = container.querySelector('#' + rootId);

        if (!Store.state.settings.enabled) {
            if (root) root.style.display = 'none';
            return;
        }
        if (root) root.style.display = '';

        let isNew = false;
        if (!root) {
            isNew = true;
            root = document.createElement('div');
            root.id = rootId;
            root.className = Store.state.settings.pnlDocked ? 'docked' : 'floating';
            if (!Store.state.settings.pnlDocked) {
                root.style.left = px(Store.state.settings.pnlPos.x);
                root.style.top = px(Store.state.settings.pnlPos.y);
            }
            container.appendChild(root);

            // Global clicks only need to be bound once on creation
            this.bindPnlEvents(root);
        }

        // Check if we need to re-render (Stale content or new)
        // We use a strict version check to ensure UI updates (like text changes) apply
        // even if the structure (like discipline score) is already present.
        const CURRENT_UI_VERSION = "1.1.5";
        const renderedVersion = root.dataset.uiVersion;

        if (isNew || renderedVersion !== CURRENT_UI_VERSION) {
            this.renderPnlHudContent(root);
            root.dataset.uiVersion = CURRENT_UI_VERSION;
        }
    },

    renderPnlHudContent(root) {
        root.innerHTML = `
            <div class="card">
              <div class="header">
                <div class="title"><span class="dot"></span> ZERØ PNL <span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);">TOKEN</span></div>
                <div class="controls">
                  <div class="startSol">
                    <span style="font-weight:700;color:rgba(203,213,225,0.92);">Start SOL</span>
                    <input class="startSolInput" type="text" inputmode="decimal" />
                  </div>
                  <button class="pillBtn" data-act="trades">Trades</button>
                  <button class="pillBtn" data-act="reset" style="color:#ef4444;">Reset</button>
                  <button class="pillBtn" data-act="settings" style="padding:6px 8px;">⚙</button>
                  <button class="pillBtn" data-act="dock">Dock</button>
                </div>
              </div>
              <div class="stats">
                <div class="stat" style="cursor:pointer;" data-act="toggleTokenUnit">
                    <div class="k">UNREALIZED P&L <span data-k="tokenUnit" style="opacity:0.6;font-size:9px;">SOL</span></div>
                    <div class="v" data-k="tokenValue">0.0000</div>
                </div>
                <div class="stat">
                    <div class="k">BALANCE</div>
                    <div class="v" data-k="balance">0.0000 SOL</div>
                </div>
                <div class="stat" style="cursor:pointer;" data-act="toggleSessionUnit">
                    <div class="k">SESSION P&L <span data-k="pnlUnit" style="opacity:0.6;font-size:9px;">SOL</span></div>
                    <div class="v" data-k="pnl" style="color:#10b981;">+0.0000 SOL</div>
                </div>
                <div class="stat streak">
                    <div class="k">WIN STREAK</div>
                    <div class="v" data-k="streak">0</div>
                </div>
                <div class="stat discipline">
                    <div class="k">DISCIPLINE</div>
                    <div class="v" data-k="discipline">100</div>
                </div>
              </div>
              <div class="tradeList" style="display:none;"></div>
            </div>
         `;

        // Re-bind drag because header element is new
        this.bindPnlDrag(root);

        // Re-bind input change because input is new
        const inp = root.querySelector('.startSolInput');
        if (inp) {
            inp.addEventListener('change', async () => {
                const v = parseFloat(inp.value);
                if (v > 0) {
                    if ((Store.state.session.trades || []).length === 0) {
                        Store.state.session.balance = v;
                        Store.state.session.equity = v;
                    }
                    Store.state.settings.startSol = v;
                    await Store.save();
                    this.updatePnlHud();
                }
            });
        }
    },

    bindPnlDrag(root) {
        const header = root.querySelector(".header");
        if (!header) return;

        this.makeDraggable(header, (dx, dy) => {
            if (Store.state.settings.pnlDocked) return;
            const s = Store.state.settings;
            s.pnlPos.x = clamp(s.pnlPos.x + dx, 0, window.innerWidth - 40);
            s.pnlPos.y = clamp(s.pnlPos.y + dy, 34, window.innerHeight - 40);
            root.style.left = px(s.pnlPos.x);
            root.style.top = px(s.pnlPos.y);
        }, async () => {
            if (!Store.state.settings.pnlDocked) await Store.save();
        });
    },

    bindPnlEvents(root) {
        root.addEventListener('click', async (e) => {
            const t = e.target;
            // Allow inputs/labels to work normally
            if (t.matches('input, label')) return;

            const actEl = t.closest('[data-act]');
            if (!actEl) return;
            const act = actEl.getAttribute('data-act');

            e.preventDefault();
            e.stopPropagation();

            if (act === 'dock') {
                Store.state.settings.pnlDocked = !Store.state.settings.pnlDocked;
                await Store.save();
                this.updatePnlHud();
            }
            if (act === 'reset') {
                this.showResetModal();
            }
            if (act === 'trades') {
                const list = root.querySelector(".tradeList");
                if (list) {
                    list.style.display = list.style.display === 'none' ? 'block' : 'none';
                    this.updateTradeList(list);
                }
            }
            if (act === 'toggleTokenUnit') {
                Store.state.settings.tokenDisplayUsd = !Store.state.settings.tokenDisplayUsd;
                await Store.save();
                this.updatePnlHud();
            }
            if (act === 'toggleSessionUnit') {
                Store.state.settings.sessionDisplayUsd = !Store.state.settings.sessionDisplayUsd;
                await Store.save();
                this.updatePnlHud();
            }
            if (act === 'settings') {
                this.showSettingsModal();
            }
        });
    },

    updatePnlHud() {
        const root = OverlayManager.getContainer().querySelector('#' + IDS.pnlHud);
        if (!root || !Store.state) return;

        root.className = Store.state.settings.pnlDocked ? "docked" : "floating";
        if (!Store.state.settings.pnlDocked) {
            root.style.left = px(Store.state.settings.pnlPos.x);
            root.style.top = px(Store.state.settings.pnlPos.y);
            root.style.transform = "none";
        } else {
            root.style.left = "";
            root.style.top = "";
        }

        const s = Store.state;
        const unrealized = Trading.getUnrealizedPnl(s);

        const inp = root.querySelector('.startSolInput');
        if (document.activeElement !== inp) inp.value = s.settings.startSol;

        root.querySelector('[data-k="balance"]').textContent = `${Trading.fmtSol(s.session.balance)} SOL`;

        const realized = s.session.realized || 0;
        const totalPnl = realized + unrealized;

        const pnlEl = root.querySelector('[data-k="pnl"]');
        pnlEl.textContent = (totalPnl >= 0 ? "+" : "") + Trading.fmtSol(totalPnl) + " SOL";
        pnlEl.style.color = totalPnl >= 0 ? "#10b981" : "#ef4444";

        const streakEl = root.querySelector('[data-k="streak"]');
        const winStreak = s.session.winStreak || 0;
        const lossStreak = s.session.lossStreak || 0;

        if (lossStreak > 0) {
            streakEl.textContent = "-" + lossStreak;
            streakEl.parentElement.className = "stat streak loss";
        } else {
            streakEl.textContent = winStreak;
            streakEl.parentElement.className = winStreak > 0 ? "stat streak win" : "stat streak";
        }

        const discEl = root.querySelector('[data-k="discipline"]');
        if (discEl) {
            const score = s.session.disciplineScore !== undefined ? s.session.disciplineScore : 100;
            discEl.textContent = score;

            // Color logic
            let color = '#94a3b8'; // Default
            if (score >= 90) color = '#10b981'; // Green
            else if (score < 70) color = '#ef4444'; // Red
            else if (score < 90) color = '#f59e0b'; // Orange

            discEl.style.color = color;
        }
    },

    // --- BUY HUD ---
    mountBuyHud() {
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
            this.renderBuyHudContent(root);
            this.setupBuyHudInteractions(root);
        }

        // Always refresh content on mount to sync tabs
        this.renderBuyHudContent(root);
    },

    renderBuyHudContent(root) {
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
        this.bindHeaderDrag(root);
    },

    renderQuickButtons(isBuy) {
        const values = isBuy
            ? Store.state.settings.quickBuySols
            : Store.state.settings.quickSellPcts;

        return values.map(v => `
            <button class="qbtn" data-act="quick" data-val="${v}">${v}${isBuy ? ' SOL' : '%'}</button>
        `).join('');
    },

    bindHeaderDrag(root) {
        const header = root.querySelector('.panelHeader');
        if (!header) return;

        this.makeDraggable(header, (dx, dy) => {
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
        // Drag logic moved to bindHeaderDrag() called in render()
        // Here we just handle global clicks (delegation) which survive innerHTML updates 
        // IF the listener is on 'root' (which it is).

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
                const strategy = strategyEl ? strategyEl.value : "Trend";

                if (val <= 0) {
                    if (status) status.textContent = "Invalid amount";
                    return;
                }

                status.textContent = "Executing...";

                // Capture token info
                const tokenInfo = this.getCurrentToken();
                console.log(`[HUD] Action Clicked. Token: ${tokenInfo.symbol} (${tokenInfo.mint})`);

                let res;
                if (this.buyHudTab === 'buy') {
                    // Buy (val is numeric SOL amount)
                    res = await Trading.buy(val, strategy, tokenInfo);
                } else {
                    // Sell (val is %, strategy, tokenInfo)
                    res = await Trading.sell(val, strategy, tokenInfo);
                }

                if (res.success) {
                    status.textContent = "Trade executed!";
                    field.value = "";
                    this.updateAll();
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
        if (Store.state.settings.showJournal === false) return; // Check setting

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
    },

    updateBuyHud() {
        const root = OverlayManager.getContainer().querySelector('#' + IDS.buyHud);
        if (!root || !Store.state) return;

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
    },

    getCurrentToken() {
        let symbol = 'SOL';
        let mint = 'So11111111111111111111111111111111111111112';

        try {
            // 1. Try URL for Mint (Most reliable on Padre/Axiom)
            // URL: /trade/solana/MINTADDRESS
            const url = window.location.href;

            // 1. Try URL for Mint (Regex Scanner)
            const mintMatch = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
            if (mintMatch) {
                // Usually the last long string is the mint
                const candidate = mintMatch[mintMatch.length - 1];
                if (candidate && candidate.length > 30) {
                    mint = candidate;
                }
            }

            // 2. Try Title for Symbol (e.g. "APEPE $2.47K | Terminal")
            const title = document.title;
            const titleParts = title.trim().split(/[\s|/]+/);

            // Check for specific "Ticker | Platform" format
            if (titleParts.length > 0) {
                let first = titleParts[0].toUpperCase();
                // Exclude generic platform names
                const generics = ['PADRE', 'TERMINAL', 'AXIOM', 'SOLANA', 'TRADE', 'DEX', 'CHART'];

                if (!generics.includes(first) && first.length < 15 && first.length > 1) {
                    symbol = first;
                }
            }

            // 3. Fallback: Search for Ticker in Header/MUI Elements
            if (symbol === 'SOL' || symbol === 'TERMINAL' || symbol.includes('SEARCH')) {
                // Look for standard Padre ticker spans
                const tickerSpans = document.querySelectorAll('span[class*="css-1oo1vsz"]');
                for (const s of tickerSpans) {
                    const txt = s.textContent.trim().toUpperCase();
                    // Filter out known generics and placeholders
                    const bad = ['PADRE', 'TERMINAL', 'AXIOM', 'SOLANA', 'TRADE', 'DEX', 'CHART', 'SEARCH BY NAME OR CA...'];
                    if (txt && !bad.includes(txt) && txt.length < 15 && txt.length > 1) {
                        symbol = txt;
                        break;
                    }
                }

                if (symbol === 'SOL' || symbol.includes('SEARCH')) {
                    // Look for SYMBOL/SOL pattern in all spans
                    const spans = document.querySelectorAll('span, div');
                    for (const s of spans) {
                        const t = s.textContent.trim();
                        if (t.includes('/') && t.includes('SOL') && t.length < 20) {
                            const potential = t.split('/')[0].trim().toUpperCase();
                            if (potential.length > 1 && potential.length < 10) {
                                symbol = potential;
                                break;
                            }
                        }
                    }
                }
            }

        } catch (e) {
            console.warn('[HUD] Token scrape failed', e);
        }

        return { symbol, mint };
    },

    // --- Utils ---
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
    },

    showResetModal() {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        overlay.innerHTML = `
            <div class="confirm-modal">
                <h3>Reset Session?</h3>
                <p>Clear all history and restore balance?</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">Reset</button>
                </div>
            </div>
        `;
        OverlayManager.getContainer().appendChild(overlay);

        overlay.querySelector('.cancel').onclick = () => overlay.remove();
        overlay.querySelector('.confirm').onclick = async () => {
            Store.state.session.balance = Store.state.settings.startSol;
            Store.state.session.realized = 0;
            Store.state.session.winStreak = 0;
            Store.state.session.lossStreak = 0;
            Store.state.session.trades = [];
            Store.state.trades = {};
            Store.state.positions = {};
            await Store.save();
            this.updateAll();
            overlay.remove();
        };
    },

    showSettingsModal() {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';

        const isShadow = Store.state.settings.tradingMode === 'shadow';

        overlay.innerHTML = `
            <div class="settings-modal">
                <div class="settings-header">
                    <div class="settings-title">
                        <span>⚙️</span> Settings
                    </div>
                    <button class="settings-close">×</button>
                </div>
                
                <div class="setting-row">
                    <div class="setting-info">
                        <div class="setting-name">Shadow Real Mode</div>
                        <div class="setting-desc">Tag trades as "Real" for journaling. Changes UI theme.</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="toggle-shadow" ${isShadow ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="setting-row" style="opacity:0.5; pointer-events:none;">
                    <div class="setting-info">
                        <div class="setting-name">Discipline Score</div>
                        <div class="setting-desc">Track rule adherence (Coming Soon).</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox">
                        <span class="slider"></span>
                    </label>
                </div>

                <div style="margin-top:20px; text-align:center; font-size:11px; color:#64748b;">
                    ZERØ v${Store.state.version || '0.9.9'}
                </div>
            </div>
        `;

        OverlayManager.getContainer().appendChild(overlay);

        // Close logic
        const close = () => {
            overlay.remove();
            this.updateAll(); // Refresh UI to apply themes
        };
        overlay.querySelector('.settings-close').onclick = close;
        const bg = overlay;
        bg.addEventListener('click', (e) => { if (e.target === bg) close(); });

        // Toggle Logic
        const shadowToggle = overlay.querySelector('#toggle-shadow');
        shadowToggle.onchange = async (e) => {
            const val = e.target.checked;
            Store.state.settings.tradingMode = val ? 'shadow' : 'paper';
            await Store.save();

            // Apply visual class immediately
            const container = OverlayManager.getContainer();
            if (val) container.classList.add('zero-shadow-mode');
            else container.classList.remove('zero-shadow-mode');
        };
    },

    updateTradeList(container) {
        const trades = Store.state.session.trades || [];
        const tradeObjs = trades.map(id => Store.state.trades[id]).filter(t => t).reverse();

        let html = '';
        tradeObjs.forEach(t => {
            const isBuy = t.side === 'BUY';
            let valStr = '';
            let pnlClass = 'muted';

            if (isBuy) {
                valStr = `${t.solAmount?.toFixed(3) || '0.1'} SOL`;
            } else {
                const isWin = (t.realizedPnlSol || 0) > 0;
                pnlClass = isWin ? 'buy' : (t.realizedPnlSol < 0 ? 'sell' : 'muted');
                valStr = (t.realizedPnlSol ? (t.realizedPnlSol > 0 ? '+' : '') + t.realizedPnlSol.toFixed(4) : '0.00') + ' SOL';
            }

            html += `
                <div class="tradeRow">
                    <div class="muted" style="font-size:9px;">${new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div class="tag ${t.side.toLowerCase()}">${t.side}</div>
                    <div style="flex:1;">${t.symbol}</div>
                    <div class="${pnlClass}">${valStr}</div>
                </div>
            `;
        });
        container.innerHTML = html || '<div style="padding:10px;color:#64748b;text-align:center;">No trades yet</div>';
    }
};

function px(n) { return n + 'px'; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
