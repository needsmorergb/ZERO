import { Store } from '../store.js';
import { DiagnosticsStore } from '../diagnostics-store.js';
import { OverlayManager } from './overlay.js';
import { FeatureManager } from '../featureManager.js';
import { Trading } from '../core/trading.js';
import { IDS } from './ids.js';
import { TokenDetector } from './token-detector.js';
import { Paywall } from './paywall.js';
import { Analytics } from '../core/analytics.js';
import { Dashboard } from './dashboard.js';
import { Insights } from './insights.js';
import { SettingsPanel } from './settings-panel.js';
import { Market } from '../core/market.js';
import { CoachingEvaluator } from '../core/coaching-evaluator.js';
import { CoachingBanner } from './coaching-banner.js';
import { CoachingFeedback } from '../core/coaching-feedback.js';

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
                <div class="title"><div><span class="dot"></span> ZERØ PNL</div><span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);margin-left:10px;">TOKEN</span></div>
                <div class="controls">
                  <div class="startSol">
                    <span style="font-weight:700;color:rgba(203,213,225,0.92);font-size:10px;">Start</span>
                    <input class="startSolInput" type="text" inputmode="decimal" />
                  </div>
                  <button class="pillBtn" data-act="shareX" style="background:rgba(29,155,240,0.15);color:#1d9bf0;border:1px solid rgba(29,155,240,0.3);font-family:'Arial',sans-serif;font-weight:600;display:none;" id="pnl-share-btn">Share 𝕏</button>
                  <button class="pillBtn" data-act="trades">Trades</button>
                  <button class="pillBtn" data-act="dashboard" style="background:rgba(20,184,166,0.15);color:#14b8a6;border:1px solid rgba(20,184,166,0.3);font-weight:700;">Stats</button>
                  <button class="pillBtn" data-act="insights" style="background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);font-weight:700;">Insights</button>
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
                    <div class="k">DISCIPLINE</div>
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
        // Prevent key events from bubbling to the host page (e.g. platform hotkeys)
        root.addEventListener('keydown', (e) => {
            if (e.target.matches('input, select, textarea')) {
                e.stopPropagation();
            }
        });

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
            if (act === 'insights') {
                Insights.toggle();
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

        const shareBtn = root.querySelector('#pnl-share-btn');
        if (shareBtn) shareBtn.style.display = shareFlags.visible && !shareFlags.gated ? '' : 'none';

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

        // Calculate unrealized percentage using MC ratio (matches Padre logic)
        const currentMC = Market.marketCap || 0;
        let unrealizedPct = 0;
        for (const p of Object.values(s.positions || {})) {
            if (p && p.qtyTokens > 0 && p.entryMarketCapUsdReference > 0 && currentMC > 0) {
                unrealizedPct = ((currentMC / p.entryMarketCapUsdReference) - 1) * 100;
                break;
            }
        }
        // Fallback to invested-based percentage if MC not available
        if (unrealizedPct === 0 && unrealized !== 0) {
            const positions = Object.values(s.positions || {});
            const totalInvested = positions.reduce((sum, pos) => sum + (pos.totalSolSpent || 0), 0);
            unrealizedPct = totalInvested > 0 ? (unrealized / totalInvested) * 100 : 0;
        }

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
                tokenValueEl.textContent = (unrealized >= 0 ? "+" : "") + unrealized.toFixed(3) + ` (${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(1)}%)`;
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
                pnlEl.textContent = (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(3) + ` (${sessionPct >= 0 ? "+" : ""}${sessionPct.toFixed(1)}%)`;
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

        // Update Discipline visibility and value
        const discFlags = FeatureManager.resolveFlags(s, 'DISCIPLINE_SCORING');
        const discStatEl = root.querySelector('.stat.discipline');

        if (discStatEl) {
            discStatEl.style.display = (discFlags.visible && !discFlags.gated) ? '' : 'none';
        }

        // Update discipline score value
        const disciplineEl = root.querySelector('[data-k="discipline"]');
        if (disciplineEl) {
            disciplineEl.textContent = s.session.disciplineScore ?? 100;
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
                <h3>Reset current session?</h3>
                <p>This will clear current session stats and start a fresh run.<br>Your trade history and past sessions will not be deleted.</p>
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
                    <button class="confirm-modal-btn confirm">Reset session</button>
                </div>
            </div>
        `;
        OverlayManager.getContainer().appendChild(overlay);

        overlay.querySelector('.cancel').onclick = () => overlay.remove();
        overlay.querySelector('.confirm').onclick = async () => {
            // Use the new session management
            await Store.startNewSession();

            // Check if trial just expired on this session start
            if (Store._trialJustExpired) {
                Store._trialJustExpired = false;
                Paywall.showTrialExpiredModal();
            }

            Store.state.positions = {};
            await Store.save();

            // Clear markers from chart
            window.postMessage({ __paper: true, type: "PAPER_CLEAR_MARKERS" }, "*");

            // Trigger update through HUD
            if (window.ZeroHUD && window.ZeroHUD.updateAll) {
                window.ZeroHUD.updateAll();
            }
            overlay.remove();
        };
    },

    showDisciplineInfoModal() {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        overlay.style.zIndex = '2147483648';
        overlay.innerHTML = `
                <div class="confirm-modal" style="max-width:380px; text-align:center;">
                    <h3>Discipline scoring</h3>
                    <p style="font-size:13px; line-height:1.6; color:#94a3b8; margin-bottom:16px;">
                        Discipline scoring analyzes how consistently you follow your plan and manage risk. Available in Elite.
                    </p>
                    <div class="confirm-modal-buttons" style="justify-content:center;">
                        <button class="confirm-modal-btn cancel">Close</button>
                    </div>
                </div>
            `;
        OverlayManager.getContainer().appendChild(overlay);
        overlay.querySelector('.cancel').onclick = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    },

    showSettingsModal() {
        SettingsPanel.show();
    },

    updateTradeList(container) {
        const trades = Store.state.session.trades || [];
        const tradeObjs = trades.map(id => Store.state.trades[id]).filter(t => t).reverse();

        let html = '';
        tradeObjs.forEach(t => {
            // Normalize side: ENTRY->BUY, EXIT->SELL
            const side = t.side === 'ENTRY' ? 'BUY' : (t.side === 'EXIT' ? 'SELL' : t.side);
            const isBuy = side === 'BUY';
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
            const mc = t.marketCapUsdAtFill || t.marketCap || 0;
            let mcStr = '';
            if (mc > 0) {
                if (mc >= 1000000000) {
                    mcStr = `$${(mc / 1000000000).toFixed(2)}B`;
                } else if (mc >= 1000000) {
                    mcStr = `$${(mc / 1000000).toFixed(2)}M`;
                } else if (mc >= 1000) {
                    mcStr = `$${(mc / 1000).toFixed(1)}K`;
                } else {
                    mcStr = `$${mc.toFixed(0)}`;
                }
            }

            html += `
                <div class="tradeRow">
                    <div class="muted" style="font-size:9px;">${new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div class="tag ${side.toLowerCase()}">${side}</div>
                    <div style="flex:1;">
                        <div>${t.symbol}</div>
                    </div>
                    <div class="${pnlClass}" style="text-align:right;">
                        ${valStr}${mcStr ? ` <span class="muted" style="font-size:9px;opacity:0.8;">@ ${mcStr}</span>` : ''}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || '<div style="padding:10px;color:#64748b;text-align:center;">No trades yet</div>';
    },

    updatePositionsPanel(root) {
        const s = Store.state;
        const positions = Object.values(s.positions || {}).filter(p => p.qtyTokens > 0);
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
            let currentPrice = pos.lastMarkPriceUsd || pos.avgCostUsdPerToken || 0;

            // Calculate PnL using WAC method (consistent with header PNL)
            const currentValueUsd = pos.qtyTokens * currentPrice;
            const unrealizedPnlUsd = currentValueUsd - (pos.costBasisUsd || 0);
            const pnl = unrealizedPnlUsd / solUsd;
            const pnlPct = pos.costBasisUsd > 0 ? (unrealizedPnlUsd / pos.costBasisUsd) * 100 : 0;
            const isPositive = pnl >= 0;

            return `
                <div class="positionRow">
                    <div class="positionInfo">
                        <div class="positionSymbol">${pos.symbol || 'UNKNOWN'}</div>
                        <div class="positionDetails">
                            <span class="positionQty">${this.formatQty(pos.qtyTokens)} tokens</span>
                            <span class="positionPrices">Avg: $${this.formatPrice(pos.avgCostUsdPerToken)} → $${this.formatPrice(currentPrice)}</span>
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
        // For micro-cap tokens (e.g. $0.0000418), show full decimal instead of scientific notation
        const leadingZeros = Math.floor(-Math.log10(p));
        return p.toFixed(leadingZeros + 3);
    },

    async executeQuickSell(mint, pct) {
        const pos = Store.state.positions[mint];
        if (!pos) {
            console.error('[PnlHud] Position not found for mint:', mint);
            return;
        }

        // Find the token info for this position
        const tokenInfo = { symbol: pos.symbol, mint: pos.mint };

        // Live Trade Coaching - evaluate pre-trade signals (non-blocking)
        const coachingContext = {
            side: 'SELL',
            mint,
            pct,
            position: pos,
            currentPnl: Store.state.session?.realized || 0
        };
        const coaching = CoachingEvaluator.evaluate(coachingContext, Store.state);
        if (coaching) {
            CoachingBanner.show(
                coaching,
                (triggerId) => CoachingFeedback.recordDismiss(triggerId),
                (triggerId, duration) => CoachingFeedback.recordPause(triggerId, duration)
            );
            CoachingFeedback.recordShown(coaching.triggerId, coachingContext);
        }

        // Execute sell through Trading module
        const result = await Trading.sell(pct, 'Quick Sell', tokenInfo);

        if (result.success) {
            console.log(`[PnlHud] Quick sell ${pct}% of ${pos.symbol} successful`);

            // Draw SELL marker on chart
            if (result.trade && result.trade.id) {
                const fullTrade = (Store.state.trades && Store.state.trades[result.trade.id])
                    ? Store.state.trades[result.trade.id]
                    : (Store.state.fills ? Store.state.fills.find(f => f.id === result.trade.id) : null);
                if (fullTrade) {
                    const bridgeTrade = {
                        ...fullTrade,
                        side: fullTrade.side === 'ENTRY' ? 'BUY' : (fullTrade.side === 'EXIT' ? 'SELL' : fullTrade.side),
                        priceUsd: fullTrade.fillPriceUsd || fullTrade.priceUsd,
                        marketCap: fullTrade.marketCapUsdAtFill || fullTrade.marketCap
                    };
                    window.postMessage({ __paper: true, type: "PAPER_DRAW_MARKER", trade: bridgeTrade }, "*");
                }
            }

            // Update UI
            if (window.ZeroHUD && window.ZeroHUD.updateAll) {
                window.ZeroHUD.updateAll();
            }
        } else {
            console.error('[PnlHud] Quick sell failed:', result.error);
        }
    }
};
