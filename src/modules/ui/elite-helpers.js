import { ICONS } from './icons.js';

/**
 * Render a locked Elite feature card with consistent UI.
 * Used in Dashboard, Settings, and Insights panels.
 * No upgrade CTA — payments not live. Informational only.
 */
export function renderEliteLockedCard(title, desc) {
    return `
        <div class="elite-locked-card">
            <div class="elite-locked-card-header">
                <div class="elite-locked-card-icon">${ICONS.LOCK}</div>
                <div class="elite-locked-card-title">${title}</div>
                <div class="elite-locked-card-badge">Elite</div>
            </div>
            <div class="elite-locked-card-desc">${desc}</div>
        </div>
    `;
}
