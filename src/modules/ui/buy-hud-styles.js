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

/* Market Context HUD Styles */
.market-context-container {
    padding: 2px 0;
}

.market-badge {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(13, 17, 23, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
}

.market-badge.gated {
    background: rgba(139, 92, 246, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.15);
    color: #818cf8;
    justify-content: center;
    gap: 6px;
    font-weight: 600;
    font-size: 10px;
    padding: 6px 10px;
}

.market-badge.loading {
    justify-content: center;
    color: #64748b;
    font-style: italic;
}

.market-badge .mitem {
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
}

.market-badge .mitem span {
    color: #f8fafc;
    margin-left: 4px;
}

/* Trade Plan Section Styles */
.trade-plan-section {
    margin-top: 14px;
    padding: 12px;
    background: rgba(99, 102, 241, 0.05);
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: 10px;
}

.trade-plan-section.gated {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
    border: 1px dashed rgba(99, 102, 241, 0.3);
    cursor: pointer;
    text-align: center;
    padding: 16px 12px;
    transition: all 0.2s;
}

.trade-plan-section.gated:hover {
    border-color: rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.1);
}

.plan-gated-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #6366f1;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.plan-gated-hint {
    color: #64748b;
    font-size: 10px;
    margin-top: 4px;
}

.plan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.plan-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.plan-title svg {
    color: #6366f1;
}

.plan-tag {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 8px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.5px;
}

.plan-row {
    display: flex;
    gap: 10px;
}

.plan-field {
    flex: 1;
}

.plan-field.full {
    margin-top: 10px;
}

.plan-label {
    display: block;
    color: #64748b;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
}

.plan-label .optional {
    color: #475569;
    font-weight: 500;
    text-transform: none;
}

.plan-input-wrap {
    display: flex;
    align-items: center;
    background: #161b22;
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 6px;
    overflow: hidden;
    transition: border-color 0.2s;
}

.plan-input-wrap:focus-within {
    border-color: #6366f1;
}

.plan-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    outline: none;
    width: 100%;
    min-width: 0;
}

.plan-input::placeholder {
    color: #475569;
}

.plan-unit {
    color: #64748b;
    font-size: 10px;
    font-weight: 600;
    padding-right: 10px;
    text-transform: uppercase;
}

.plan-textarea {
    width: 100%;
    background: #161b22;
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 6px;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
    resize: none;
    transition: border-color 0.2s;
}

.plan-textarea::placeholder {
    color: #475569;
}

.plan-textarea:focus {
    border-color: #6366f1;
}

.plan-toggle {
    margin-top: 12px;
    padding: 8px 12px;
    background: rgba(99, 102, 241, 0.05);
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    transition: all 0.2s;
}

.plan-toggle:hover {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.3);
    color: #6366f1;
}

.plan-collapse-arrow {
    cursor: pointer;
    color: #64748b;
    padding: 2px 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
}

.plan-collapse-arrow:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
}
`;
