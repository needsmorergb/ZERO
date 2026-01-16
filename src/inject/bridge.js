export function injectWsHook() {
  const id = "paper-ws-hook";
  if (document.getElementById(id)) return;

  const s = document.createElement("script");
  s.id = id;
  s.src = chrome.runtime.getURL("src/inject/ws_hook.js");
  s.type = "text/javascript";
  (document.head || document.documentElement).appendChild(s);
  s.remove();
}

export function startBridge(onMessage) {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== "paper-trader") return;
    onMessage(msg);
  });
}
