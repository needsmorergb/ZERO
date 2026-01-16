/**
 * Mounts a paper trading badge overlay on the page
 * @param {string} venueName - Name of the trading platform (e.g., "Axiom", "Padre Terminal")
 */
export function mountBadge(venueName) {
  if (document.getElementById("paper-trader-badge")) return;

  const el = document.createElement("div");
  el.id = "paper-trader-badge";
  el.textContent = `Paper mode active (${venueName})`;

  el.style.position = "fixed";
  el.style.right = "12px";
  el.style.bottom = "12px";
  el.style.zIndex = "999999";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "10px";
  el.style.font = "12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial";
  el.style.background = "rgba(0,0,0,0.80)";
  el.style.color = "white";
  el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";

  document.documentElement.appendChild(el);
}
