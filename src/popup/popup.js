(() => {
  // Configuration
  const CONFIG = {
    AXIOM_URL: "https://axiom.trade/@takep",
    TERMINAL_URL: "https://trade.padre.gg/rk/take",
    TELEGRAM_URL: "https://t.me/ZERO_SupportBot",
    WEBSITE_URL: "https://get-zero.xyz",
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

  $("telegramLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: CONFIG.TELEGRAM_URL });
  });

  $("websiteLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: CONFIG.WEBSITE_URL });
  });
})();
