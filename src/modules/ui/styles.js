export const IDS = {
  banner: "paper-mode-banner",
  pnlHud: "paper-pnl-hud",
  buyHud: "paper-buyhud-root",
  style: "paper-overlay-style",
};

export const CSS = `
.zero-inline-icon { height:14px; width:14px; vertical-align:-2px; margin:0 1px; display:inline-block; }
#${IDS.banner}{
  position:fixed; top:12px; left:50%; transform:translateX(-50%); bottom:auto; right:auto;
  height:36px;
  padding: 0 20px;
  border-radius: 99px;
  z-index:2147483646;
  display:flex; align-items:center; justify-content:center;
  user-select:none;
  pointer-events:auto;
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.3);
  box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${IDS.banner} .inner{ display:flex; align-items:center; gap:24px; font-size:12px; letter-spacing:0.3px; }
#${IDS.banner} .dot{ width:8px;height:8px;border-radius:999px; background: #14b8a6; box-shadow: 0 0 8px rgba(20,184,166,0.5); }
#${IDS.banner}.disabled .dot{ background: #475569; box-shadow: none; }
#${IDS.banner} .label{ color: #14b8a6; font-weight:700; text-transform: uppercase; letter-spacing: 1px; }
#${IDS.banner} .state{ color: #f8fafc; font-weight:600; }
#${IDS.banner}.disabled .state{ color: #64748b; }
#${IDS.banner} .hint{ color: #64748b; font-weight:500; }

#${IDS.pnlHud}{
  position: fixed;
  z-index: 2147483645;
  width: 720px;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${IDS.pnlHud}.docked{ left: 50%; transform: translateX(-50%); top: 50px; }
#${IDS.pnlHud}.floating{ left: 20px; top: 60px; transform: none; }
#${IDS.pnlHud} .card{
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}
#${IDS.pnlHud} .header{
  display:flex; align-items:center; justify-content:space-between;
  padding: 14px 20px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}
#${IDS.pnlHud} .header:active{ cursor: grabbing; }
#${IDS.pnlHud} .title{
  display:flex; align-items:center; gap:10px;
  font-size: 13px; font-weight: 700;
  color: #14b8a6;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
#${IDS.pnlHud} .title .dot{ 
  width:10px;height:10px;border-radius:999px; 
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.9)} }
#${IDS.pnlHud} .controls{ display:flex; align-items:center; gap:12px; font-size: 11px; color: #64748b; }
#${IDS.pnlHud} .stat.streak .v { font-size:20px; font-weight:800; color: #14b8a6; }
#${IDS.pnlHud} .stat.streak.loss .v { color:#ef4444; }
#${IDS.pnlHud} .stat.streak.win .v { color:#14b8a6; animation: streakPulse 1s infinite; }
@keyframes streakPulse { 0%{transform:scale(1);} 50%{transform:scale(1.05);} 100%{transform:scale(1);} }
#${IDS.pnlHud} .pillBtn{
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
#${IDS.pnlHud} .pillBtn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}
#${IDS.pnlHud} .startSol{ display:flex; align-items:center; gap:8px; }
#${IDS.pnlHud} input.startSolInput{
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
#${IDS.pnlHud} input.startSolInput:focus{
  border-color: #14b8a6;
}
#${IDS.pnlHud} .stats{ display:flex; gap:0; padding: 0; border-top: 1px solid rgba(20,184,166,0.1); }
#${IDS.pnlHud} .stat{
  flex:1;
  background: transparent;
  border: none;
  border-right: 1px solid rgba(20,184,166,0.1);
  border-radius: 0;
  padding: 16px 20px;
  text-align: left;
  transition: background 0.2s;
}
#${IDS.pnlHud} .stat:last-child{ border-right: none; }
#${IDS.pnlHud} .stat:hover{ background: rgba(20,184,166,0.05); }
#${IDS.pnlHud} .stat .k{ 
  font-size: 10px; 
  color: #64748b; 
  margin-bottom: 4px; 
  font-weight: 600; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
}
#${IDS.pnlHud} .stat .v{ 
  font-size: 16px; 
  font-weight: 700; 
  color: #f8fafc;
}
#${IDS.pnlHud} .tradeList{ max-height: 200px; overflow: auto; border-top: 1px solid rgba(20,184,166,0.1); }
#${IDS.pnlHud} .tradeRow{
  display:grid;
  grid-template-columns: 70px 70px 50px 100px 80px 70px;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(20,184,166,0.05);
  font-size: 11px;
  color: #e2e8f0;
  align-items: center;
}
#${IDS.pnlHud} .tradeRow:hover{ background: rgba(20,184,166,0.03); }
#${IDS.pnlHud} .tradeRow .muted{ color: #64748b; }
#${IDS.pnlHud} .tag{
  display:inline-flex; align-items:center; justify-content:center;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
}
#${IDS.pnlHud} .tag.buy{ 
  background: rgba(20,184,166,0.15);
  color: #14b8a6;
}
#${IDS.pnlHud} .tag.sell{ 
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

/* Custom confirm modal */
.confirm-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
}
.confirm-modal {
  background: linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(10,15,30,0.99) 100%);
  border: 1px solid rgba(99,102,241,0.35);
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  font-family: 'Inter', sans-serif;
}
.confirm-modal h3 {
  margin: 0 0 12px 0;
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 700;
}
.confirm-modal p {
  margin: 0 0 20px 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.5;
}
.confirm-modal-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.confirm-modal-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.confirm-modal-btn.cancel {
  background: rgba(100,116,139,0.3);
  color: #94a3b8;
}
.confirm-modal-btn.cancel:hover {
  background: rgba(100,116,139,0.5);
}
.confirm-modal-btn.confirm {
  background: rgba(239,68,68,0.8);
  color: white;
}
.confirm-modal-btn.confirm:hover {
  background: rgba(239,68,68,1);
}

#${IDS.buyHud}{ z-index: 2147483644; pointer-events: auto; font-size: 12px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
#${IDS.buyHud}.floating{ position: fixed; left: auto; top: 100px; width: 300px; max-width: calc(100vw - 24px); }
#${IDS.buyHud}.docked{ position: fixed; right: 16px; top: 320px; width: 300px; z-index: 2147483645; }
#${IDS.buyHud} .panel{
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}
#${IDS.buyHud}.docked .panel{ border-radius: 10px; }
#${IDS.buyHud} .panelHeader{
  display:flex; align-items:center; justify-content:space-between;
  padding: 12px 16px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}
#${IDS.buyHud} .panelHeader:active{ cursor: grabbing; }
#${IDS.buyHud} .panelTitle{ 
  display:flex; align-items:center; gap:10px; 
  font-weight: 700; 
  color: #14b8a6; 
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
#${IDS.buyHud} .panelTitle .dot{ 
  width:10px;height:10px;border-radius:999px; 
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
}
#${IDS.buyHud} .panelBtns{ display:flex; align-items:center; gap:8px; }
#${IDS.buyHud} .btn{
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
#${IDS.buyHud} .btn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}
#${IDS.buyHud} .tabs{ display:flex; gap:8px; padding: 12px 16px 0; }
#${IDS.buyHud} .tab{
  flex:1;
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
#${IDS.buyHud} .tab.active{ 
  background: rgba(20,184,166,0.15); 
  border-color: #14b8a6; 
  color: #14b8a6;
}
#${IDS.buyHud} .tab:hover:not(.active){ 
  background: #1c2128;
  border-color: rgba(20,184,166,0.25);
}
#${IDS.buyHud} .body{ padding: 14px 16px; }
#${IDS.buyHud} .fieldLabel{ 
  color: #64748b; 
  font-weight: 600; 
  margin-bottom: 8px; 
  font-size: 10px; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
}
#${IDS.buyHud} input.field{
  width:100%;
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
#${IDS.buyHud} input.field:focus{ 
  border-color: #14b8a6;
}
#${IDS.buyHud} .quickRow{ display:flex; flex-wrap:wrap; gap:8px; margin-top: 12px; }
#${IDS.buyHud} .qbtn{
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
#${IDS.buyHud} .qbtn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.3);
  color: #14b8a6;
}
#${IDS.buyHud} .action{
  margin-top: 14px;
  width:100%;
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
#${IDS.buyHud} .action:hover{ 
  background: #2dd4bf;
}
#${IDS.buyHud} .action.sell{ 
  background: #ef4444;
  color: white;
}
#${IDS.buyHud} .action.sell:hover{ 
  background: #f87171;
}
#${IDS.buyHud} .status{
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

#${IDS.buyHud} .strategyRow{
  margin-top: 12px;
}
#${IDS.buyHud} .strategySelect{
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
#${IDS.buyHud} .strategySelect:hover{
  border-color: rgba(20,184,166,0.5);
}
#${IDS.buyHud} .strategySelect:focus{
  border-color: #14b8a6;
}

/* Professor Trade Critique Popup */
/* Professor Trade Critique Popup */
.professor-overlay {
  position: fixed;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  animation: professorFadeIn 0.3s ease-out;
  /* Removed fullscreen backdrop */
}
.professor-overlay * {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
@keyframes professorFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.professor-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 500px;
  animation: professorSlideIn 0.4s ease-out;
}
@keyframes professorSlideIn {
  from { transform: translateY(30px) scale(0.9); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
.professor-image {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #6366f1;
  box-shadow: 0 0 30px rgba(99,102,241,0.4);
  margin-bottom: -20px;
  z-index: 1;
}
.professor-bubble {
  background: linear-gradient(145deg, #1e293b, #0f172a);
  border: 2px solid rgba(99,102,241,0.4);
  border-radius: 20px;
  padding: 25px 30px;
  color: #f1f5f9;
  font-size: 15px;
  line-height: 1.6;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  position: relative;
  text-align: center;
}
.professor-bubble::before {
  content: '';
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  border: 12px solid transparent;
  border-bottom-color: rgba(99,102,241,0.4);
}
.professor-bubble::after {
  content: '';
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  border: 10px solid transparent;
  border-bottom-color: #1e293b;
}
.professor-title {
  font-size: 18px;
  font-weight: 900;
  color: #a5b4fc;
  margin-bottom: 12px;
}
.professor-message {
  margin-bottom: 15px;
  color: #e2e8f0;
}
.professor-stats {
  background: rgba(15,23,42,0.5);
  border-radius: 12px;
  padding: 12px 16px;
  margin: 15px 0;
  font-size: 13px;
  text-align: left;
}
.professor-stats div {
  margin: 4px 0;
  color: #94a3b8;
}
.professor-stats span {
  color: #f1f5f9;
  font-weight: 700;
}
.professor-dismiss {
  margin-top: 15px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  color: white;
  padding: 10px 30px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  transition: all 0.2s;
}
.professor-dismiss:hover {
  background: linear-gradient(135deg, #818cf8, #6366f1);
  transform: scale(1.05);
}
/* Emotion Selector */
.emotion-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
  opacity: 0;
  animation: fadeIn 0.2s forwards;
}
@keyframes fadeIn { to { opacity: 1; } }

.emotion-modal {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 16px;
  padding: 24px;
  width: 340px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  text-align: center;
  transform: scale(0.9);
  animation: scaleIn 0.2s forwards;
}
@keyframes scaleIn { to { transform: scale(1); } }

.emotion-title {
  color: #14b8a6;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.emotion-subtitle {
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 20px;
}

.emotion-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.emotion-btn {
  background: #161b22;
  border: 1px solid rgba(20,184,166,0.15);
  color: #bdc6d5;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.emotion-btn:hover {
  background: rgba(20,184,166,0.05);
  border-color: rgba(20,184,166,0.3);
  color: #f8fafc;
  transform: translateY(-2px);
}
.emotion-btn.selected {
  background: rgba(20,184,166,0.15);
  border-color: #14b8a6;
  color: #14b8a6;
}

.emotion-skip {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}
.emotion-skip:hover { color: #94a3b8; }
/* Settings Modal */
.settings-modal {
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.2);
  border-radius: 16px;
  padding: 24px;
  width: 320px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8);
  font-family: 'Inter', sans-serif;
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.settings-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px; border-bottom: 1px solid rgba(20,184,166,0.1); padding-bottom: 12px;
}
.settings-title { font-size: 16px; font-weight: 700; color: #f8fafc; display:flex; align-items:center; gap:8px; }
.settings-close { background:none; border:none; color:#64748b; cursor:pointer; font-size:18px; transition:color 0.2s; }
.settings-close:hover { color: #f8fafc; }

.setting-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.setting-info { flex: 1; }
.setting-name { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 2px; }
.setting-desc { font-size: 11px; color: #94a3b8; line-height: 1.3; }

/* Toggle Switch */
.toggle-switch {
  position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #1e293b;
  transition: .3s;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.1);
}
.slider:before {
  position: absolute; content: "";
  height: 16px; width: 16px;
  left: 3px; bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}
input:checked + .slider { background-color: #14b8a6; border-color: #14b8a6; }
input:checked + .slider:before { transform: translateX(18px); }

/* Shadow Mode Overrides (Gold/Orange) */
.zero-shadow-mode .slider { background-color: #451a03; }
.zero-shadow-mode input:checked + .slider { background-color: #f59e0b; border-color: #f59e0b; }
.zero-shadow-mode #${IDS.pnlHud} .title .dot { background: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,0.5); }
.zero-shadow-mode #${IDS.pnlHud} .title { color: #f59e0b; }
.zero-shadow-mode #${IDS.buyHud} .panelTitle .dot { background: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,0.5); }
.zero-shadow-mode #${IDS.buyHud} .panelTitle { color: #f59e0b; }
.zero-shadow-mode #${IDS.buyHud} .action { background: #f59e0b; color: #000; }
.zero-shadow-mode #${IDS.buyHud} .action:hover { background: #fbbf24; }
/* Revert Banner for Shadow Mode */
.zero-shadow-mode #${IDS.banner} .label { color: #f59e0b; }
.zero-shadow-mode #${IDS.banner} .dot { background: #f59e0b; box-shadow: 0 0 8px rgba(245,158,11,0.5); }
`;
