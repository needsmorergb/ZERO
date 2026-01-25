export const DASHBOARD_CSS = `
.paper-dashboard-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(13, 17, 23, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #f8fafc;
}

.paper-dashboard-modal {
    width: 900px;
    max-width: 95vw;
    height: 700px;
    max-height: 90vh;
    background: #0d1117;
    border: 1px solid rgba(20, 184, 166, 0.3);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.dashboard-header {
    padding: 24px 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.dashboard-title {
    font-size: 20px;
    font-weight: 800;
    color: #14b8a6;
    letter-spacing: 0.5px;
}

.dashboard-close {
    background: none;
    border: none;
    color: #64748b;
    font-size: 28px;
    cursor: pointer;
    transition: color 0.2s;
}

.dashboard-close:hover { color: #f8fafc; }

.dashboard-content {
    flex: 1;
    overflow-y: auto;
    padding: 32px;
    display: grid;
    grid-template-columns: 2fr 1.2fr;
    gap: 32px;
}

.dashboard-card {
    background: #161b22;
    border-radius: 16px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.03);
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 32px;
}

.big-stat {
    text-align: center;
}

.big-stat .k { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
.big-stat .v { font-size: 24px; font-weight: 800; }

.win { color: #10b981; }
.loss { color: #ef4444; }

.professor-critique-box {
    background: linear-gradient(145deg, #1e293b, #0f172a);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 16px;
    padding: 24px;
}

.professor-title { color: #a5b4fc; font-weight: 800; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; }
.professor-text { font-size: 15px; line-height: 1.6; color: #e2e8f0; font-style: italic; }

.equity-chart-placeholder {
    height: 200px;
    background: rgba(20, 184, 166, 0.05);
    border: 1px dashed rgba(20, 184, 166, 0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #14b8a6;
    font-size: 12px;
    margin-top: 20px;
}

.trade-mini-list {
    margin-top: 24px;
}

.mini-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    font-size: 13px;
}
.mini-row:last-child { border-bottom: none; }

canvas#equity-canvas {
    width: 100%;
    height: 180px;
    background: rgba(13, 17, 23, 0.4);
    border-radius: 12px;
    margin-top: 10px;
}

.locked-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(13, 17, 23, 0.85);
    backdrop-filter: blur(6px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    cursor: pointer;
    border-radius: 16px;
}

.locked-icon { font-size: 28px; margin-bottom: 12px; }
.locked-text { font-size: 11px; font-weight: 900; color: #14b8a6; letter-spacing: 2px; }
`;
