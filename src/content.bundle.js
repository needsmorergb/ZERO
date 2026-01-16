(()=>{(()=>{"use strict";let P={isAxiom:window.location.hostname.includes("axiom.trade"),isPadre:window.location.hostname.includes("padre.gg"),name:window.location.hostname.includes("axiom.trade")?"Axiom":"Padre"},Kt=!1;function Qt(){return window.location.pathname.includes("/trade/")}let X={KEY:"sol_paper_trader_v1",VERSION:"0.1.0",DEBUG:!0,PLATFORM:P.name},g=(...e)=>X.DEBUG&&console.log("%cpaper:Padre v51-Brand","color: #ff0; font-weight: bold",...e),G={enabled:!0,buyHudDocked:!0,pnlDocked:!0,buyHudPos:{x:20,y:120},pnlPos:{x:20,y:60},startSol:10,quickBuySols:[.01,.05,.1,.25,.5,1],quickSellPcts:[10,25,50,75,100],cashSol:10,equitySol:10,realizedSol:0,positions:{},trades:[],winStreak:0,tokenDisplayUsd:!1,sessionDisplayUsd:!1},q=(e,o,t)=>Math.max(o,Math.min(t,e));function wt(e){try{return new Date(e).toLocaleTimeString([],{hour12:!1})}catch{return""}}function B(e){let o=Number.parseFloat(String(e).replace(/,/g,"").trim());return Number.isFinite(o)?o:0}function jt(e){let o=Number.parseInt(String(e).trim(),10);return Number.isFinite(o)?o:0}function I(e){return Number.isFinite(e)?e.toFixed(4):"0.0000"}function ct(){try{return typeof chrome<"u"&&chrome.storage&&chrome.storage.local}catch{return!1}}function kt(e){return new Promise(o=>{if(!ct())return o(void 0);chrome.storage.local.get([e],t=>o(t[e]))})}function St(e){return new Promise(o=>{if(!ct())return o();chrome.storage.local.set(e,()=>o())})}function J(e,o){if(!o||typeof o!="object")return e;let t=Array.isArray(e)?[...e]:{...e};for(let[s,r]of Object.entries(o))r&&typeof r=="object"&&!Array.isArray(r)&&e[s]&&typeof e[s]=="object"?t[s]=J(e[s],r):t[s]=r;return t}let i={banner:"paper-mode-banner",pnlHud:"paper-pnl-hud",buyHud:"paper-buyhud-root",style:"paper-overlay-style"},Pt=`
.zero-inline-icon { height:14px; width:14px; vertical-align:-2px; margin:0 1px; display:inline-block; }
#${i.banner}{
  position:fixed; left:0; right:0; top:0;
  height:44px;
  z-index:2147483646;
  display:flex; align-items:center; justify-content:center;
  user-select:none;
  pointer-events:auto;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.15);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${i.banner} .inner{ display:flex; align-items:center; gap:24px; font-size:12px; letter-spacing:0.3px; }
#${i.banner} .dot{ width:8px;height:8px;border-radius:999px; background: #14b8a6; box-shadow: 0 0 8px rgba(20,184,166,0.5); }
#${i.banner}.disabled .dot{ background: #475569; box-shadow: none; }
#${i.banner} .label{ color: #14b8a6; font-weight:700; text-transform: uppercase; letter-spacing: 1px; }
#${i.banner} .state{ color: #f8fafc; font-weight:600; }
#${i.banner}.disabled .state{ color: #64748b; }
#${i.banner} .hint{ color: #64748b; font-weight:500; }

#${i.pnlHud}{
  position: fixed;
  z-index: 2147483645;
  width: 720px;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${i.pnlHud}.docked{ left: 50%; transform: translateX(-50%); top: 50px; }
#${i.pnlHud}.floating{ left: 20px; top: 60px; transform: none; }
#${i.pnlHud} .card{
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}
#${i.pnlHud} .header{
  display:flex; align-items:center; justify-content:space-between;
  padding: 14px 20px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}
#${i.pnlHud} .header:active{ cursor: grabbing; }
#${i.pnlHud} .title{
  display:flex; align-items:center; gap:10px;
  font-size: 13px; font-weight: 700;
  color: #14b8a6;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
#${i.pnlHud} .title .dot{ 
  width:10px;height:10px;border-radius:999px; 
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.9)} }
#${i.pnlHud} .controls{ display:flex; align-items:center; gap:12px; font-size: 11px; color: #64748b; }
#${i.pnlHud} .stat.streak .v { font-size:20px; font-weight:800; color: #14b8a6; }
#${i.pnlHud} .stat.streak.loss .v { color:#ef4444; }
#${i.pnlHud} .stat.streak.win .v { color:#14b8a6; animation: streakPulse 1s infinite; }
@keyframes streakPulse { 0%{transform:scale(1);} 50%{transform:scale(1.05);} 100%{transform:scale(1);} }
#${i.pnlHud} .pillBtn{
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
#${i.pnlHud} .pillBtn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}
#${i.pnlHud} .startSol{ display:flex; align-items:center; gap:8px; }
#${i.pnlHud} input.startSolInput{
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
#${i.pnlHud} input.startSolInput:focus{
  border-color: #14b8a6;
}
#${i.pnlHud} .stats{ display:flex; gap:0; padding: 0; border-top: 1px solid rgba(20,184,166,0.1); }
#${i.pnlHud} .stat{
  flex:1;
  background: transparent;
  border: none;
  border-right: 1px solid rgba(20,184,166,0.1);
  border-radius: 0;
  padding: 16px 20px;
  text-align: left;
  transition: background 0.2s;
}
#${i.pnlHud} .stat:last-child{ border-right: none; }
#${i.pnlHud} .stat:hover{ background: rgba(20,184,166,0.05); }
#${i.pnlHud} .stat .k{ 
  font-size: 10px; 
  color: #64748b; 
  margin-bottom: 4px; 
  font-weight: 600; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
}
#${i.pnlHud} .stat .v{ 
  font-size: 16px; 
  font-weight: 700; 
  color: #f8fafc;
}
#${i.pnlHud} .tradeList{ max-height: 200px; overflow: auto; border-top: 1px solid rgba(20,184,166,0.1); }
#${i.pnlHud} .tradeRow{
  display:grid;
  grid-template-columns: 70px 70px 50px 100px 80px 70px;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(20,184,166,0.05);
  font-size: 11px;
  color: #e2e8f0;
  align-items: center;
}
#${i.pnlHud} .tradeRow:hover{ background: rgba(20,184,166,0.03); }
#${i.pnlHud} .tradeRow .muted{ color: #64748b; }
#${i.pnlHud} .tag{
  display:inline-flex; align-items:center; justify-content:center;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
}
#${i.pnlHud} .tag.buy{ 
  background: rgba(20,184,166,0.15);
  color: #14b8a6;
}
#${i.pnlHud} .tag.sell{ 
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

/* Custom confirm modal (replaces window.confirm which is blocked in shadow DOM) */
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

#${i.buyHud}{ z-index: 2147483644; pointer-events: auto; font-size: 12px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
#${i.buyHud}.floating{ position: fixed; right: 18px; top: 100px; width: 300px; max-width: calc(100vw - 24px); }
#${i.buyHud}.docked{ position: fixed; right: 16px; top: 320px; width: 300px; z-index: 2147483645; }
#${i.buyHud} .panel{
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.15);
  border-radius: 12px;
  overflow: hidden;
}
#${i.buyHud}.docked .panel{ border-radius: 10px; }
#${i.buyHud} .panelHeader{
  display:flex; align-items:center; justify-content:space-between;
  padding: 12px 16px;
  background: #0d1117;
  border-bottom: 1px solid rgba(20,184,166,0.1);
  cursor: grab;
}
#${i.buyHud} .panelHeader:active{ cursor: grabbing; }
#${i.buyHud} .panelTitle{ 
  display:flex; align-items:center; gap:10px; 
  font-weight: 700; 
  color: #14b8a6; 
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
#${i.buyHud} .panelTitle .dot{ 
  width:10px;height:10px;border-radius:999px; 
  background: #14b8a6;
  box-shadow: 0 0 10px rgba(20,184,166,0.5);
}
#${i.buyHud} .panelBtns{ display:flex; align-items:center; gap:8px; }
#${i.buyHud} .btn{
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
#${i.buyHud} .btn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.4);
  color: #14b8a6;
}
#${i.buyHud} .tabs{ display:flex; gap:8px; padding: 12px 16px 0; }
#${i.buyHud} .tab{
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
#${i.buyHud} .tab.active{ 
  background: rgba(20,184,166,0.15); 
  border-color: #14b8a6; 
  color: #14b8a6;
}
#${i.buyHud} .tab:hover:not(.active){ 
  background: #1c2128;
  border-color: rgba(20,184,166,0.25);
}
#${i.buyHud} .body{ padding: 14px 16px; }
#${i.buyHud} .fieldLabel{ 
  color: #64748b; 
  font-weight: 600; 
  margin-bottom: 8px; 
  font-size: 10px; 
  text-transform: uppercase; 
  letter-spacing: 0.5px;
}
#${i.buyHud} input.field{
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
#${i.buyHud} input.field:focus{ 
  border-color: #14b8a6;
}
#${i.buyHud} .quickRow{ display:flex; flex-wrap:wrap; gap:8px; margin-top: 12px; }
#${i.buyHud} .qbtn{
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
#${i.buyHud} .qbtn:hover{ 
  background: rgba(20,184,166,0.1);
  border-color: rgba(20,184,166,0.3);
  color: #14b8a6;
}
#${i.buyHud} .action{
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
#${i.buyHud} .action:hover{ 
  background: #2dd4bf;
}
#${i.buyHud} .action.sell{ 
  background: #ef4444;
  color: white;
}
#${i.buyHud} .action.sell:hover{ 
  background: #f87171;
}
#${i.buyHud} .status{
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

/* Professor Trade Critique Popup */
.professor-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  animation: professorFadeIn 0.3s ease-out;
  pointer-events: auto;
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
`,n=J(G,{}),Yt=null,pt=!1,tt=null,et=!1,ut=0,ot=!1,H=null,C=null;function U(){if(C&&H&&H.isConnected)return C;H=document.createElement("paper-trader-host"),H.style.cssText="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none;",C=H.attachShadow({mode:"open"});let e=document.createElement("div");return e.id="paper-shadow-container",e.style.cssText="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647;",C.appendChild(e),document.documentElement.appendChild(H),g("Shadow DOM created for React isolation"),C}function j(){let e=U();return e.getElementById("paper-shadow-container")||e}async function ft(){let e=await kt(X.KEY);n=J(G,e||{}),n.startSol=B(n.startSol)||G.startSol,Number.isFinite(n.cashSol)||(n.cashSol=n.startSol),Number.isFinite(n.equitySol)||(n.equitySol=n.cashSol)}async function E(){await St({[X.KEY]:n})}function $t(){let e=U();if(e.getElementById(i.style))return;let o=document.createElement("style");o.id=i.style,o.textContent=Pt,e.appendChild(o)}function Et(){if(!P.isPadre)return;let e="paper-padre-offset-style";if(document.getElementById(e))return;let o=document.createElement("style");o.id=e,o.textContent=`
      /* Push down Padre's fixed/sticky header elements */
      /* Use top specifically for sticky/fixed elements */
      header, nav, [class*="Header"], [class*="Nav"], .MuiAppBar-root, [style*="sticky"], [style*="fixed"], [data-testid="top-bar"] {
        top: 28px !important;
        margin-top: 28px !important;
      }
      /* Specifically target Padre's MuiBox root header if sticky/absolute */
      .MuiBox-root[style*="top: 0"], .MuiBox-root[style*="top:0"] {
        top: 28px !important;
      }
      
      /* Also push down the main content */
      #root, main, [class*="main"], body > div:first-child {
        padding-top: 28px !important;
      }
    `,document.head.appendChild(o),g("Padre header offset CSS injected")}function Tt(){try{if(document.body){let o=getComputedStyle(document.body).fontFamily;if(o&&o!=="inherit")return o}}catch{}let e=[document.querySelector("#root"),document.querySelector("[data-testid]"),document.querySelector("main"),document.querySelector("header")].filter(Boolean);for(let o of e)try{let t=getComputedStyle(o).fontFamily;if(t&&t!=="inherit")return t}catch{}try{let o=Array.from(document.querySelectorAll("button, input, span, div")).filter(t=>{let s=t.getBoundingClientRect();return s.width>20&&s.height>10&&s.top>=0&&s.left>=0&&s.top<window.innerHeight}).slice(0,40);for(let t of o){let s=getComputedStyle(t).fontFamily;if(s&&s!=="inherit")return s}}catch{}return""}function Y(){if(P.isPadre)return;let e=Tt();if(!e)return;let o=[document.getElementById(i.banner),document.getElementById(i.pnlHud),document.getElementById(i.buyHud)].filter(Boolean);for(let t of o)t.style.fontFamily=e}function Ht(){if(!document.body)return;let e=28,o=document.body;if(o.getAttribute("data-paper-prev-padding-top")||o.setAttribute("data-paper-prev-padding-top",getComputedStyle(o).paddingTop||"0px"),B(getComputedStyle(o).paddingTop)<e&&(o.style.paddingTop=`${e}px`),P.isPadre){let r=document.querySelector("header")||document.querySelector("nav")||document.querySelector('[class*="Header"]')||document.querySelector('[class*="header"]');if(r){let c=getComputedStyle(r);(c.position==="fixed"||c.position==="sticky")&&B(c.top)<e&&(r.style.top=`${e}px`)}let l=document.querySelector("#root")||document.querySelector('[class*="main"]')||document.querySelector("main");l&&(l.getAttribute("data-paper-prev-margin-top")||l.setAttribute("data-paper-prev-margin-top",getComputedStyle(l).marginTop||"0px"),B(getComputedStyle(l).marginTop)<e&&(l.style.marginTop=`${e}px`))}}function Ct(){let e=j();if(U().getElementById(i.banner)){_();return}let o=document.createElement("div");o.id=i.banner,o.style.pointerEvents="auto",o.innerHTML=`
      <div class="inner" title="Click to toggle ZER\xD8 mode">
        <div class="dot"></div>
        <div class="label">ZER\xD8 MODE</div>
        <div class="state">ENABLED</div>
        <div class="hint">Click to toggle</div>
      </div>
    `,o.addEventListener("click",async t=>{t.preventDefault(),t.stopPropagation(),n.enabled=!n.enabled,await E(),_(),N()}),e.appendChild(o),_()}function _(){let e=U().getElementById(i.banner);if(!e)return;let o=e.querySelector(".state");o&&(o.textContent=n.enabled?"ENABLED":"DISABLED"),e.classList.toggle("disabled",!n.enabled)}function mt(e,o,t){let s=!1,r=0,l=0,c=a=>{a.button!==void 0&&a.button!==0||(s=!0,r=a.clientX,l=a.clientY,a.preventDefault(),a.stopPropagation(),window.addEventListener("mousemove",f,!0),window.addEventListener("mouseup",d,!0))},f=a=>{if(!s)return;let p=a.clientX-r,u=a.clientY-l;r=a.clientX,l=a.clientY,o(p,u),a.preventDefault(),a.stopPropagation()},d=async a=>{s&&(s=!1,window.removeEventListener("mousemove",f,!0),window.removeEventListener("mouseup",d,!0),t&&await t(),a.preventDefault(),a.stopPropagation())};e.addEventListener("mousedown",c)}function _t(){let e=Array.from(document.querySelectorAll("button")).filter(r=>{let l=(r.textContent||"").trim();return/^Buy\s+/i.test(l)||/^Sell\s+/i.test(l)}),o=null,t=0;for(let r of e){let l=r.getBoundingClientRect();if(l.width<140||l.height<28)continue;let c=l.left>window.innerWidth*.55?1:0,f=l.width*l.height+c*1e4;f>t&&(t=f,o=r)}if(!o)return null;let s=o.closest("div");for(let r=0;r<8&&s;r++){let l=s.querySelector("input")!=null,c=s.querySelectorAll("button").length>=4,f=s.getBoundingClientRect(),d=f.width>=260&&f.width<=520&&f.height>=220;if(l&&c&&d)return s;s=s.parentElement}return o.parentElement||null}function R(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function D(){let e=null,o=null;try{let s=location.href.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);s&&(e=s[1])}catch{}try{let t=Array.from(document.querySelectorAll("div, span, a")).filter(s=>(s.textContent||"").includes("CA:")).slice(0,8);for(let s of t){let l=(s.textContent||"").trim().match(/CA:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);if(l){e=l[1];break}}}catch{}try{let t=document.title;if(t&&(t.includes("Padre")||t.includes("Terminal"))){let s=t.split("|");if(s.length>=1){let r=s[0].trim();r&&r.length>0&&r.length<=20&&(o=r,g("Symbol from title:",o))}}}catch{}if(!o)try{let t=document.querySelector("h1");if(t){let r=(t.textContent||"").trim().replace("/SOL","").replace("Price","").trim();r&&r.length>1&&r.length<=12&&(o=r)}}catch{}if(!o)try{let t=document.querySelector('button[aria-label="Change symbol"]');if(t){let s=(t.textContent||"").trim();if(s){let r=s.split("/")[0].trim();r&&r.length>0&&(o=r,g("Symbol from button:",o))}}}catch{}return o||(o="TOKEN"),e?{mint:e,symbol:o}:{mint:null,symbol:o}}function nt(){let e=null;try{if(P.isPadre){let t=(document.title||"").match(/\$([\d,.]+)\s*([KMB])/i);if(t)return e=rt(t[1],t[2]),e;let s=Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2, p.MuiTypography-body1")).filter(r=>/\$[\d.]+[KMB]/i.test(r.textContent));for(let r of s){let c=(r.textContent||"").match(/\$?([\d,.]+)\s*([KMB])/i);if(c)return e=rt(c[1],c[2]),e}}else{let t=document.body.innerText.match(/\$?([\d,.]+)\s*([KMB])\s+Price/i);if(t)return rt(t[1],t[2])}}catch(o){g("MC Error",o)}return e||0}function rt(e,o){let t=parseFloat(e.replace(/,/g,"")),s=o.toUpperCase();return s==="K"&&(t*=1e3),s==="M"&&(t*=1e6),s==="B"&&(t*=1e9),t}function bt(){if(n.solPrice&&Date.now()-(n.solPriceTs||0)<5e3)return n.solPrice;let e=null;if(P.isAxiom){let o=Array.from(document.querySelectorAll("img")).find(t=>(t.src.toLowerCase().includes("solana")||t.src.toLowerCase().includes("sol.png"))&&t.clientWidth<40);if(o&&o.parentElement){let s=o.parentElement.textContent.replace("$","").replace(",","").trim(),r=parseFloat(s);!isNaN(r)&&r>10&&r<1e3&&(e=r)}}if(!e&&P.isPadre){let o=Array.from(document.querySelectorAll("span, div, p")).filter(t=>t.children.length===0&&t.textContent.trim().startsWith("$")).map(t=>parseFloat(t.textContent.trim().replace("$","").replace(",",""))).filter(t=>!isNaN(t)&&t>50&&t<500);o.length>0&&(e=o[0])}if(!e){let o=Array.from(document.querySelectorAll("div, span, button")).filter(t=>t.children.length===0&&t.textContent.trim().startsWith("$")).map(t=>parseFloat(t.textContent.trim().replace("$","").replace(",",""))).filter(t=>!isNaN(t)&&t>50&&t<500);o.length>0&&(e=o[0])}return e?(n.solPrice=e,n.solPriceTs=Date.now(),e):n.solPrice||200}function Lt(){let e=U(),o=j(),t=e.getElementById(i.pnlHud);if(!n.enabled){t&&(t.style.display="none");return}if(t&&(t.style.display=""),!t){t=document.createElement("div"),t.id=i.pnlHud,t.style.pointerEvents="auto",t.innerHTML=`
        <div class="card">
          <div class="header">
            <div class="title"><span class="dot"></span> ZER\xD8 PNL <span class="muted" data-k="tokenSymbol" style="font-weight:700;color:rgba(148,163,184,0.85);">TOKEN</span></div>
            <div class="controls">
              <div class="startSol">
                <span style="font-weight:700;color:rgba(203,213,225,0.92);">Start SOL</span>
                <input class="startSolInput" type="text" inputmode="decimal" />
              </div>
              <button class="pillBtn" data-act="trades">Trades</button>
              <button class="pillBtn" data-act="reset" style="color:#ef4444;">Reset</button>
              <button class="pillBtn" data-act="dock">Dock</button>
            </div>
          </div>
          <div class="stats">
          <div class="stat" style="cursor:pointer;" data-act="toggleTokenUnit">
            <div class="k">UNREALIZED P&L <span data-k="tokenUnit" style="opacity:0.6;font-size:9px;">SOL</span></div>
            <div class="v" data-k="tokenValue">0.0000</div>
          </div>
          <div class="stat">
            <div class="k">BALANCE</div>
            <div class="v" data-k="balance">0.0000 SOL</div>
          </div>
          <div class="stat" style="cursor:pointer;" data-act="toggleSessionUnit">
            <div class="k">SESSION P&L <span data-k="pnlUnit" style="opacity:0.6;font-size:9px;">SOL</span></div>
            <div class="v" data-k="pnl" style="color:#10b981;">+0.0000 SOL</div>
          </div>
          <div class="stat streak">
            <div class="k">WIN STREAK</div>
            <div class="v" data-k="streak">0</div>
          </div>
        </div>
          <div class="tradeList" style="display:none;"></div>
        </div>
      `,o.appendChild(t);let s=t.querySelector(".header");mt(s,(l,c)=>{n.pnlDocked||(n.pnlPos.x+=l,n.pnlPos.y+=c,n.pnlPos.x=q(n.pnlPos.x,0,window.innerWidth-40),n.pnlPos.y=q(n.pnlPos.y,34,window.innerHeight-40),t.style.left=`${n.pnlPos.x}px`,t.style.top=`${n.pnlPos.y}px`)},async()=>{n.pnlDocked||await E()}),t.addEventListener("click",async l=>{let c=l.target;if(c.matches&&c.matches("input, textarea, label, .startSolInput"))return;let d=c.closest("[data-act]")?.getAttribute("data-act");if(g("PNL HUD click:",c.tagName,c.className,"act:",d),c instanceof HTMLElement){if(d==="dock"){n.pnlDocked=!n.pnlDocked,await E(),P.isPadre?K():N(),l.preventDefault(),l.stopPropagation();return}if(d==="trades"){let a=t.querySelector(".tradeList");a&&(a.style.display=a.style.display==="none"?"block":"none",st(a)),l.preventDefault(),l.stopPropagation()}if(d==="reset"){g("Reset button clicked, showing custom modal");let a=document.createElement("div");a.className="confirm-modal-overlay",a.innerHTML=`
            <div class="confirm-modal">
              <h3>Reset Session?</h3>
              <p>This will clear all realized P&L, trade history, and active positions. Your Start SOL balance will be restored.</p>
              <div class="confirm-modal-buttons">
                <button class="confirm-modal-btn cancel">Cancel</button>
                <button class="confirm-modal-btn confirm">Reset</button>
              </div>
            </div>
          `,U().appendChild(a);let p=()=>a.remove();a.querySelector(".cancel").addEventListener("click",x=>{x.stopPropagation(),p()}),a.querySelector(".confirm").addEventListener("click",async x=>{x.stopPropagation(),g("Reset confirmed via custom modal"),n.cashSol=n.startSol,n.realizedSol=0,n.positions={},n.trades=[],await E(),$();let m=t.querySelector(".tradeList");m&&st(m),p()}),a.addEventListener("click",x=>{x.target===a&&(x.stopPropagation(),p())}),l.preventDefault(),l.stopPropagation()}d==="toggleTokenUnit"&&(n.tokenDisplayUsd=!n.tokenDisplayUsd,await E(),$(),l.preventDefault(),l.stopPropagation()),d==="toggleSessionUnit"&&(n.sessionDisplayUsd=!n.sessionDisplayUsd,await E(),$(),l.preventDefault(),l.stopPropagation())}});let r=t.querySelector("input.startSolInput");r&&(r.value=String(n.startSol),r.addEventListener("change",async()=>{let l=B(r.value);if(l>0){let c=(n.trades||[]).length>0;n.startSol=l,c||(n.cashSol=l,n.equitySol=l,n.realizedSol=0,n.positions={},n.trades=[]),await E(),$()}else r.value=String(n.startSol)}))}t.className=n.pnlDocked?"docked":"floating",n.pnlDocked?(t.style.left="",t.style.top=""):(t.style.left=`${q(n.pnlPos.x,0,window.innerWidth-40)}px`,t.style.top=`${q(n.pnlPos.y,34,window.innerHeight-40)}px`,t.style.transform="none")}function Mt(){let e=0,o=n.positions||{};for(let t of Object.values(o)){if(!t||!t.tokenQty||t.tokenQty<=0)continue;let s=Number(t.entryPriceUsd||0),r=Number(t.lastPriceUsd||s),l=Number(t.tokenQty||0);if(!Number.isFinite(s)||s<=0||!Number.isFinite(r)||r<=0)continue;let d=(r-s)*l/200;e+=d}return e}function Ut(){let e=n.trades||[];if(e.length===0)return null;let o=e.slice(-10),t=0,s=0,r=0,l=0,c=0,f=0,d=0,a=0,p=0,u=0;for(let y of o){if(y.pnlSol>0?t++:s++,l+=y.pnlSol||0,y.entryTs&&y.exitTs){let b=y.exitTs-y.entryTs;r+=b,b<6e4&&p++,b>6e5&&u++}y.entryMc&&(c+=y.entryMc,d++),y.exitMc&&(f+=y.exitMc,a++)}let S=o.length>0?r/o.length/1e3:0;c=d>0?c/d:0,f=a>0?f/a:0;let x=o.length>0?t/o.length*100:0,m="balanced";return p>o.length*.6?m="scalper":u>o.length*.4?m="swing":c<1e5?m="degen":c>5e5&&(m="conservative"),{totalTrades:o.length,wins:t,losses:s,winRate:x.toFixed(1),avgHoldTimeSec:S,avgEntryMc:c,avgExitMc:f,totalPnlSol:l,style:m,quickFlips:p,longHolds:u}}function yt(e,o){let t=Ut(),s=j();if(!s)return;let r=typeof chrome<"u"&&chrome.runtime?.getURL?chrome.runtime.getURL("src/professor.png"):"",l,c;if(e==="achievement"){l="\u{1F3C6} Incredible Achievement!";let a=["Remarkable! A 10-win streak shows true discipline. You've mastered the art of knowing when to take profits!","Outstanding work, trader! Your consistency is legendary. Keep that winning momentum going!","Phenomenal streak! You're reading the market like a pro. Remember, the key is sustainable success!"];c=a[Math.floor(Math.random()*a.length)]}else{l="\u{1F4CA} Trade Analysis";let a={scalper:["I see you're a fast trader! Quick flips can be profitable, but watch out for overtrading fees eating into gains.","Speed is your game! Consider adding a cooldown between trades to avoid emotional decisions.","Rapid-fire trading detected! Remember, sometimes the best trade is no trade at all."],swing:["You like to hold positions. Make sure you're setting proper stop losses to protect those gains!","Patient trader, I see! Consider taking partial profits along the way to lock in gains.","Long holds can be rewarding, but don't let winners turn into losers. Set exit targets!"],degen:["Low market cap plays are high risk! Consider sizing down on these volatile micro-caps.","I see you like the small caps! Exciting, but remember - most of these go to zero. Size wisely!","Degen mode activated! Just remember, it's okay to take profits on the way up."],conservative:["You trade safer market caps. Good discipline! But sometimes a bit of risk brings reward.","Conservative approach noted. Consider allocating a small portion to higher-risk plays.","Steady trading style! Your risk management is solid. Keep building those consistent gains."],balanced:["Your streak ended, but that's part of the game. Review what made this trade different.","Every loss is a lesson! Look at your entry timing and market conditions.","The market humbled you today. Take a moment to analyze before the next trade."]},p=t?.style||"balanced",u=a[p]||a.balanced;c=u[Math.floor(Math.random()*u.length)],o>0&&(c=`Your ${o}-win streak has ended. `+c)}let f="";if(t&&t.totalTrades>0){let a=u=>u>=1e6?`$${(u/1e6).toFixed(1)}M`:u>=1e3?`$${(u/1e3).toFixed(0)}K`:`$${u.toFixed(0)}`,p=u=>u>=3600?`${(u/3600).toFixed(1)}h`:u>=60?`${(u/60).toFixed(1)}m`:`${u.toFixed(0)}s`;f=`
        <div class="professor-stats">
          <div>\u{1F4C8} Win Rate: <span>${t.winRate}%</span> (${t.wins}W / ${t.losses}L)</div>
          <div>\u23F1\uFE0F Avg Hold Time: <span>${p(t.avgHoldTimeSec)}</span></div>
          ${t.avgEntryMc>0?`<div>\u{1F3AF} Avg Entry MC: <span>${a(t.avgEntryMc)}</span></div>`:""}
          <div>\u{1F4B0} Session P&L: <span style="color:${t.totalPnlSol>=0?"#10b981":"#ef4444"}">${t.totalPnlSol>=0?"+":""}${t.totalPnlSol.toFixed(4)} SOL</span></div>
          <div>\u{1F3AE} Style: <span>${t.style.charAt(0).toUpperCase()+t.style.slice(1)}</span></div>
        </div>
      `}let d=document.createElement("div");d.className="professor-overlay",d.innerHTML=`
      <div class="professor-container">
        ${r?`<img class="professor-image" src="${r}" alt="Professor">`:""}
        <div class="professor-bubble">
          <div class="professor-title">${l}</div>
          <div class="professor-message">${c}</div>
          ${f}
          <button class="professor-dismiss">Got it!</button>
        </div>
      </div>
    `,s.appendChild(d),d.querySelector(".professor-dismiss").addEventListener("click",()=>{d.style.animation="professorFadeIn 0.2s ease-out reverse",setTimeout(()=>d.remove(),200)}),d.addEventListener("click",a=>{a.target===d&&(d.style.animation="professorFadeIn 0.2s ease-out reverse",setTimeout(()=>d.remove(),200))}),g("Professor critique shown:",e,o)}function $(){let e=U().getElementById(i.pnlHud);if(!e)return;let o=Mt(),t=Number(n.realizedSol||0),s=Number(n.cashSol||0),r=200,l=Math.abs(n.startSol||10)*10,c=Math.abs(o)>l?0:o,f=s,d=c+t,a=0,p=0;for(let h of Object.values(n.positions||{}))if(h&&h.tokenQty>0&&h.lastPriceUsd>0){let w=h.tokenQty*h.lastPriceUsd;p+=w,a+=w/r}let u=e.querySelector('[data-k="balance"]');u&&(u.textContent=`${I(f)} SOL`);let S=e.querySelector('[data-k="tokenValue"]'),x=e.querySelector('[data-k="tokenUnit"]');if(S){let h=c>=0?"+":"";if(n.tokenDisplayUsd){let w=c*r;S.textContent=`${h}$${Math.abs(w).toFixed(2)}`,x&&(x.textContent="USD")}else S.textContent=`${h}${I(c)} SOL`,x&&(x.textContent="SOL");S.style.color=c>=0?"#10b981":"#ef4444"}let m=e.querySelector('[data-k="pnl"]'),y=e.querySelector('[data-k="pnlUnit"]');if(m){let h=d>=0?"+":"";if(n.sessionDisplayUsd){let w=d*r;m.textContent=`${h}$${Math.abs(w).toFixed(2)}`,y&&(y.textContent="USD")}else m.textContent=`${h}${I(d)} SOL`,y&&(y.textContent="SOL");m.style.color=d>=0?"#10b981":"#ef4444"}let b=e.querySelector(".stat.streak"),v=e.querySelector('[data-k="streak"]');if(b&&v){let h=n.winStreak||0;v.textContent=h,b.classList.remove("win","loss"),h>0?b.classList.add("win"):h===0&&n.lastTradeWasLoss&&(b.classList.add("loss"),setTimeout(()=>b.classList.remove("loss"),2e3),n.lastTradeWasLoss=!1)}let k=e.querySelector('[data-k="tokenSymbol"]');if(k){let h=D()?.symbol;h&&h!=="TOKEN"&&(k.textContent=h)}let T=e.querySelector(".tradeList");T&&T.style.display!=="none"&&st(T)}function st(e){let o=(n.trades||[]).slice().reverse().slice(0,50);if(o.length===0){e.innerHTML='<div style="padding:12px;color:rgba(148,163,184,0.9);font-weight:700;">No trades yet</div>';return}e.innerHTML=o.map(t=>{let s=t.side==="SELL"?"sell":"buy",r=t.side==="SELL"?"SELL":"BUY",l=wt(t.ts),c=t.symbol||"TOKEN",f=t.side==="SELL"?`${Number(t.tokenQty||0).toFixed(2)} tok`:`${I(Number(t.solSize||0))} SOL`,d=t.priceUsd?`$${Number(t.priceUsd).toFixed(6)}`:"",p=(u=>u?u>=1e6?`$${(u/1e6).toFixed(1)}M`:u>=1e3?`$${(u/1e3).toFixed(0)}K`:`$${u.toFixed(0)}`:"-")(t.marketCap);return`
          <div class="tradeRow">
            <div class="muted">${R(l)}</div>
            <div style="font-weight:700;">${R(c)}</div>
            <div><span class="tag ${s}">${r}</span></div>
            <div>${R(f)}</div>
            <div>${R(d)}</div>
            <div style="color:#94a3b8;">${p}</div>
          </div>
          `}).join("")}function gt(e){if(!e||!e.price)return;let o=Number(e.price);if(!Number.isFinite(o)||o<=0)return;let t=!1;for(let s of Object.keys(n.positions||{})){let r=n.positions[s];r&&r.tokenQty>0&&(r.lastPriceUsd=o,r.lastPriceTs=Date.now(),t=!0)}t&&$()}function at(e,o,t,s,r){if(!P.isPadre){g("Trade markers only supported on Padre (TradingView)");return}let l=r||Date.now();g("Sending TRADE_EXECUTED message to page-bridge:",{side:e,price:o,marketCap:s,ts:l}),window.postMessage({__paper:!0,type:"TRADE_EXECUTED",side:e.toLowerCase(),price:o,marketCap:s,timestamp:l},"*")}function At(){if(!P.isPadre||!n.trades||n.trades.length===0)return;let e=qt();if(!e){g("renderTradeMarkers: No current token mint found");return}let o=n.trades.filter(t=>t.mint===e);g("renderTradeMarkers: Found",o.length,"trades for",e),o.forEach(t=>{let s=Math.floor(t.ts/1e3);at(t.side.toLowerCase(),t.priceUsd,t.solSize,t.marketCap,s)})}function qt(){let e=window.location.pathname.match(/\/([A-Za-z0-9]{32,})/);return e?e[1]:D()?.mint||null}function Bt(e,o=5e3){P.isPadre&&(g("Waiting",o,"ms for TradingView widget to initialize..."),setTimeout(()=>{g("Rendering stored trade markers via page-bridge"),e()},o))}function Dt(){let e=D();window.postMessage({__paper:!0,type:"PAPER_SET_CONTEXT",mint:e?.mint||null,symbol:e?.symbol||"TOKEN"},"*")}let W="buy",it=!1;function zt(){let e=U(),o=j(),t=e.getElementById(i.buyHud);if(!n.enabled){t&&(t.style.display="none");return}if(t&&(t.style.display=""),!t){t=document.createElement("div"),t.id=i.buyHud,t.style.pointerEvents="auto",t.innerHTML=`
          <div class="panel">
          <div class="panelHeader">
            <div class="panelTitle"><span class="dot"></span> ZER\xD8</div>
            <div class="panelBtns">
              <button class="btn" data-act="dock">Dock</button>
              <button class="btn" data-act="edit">Edit</button>
            </div>
          </div>
          <div class="tabs">
            <button class="tab active" data-tab="buy">BUY</button>
            <button class="tab" data-tab="sell">SELL</button>
          </div>
          <div class="body">
            <div class="fieldLabel" data-k="label">Buy Amount (SOL)</div>
            <input class="field" data-k="field" type="text" inputmode="decimal" placeholder="e.g. 0.25" />
            <div class="quickRow" data-k="quick"></div>
            <button class="action" data-act="action">ZER\xD8 Buy TOKEN</button>
            <div class="status" data-k="status"></div>
          </div>
        </div>
          `,o.appendChild(t);let s=t.querySelector(".panelHeader");mt(s,(r,l)=>{n.buyHudDocked||(n.buyHudPos.x+=r,n.buyHudPos.y+=l,n.buyHudPos.x=q(n.buyHudPos.x,0,window.innerWidth-100),n.buyHudPos.y=q(n.buyHudPos.y,34,window.innerHeight-80),t.style.left=`${n.buyHudPos.x}px`,t.style.right="auto",t.style.top=`${n.buyHudPos.y}px`)},async()=>{n.buyHudDocked||await E()}),t.addEventListener("click",async r=>{let l=r.target;if(!(l instanceof HTMLElement))return;let c=l.getAttribute("data-act"),f=l.getAttribute("data-tab");if(f){W=f==="sell"?"sell":"buy",Z(),r.preventDefault(),r.stopPropagation();return}if(c==="dock"){n.buyHudDocked=!n.buyHudDocked,await E(),P.isPadre?K():N(),r.preventDefault(),r.stopPropagation();return}if(c==="edit"){it=!it,Z(),r.preventDefault(),r.stopPropagation();return}if(c==="action"){if(!n.enabled){let m=t.querySelector('[data-k="status"]');m&&(m.textContent="ZER\xD8 mode is disabled. Click the banner to enable."),r.preventDefault(),r.stopPropagation();return}let d=t.querySelector('input[data-k="field"]'),a=d?d.value.trim():"";if(!a){let m=t.querySelector('[data-k="status"]');m&&(m.textContent="Please enter an amount."),r.preventDefault(),r.stopPropagation();return}let p=D(),u=p?.symbol||"TOKEN",S=p?.mint||null,x=()=>{let m=v=>{let k={"\u2080":0,"\u2081":1,"\u2082":2,"\u2083":3,"\u2084":4,"\u2085":5,"\u2086":6,"\u2087":7,"\u2088":8,"\u2089":9},T=v.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);if(T){let w=k[T[1]],A=T[2],z="0."+"0".repeat(w+1)+A,L=parseFloat(z);return g("Parsed subscript price:",v,"\u2192",L),L}let h=v.match(/\$([\d.]+)/);if(h){let w=parseFloat(h[1]);if(w>0&&w<1)return g("Parsed standard price:",w),w}return null},y=Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2, p.MuiTypography-body1")).filter(v=>{let k=v.textContent||"";return/\$[\d.]+/.test(k)||/\$0\.0[₀₁₂₃₄₅₆₇₈₉]/.test(k)});for(let v of y){let k=m(v.textContent||"");if(k&&k>1e-7&&k<10)return k}let b=S||u;return n.positions[b]?.lastPriceUsd?(g("DOM scraping failed, using cached price:",n.positions[b].lastPriceUsd),n.positions[b].lastPriceUsd):.001};if(W==="buy"){let m=B(a);if(m<=0||m>n.cashSol){let M=t.querySelector('[data-k="status"]');M&&(M.textContent=m<=0?"Invalid amount.":`Insufficient cash. Available: ${I(n.cashSol)} SOL`),r.preventDefault(),r.stopPropagation();return}let y=S||u,b=x(),v=nt(),k=bt(),h=m*k/b;n.cashSol-=m,n.positions[y]||(n.positions[y]={tokenQty:0,entryPriceUsd:b,lastPriceUsd:b,symbol:u,mint:S,entryTs:Date.now(),entryMarketCap:v,totalSolSpent:0,impliedSupply:v>0&&b>0?v/b:0});let w=n.positions[y],A=(w.tokenQty||0)*(w.entryPriceUsd||b),z=h*b,L=(w.tokenQty||0)+h;w.tokenQty=L,w.entryPriceUsd=L>0?(A+z)/L:b,w.lastPriceUsd=b,w.totalSolSpent=(w.totalSolSpent||0)+m,g("[v51 BUY] Added",m,"SOL to position. Total SOL spent:",w.totalSolSpent),n.trades||(n.trades=[]),n.trades.push({ts:Date.now(),side:"BUY",symbol:u,mint:S,solSize:m,tokenQty:h,priceUsd:b,marketCap:v}),await E(),$(),at("buy",b,m,v),g("Buy executed:",{symbol:u,solAmount:m,tokenQty:h,currentPriceUsd:b,entryPriceUsd:w.entryPriceUsd,position:w});let O=t.querySelector('[data-k="status"]');O&&(O.textContent=`\u2713 Bought ${h.toFixed(2)} ${u} @ $${b.toFixed(6)}`),d&&(d.value="")}else{let m=B(a);if(m<=0||m>100){let F=t.querySelector('[data-k="status"]');F&&(F.textContent="Invalid percentage (0-100)."),r.preventDefault(),r.stopPropagation();return}let y=S||u,b=n.positions[y];if(!b||!b.tokenQty||b.tokenQty<=0){let F=t.querySelector('[data-k="status"]');F&&(F.textContent=`No position in ${u} to sell.`),r.preventDefault(),r.stopPropagation();return}let v=b.tokenQty*m/100,k=x(),T=b.entryPriceUsd||k,h=v*k,w=bt(),A=h/w,z=b.tokenQty,L=b.totalSolSpent||0,O=z>0?L*(v/z):0,M=A-O;g("[v51 SELL] Sell Qty:",v,"of",z,"tokens"),g("[v51 SELL] Total SOL Spent:",L,"Portion sold:",O),g("[v51 SELL] SOL Received:",A,"P&L SOL:",M),b.totalSolSpent=Math.max(0,L-O),n.cashSol+=A,n.realizedSol=(n.realizedSol||0)+M;let lt=n.winStreak||0;M>0?(n.winStreak=lt+1,n.lastTradeWasLoss=!1,n.winStreak===10&&setTimeout(()=>yt("achievement",n.winStreak),500)):(n.winStreak=0,n.lastTradeWasLoss=!0,lt>=1&&setTimeout(()=>yt("loss",lt),500)),b.tokenQty-=v;let Wt=()=>{let F=document.querySelectorAll('[class*="mc"], [class*="MarketCap"]');for(let Ot of F){let V=Ot.textContent||"",vt=V.match(/\$?([\d,.]+)\s*[KMB]?/i);if(vt){let Q=parseFloat(vt[1].replace(/,/g,""));if(V.includes("K")&&(Q*=1e3),V.includes("M")&&(Q*=1e6),V.includes("B")&&(Q*=1e9),Q>1e3)return Q}}return null},dt=nt();n.trades||(n.trades=[]),n.trades.push({ts:Date.now(),side:"SELL",symbol:u,mint:S,solSize:A,tokenQty:v,priceUsd:k,realizedPnlSol:M,pnlSol:M,marketCap:dt,exitMc:dt,entryMc:b.entryMarketCap||null,entryTs:b.entryTs||null,exitTs:Date.now()}),await E(),$(),at("sell",k,A,dt);let Nt=M>=0?"+":"",xt=t.querySelector('[data-k="status"]');xt&&(xt.textContent=`\u2713 Sold ${m}% @ $${k.toFixed(6)} (${Nt}${I(M)} SOL)`),d&&(d.value="")}r.preventDefault(),r.stopPropagation();return}if(l.classList.contains("qbtn")){let d=l.getAttribute("data-v"),a=t.querySelector('input[data-k="field"]');a&&d&&(a.value=d),r.preventDefault(),r.stopPropagation();return}})}n.buyHudDocked?(t.className="docked",t.style.top="",t.style.left="",t.style.right="",t.style.width=""):(t.className="floating",n.buyHudPos.x>0?(t.style.left=`${n.buyHudPos.x}px`,t.style.right="auto"):(t.style.right="18px",t.style.left=""),t.style.top=`${q(n.buyHudPos.y||120,34,window.innerHeight-80)}px`,t.style.width="320px")}function ht(e,o,t){e&&(e.innerHTML=o.map((s,r)=>`<button class="qbtn" data-v="${R(t[r])}">${R(s)}</button>`).join(""))}function Z(){let e=U().getElementById(i.buyHud);if(!e)return;e.querySelectorAll(".tab").forEach(p=>{let u=p.getAttribute("data-tab");p.classList.toggle("active",u===W)});let s=D()?.symbol||"TOKEN",r=e.querySelector('[data-k="label"]'),l=e.querySelector('input[data-k="field"]'),c=e.querySelector('button[data-act="action"]'),f=e.querySelector('[data-k="quick"]'),d=e.querySelector('[data-k="status"]'),a=e.querySelector('button[data-act="edit"]');a&&(a.textContent=it?"Done":"Edit"),W==="buy"?(r&&(r.textContent="Buy Amount (SOL)"),l&&(l.placeholder="e.g. 0.25",l.setAttribute("inputmode","decimal")),c&&(c.innerHTML=`ZER\xD8 Buy ${s} `,c.classList.remove("sell")),ht(f,n.quickBuySols.map(p=>`${p} SOL`),n.quickBuySols.map(p=>String(p)))):(r&&(r.textContent="Sell Percent (%)"),l&&(l.placeholder="e.g. 25",l.setAttribute("inputmode","numeric")),c&&(c.innerHTML=`ZER\xD8 Sell ${s} `,c.classList.add("sell")),ht(f,n.quickSellPcts.map(p=>`${p}% `),n.quickSellPcts.map(p=>String(p)))),d&&(d.textContent=n.enabled?"Trades are simulated. Real wallet is not touched.":"ZER\xD8 mode is disabled.")}function N(){et||(et=!0,requestAnimationFrame(()=>{et=!1;let e=Date.now();e-ut<250||(ut=e,K())}))}function Ft(e){return e instanceof HTMLElement?e.id===i.banner||e.id===i.pnlHud||e.id===i.buyHud||e.closest?.(`#${i.banner}, #${i.pnlHud}, #${i.buyHud} `)!=null:!1}function It(){tt||(tt=new MutationObserver(e=>{if(!ot){for(let o of e)if(!Ft(o.target)){N();break}}}),tt.observe(document.documentElement,{childList:!0,subtree:!0}))}function K(){ot=!0;try{$t(),Ct(),Ht(),Lt(),zt(),_(),$(),Z(),Dt(),Y()}finally{ot=!1}}async function Rt(){if(pt)return;pt=!0,await ft();let e=async()=>{if(!document.body)return await new Promise(s=>setTimeout(s,25)),e()};await e(),await new Promise(s=>requestAnimationFrame(()=>s())),await new Promise(s=>setTimeout(s,50)),(()=>{let s="paper-page-bridge";if(document.getElementById(s))return;let r=document.createElement("script");r.id=s,r.src=chrome.runtime.getURL("src/page-bridge.js"),r.type="text/javascript",(document.head||document.documentElement).appendChild(r)})(),K(),P.isPadre?console.log("[paper:Padre v16] Skipping MutationObserver to avoid React interference"):setTimeout(()=>{It(),N()},600),P.isPadre?setTimeout(Y,2e3):(setTimeout(Y,1500),setTimeout(Y,4500)),window.addEventListener("message",s=>{if(s.source!==window)return;let r=s.data;!r||!r.__paper||r.type==="PRICE_TICK"&&gt(r)}),setInterval(()=>{if(!window.location.pathname.includes("/trade/"))return;let s=D();if(!s)return;let r=s.mint||s.symbol;if(!n.positions[r]||!n.positions[r].tokenQty)return;let l=nt(),c=n.positions[r];if(l>0&&c&&c.impliedSupply>0){let d=l/c.impliedSupply;if(Number.isFinite(d)&&d>0){let a=c.lastPriceUsd;if(Math.abs(d-a)/a>1e-4){c.lastPriceUsd=d,c.lastPriceTs=Date.now(),g("Price DERIVED from MC:",d,`(MC: ${l})`),$();return}}}let f=[];P.isPadre?f=Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2")).filter(d=>{let a=d.textContent||"";return(/[\u2080-\u2089]/.test(a)||/\$0\.[0-9]{4,}/.test(a))&&d.childElementCount<=2}).sort((d,a)=>{let p=d.textContent||"",u=a.textContent||"",S=/[\u2080-\u2089]/.test(p),x=/[\u2080-\u2089]/.test(u);return S&&!x?-1:!S&&x?1:u.length-p.length}):f=Array.from(document.querySelectorAll("span, div")).filter(d=>{let a=d.textContent||"";return/\$0\.\d{4,}/.test(a)&&d.childElementCount===0}).slice(0,10);for(let d of f){let a=d.textContent||"",p=null,u={"\u2080":0,"\u2081":1,"\u2082":2,"\u2083":3,"\u2084":4,"\u2085":5,"\u2086":6,"\u2087":7,"\u2088":8,"\u2089":9},S=a.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);if(S){let x=u[S[1]],m=S[2],y="0."+"0".repeat(x+1)+m;p=parseFloat(y),g("Polling: Parsed subscript price:",a,"\u2192",p)}else{let x=a.match(/\$([\d.]+)/);x&&(p=parseFloat(x[1]))}if(p&&p>1e-7&&p<10){let x=n.positions[r].lastPriceUsd;x!==p&&(n.positions[r].lastPriceUsd=p,n.positions[r].lastPriceTs=Date.now(),g("Price polled from page:",p,"(was:",x,")"),$());return}}},2e3),window.addEventListener("resize",()=>N())}if(P.isPadre){g("Padre mode initialized"),H=document.createElement("paper-trader-host"),H.style.cssText="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;",C=H.attachShadow({mode:"open"});let e=document.createElement("div");e.id="paper-shadow-container",e.style.cssText="position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;",C.appendChild(e),document.documentElement.appendChild(H);let o=async()=>{await ft();let f=async()=>{if(!document.body)return await new Promise(a=>setTimeout(a,25)),f()};await f(),await new Promise(a=>requestAnimationFrame(()=>a())),await new Promise(a=>setTimeout(a,50)),Et(),K(),g("HUDs mounted"),setInterval(()=>{if(!window.location.pathname.includes("/trade/"))return;let a=D();if(!a){g("Price poll: no stable token");return}let p=a.mint||a.symbol;if(!(n.positions[p]&&n.positions[p].tokenQty>0))return;let S=m=>{let y={"\u2080":0,"\u2081":1,"\u2082":2,"\u2083":3,"\u2084":4,"\u2085":5,"\u2086":6,"\u2087":7,"\u2088":8,"\u2089":9},b=m.match(/\$0\.0([₀₁₂₃₄₅₆₇₈₉])(\d+)/);if(b){let k=y[b[1]],T=b[2],h="0."+"0".repeat(k+1)+T;return parseFloat(h)}let v=m.match(/\$([\d.]+)/);if(v){let k=parseFloat(v[1]);if(k>0&&k<10)return k}return null},x=Array.from(document.querySelectorAll("h2.MuiTypography-h2, h2, p.MuiTypography-body1")).filter(m=>{let y=m.textContent||"";return/\$[\d.]+/.test(y)||/\$0\.0[₀₁₂₃₄₅₆₇₈₉]/.test(y)});for(let m of x){let y=S(m.textContent||"");if(y&&y>1e-7&&y<10){let b=n.positions[p].lastPriceUsd,v=Math.abs((b||0)-y)>1e-10;n.positions[p].lastPriceUsd=y,n.positions[p].lastPriceTs=Date.now(),v&&g("Price polled:",y.toFixed(10),"(was:",b?.toFixed(10),")"),$();return}}},1e3),window.addEventListener("message",a=>{if(a.source!==window)return;let p=a.data;!p||!p.__paper||p.type==="PRICE_TICK"&&gt(p)}),Bt(()=>{g("Rendering stored trade markers..."),At()})},t=()=>window.location.pathname.includes("/trade/");t()&&setTimeout(()=>{o().catch(f=>console.warn("[paper] boot error",f))},3e3);let s=window.location.pathname,r=window.location.href,l=!1,c=()=>{let f=C?.getElementById?.("paper-mode-banner"),d=C?.getElementById?.("paper-pnl-hud"),a=C?.getElementById?.("paper-buyhud-root"),u=t()?"":"none";f&&(f.style.display=u),d&&(d.style.display=u),a&&(a.style.display=u)};setInterval(()=>{let f=window.location.pathname,d=window.location.href;(f!==s||d!==r)&&(g("Navigation:",s,"->",f),s=f,r=d,c(),t()&&!l&&(l=!0,setTimeout(()=>{o().catch(a=>console.warn("[paper] boot error",a))},2e3)),t()&&l&&setTimeout(()=>{g("Refreshing HUDs for new token..."),$(),Z()},1500))},500)}else Rt().catch(e=>console.warn("[paper] boot error",e))})();})();
