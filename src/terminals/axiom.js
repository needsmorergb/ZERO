export const axiomAdapter = {
  name: "Axiom",

  // Finds the token mint (CA) displayed in the right sidebar.
  // Returns a base58 string or null.
  getCurrentMint() {
    // Look for text nodes containing "CA:" and then read the adjacent value
    const candidates = Array.from(document.querySelectorAll("*"))
      .filter((el) => el && el.childElementCount === 0) // leaf-ish nodes
      .map((el) => (el.innerText || "").trim())
      .filter((t) => t.toLowerCase().startsWith("ca:"));

    if (candidates.length) {
      // Example: "CA: CsDZkRWhn5iSKDF...bonk"
      // Try to extract the part after "CA:"
      const raw = candidates[0].split(":").slice(1).join(":").trim();
      const mint = raw.split(/\s+/)[0].trim();
      return isLikelySolanaMint(mint) ? mint : null;
    }

    // Fallback: sometimes the CA value is in an input or copy widget
    const text = document.body.innerText || "";
    const match = text.match(/CA:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (match) return match[1];

    return null;
  },

  // Find main Buy button on the order panel
  findMainBuyButton() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    // Prefer the large green Buy button with text "Buy <symbol>"
    const buy = buttons.find((el) => {
      const t = (el.innerText || "").trim().toLowerCase();
      if (!t.startsWith("buy")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.height > 28;
    });
    return buy || null;
  },

  // Find quickbuy buttons (0.01, 0.1, 1, 10 etc.)
  findQuickBuyAmountButtons() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    // Quickbuy buttons are usually small pills with numeric text
    return buttons.filter((el) => {
      const t = (el.innerText || "").trim();
      // Accept numbers like 0.01, 0.1, 1, 10
      if (!/^\d+(\.\d+)?$/.test(t)) return false;
      const n = Number(t);
      if (!Number.isFinite(n)) return false;
      // Filter out unrelated number buttons by size
      const r = el.getBoundingClientRect();
      if (r.width < 26 || r.height < 18) return false;
      if (r.width > 120 || r.height > 60) return false;
      return true;
    });
  }
};

function isLikelySolanaMint(s) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}
