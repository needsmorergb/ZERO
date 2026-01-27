import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { FeatureManager } from '../featureManager.js';
import { Trading } from '../core/trading.js';
import { IDS } from './ids.js';
import { TokenDetector } from './token-detector.js';
import { Paywall } from './paywall.js';
import { Analytics } from '../core/analytics.js';
import { Dashboard } from './dashboard.js';
import { SettingsPanel } from './settings-panel.js';

function px(n) { return n + 'px'; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Positions panel state
let positionsExpanded = false;

export const PnlHud = {
    mountPnlHud(makeDraggable) {
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

        // Check if we need to re-render
        const CURRENT_UI_VERSION = "1.12.0";
        const renderedVersion = root.dataset.uiVersion;

        if (isNew || renderedVersion !== CURRENT_UI_VERSION) {
            this.renderPnlHudContent(root, makeDraggable);
            root.dataset.uiVersion = CURRENT_UI_VERSION;
        }
    },

    renderPnlHudContent(root, makeDraggable) {
        root.innerHTML = `
            <div class="card">
              <div class="header">
                <div class="title" style="display:flex;align-items:center;justify-content:space-between;flex:1;"><div><span class="dot"></span> ZERØ PNL</div><span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);">TOKEN</span></div>
                <div class="controls">
                  <div class="startSol">
                    <span style="font-weight:700;color:rgba(203,213,225,0.92);">Start SOL</span>
                    <input class="startSolInput" type="text" inputmode="decimal" />
                  </div>
                  <button class="pillBtn" data-act="shareX" style="background:rgba(29,155,240,0.15);color:#1d9bf0;border:1px solid rgba(29,155,240,0.3);font-family:'Arial',sans-serif;font-weight:600;display:none;" id="pnl-share-btn">Share 𝕏</button>
                  <button class="pillBtn" data-act="getPro" style="background:rgba(99,102,241,0.15);color:#6366f1;border:1px solid rgba(99,102,241,0.3);font-weight:700;display:none;align-items:center;gap:4px;" id="pnl-pro-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>PRO</button>
                  <button class="pillBtn" data-act="trades">Trades</button>
                  <button class="pillBtn" data-act="dashboard" style="background:rgba(20,184,166,0.15);color:#14b8a6;border:1px solid rgba(20,184,166,0.3);font-weight:700;">Stats</button>
                  <button class="pillBtn" data-act="reset" style="color:#ef4444;">Reset</button>
                  <button class="pillBtn" data-act="settings" style="padding:6px 10px;font-size:16px;">⚙</button>
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
                    <div class="k">DISCIPLINE <span class="pro-tag" style="display:none;" id="discipline-pro-tag">PRO</span></div>
                    <div class="v" data-k="discipline">100</div>
                </div>
              </div>
              <div class="positionsPanel">
                <div class="positionsHeader" data-act="togglePositions">
                  <div class="positionsTitle">
                    <span>POSITIONS</span>
                    <span class="positionCount" data-k="positionCount">(0)</span>
                  </div>
                  <span class="positionsToggle">▼</span>
                </div>
                <div class="positionsList" style="display:none;" data-k="positionsList"></div>
              </div>
              <div class="tradeList" style="display:none;"></div>
            </div>
         `;

        // Re-bind drag because header element is new
        this.bindPnlDrag(root, makeDraggable);

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

    bindPnlDrag(root, makeDraggable) {
        const header = root.querySelector(".header");
        if (!header || !makeDraggable) return;

        makeDraggable(header, (dx, dy) => {
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
            if (act === 'dashboard') {
                Dashboard.toggle();
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
            if (act === 'shareX') {
                this.shareToX();
            }
            if (act === 'getPro') {
                Paywall.showUpgradeModal();
            }
            if (act === 'togglePositions') {
                positionsExpanded = !positionsExpanded;
                this.updatePositionsPanel(root);
            }
            if (act === 'quickSell') {
                const mint = actEl.getAttribute('data-mint');
                const pct = parseFloat(actEl.getAttribute('data-pct'));
                await this.executeQuickSell(mint, pct);
            }
        });
    },

    shareToX() {
        const shareText = Analytics.generateXShareText(Store.state);
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank', 'width=550,height=420');
        console.log('[PNL HUD] Sharing session to X');
    },

    async updatePnlHud() {
        const root = OverlayManager.getContainer().querySelector('#' + IDS.pnlHud);
        if (!root || !Store.state) return;

        const s = Store.state;
        const shareFlags = FeatureManager.resolveFlags(s, 'SHARE_TO_X');
        const proFlags = FeatureManager.resolveFlags(s, 'SHARE_TO_X'); // Combined check for now

        const shareBtn = root.querySelector('#pnl-share-btn');
        const proBtn = root.querySelector('#pnl-pro-btn');

        if (shareBtn) shareBtn.style.display = shareFlags.visible && !shareFlags.gated ? '' : 'none';
        if (proBtn) proBtn.style.display = (s.settings.tier === 'free') ? 'flex' : 'none';

        // Visibility Toggle
        if (!Store.state.settings.enabled) {
            root.style.display = 'none';
            return;
        }
        root.style.display = '';

        root.className = Store.state.settings.pnlDocked ? "docked" : "floating";
        if (!Store.state.settings.pnlDocked) {
            root.style.left = px(Store.state.settings.pnlPos.x);
            root.style.top = px(Store.state.settings.pnlPos.y);
            root.style.transform = "none";
        } else {
            root.style.left = "";
            root.style.top = "";
        }

        const solUsd = Trading.getSolPrice();

        // Detect current token to update its position price in real-time
        const currentToken = TokenDetector.getCurrentToken();
        const unrealized = Trading.getUnrealizedPnl(s, currentToken.mint);

        const inp = root.querySelector('.startSolInput');
        if (document.activeElement !== inp) inp.value = s.settings.startSol;

        root.querySelector('[data-k="balance"]').textContent = `${Trading.fmtSol(s.session.balance)} SOL`;

        // Calculate total invested for percentage
        const positions = Object.values(s.positions || {});
        const totalInvested = positions.reduce((sum, pos) => sum + (pos.totalSolSpent || 0), 0);
        const unrealizedPct = totalInvested > 0 ? (unrealized / totalInvested) * 100 : 0;

        // Update unrealized PNL display with percentage
        const tokenValueEl = root.querySelector('[data-k="tokenValue"]');
        const tokenUnitEl = root.querySelector('[data-k="tokenUnit"]');
        if (tokenValueEl && tokenUnitEl) {
            const showUsd = s.settings.tokenDisplayUsd;
            if (showUsd) {
                const unrealizedUsd = unrealized * solUsd;
                tokenValueEl.textContent = (unrealizedUsd >= 0 ? "+" : "") + "$" + Trading.fmtSol(Math.abs(unrealizedUsd));
                tokenUnitEl.textContent = "USD";
            } else {
                tokenValueEl.textContent = (unrealized >= 0 ? "+" : "") + Trading.fmtSol(unrealized) + ` (${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(1)}%)`;
                tokenUnitEl.textContent = "SOL";
            }
            tokenValueEl.style.color = unrealized >= 0 ? "#10b981" : "#ef4444";
        }

        const realized = s.session.realized || 0;
        const totalPnl = realized + unrealized;
        const startBalance = s.settings.startSol || 10;
        const sessionPct = ((totalPnl / startBalance) * 100);

        const pnlEl = root.querySelector('[data-k="pnl"]');
        const pnlUnitEl = root.querySelector('[data-k="pnlUnit"]');
        if (pnlEl && pnlUnitEl) {
            const showUsd = s.settings.sessionDisplayUsd;
            if (showUsd) {
                const totalPnlUsd = totalPnl * solUsd;
                pnlEl.textContent = (totalPnlUsd >= 0 ? "+" : "") + "$" + Trading.fmtSol(Math.abs(totalPnlUsd));
                pnlUnitEl.textContent = "USD";
            } else {
                pnlEl.textContent = (totalPnl >= 0 ? "+" : "") + Trading.fmtSol(totalPnl) + ` (${sessionPct >= 0 ? "+" : ""}${sessionPct.toFixed(1)}%)`;
                pnlUnitEl.textContent = "SOL";
            }
            pnlEl.style.color = totalPnl >= 0 ? "#10b981" : "#ef4444";
        }

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

        // Update Discipline visibility and gating
        const discFlags = FeatureManager.resolveFlags(s, 'DISCIPLINE_SCORING');
        const discStatEl = root.querySelector('.stat.discipline');
        const discProTag = root.querySelector('#discipline-pro-tag');

        if (discStatEl) {
            discStatEl.style.display = discFlags.visible ? '' : 'none';
            if (discProTag) discProTag.style.display = discFlags.gated ? '' : 'none';

            if (discFlags.gated) {
                discStatEl.style.opacity = '0.5';
                discStatEl.style.cursor = 'pointer';
                discStatEl.onclick = (e) => { e.stopPropagation(); Paywall.showUpgradeModal(); };
            } else {
                discStatEl.style.opacity = '1';
                discStatEl.style.cursor = 'default';
                discStatEl.onclick = null;
            }
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

        // Update token symbol in title
        const tokenSymbolEl = root.querySelector('[data-k="tokenSymbol"]');
        if (tokenSymbolEl) {
            const symbol = currentToken?.symbol || 'TOKEN';
            tokenSymbolEl.textContent = symbol;
        }

        // Update positions panel
        this.updatePositionsPanel(root);
    },

    showResetModal() {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        const duration = Store.getSessionDuration();
        const summary = Store.getSessionSummary();

        overlay.innerHTML = `
            <div class="confirm-modal">
                <h3>End Session?</h3>
                <p>This will archive your current session and start fresh.</p>
                ${summary && summary.tradeCount > 0 ? `
                    <div style="background:rgba(20,184,166,0.1); border:1px solid rgba(20,184,166,0.2); border-radius:8px; padding:10px; margin:12px 0; font-size:11px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color:#64748b;">Duration</span>
                            <span style="color:#f8fafc; font-weight:600;">${duration} min</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color:#64748b;">Trades</span>
                            <span style="color:#f8fafc; font-weight:600;">${summary.tradeCount}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span style="color:#64748b;">Win Rate</span>
                            <span style="color:#10b981; font-weight:600;">${summary.winRate}%</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#64748b;">P&L</span>
                            <span style="color:${summary.realized >= 0 ? '#10b981' : '#ef4444'}; font-weight:600;">${summary.realized >= 0 ? '+' : ''}${summary.realized.toFixed(4)} SOL</span>
                        </div>
                    </div>
                ` : ''}
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn cancel">Cancel</button>
                    <button class="confirm-modal-btn confirm">New Session</button>
                </div>
            </div>
        `;
        OverlayManager.getContainer().appendChild(overlay);

        overlay.querySelector('.cancel').onclick = () => overlay.remove();
        overlay.querySelector('.confirm').onclick = async () => {
            // Use the new session management
            await Store.startNewSession();

            // Clear positions for new session
            Store.state.positions = {};
            await Store.save();

            // Trigger update through HUD
            if (window.ZeroHUD && window.ZeroHUD.updateAll) {
                window.ZeroHUD.updateAll();
            }
            overlay.remove();
        };
    },

    showSettingsModal() {
        SettingsPanel.show();
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

            // Format market cap
            let mcStr = '';
            if (t.marketCap && t.marketCap > 0) {
                if (t.marketCap >= 1000000000) {
                    mcStr = `$${(t.marketCap / 1000000000).toFixed(2)}B`;
                } else if (t.marketCap >= 1000000) {
                    mcStr = `$${(t.marketCap / 1000000).toFixed(2)}M`;
                } else if (t.marketCap >= 1000) {
                    mcStr = `$${(t.marketCap / 1000).toFixed(1)}K`;
                } else {
                    mcStr = `$${t.marketCap.toFixed(0)}`;
                }
            }

            html += `
                <div class="tradeRow">
                    <div class="muted" style="font-size:9px;">${new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div class="tag ${t.side.toLowerCase()}">${t.side}</div>
                    <div style="flex:1;">
                        <div>${t.symbol}</div>
                        ${mcStr ? `<div class="muted" style="font-size:9px;">${mcStr} MC</div>` : ''}
                    </div>
                    <div class="${pnlClass}">${valStr}</div>
                </div>
            `;
        });
        container.innerHTML = html || '<div style="padding:10px;color:#64748b;text-align:center;">No trades yet</div>';
    },

    updatePositionsPanel(root) {
        const s = Store.state;
        const positions = Object.values(s.positions || {});
        const listEl = root.querySelector('[data-k="positionsList"]');
        const toggleIcon = root.querySelector('.positionsToggle');
        const countEl = root.querySelector('[data-k="positionCount"]');

        // Update count badge
        if (countEl) {
            countEl.textContent = `(${positions.length})`;
        }

        // Update toggle icon
        if (toggleIcon) {
            toggleIcon.textContent = positionsExpanded ? '▲' : '▼';
            toggleIcon.classList.toggle('expanded', positionsExpanded);
        }

        // Show/hide list
        if (listEl) {
            listEl.style.display = positionsExpanded ? 'block' : 'none';
            if (positionsExpanded) {
                listEl.innerHTML = this.renderPositionRows(positions);
            }
        }
    },

    renderPositionRows(positions) {
        if (positions.length === 0) {
            return '<div class="noPositions">No open positions</div>';
        }

        const solUsd = Trading.getSolPrice();
        const currentToken = TokenDetector.getCurrentToken();

        return positions.map(pos => {
            // Calculate current price (use live if viewing this token)
            let currentPrice = pos.lastPriceUsd || pos.entryPriceUsd;
            if (pos.mint === currentToken?.mint && currentPrice > 0) {
                // Use last known price, it gets updated when viewing the token
            }

            // Calculate PnL
            const valueUsd = pos.tokenQty * currentPrice;
            const valueSol = valueUsd / solUsd;
            const pnl = valueSol - pos.totalSolSpent;
            const pnlPct = pos.totalSolSpent > 0 ? (pnl / pos.totalSolSpent) * 100 : 0;
            const isPositive = pnl >= 0;

            return `
                <div class="positionRow">
                    <div class="positionInfo">
                        <div class="positionSymbol">${pos.symbol || 'UNKNOWN'}</div>
                        <div class="positionDetails">
                            <span class="positionQty">${this.formatQty(pos.tokenQty)}</span>
                            <span class="positionPrices">Entry: $${this.formatPrice(pos.entryPriceUsd)} → $${this.formatPrice(currentPrice)}</span>
                        </div>
                    </div>
                    <div class="positionPnl ${isPositive ? 'positive' : 'negative'}">
                        <div class="pnlValue">${isPositive ? '+' : ''}${Trading.fmtSol(pnl)} SOL</div>
                        <div class="pnlPct">${isPositive ? '+' : ''}${pnlPct.toFixed(1)}%</div>
                    </div>
                    <div class="quickSellBtns">
                        <button class="qSellBtn" data-act="quickSell" data-mint="${pos.mint}" data-pct="25">25%</button>
                        <button class="qSellBtn" data-act="quickSell" data-mint="${pos.mint}" data-pct="50">50%</button>
                        <button class="qSellBtn" data-act="quickSell" data-mint="${pos.mint}" data-pct="100">100%</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    formatQty(n) {
        if (!n || n <= 0) return '0';
        if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
        if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
        if (n >= 1) return n.toFixed(2);
        return n.toFixed(6);
    },

    formatPrice(p) {
        if (!p || p <= 0) return '0.00';
        if (p >= 1) return p.toFixed(4);
        if (p >= 0.0001) return p.toFixed(6);
        return p.toExponential(2);
    },

    async executeQuickSell(mint, pct) {
        const pos = Store.state.positions[mint];
        if (!pos) {
            console.error('[PnlHud] Position not found for mint:', mint);
            return;
        }

        // Find the token info for this position
        const tokenInfo = { symbol: pos.symbol, mint: pos.mint };

        // Execute sell through Trading module
        const result = await Trading.sell(pct, 'Quick Sell', tokenInfo);

        if (result.success) {
            console.log(`[PnlHud] Quick sell ${pct}% of ${pos.symbol} successful`);
            // Update UI
            if (window.ZeroHUD && window.ZeroHUD.updateAll) {
                window.ZeroHUD.updateAll();
            }
        } else {
            console.error('[PnlHud] Quick sell failed:', result.error);
        }
    }
};
