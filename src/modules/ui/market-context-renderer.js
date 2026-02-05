/**
 * Shared Market Context Renderer
 * Stateless rendering functions for trust score, signals, and tabbed content.
 * Used by both BuyHud (Paper Mode Elite) and ShadowHud (Shadow/Analysis Mode).
 */

import { NarrativeTrust } from '../core/narrative-trust.js';
import { ICONS } from './icons.js';

export const MarketContextRenderer = {

    renderTrustSummary() {
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

    renderSignals() {
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

    renderTabs(activeTab, actName = 'tab') {
        const tabs = [
            { id: 'xAccount', label: 'X', icon: ICONS.TAB_X_ACCOUNT },
            { id: 'website', label: 'Website', icon: ICONS.TAB_WEBSITE },
            { id: 'developer', label: 'Dev', icon: ICONS.TAB_DEVELOPER }
        ];

        return `
            <div class="sh-tabs">
                ${tabs.map(t => `
                    <div class="sh-tab ${t.id === activeTab ? 'active' : ''}" data-act="${actName}" data-tab="${t.id}">
                        <span class="sh-tab-icon">${t.icon}</span> ${t.label}
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderTabContent(activeTab) {
        const vm = NarrativeTrust.getViewModel();

        if (!vm) {
            return '<div class="sh-empty">Fetching context data...</div>';
        }

        switch (activeTab) {
            case 'xAccount': return this.renderXAccountTab(vm.xAccount);
            case 'website': return this.renderWebsiteTab(vm.website);
            case 'developer': return this.renderDeveloperTab(vm.developer);
            default: return '';
        }
    },

    renderXAccountTab(x) {
        if (!x) return '';

        const enrichedRows = [
            { label: 'Age', f: x.age },
            { label: 'Followers', f: x.followers },
            { label: 'CA Mentions', f: x.caMentions },
            { label: 'Renames', f: x.renameCount },
        ].filter(r => r.f && r.f.status === 'ok')
         .map(r => this.field(r.label, r.f))
         .join('');

        let commHtml;
        const comm = x.communities;
        if (comm && comm.status === 'ok' && comm.items.length > 0) {
            const itemsHtml = comm.items.map(item => {
                const meta = [];
                if (item.memberCount != null) meta.push(`${item.memberCount} members`);
                if (item.activityLevel && item.activityLevel !== 'unknown') meta.push(item.activityLevel);
                const metaStr = meta.length > 0 ? ` <span style="opacity:0.6; font-size:10px;">(${meta.join(' \u00b7 ')})</span>` : '';
                return `<div class="nt-community-item"><a href="${item.url}" target="_blank" rel="noopener" style="color:#a78bfa; text-decoration:none;">${this.escapeHtml(item.name)}</a>${metaStr}</div>`;
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
            ${this.field('Account', x.handle)}
            ${this.field('URL', x.url)}
            ${enrichedRows}
            ${commHtml}
        `;
    },

    renderWebsiteTab(w) {
        if (!w) return '';
        return `
            ${this.field('Domain', w.domain)}
            ${this.field('URL', w.url)}
            ${this.field('Domain Age', w.domainAge)}
            ${this.field('Content', w.contentSummary)}
            ${this.field('Narrative', w.narrativeConsistency)}
        `;
    },

    renderDeveloperTab(d) {
        if (!d) return '';
        return `
            ${this.field('Deployer', d.knownLaunches)}
            ${this.field('Recent (30d)', d.recentLaunches)}
            ${this.field('Mint Age', d.historicalSummary)}
        `;
    },

    field(label, vmField) {
        let display, isUnavailable, isStale;

        if (vmField && typeof vmField === 'object' && 'display' in vmField) {
            display = vmField.display;
            isUnavailable = vmField.status !== 'ok' && vmField.status !== 'stale_cached';
            isStale = vmField.status === 'stale_cached';
        } else {
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

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
