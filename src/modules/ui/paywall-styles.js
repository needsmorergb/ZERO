export const PAYWALL_CSS = `
/* Upgrade Modal */
.paper-paywall-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: 'Inter', sans-serif;
    animation: fadeIn 0.3s ease;
}

.paper-paywall-modal {
    width: 480px;
    background: #0d1117;
    border: 1px solid rgba(20, 184, 166, 0.3);
    border-radius: 24px;
    padding: 40px;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
}

.paper-paywall-modal::before {
    content: '';
    position: absolute;
    top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%);
    pointer-events: none;
}

.paywall-crown {
    font-size: 48px;
    margin-bottom: 24px;
    display: inline-block;
    filter: drop-shadow(0 0 10px rgba(20,184,166,0.5));
}

.paywall-title {
    font-size: 24px;
    font-weight: 800;
    color: #f8fafc;
    margin-bottom: 12px;
}

.paywall-subtitle {
    font-size: 15px;
    color: #94a3b8;
    line-height: 1.6;
    margin-bottom: 32px;
}

.paywall-features {
    text-align: left;
    margin-bottom: 32px;
    display: grid;
    gap: 16px;
}

.paywall-feature {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #e2e8f0;
}

.paywall-feature span {
    color: #14b8a6;
    font-weight: 800;
}

.paywall-btn-primary {
    width: 100%;
    background: #14b8a6;
    color: #0d1117;
    border: none;
    padding: 16px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.paywall-btn-primary:hover {
    background: #2dd4bf;
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(20,184,166,0.2);
}

.paywall-close {
    position: absolute;
    top: 20px; right: 20px;
    background: none;
    border: none;
    color: #64748b;
    font-size: 24px;
    cursor: pointer;
}

/* Feature Locking */
.locked-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(13, 17, 23, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    border-radius: inherit;
    transition: all 0.3s;
}

.locked-overlay:hover {
    background: rgba(13, 17, 23, 0.6);
}

.locked-icon {
    font-size: 24px;
    margin-bottom: 8px;
    filter: drop-shadow(0 0 5px rgba(255,255,255,0.3));
}

.locked-text {
    font-size: 11px;
    font-weight: 700;
    color: #14b8a6;
    text-transform: uppercase;
    letter-spacing: 1px;
}

@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
`;
