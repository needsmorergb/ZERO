import { OverlayManager } from './overlay.js';
import { ICONS } from './icons.js';

export const Professor = {

    init() {
        // Professor onboarding disabled for this release
    },

    showCritique(trigger, value, analysisState) {
        // Professor module disabled for Free production release
        return;

        const container = OverlayManager.getContainer();
        if (!container) return;

        const existing = container.querySelector('.professor-overlay');
        if (existing) existing.remove();

        const { title, message } = this.generateMessage(trigger, value, analysisState);

        const overlay = document.createElement('div');
        overlay.className = 'professor-overlay';
        overlay.innerHTML = `
            <div class="professor-container" style="box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(20,184,166,0.2);">
                <img src="${chrome.runtime.getURL('src/professor.png')}" class="professor-image">
                <div class="professor-bubble">
                    <div class="professor-title" style="display:flex; align-items:center; gap:8px;">
                        ${ICONS.BRAIN} ${title}
                    </div>
                    <div class="professor-message">${message}</div>
                    <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:10px; color:#64748b; cursor:pointer;">
                            <input type="checkbox" class="professor-opt-out"> Don't show again
                        </label>
                        <button class="professor-dismiss" style="font-size:11px; padding:4px 8px;">Dismiss</button>
                    </div>
                </div>
            </div>
        `;

        // Position under Buy HUD
        const buyHud = container.querySelector('#paper-buyhud-root');
        if (buyHud) {
            const rect = buyHud.getBoundingClientRect();
            overlay.style.top = (rect.bottom + 12) + 'px';
            overlay.style.left = rect.left + 'px';
            overlay.style.width = rect.width + 'px'; // Match width
        } else {
            // Fallback (Center Bottom)
            overlay.style.bottom = '20px';
            overlay.style.left = '50%';
            overlay.style.transform = 'translateX(-50%)';
        }

        container.appendChild(overlay);

        // Bind Events
        const checkbox = overlay.querySelector('.professor-opt-out');
        const dismissBtn = overlay.querySelector('.professor-dismiss');

        const close = async () => {
            if (checkbox.checked) {
                Store.state.settings.showProfessor = false;
                await Store.save();
            }
            overlay.remove();
        };

        dismissBtn.onclick = close;

        // Auto-close after 10s if not interacted? No, user wants it optional so let them read.
        // But maybe auto-close is annoying if it's "under" and not blocking.
        // I'll keep the timeout but make it longer.
        setTimeout(() => { if (overlay.isConnected) close(); }, 15000);
    },

    generateMessage(trigger, value, analysis) {
        let title = "Observation";
        let message = "Keep pushing.";

        const style = analysis?.style || 'balanced';
        const tips = this.getTips(style);
        const randomTip = tips[Math.floor(Math.random() * tips.length)];

        if (trigger === 'win_streak') {
            if (value === 5) {
                title = "🔥 5 Win Streak!";
                message = "You're finding your rhythm. The market is speaking and you're listening!";
            } else if (value === 10) {
                title = "🏆 10 Win Streak!";
                message = "Double digits! This is what consistent profitability looks like.";
            } else {
                title = `⚡ ${value} Win Streak!`;
                message = "Impressive run. Stay disciplined.";
            }
        } else if (trigger === 'loss_streak') {
            title = "⚠️ Loss Streak Detected";
            message = `${value} losses in a row. Take a breath. Are you forcing trades?`;
        } else if (trigger === 'fomo_buying') {
            title = "🚫 FOMO Detected";
            message = "3+ buys in 2 minutes. You're chasing price. Let the setup come to you.";
        } else if (trigger === 'revenge_trade') {
            title = "⚠️ Revenge Trade Warning";
            message = "Buying immediately after a loss? That's emotion, not strategy.";
        } else if (trigger === 'overtrading') {
            title = "🛑 High Volume Warning";
            message = `${value} trades this session. Quality > Quantity. Consider taking a break.`;
        } else if (trigger === 'portfolio_multiplier') {
            title = `🎉 ${value}X PORTFOLIO!`;
            message = `You've turned your starting balance into ${value}x! Incredible work.`;
        }

        return { title, message: message + '<br><br><span style="color:#94a3b8;font-size:12px">💡 ' + randomTip + '</span>' };
    },

    getTips(style) {
        const tips = {
            scalper: [
                "Scalping works best in high-volume markets. Watch those fees!",
                "Consider setting a 5-trade limit per hour to avoid overtrading.",
                "Quick flips need quick reflexes. Always have an exit plan!"
            ],
            swing: [
                "Setting a trailing stop can protect your swing trade profits.",
                "Patient hands make the most gains. Trust your analysis!",
                "Consider scaling out in 25% chunks to lock in profits."
            ],
            degen: [
                "Micro-caps are fun but size down! Never risk more than 5% on a single play.",
                "In degen territory, the first green candle is often the exit signal.",
                "Set a hard stop at -50%. Live to degen another day!"
            ],
            conservative: [
                "Your conservative style keeps you in the game. Consider a small moon bag!",
                "Larger caps mean smaller moves. Patience is your superpower.",
                "Consider allocating 10% to higher-risk plays for balance."
            ],
            balanced: [
                "Your balanced approach is sustainable. Keep mixing risk levels!",
                "Track your best-performing market cap range and lean into it.",
                "Journal your winners - patterns emerge over time!"
            ]
        };
        return tips[style] || tips.balanced;
    }
};
