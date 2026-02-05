import { IDS } from "./ids.js";

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

#${IDS.buyHud} .qbtn-edit {
  border: 1px solid rgba(20,184,166,0.3);
  background: #161b22;
  color: #f8fafc;
  padding: 8px 6px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  width: 56px;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

#${IDS.buyHud} .qbtn-edit:focus {
  border-color: #14b8a6;
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
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px dashed rgba(168, 85, 247, 0.3);
    color: #a855f7;
    justify-content: center;
    gap: 8px;
    font-weight: 700;
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

/* Trade Plan Styles */
#${IDS.buyHud} .plan-toggle {
    margin-top: 12px;
    padding: 10px 14px;
    background: #161b22;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 8px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.2s;
}

#${IDS.buyHud} .plan-toggle:hover {
    border-color: rgba(20,184,166,0.3);
    background: #1c2128;
}

#${IDS.buyHud} .plan-toggle svg {
    flex-shrink: 0;
}

#${IDS.buyHud} .trade-plan-section {
    margin-top: 12px;
    padding: 12px 14px;
    background: #161b22;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 8px;
}

#${IDS.buyHud} .trade-plan-section.gated {
    background: linear-gradient(135deg, rgba(168,85,247,0.05), rgba(139,92,246,0.05));
    border: 1px dashed rgba(168,85,247,0.25);
}

#${IDS.buyHud} .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

#${IDS.buyHud} .plan-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #e2e8f0;
    font-weight: 700;
    font-size: 11px;
}

#${IDS.buyHud} .plan-tag {
    background: rgba(168,85,247,0.15);
    color: #a78bfa;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
}

#${IDS.buyHud} .plan-collapse-arrow {
    cursor: pointer;
    color: #64748b;
    padding: 4px;
    transition: color 0.2s;
}

#${IDS.buyHud} .plan-collapse-arrow:hover {
    color: #94a3b8;
}

#${IDS.buyHud} .plan-gated-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    background: rgba(168,85,247,0.1);
    border: 1px dashed rgba(168,85,247,0.3);
    border-radius: 6px;
    color: #a855f7;
    font-weight: 700;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

#${IDS.buyHud} .plan-gated-badge:hover {
    background: rgba(168,85,247,0.15);
    border-color: rgba(168,85,247,0.5);
}

#${IDS.buyHud} .plan-gated-hint {
    text-align: center;
    color: #64748b;
    font-size: 10px;
    margin-top: 6px;
}

#${IDS.buyHud} .plan-row {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
}

#${IDS.buyHud} .plan-field {
    flex: 1;
}

#${IDS.buyHud} .plan-field.full {
    flex: unset;
    width: 100%;
}

#${IDS.buyHud} .plan-label {
    display: block;
    color: #64748b;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 4px;
}

#${IDS.buyHud} .plan-label .optional {
    font-weight: 400;
    text-transform: none;
    color: #475569;
}

#${IDS.buyHud} .plan-input-wrap {
    display: flex;
    align-items: center;
    background: #0d1117;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 6px;
    overflow: hidden;
    transition: border-color 0.2s;
}

#${IDS.buyHud} .plan-input-wrap:focus-within {
    border-color: #14b8a6;
}

#${IDS.buyHud} .plan-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    min-width: 0;
}

#${IDS.buyHud} .plan-unit {
    color: #475569;
    font-size: 10px;
    font-weight: 600;
    padding: 0 8px;
    flex-shrink: 0;
}

#${IDS.buyHud} .plan-textarea {
    width: 100%;
    background: #0d1117;
    border: 1px solid rgba(20,184,166,0.15);
    border-radius: 6px;
    color: #f8fafc;
    padding: 8px 10px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
    resize: vertical;
    min-height: 36px;
    transition: border-color 0.2s;
}

#${IDS.buyHud} .plan-textarea:focus {
    border-color: #14b8a6;
}
`;
