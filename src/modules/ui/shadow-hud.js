/**
 * ZERO Shadow HUD
 * Dedicated HUD for Shadow Mode (Elite).
 * Renders ONLY when mode === 'shadow'. Completely removed from DOM otherwise.
 *
 * Three sections:
 * 1. Market Context (Narrative Trust) — collapsed/expanded with tabbed drawer
 * 2. Strategy (Declared) — editable dropdown
 * 3. Trade Notes — timestamped free-text notes
 *
 * Rules: Never auto-opens, never interrupts, never flashes, never suggests actions.
 */

import { Store } from '../store.js';
import { OverlayManager } from './overlay.js';
import { IDS } from './ids.js';
import { ICONS } from './icons.js';
import { NarrativeTrust } from '../core/narrative-trust.js';
import { TradeNotes } from '../core/trade-notes.js';
import { Market } from '../core/market.js';

function px(n) { return n + 'px'; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export const ShadowHud = {
    // UI state (not persisted — resets each page load)
    marketContextExpanded: false,
    strategyExpanded: true,
    notesExpanded: false,
    activeTab: 'xAccount', // 'xAccount' | 'website' | 'developer'

    makeDraggableRef: null,

    // ==================== Lifecycle ====================

    mountShadowHud(makeDraggable) {
        if (makeDraggable) this.makeDraggableRef = makeDraggable;
        const dragger = makeDraggable || this.makeDraggableRef;

        const container = OverlayManager.getContainer();
        if (!container) return;

        const rootId = IDS.shadowHud;
        let root = container.querySelector('#' + rootId);

        if (!Store.state?.settings?.enabled) {
            if (root) root.style.display = 'none';
            return;
        }
        if (root) {
            root.style.display = '';
            return; // Already mounted
        }

        // Create new root element
        root = document.createElement('div');
        root.id = rootId;

        const shadow = Store.state.shadow || {};
        root.className = shadow.hudDocked ? 'docked' : 'floating';
        if (!shadow.hudDocked) {
            const pos = shadow.hudPos || { x: 20, y: 400 };
            root.style.left = px(pos.x);
            root.style.top = px(pos.y);
        }

        container.appendChild(root);
        this.renderContent(root, dragger);
        this.bindEvents(root);

        // Subscribe to Narrative Trust updates
        NarrativeTrust.subscribe(() => {
            this._updateMarketContext(root);
        });
    },

    removeShadowHud() {
        const container = OverlayManager.getContainer();
        if (!container) return;
        const root = container.querySelector('#' + IDS.shadowHud);
        if (root) root.remove();
    },

    updateShadowHud() {
        const container = OverlayManager.getContainer();
        if (!container) return;
        const root = container.querySelector('#' + IDS.shadowHud);
        if (!root || !Store.state) return;

        if (!Store.state.settings.enabled) {
            root.style.display = 'none';
            return;
        }
        root.style.display = '';

        const shadow = Store.state.shadow || {};
        root.className = shadow.hudDocked ? 'docked' : 'floating';
        if (!shadow.hudDocked) {
            const pos = shadow.hudPos || { x: 20, y: 400 };
            root.style.left = px(pos.x);
            root.style.top = px(pos.y);
        }

        this._updateMarketContext(root);
        this._updateNotesList(root);
    },

    // ==================== Rendering ====================

    renderContent(root, makeDraggable) {
        const shadow = Store.state?.shadow || {};
        const strategies = Store.state?.settings?.strategies || ['Trend', 'Breakout', 'Reversal', 'Scalp', 'News', 'Other'];
        const currentStrategy = shadow.declaredStrategy || strategies[0];

        root.innerHTML = `
            <div class="sh-card">
                <!-- Header -->
                <div class="sh-header">
                    <div class="sh-header-left">
                        <div class="sh-header-icon">${ICONS.SHADOW_HUD_ICON}</div>
                        <div class="sh-header-title">ZERØ — Shadow Mode</div>
                    </div>
                    <div class="sh-header-btns">
                        <button class="sh-btn" data-act="dock">${shadow.hudDocked ? 'Float' : 'Dock'}</button>
                    </div>
                </div>
                <div class="sh-subtitle">Real trade analysis · Observation only</div>

                <!-- Section 1: Market Context -->
                <div class="sh-section" data-section="marketContext">
                    <div class="sh-section-header" data-act="toggle-section" data-target="marketContext">
                        <div class="sh-section-header-left">
                            <div class="sh-section-icon">${ICONS.TRUST_SHIELD}</div>
                            <div class="sh-section-title">Market Context</div>
                        </div>
                        <div class="sh-section-chevron ${this.marketContextExpanded ? 'expanded' : ''}">${ICONS.CHEVRON_DOWN}</div>
                    </div>
                    ${this._renderTrustSummary()}
                    ${this._renderSignals()}
                    <div class="sh-section-body ${this.marketContextExpanded ? '' : 'collapsed'}" data-body="marketContext">
                        ${this._renderTabs()}
                        <div class="sh-tab-content" data-tab-content>
                            ${this._renderTabContent()}
                        </div>
                    </div>
                </div>

                <!-- Section 2: Strategy (Declared) -->
                <div class="sh-section" data-section="strategy">
                    <div class="sh-section-header" data-act="toggle-section" data-target="strategy">
                        <div class="sh-section-header-left">
                            <div class="sh-section-icon">${ICONS.STRATEGY_COMPASS}</div>
                            <div class="sh-section-title">Strategy (declared)</div>
                        </div>
                        <div class="sh-section-chevron ${this.strategyExpanded ? 'expanded' : ''}">${ICONS.CHEVRON_DOWN}</div>
                    </div>
                    <div class="sh-section-body ${this.strategyExpanded ? '' : 'collapsed'}" data-body="strategy">
                        <div class="sh-strategy-label">Current strategy</div>
                        <select class="sh-strategy-select" data-act="strategy-change">
                            ${strategies.map(s => `<option value="${s}" ${s === currentStrategy ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Section 3: Trade Notes -->
                <div class="sh-section" data-section="notes">
                    <div class="sh-section-header" data-act="toggle-section" data-target="notes">
                        <div class="sh-section-header-left">
                            <div class="sh-section-icon">${ICONS.NOTES_DOC}</div>
                            <div class="sh-section-title">Trade Notes</div>
                        </div>
                        <div class="sh-section-chevron ${this.notesExpanded ? 'expanded' : ''}">${ICONS.CHEVRON_DOWN}</div>
                    </div>
                    <div class="sh-section-body ${this.notesExpanded ? '' : 'collapsed'}" data-body="notes">
                        <div class="sh-notes-input">
                            <textarea class="sh-notes-textarea" data-act="note-input" placeholder="Add a note..." maxlength="280" rows="1"></textarea>
                            <button class="sh-notes-add" data-act="add-note">Add</button>
                        </div>
                        <div class="sh-note-char-count" data-char-count></div>
                        <div class="sh-notes-list" data-notes-list>
                            ${this._renderNotesList()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindDrag(root, makeDraggable);
    },

    // ==================== Market Context Rendering ====================

    _renderTrustSummary() {
        const data = NarrativeTrust.getData();
        const score = data.score;
        const confidence = data.confidence;
        const isLoading = NarrativeTrust.loading;

        if (isLoading) {
            return `
                <div class="sh-trust-summary sh-trust-loading-state">
                    <div class="sh-loading-text">Scanning market context...</div>
                    <div class="sh-loading-bar"><div class="sh-loading-bar-fill"></div></div>
                </div>
            `;
        }

        if (score === null) {
            return `
                <div class="sh-trust-summary">
                    <div class="sh-trust-score">Trust: <span class="score-val">--</span>/100</div>
                    <div class="sh-trust-bar"><div class="sh-trust-bar-fill" style="width:0%"></div></div>
                    <span class="sh-confidence-badge low">no data</span>
                </div>
            `;
        }

        const barClass = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
        return `
            <div class="sh-trust-summary">
                <div class="sh-trust-score">Trust: <span class="score-val">${score}</span>/100</div>
                <div class="sh-trust-bar"><div class="sh-trust-bar-fill ${barClass}" style="width:${score}%"></div></div>
                <span class="sh-confidence-badge ${confidence}">${confidence}</span>
            </div>
        `;
    },

    _renderSignals() {
        const isLoading = NarrativeTrust.loading;
        if (isLoading) {
            return `<div class="sh-signals"><span class="sh-signal-label sh-signal-loading">Waiting for data...</span></div>`;
        }

        const signals = NarrativeTrust.getSignals();
        const items = [
            { key: 'xAccountAge', label: 'X' },
            { key: 'recentActivity', label: 'Activity' },
            { key: 'xCommunities', label: 'X Comm' },
            { key: 'developerHistory', label: 'Dev' }
        ];

        // Only count signals that are actually present (not unavailable)
        const presentCount = items.filter(item => signals[item.key] !== 'unavailable').length;

        return `
            <div class="sh-signals">
                ${items.map(item => {
                    const val = signals[item.key];
                    const cls = val === 'unavailable' ? 'unavailable' : (val === 'detected' || val === 'active' || val === 'established' || val === 'known') ? 'positive' : 'neutral';
                    return `<div class="sh-signal-dot ${cls}" title="${item.label}: ${val}"></div>`;
                }).join('')}
                <span class="sh-signal-label">${presentCount} of ${items.length} signals</span>
            </div>
        `;
    },

    _renderTabs() {
        const tabs = [
            { id: 'xAccount', label: 'X', icon: ICONS.TAB_X_ACCOUNT },
            { id: 'website', label: 'Website', icon: ICONS.TAB_WEBSITE },
            { id: 'developer', label: 'Dev', icon: ICONS.TAB_DEVELOPER }
        ];

        return `
            <div class="sh-tabs">
                ${tabs.map(t => `
                    <div class="sh-tab ${t.id === this.activeTab ? 'active' : ''}" data-act="tab" data-tab="${t.id}">
                        <span class="sh-tab-icon">${t.icon}</span> ${t.label}
                    </div>
                `).join('')}
            </div>
        `;
    },

    _renderTabContent() {
        const vm = NarrativeTrust.getViewModel();

        // VM not yet available (loading or pre-fetch)
        if (!vm) {
            return '<div class="sh-empty">Fetching context data...</div>';
        }

        switch (this.activeTab) {
            case 'xAccount': return this._renderXAccountTab(vm.xAccount);
            case 'website': return this._renderWebsiteTab(vm.website);
            case 'developer': return this._renderDeveloperTab(vm.developer);
            default: return '';
        }
    },

    _renderXAccountTab(x) {
        if (!x) return '';

        // Enriched rows — only render when status === 'ok' (real data present)
        const enrichedRows = [
            { label: 'Age', f: x.age },
            { label: 'Followers', f: x.followers },
            { label: 'CA Mentions', f: x.caMentions },
            { label: 'Renames', f: x.renameCount },
        ].filter(r => r.f && r.f.status === 'ok')
         .map(r => this._field(r.label, r.f))
         .join('');

        // X Communities — always shown
        let commHtml;
        const comm = x.communities;
        if (comm && comm.status === 'ok' && comm.items.length > 0) {
            const itemsHtml = comm.items.map(item => {
                const meta = [];
                if (item.memberCount != null) meta.push(`${item.memberCount} members`);
                if (item.activityLevel && item.activityLevel !== 'unknown') meta.push(item.activityLevel);
                const metaStr = meta.length > 0 ? ` <span style="opacity:0.6; font-size:10px;">(${meta.join(' \u00b7 ')})</span>` : '';
                return `<div class="nt-community-item"><a href="${item.url}" target="_blank" rel="noopener" style="color:#a78bfa; text-decoration:none;">${this._escapeHtml(item.name)}</a>${metaStr}</div>`;
            }).join('');
            commHtml = `
                <div class="nt-section-divider" style="margin:8px 0 4px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                    <div class="nt-label" style="font-weight:600; margin-bottom:4px;">X Communities</div>
                    ${itemsHtml}
                </div>
            `;
        } else {
            commHtml = `
                <div class="nt-section-divider" style="margin:8px 0 4px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                    <div class="nt-field unavailable"><div class="nt-label">X Communities</div><div class="nt-value">No X community detected</div></div>
                </div>
            `;
        }

        return `
            ${this._field('Account', x.handle)}
            ${this._field('URL', x.url)}
            ${enrichedRows}
            ${commHtml}
        `;
    },

    _renderWebsiteTab(w) {
        if (!w) return '';
        return `
            ${this._field('Domain', w.domain)}
            ${this._field('URL', w.url)}
            ${this._field('Domain Age', w.domainAge)}
            ${this._field('Content', w.contentSummary)}
            ${this._field('Narrative', w.narrativeConsistency)}
        `;
    },

    _renderDeveloperTab(d) {
        if (!d) return '';
        return `
            ${this._field('Deployer', d.knownLaunches)}
            ${this._field('Mint Auth', d.mintAuthority)}
            ${this._field('Freeze Auth', d.freezeAuthority)}
            ${this._field('Metadata', d.metadataMutable)}
            ${this._field('Dev Holdings', d.devHoldings)}
            ${this._field('Dev SOL', d.deployerBalance)}
            ${this._field('Wallet Age', d.deployerAge)}
            ${this._field('Dev Tokens', d.recentLaunches)}
            ${this._field('Recent (7d)', d.recentMints7d)}
            ${this._field('Mint Age', d.historicalSummary)}
        `;
    },

    /**
     * Render a key-value field. Accepts a VMField { display, status } or a raw string.
     * Never outputs "Data unavailable". Uses status-aware display text.
     */
    _field(label, vmField) {
        let display, isUnavailable, isStale;

        if (vmField && typeof vmField === 'object' && 'display' in vmField) {
            // VMField from view-model.js
            display = vmField.display;
            isUnavailable = vmField.status !== 'ok' && vmField.status !== 'stale_cached';
            isStale = vmField.status === 'stale_cached';
        } else {
            // Raw string fallback (legacy / direct values)
            display = vmField || 'Not detected';
            isUnavailable = !vmField || vmField === 'unavailable';
            isStale = false;
        }

        const cls = isUnavailable ? 'unavailable' : isStale ? 'stale' : '';
        return `
            <div class="nt-field ${cls}">
                <div class="nt-label">${label}</div>
                <div class="nt-value">${display}</div>
            </div>
        `;
    },

    // ==================== Notes Rendering ====================

    _renderNotesList() {
        const notes = TradeNotes.getSessionNotes();
        if (notes.length === 0) {
            return '<div class="sh-empty">No notes this session</div>';
        }

        return notes.map(note => {
            const time = new Date(note.ts);
            const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            return `
                <div class="sh-note" data-note-id="${note.id}">
                    <div class="sh-note-time">${timeStr}</div>
                    <div class="sh-note-text">${this._escapeHtml(note.text)}</div>
                    <div class="sh-note-actions">
                        <button class="sh-note-action" data-act="delete-note" data-note-id="${note.id}" title="Delete">${ICONS.X}</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ==================== Partial Updates ====================

    _updateMarketContext(root) {
        if (!root) return;

        // Update trust summary
        const summaryEl = root.querySelector('.sh-trust-summary');
        if (summaryEl) {
            summaryEl.outerHTML = this._renderTrustSummary();
        }

        // Update signals
        const signalsEl = root.querySelector('.sh-signals');
        if (signalsEl) {
            signalsEl.outerHTML = this._renderSignals();
        }

        // Update tab content if expanded
        if (this.marketContextExpanded) {
            const tabContent = root.querySelector('[data-tab-content]');
            if (tabContent) {
                tabContent.innerHTML = this._renderTabContent();
            }
        }
    },

    _updateNotesList(root) {
        if (!root) return;
        const listEl = root.querySelector('[data-notes-list]');
        if (listEl) {
            listEl.innerHTML = this._renderNotesList();
        }
    },

    // ==================== Event Binding ====================

    bindEvents(root) {
        // Click delegation
        root.addEventListener('click', async (e) => {
            const t = e.target;

            // Allow inputs/selects
            if (t.matches('input, select, textarea, option')) return;

            const actEl = t.closest('[data-act]');
            if (!actEl) return;

            const act = actEl.getAttribute('data-act');
            e.preventDefault();
            e.stopPropagation();

            if (act === 'toggle-section') {
                const target = actEl.getAttribute('data-target');
                this._toggleSection(root, target);
            }

            if (act === 'tab') {
                const tab = actEl.getAttribute('data-tab');
                this._switchTab(root, tab);
            }

            if (act === 'dock') {
                const shadow = Store.state.shadow || {};
                shadow.hudDocked = !shadow.hudDocked;
                Store.state.shadow = shadow;
                await Store.save();
                root.className = shadow.hudDocked ? 'docked' : 'floating';
                actEl.textContent = shadow.hudDocked ? 'Float' : 'Dock';
                if (!shadow.hudDocked) {
                    const pos = shadow.hudPos || { x: 20, y: 400 };
                    root.style.left = px(pos.x);
                    root.style.top = px(pos.y);
                }
            }

            if (act === 'add-note') {
                const textarea = root.querySelector('.sh-notes-textarea');
                if (textarea && textarea.value.trim()) {
                    await TradeNotes.addNote(textarea.value);
                    textarea.value = '';
                    this._updateNotesList(root);
                    const charCount = root.querySelector('[data-char-count]');
                    if (charCount) charCount.textContent = '';
                }
            }

            if (act === 'delete-note') {
                const noteId = actEl.getAttribute('data-note-id');
                if (noteId) {
                    await TradeNotes.deleteNote(noteId);
                    this._updateNotesList(root);
                }
            }
        });

        // Strategy change
        root.addEventListener('change', async (e) => {
            if (e.target.matches('.sh-strategy-select')) {
                if (!Store.state.shadow) Store.state.shadow = {};
                Store.state.shadow.declaredStrategy = e.target.value;
                await Store.save();
            }
        });

        // Textarea char count
        root.addEventListener('input', (e) => {
            if (e.target.matches('.sh-notes-textarea')) {
                const charCount = root.querySelector('[data-char-count]');
                if (charCount) {
                    const len = e.target.value.length;
                    charCount.textContent = len > 0 ? `${len}/280` : '';
                }
            }
        });
    },

    _toggleSection(root, section) {
        if (section === 'marketContext') this.marketContextExpanded = !this.marketContextExpanded;
        if (section === 'strategy') this.strategyExpanded = !this.strategyExpanded;
        if (section === 'notes') this.notesExpanded = !this.notesExpanded;

        const body = root.querySelector(`[data-body="${section}"]`);
        if (body) {
            body.classList.toggle('collapsed');
        }

        const header = root.querySelector(`[data-target="${section}"]`);
        if (header) {
            const chevron = header.querySelector('.sh-section-chevron');
            if (chevron) chevron.classList.toggle('expanded');
        }
    },

    _switchTab(root, tab) {
        this.activeTab = tab;

        // Update tab active states
        root.querySelectorAll('.sh-tab').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-tab') === tab);
        });

        // Update tab content
        const tabContent = root.querySelector('[data-tab-content]');
        if (tabContent) {
            tabContent.innerHTML = this._renderTabContent();
        }
    },

    // ==================== Drag ====================

    bindDrag(root, makeDraggable) {
        const header = root.querySelector('.sh-header');
        if (!header || !makeDraggable) return;

        makeDraggable(header, (dx, dy) => {
            if (!Store.state.shadow || Store.state.shadow.hudDocked) return;
            const pos = Store.state.shadow.hudPos || { x: 20, y: 400 };
            pos.x = clamp(pos.x + dx, 0, window.innerWidth - 40);
            pos.y = clamp(pos.y + dy, 34, window.innerHeight - 40);
            Store.state.shadow.hudPos = pos;
            root.style.left = px(pos.x);
            root.style.top = px(pos.y);
        }, async () => {
            if (Store.state.shadow && !Store.state.shadow.hudDocked) {
                await Store.save();
            }
        });
    }
};
