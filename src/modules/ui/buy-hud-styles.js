import { IDS } from './ids.js';

export const BUY_HUD_CSS = `
#${IDS.buyHud} {
  z-index: 2147483644;
  pointer-events: auto;
  font-size: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#${IDS.buyHud}.floating {
  position: fixed;
  left: auto;
  top: 100px;
  width: 300px;
  max-width: calc(100vw - 24px);
}

#${IDS.buyHud}.docked {
  position: fixed;
  right: 16px;
  top: 320px;
  width: 300px;
  z-index: 2147483645;
}

#${IDS.buyHud} .panel {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}

#${IDS.buyHud}.docked .panel {
  border-radius: 10px;
}

#${IDS.buyHud} .panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}

#${IDS.buyHud} .panelHeader:active {
  cursor: grabbing;
}

#${IDS.buyHud} .panelTitle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: #14b8a6;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.buyHud} .panelTitle .dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
}

#${IDS.buyHud} .panelBtns {
  display: flex;
  align-items: center;
  gap: 8px;
}

#${IDS.buyHud} .btn {
  border: 1px solid rgba(20,184,166,0.2);
  background: transparent;
  color: #94a3b8;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 10px;
  transition: all 0.2s;
  text-transform: uppercase;
}

#${IDS.buyHud} .btn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}

#${IDS.buyHud} .tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
}

#${IDS.buyHud} .tab {
  flex: 1;
  border: 1px solid rgba(20,184,166,0.15);
  background: #161b22;
  color: #94a3b8;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 11px;
  text-align: center;
  transition: all 0.2s;
  text-transform: uppercase;
}

#${IDS.buyHud} .tab.active {
  background: rgba(20,184,166,0.15);
  border-color: #14b8a6;
  color: #14b8a6;
}

#${IDS.buyHud} .tab:hover:not(.active) {
  background: #1c2128;
  border-color: rgba(20,184,166,0.25);
}

#${IDS.buyHud} .body {
  padding: 14px 16px;
}

#${IDS.buyHud} .fieldLabel {
  color: #64748b;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

#${IDS.buyHud} input.field {
  width: 100%;
  border: 1px solid rgba(20,184,166,0.2);
  background: #161b22;
  color: #f8fafc;
  padding: 12px 14px;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

#${IDS.buyHud} input.field:focus {
  border-color: #14b8a6;
}

#${IDS.buyHud} .quickRow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

#${IDS.buyHud} .qbtn {
  border: 1px solid rgba(20,184,166,0.15);
  background: #161b22;
  color: #94a3b8;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;
  transition: all 0.2s;
}

#${IDS.buyHud} .qbtn:hover {
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.3);
  color: #14b8a6;
}

#${IDS.buyHud} .strategyRow {
  margin-top: 12px;
}

#${IDS.buyHud} .strategySelect {
  width: 100%;
  padding: 8px 10px;
  background: #161b22;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 8px;
  color: #f8fafc;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
}

#${IDS.buyHud} .strategySelect:hover {
  border-color: rgba(20,184,166,0.5);
}

#${IDS.buyHud} .strategySelect:focus {
  border-color: #14b8a6;
}

#${IDS.buyHud} .action {
  margin-top: 14px;
  width: 100%;
  border: none;
  background: #14b8a6;
  color: #0d1117;
  padding: 12px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s;
}

#${IDS.buyHud} .action:hover {
  background: #2dd4bf;
}

#${IDS.buyHud} .action.sell {
  background: #ef4444;
  color: white;
}

#${IDS.buyHud} .action.sell:hover {
  background: #f87171;
}

#${IDS.buyHud} .status {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #161b22;
  border: 1px solid rgba(20,184,166,0.1);
  color: #64748b;
  font-weight: 600;
  min-height: 40px;
  font-size: 11px;
}
`;
