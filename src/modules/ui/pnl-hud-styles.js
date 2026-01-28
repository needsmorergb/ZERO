import { IDS } from './ids.js';

export const PNL_HUD_CSS = `
#${IDS.pnlHud} {
  position: fixed;
  z-index: 2147483645;
  width: 720px;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#${IDS.pnlHud}.docked {
  left: 50%;
  transform: translateX(-50%);
  top: 50px;
}

#${IDS.pnlHud}.floating {
  left: 20px;
  top: 60px;
  transform: none;
}

#${IDS.pnlHud} .card {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}

#${IDS.pnlHud} .header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}

#${IDS.pnlHud} .header:active {
  cursor: grabbing;
}

#${IDS.pnlHud} .title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #14b8a6;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

#${IDS.pnlHud} .title .dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
  animation: pulse 2s infinite;
}

#${IDS.pnlHud} .controls {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #64748b;
}

#${IDS.pnlHud} .pillBtn {
  border: 1px solid rgba(20,184,166,0.2);
  background: transparent;
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

#${IDS.pnlHud} .pillBtn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}

#${IDS.pnlHud} .startSol {
  display: flex;
  align-items: center;
  gap: 8px;
}

#${IDS.pnlHud} input.startSolInput {
  width: 70px;
  border: 1px solid rgba(20,184,166,0.2);
  background: #161b22;
  color: #f8fafc;
  padding: 6px 10px;
  border-radius: 6px;
  outline: none;
  font-weight: 600;
  pointer-events: auto;
  cursor: text;
  transition: all 0.2s;
}

#${IDS.pnlHud} input.startSolInput:focus {
  border-color: #14b8a6;
}

#${IDS.pnlHud} .stats {
  display: flex;
  gap: 0;
  padding: 0;
  border-top: 1px solid rgba(20,184,166,0.1);
}

#${IDS.pnlHud} .stat {
  flex: 1;
  background: transparent;
  border: none;
  border-right: 1px solid rgba(20,184,166,0.1);
  border-radius: 0;
  padding: 16px 20px;
  text-align: left;
  transition: background 0.2s;
}

#${IDS.pnlHud} .stat:last-child {
  border-right: none;
}

#${IDS.pnlHud} .stat:hover {
  background: rgba(20,184,166,0.05);
}

#${IDS.pnlHud} .stat .k {
  font-size: 10px;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.pnlHud} .stat .v {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
}

#${IDS.pnlHud} .stat.streak .v {
  font-size: 20px;
  font-weight: 800;
  color: #14b8a6;
}

#${IDS.pnlHud} .stat.streak.loss .v {
  color: #ef4444;
}

#${IDS.pnlHud} .stat.streak.win .v {
  color: #14b8a6;
  animation: streakPulse 1s infinite;
}

#${IDS.pnlHud} .tradeList {
  max-height: 200px;
  overflow: auto;
  border-top: 1px solid rgba(20,184,166,0.1);
}

#${IDS.pnlHud} .tradeRow {
  display: grid;
  grid-template-columns: 40px 35px 1fr 60px 70px;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(20,184,166,0.05);
  font-size: 11px;
  color: #e2e8f0;
  align-items: center;
}

#${IDS.pnlHud} .tradeRow:hover {
  background: rgba(20,184,166,0.03);
}

#${IDS.pnlHud} .tradeRow .muted {
  color: #64748b;
}

#${IDS.pnlHud} .tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
}

#${IDS.pnlHud} .tag.buy {
  background: rgba(20,184,166,0.15);
  color: #14b8a6;
}

#${IDS.pnlHud} .tag.sell {
  background: rgba(239,68,68,0.15);
  color: #ef4444;
}

/* Chart trade markers */
.paper-trade-marker {
  position: absolute;
  z-index: 999999;
  pointer-events: none;
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.paper-trade-marker.buy {
  background: rgba(34, 197, 94, 0.9);
  color: white;
  border-bottom: 2px solid #22c55e;
}

.paper-trade-marker.sell {
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border-top: 2px solid #ef4444;
}

.paper-trade-marker::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
}

.paper-trade-marker.buy::after {
  bottom: -12px;
  border-top-color: #22c55e;
}

.paper-trade-marker.sell::after {
  top: -12px;
  border-bottom-color: #ef4444;
}

/* Positions Panel */
#${IDS.pnlHud} .positionsPanel {
  border-top: 1px solid rgba(20,184,166,0.1);
}

#${IDS.pnlHud} .positionsHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  background: rgba(20,184,166,0.03);
  transition: background 0.2s;
}

#${IDS.pnlHud} .positionsHeader:hover {
  background: rgba(20,184,166,0.08);
}

#${IDS.pnlHud} .positionsTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.pnlHud} .positionCount {
  color: #14b8a6;
  font-weight: 800;
}

#${IDS.pnlHud} .positionsToggle {
  color: #64748b;
  transition: transform 0.2s;
}

#${IDS.pnlHud} .positionsToggle.expanded {
  transform: rotate(180deg);
}

#${IDS.pnlHud} .positionsList {
  max-height: 300px;
  overflow-y: auto;
}

#${IDS.pnlHud} .positionRow {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(20,184,166,0.05);
  transition: background 0.15s;
}

#${IDS.pnlHud} .positionRow:hover {
  background: rgba(20,184,166,0.05);
}

#${IDS.pnlHud} .positionRow:last-child {
  border-bottom: none;
}

#${IDS.pnlHud} .positionInfo {
  min-width: 0;
}

#${IDS.pnlHud} .positionSymbol {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 2px;
}

#${IDS.pnlHud} .positionDetails {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: #64748b;
}

#${IDS.pnlHud} .positionPnl {
  text-align: right;
  min-width: 100px;
}

#${IDS.pnlHud} .positionPnl .pnlValue {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

#${IDS.pnlHud} .positionPnl .pnlPct {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

#${IDS.pnlHud} .positionPnl.positive .pnlValue,
#${IDS.pnlHud} .positionPnl.positive .pnlPct {
  color: #10b981;
}

#${IDS.pnlHud} .positionPnl.negative .pnlValue,
#${IDS.pnlHud} .positionPnl.negative .pnlPct {
  color: #ef4444;
}

#${IDS.pnlHud} .quickSellBtns {
  display: flex;
  gap: 6px;
}

#${IDS.pnlHud} .qSellBtn {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  color: #ef4444;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

#${IDS.pnlHud} .qSellBtn:hover {
  background: rgba(239,68,68,0.2);
  border-color: rgba(239,68,68,0.4);
}

#${IDS.pnlHud} .noPositions {
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-size: 12px;
}
`;
