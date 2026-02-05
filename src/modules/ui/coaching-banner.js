/**
 * Live Trade Coaching Banner
 *
 * Non-blocking UI overlay that shows coaching alerts below the
 * BUY/SELL button. Does NOT prevent trade execution.
 *
 * Voice Rules (from spec):
 * - No shaming
 * - No commands
 * - No emotional language
 * - Always reference their own data
 * - Always leave final agency with the trader
 * - Tone = senior risk manager
 */

export const CoachingBanner = {
    activeTimeout: null,
    currentTriggerId: null,

    /**
     * Show coaching banner
     * Returns immediately - does NOT block trade
     *
     * @param {Object} evaluation - { triggerId, severity, message, confidence }
     * @param {Function} onDismiss - Called when user dismisses
     * @param {Function} onPause - Called when user clicks "Pause 5 min"
     */
    show(evaluation, onDismiss, onPause) {
        this.hide(); // Clear any existing

        // Find container - try buy-hud first, then pnl-hud
        const container = document.querySelector('.zero-buy-hud') ||
                          document.querySelector('.zero-pnl-hud');
        if (!container) {
            console.warn('[Coaching] No HUD container found');
            return;
        }

        this.currentTriggerId = evaluation.triggerId;

        const banner = document.createElement('div');
        banner.className = 'zero-coaching-banner';
        banner.setAttribute('data-trigger', evaluation.triggerId);

        // Build HTML
        const mainText = evaluation.message.main.replace(/\n/g, '<br>');
        const footerHtml = evaluation.message.footer
            ? `<div class="coaching-footer">${evaluation.message.footer}</div>`
            : '';

        banner.innerHTML = `
            <div class="coaching-content">
                <div class="coaching-icon"></div>
                <div class="coaching-text">
                    <div class="coaching-main">${mainText}</div>
                    ${footerHtml}
                </div>
                <button class="coaching-dismiss" aria-label="Dismiss">&times;</button>
            </div>
            <div class="coaching-actions">
                <button class="coaching-pause">Pause 5 min</button>
            </div>
        `;

        // Event handlers
        const dismissBtn = banner.querySelector('.coaching-dismiss');
        dismissBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
            if (onDismiss) onDismiss(evaluation.triggerId);
        });

        const pauseBtn = banner.querySelector('.coaching-pause');
        pauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
            if (onPause) onPause(evaluation.triggerId, 5 * 60 * 1000);
        });

        // Add upgrade CTA if footer exists (free tier)
        if (evaluation.message.footer) {
            const upgradeBtn = document.createElement('button');
            upgradeBtn.className = 'coaching-upgrade';
            upgradeBtn.textContent = 'Unlock Live Coaching';
            upgradeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Trigger paywall modal
                window.dispatchEvent(new CustomEvent('zero-show-paywall', {
                    detail: { source: 'coaching' }
                }));
                this.hide();
            });
            banner.querySelector('.coaching-actions').appendChild(upgradeBtn);
        }

        container.appendChild(banner);

        // Auto-dismiss after 8 seconds
        this.activeTimeout = setTimeout(() => {
            this.hide();
        }, 8000);

        console.log(`[Coaching] Showed ${evaluation.triggerId} alert (severity: ${evaluation.severity})`);
    },

    /**
     * Hide coaching banner
     */
    hide() {
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = null;
        }
        this.currentTriggerId = null;

        document.querySelectorAll('.zero-coaching-banner').forEach(el => {
            el.remove();
        });
    },

    /**
     * Inject coaching styles into the page
     * Call once during initialization
     */
    injectStyles() {
        if (document.getElementById('zero-coaching-styles')) return;

        const style = document.createElement('style');
        style.id = 'zero-coaching-styles';
        style.textContent = `
            .zero-coaching-banner {
                margin-top: 8px;
                padding: 12px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 1px solid rgba(255, 193, 7, 0.3);
                border-radius: 8px;
                font-size: 12px;
                color: #e0e0e0;
                animation: coachingFadeIn 0.2s ease-out;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            @keyframes coachingFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .coaching-content {
                display: flex;
                gap: 10px;
                align-items: flex-start;
            }

            .coaching-icon {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
                background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                border-radius: 50%;
                position: relative;
            }

            .coaching-icon::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 2px;
                height: 8px;
                background: #1a1a2e;
                border-radius: 1px;
            }

            .coaching-icon::before {
                content: '';
                position: absolute;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                width: 2px;
                height: 2px;
                background: #1a1a2e;
                border-radius: 50%;
            }

            .coaching-text {
                flex: 1;
                min-width: 0;
            }

            .coaching-main {
                line-height: 1.5;
                color: #f5f5f5;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .coaching-footer {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                color: #ffc107;
                font-size: 11px;
            }

            .coaching-dismiss {
                background: none;
                border: none;
                color: #666;
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
                line-height: 1;
                transition: color 0.15s ease;
            }

            .coaching-dismiss:hover {
                color: #fff;
            }

            .coaching-actions {
                margin-top: 10px;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .coaching-pause {
                background: rgba(255, 193, 7, 0.1);
                border: 1px solid rgba(255, 193, 7, 0.25);
                color: #ffc107;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .coaching-pause:hover {
                background: rgba(255, 193, 7, 0.2);
                border-color: rgba(255, 193, 7, 0.4);
            }

            .coaching-upgrade {
                background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                border: none;
                color: #1a1a2e;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .coaching-upgrade:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
            }
        `;

        document.head.appendChild(style);
    }
};
