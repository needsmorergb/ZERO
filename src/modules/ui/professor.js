import { OverlayManager } from './overlay.js';
import { Store } from '../store.js';
import { ICONS } from './icons.js';

export const Professor = {
    currentStep: 0,
    steps: [
        {
            title: "Welcome to ZERØ",
            body: "ZERØ is a secure paper trading overlay for Solana.<br>Practice strategies on real charts without risking real funds.",
            icon: ICONS.BRAIN || '🧠'
        },
        {
            title: "Track Your Performance",
            body: "Monitor your session P&L, win rates, and streaks in real-time.<br>Stats update instantly as you trade.",
            icon: '📊'
        },
        {
            title: "Start Fresh Anytime",
            body: "Use the <strong>Reset</strong> button to clear your current session stats and start a fresh run.<br>Your trade history is always preserved.",
            icon: '🔄'
        },
        {
            title: "Privacy First",
            body: "All trading data is stored locally on your device.<br>We do not track your personal trades or access your wallet.",
            icon: '🛡️'
        },
        {
            title: "You're All Set",
            body: "ZERØ will stay out of the way while you practice.<br>Open <strong>Settings</strong> to replay this walkthrough anytime.",
            icon: '🚀'
        }
    ],

    async init() {
        // Check if onboarding is needed
        const s = Store.state.settings;
        if (!s.onboardingSeen) {
            // Small delay to ensure UI is ready
            setTimeout(() => this.startWalkthrough(), 1500);
        }
    },

    startWalkthrough(force = false) {
        if (!force && Store.state.settings.onboardingSeen) return;
        this.currentStep = 0;
        this.renderStep(this.currentStep);
    },

    renderStep(index) {
        const step = this.steps[index];
        if (!step) {
            this.complete();
            return;
        }

        const container = OverlayManager.getContainer();
        let overlay = container.querySelector('.professor-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'professor-overlay';
            // Center styling specific for walkthrough
            overlay.style.position = 'fixed'; // Ensure fixed positioning relative to viewport or container
            overlay.style.bottom = '120px'; // Positioned centrally but lower
            overlay.style.left = '50%';
            overlay.style.transform = 'translateX(-50%)';
            overlay.style.zIndex = '1000000';
            container.appendChild(overlay);
        }

        const isLast = index === this.steps.length - 1;

        overlay.innerHTML = `
            <div class="professor-container" style="
                background: #0f172a; 
                border: 1px solid rgba(20,184,166,0.5); 
                box-shadow: 0 20px 50px rgba(0,0,0,0.8); 
                padding: 20px; 
                border-radius: 12px; 
                width: 320px; 
                text-align: center;
                animation: fadeIn 0.3s ease-out;
                pointer-events: auto;
            ">
                <div style="font-size:32px; margin-bottom:12px;">${step.icon}</div>
                <div style="font-size:16px; font-weight:700; color:#f8fafc; margin-bottom:8px;">${step.title}</div>
                <div style="font-size:13px; color:#94a3b8; line-height:1.5; margin-bottom:20px; min-height:40px;">${step.body}</div>
                
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:4px;">
                        ${this.steps.map((_, i) => `
                            <div style="
                                width:6px; height:6px; border-radius:50%; 
                                background:${i === index ? '#14b8a6' : '#334155'};
                                transition: background 0.3s;
                            "></div>
                        `).join('')}
                    </div>
                    <div style="display:flex; gap:10px;">
                        ${!isLast ? `<button class="prof-skip" style="background:transparent; border:none; color:#64748b; font-size:12px; cursor:pointer;">Skip</button>` : ''}
                        <button class="prof-next" style="
                            background: rgba(20,184,166,0.2); 
                            color: #14b8a6; 
                            border: 1px solid rgba(20,184,166,0.3); 
                            padding: 6px 16px; 
                            border-radius: 6px; 
                            font-size: 13px; 
                            font-weight: 600;
                            cursor: pointer;
                        ">${isLast ? 'Finish' : 'Next'}</button>
                    </div>
                </div>
            </div>
        `;

        const nextBtn = overlay.querySelector('.prof-next');
        const skipBtn = overlay.querySelector('.prof-skip');

        nextBtn.onclick = () => this.next();
        if (skipBtn) skipBtn.onclick = () => this.complete();
    },

    next() {
        this.currentStep++;
        this.renderStep(this.currentStep);
    },

    async complete() {
        const overlay = OverlayManager.getContainer().querySelector('.professor-overlay');
        if (overlay) overlay.remove();

        // Mark as seen
        if (!Store.state.settings.onboardingSeen) {
            Store.state.settings.onboardingSeen = true;
            Store.state.settings.onboardingCompletedAt = Date.now();
            Store.state.settings.onboardingCompletedAt = Date.now();
            Store.state.settings.onboardingVersion = Store.state.version || '1.11.8';
            await Store.save();
        }
    }
};
