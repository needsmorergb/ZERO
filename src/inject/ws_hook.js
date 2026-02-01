(() => {
  const NativeWebSocket = window.WebSocket;

  function safeJsonParse(data) {
    try {
      if (typeof data === "string") return JSON.parse(data);
    } catch { /* swallowed */ }
    return null;
  }

  // Temporary generic extractor: logs likely price payloads.
  // You will replace this with a terminal-specific extractor once you see shapes.
  function extractCandidateTick(obj) {
    if (!obj || typeof obj !== "object") return null;

    const stack = [obj];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;

      const price = cur.price ?? cur.lastPrice ?? cur.markPrice ?? cur.p;
      const mint = cur.mint ?? cur.baseMint ?? cur.tokenMint ?? cur.address ?? cur.m;
      const symbol = cur.symbol ?? cur.ticker ?? cur.s;

      if (mint && price && Number.isFinite(Number(price))) {
        return {
          mint: String(mint),
          symbol: symbol ? String(symbol) : "",
          price: Number(price),
          ts: Date.now(),
        };
      }

      for (const v of Object.values(cur)) {
        if (v && typeof v === "object") stack.push(v);
      }
    }

    return null;
  }

  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);

    ws.addEventListener("message", (event) => {
      const obj = safeJsonParse(event.data);
      if (!obj) return;

      const tick = extractCandidateTick(obj);
      if (!tick) return;

      window.postMessage({ source: "paper-trader", type: "TICK", tick }, "*");
    });

    return ws;
  };

  window.WebSocket.prototype = NativeWebSocket.prototype;

  window.postMessage({ source: "paper-trader", type: "STATUS", status: "ws_hook_installed" }, "*");
})();
