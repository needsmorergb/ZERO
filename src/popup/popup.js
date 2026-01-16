(() => {
  // Configuration
  const CONFIG = {
    AXIOM_URL: "https://axiom.trade/@takep",
    TERMINAL_URL: "https://trade.padre.gg/rk/take",
    DISCORD_URL: "https://discord.gg/", // TODO: Add your Discord invite link
  };

  const $ = (id) => document.getElementById(id);

  // Set asset URLs
  $("paperIcon").src = chrome.runtime.getURL("assets/paper-48.png");
  $("axiomLogo").src = chrome.runtime.getURL("assets/axiom.png");
  $("terminalLogo").src = chrome.runtime.getURL("assets/terminal.png");

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

  $("discordLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: CONFIG.DISCORD_URL });
  });
})();
