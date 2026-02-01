import { OverlayManager } from './overlay.js';
import { IDS } from './ids.js';
import { ICONS } from './icons.js';
import { Store } from '../store.js';

const TUTORIAL_STEPS = [
    {
        title: "👋 Welcome to ZERØ!",
        message: "I'm Professor Zero, and I'm here to help you master Solana trading without risking a single penny!<br><br>This is a <b>Paper Trading Simulation</b>. Everything looks real, but your wallet is completely safe.",
        highlightId: null
    },
    {
        title: "🛡️ Zero Risk, Real Data",
        message: "See that overlay? That's your command center.<br><br>We use <b>real-time market data</b> to simulate exactly what would happen if you traded for real. Same prices, same thrills, zero risk.",
        highlightId: IDS.banner
    },
    {
        title: "📊 Your P&L Tracker",
        message: "Keep an eye on the <b>P&L (Profit & Loss)</b> bar.<br><br>It tracks your wins and losses in real-time. I'll pop in occasionally to give you tips!<br><br>⚠️ The <b>RESET</b> button clears your entire session — balance, trades, and P&L.",
        highlightId: IDS.pnlHud
    },
    {
        title: "💸 Buying & Selling",
        message: "Use the <b>HUD Panel</b> to place trades.<br><br>Enter an amount and click <b>BUY</b>. When you're ready to exit, switch to the <b>SELL</b> tab.<br><br>Try to build your 10 SOL starting balance into a fortune!",
        highlightId: IDS.buyHud
    },
    {
        title: "🚀 Ready to Trade?",
        message: "That's it! You're ready to hit the markets.<br><br>Remember: The goal is to learn. Don't be afraid to make mistakes here—that's how you get better.<br><br><b>Good luck, trader!</b>",
        highlightId: null
    }
];

export const Professor = {

    init() {
        // Professor onboarding disabled for this release
    },

    /**
     * Start the walkthrough tutorial.
     * @param {boolean} [isReplay=false] - If true, replays even if already completed.
     */
    startWalkthrough(isReplay = false) {
        this._showStep(0);
    },

    /** @private */
    _showStep(stepIndex) {
        const container = OverlayManager.getContainer();
        const shadowRoot = OverlayManager.getShadowRoot();
        if (!container || !shadowRoot) return;

        const step = TUTORIAL_STEPS[stepIndex];
        if (!step) return;

        // Clear previous highlights
        const highlighted = container.querySelectorAll('.highlight-active');
        highlighted.forEach(el => el.classList.remove('highlight-active'));

        // Apply new highlight
        if (step.highlightId) {
            const target = shadowRoot.getElementById(step.highlightId);
            if (target) {
                target.classList.add('highlight-active');
            }
        }

        // Remove existing overlay
        const existing = container.querySelector('.professor-overlay');
        if (existing) existing.remove();

        // Get professor image
        const professorImgUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
            ? chrome.runtime.getURL('src/professor.png')
            : '';

        const overlay = document.createElement('div');
        overlay.className = 'professor-overlay tutorial-mode';

        const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
        const btnText = isLastStep ? "Let's Go! 🚀" : "Next ➡️";

        overlay.innerHTML = `
            <div class="professor-container">
                ${professorImgUrl ? `<img class="professor-image" src="${professorImgUrl}" alt="Professor">` : ''}
                <div class="professor-bubble">
                    <div class="professor-title">${step.title}</div>
                    <div class="professor-message">${step.message}</div>
                    <div class="professor-stats" style="margin-top:10px;text-align:right;color:#64748b;font-size:12px;">
                        Step ${stepIndex + 1} of ${TUTORIAL_STEPS.length}
                    </div>
                    <button class="professor-dismiss">${btnText}</button>
                </div>
            </div>
        `;

        container.appendChild(overlay);

        overlay.querySelector('.professor-dismiss').addEventListener('click', async () => {
            if (isLastStep) {
                overlay.style.animation = 'professorFadeIn 0.2s ease-out reverse';
                setTimeout(() => overlay.remove(), 200);

                // Remove highlights
                const hl = container.querySelectorAll('.highlight-active');
                hl.forEach(el => el.classList.remove('highlight-active'));

                // Save completion
                if (Store.state?.settings) {
                    Store.state.settings.tutorialCompleted = true;
                    await Store.save();
                }
            } else {
                this._showStep(stepIndex + 1);
            }
        });
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
