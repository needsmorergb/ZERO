export const ELITE_CSS = `
.elite-alert-overlay {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    pointer-events: none;
    width: 400px;
}

.elite-alert {
    background: rgba(13, 17, 23, 0.95);
    border: 1px solid rgba(245, 158, 11, 0.5);
    border-radius: 12px;
    padding: 12px 20px;
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 12px;
    pointer-events: auto;
    animation: alertSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    width: 100%;
}

.elite-alert.TILT { border-color: #ef4444; border-left: 4px solid #ef4444; }
.elite-alert.FOMO { border-color: #f59e0b; border-left: 4px solid #f59e0b; }
.elite-alert.PANIC { border-color: #6366f1; border-left: 4px solid #6366f1; }
.elite-alert.SUNK_COST { border-color: #a855f7; border-left: 4px solid #a855f7; }
.elite-alert.VELOCITY { border-color: #ec4899; border-left: 4px solid #ec4899; }
.elite-alert.PROFIT_NEGLECT { border-color: #10b981; border-left: 4px solid #10b981; }
.elite-alert.DRIFT { border-color: #06b6d4; border-left: 4px solid #06b6d4; }
.elite-alert.MARKET_REGIME { border-color: #fbbf24; border-left: 4px solid #fbbf24; }

.elite-alert-close {
    margin-left: auto;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
}

@keyframes alertSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes alertFadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
}

.behavior-profile-card {
    margin-top: 24px;
    padding: 20px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 16px;
}

.behavior-tag {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
}

.behavior-tag.Disciplined { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.behavior-tag.Impulsive { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.behavior-tag.Emotional { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.behavior-tag.Hesitant { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
.behavior-tag.Improving { background: rgba(20, 184, 166, 0.2); color: #14b8a6; }

.behavior-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 16px;
}

.behavior-stat-item {
    text-align: center;
}

.behavior-stat-item .k { font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
.behavior-stat-item .v { font-size: 16px; font-weight: 800; color: #f8fafc; }
`;
