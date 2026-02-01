(() => {
  // Configuration
  const CONFIG = {
    AXIOM_URL: "https://axiom.trade/@takep",
    TERMINAL_URL: "https://trade.padre.gg/rk/take",
    WEBSITE_URL: "https://get-zero.xyz",
    X_URL: "https://x.com/get_zero_xyz",
  };

  const $ = (id) => document.getElementById(id);

  // Set asset URLs
  $("zeroIcon").src = chrome.runtime.getURL("assets/zero-48.png");

  // Get version from manifest
  const manifest = chrome.runtime.getManifest();
  $("ver").textContent = manifest.version;

  // Event handlers
  $("btnAxiom").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.update(tab.id, { url: CONFIG.AXIOM_URL });
  });

  $("btnTerminal").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.update(tab.id, { url: CONFIG.TERMINAL_URL });
  });

  $("supportLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: CONFIG.WEBSITE_URL });
  });

  $("xLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: CONFIG.X_URL });
  });
})();
