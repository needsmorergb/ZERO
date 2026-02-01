import { mountBadge } from "./ui/overlay.js";
import { injectWsHook, startBridge } from "./inject/bridge.js";
import { findAdapter } from "./terminals/adapters.js";

const adapter = findAdapter(location.hostname);
if (!adapter) {
  // Not one of our targets
  // Return so we do not run anything else
  return;
}

mountBadge(adapter.name);

// Inject WS hook (page context) and listen for ticks
injectWsHook();

startBridge((msg) => {
  if (msg.type === "TICK") {
    // Handle price tick updates
    // TODO: Update paper trading state
  }
  if (msg.type === "STATUS") {
    // Handle status updates
  }
});
