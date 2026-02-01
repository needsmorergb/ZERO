import { IDS } from "./ids.js";

export const BANNER_CSS = `
#${IDS.banner} {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  bottom: auto;
  right: auto;
  height: 36px;
  padding: 0 20px;
  border-radius: 99px;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  pointer-events: auto;
  background: #0d1117;
  border: 1px solid rgba(20,184,166,0.3);
  box-shadow: 0 4px 12px rgba(0,0,0,0.6);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#${IDS.banner} .inner {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 12px;
  letter-spacing: 0.3px;
}

#${IDS.banner} .dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #14b8a6;
  box-shadow: 0 0 8px rgba(20,184,166,0.5);
}

#${IDS.banner}.disabled .dot {
  background: #475569;
  box-shadow: none;
}

#${IDS.banner} .label {
  color: #14b8a6;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

#${IDS.banner} .state {
  color: #f8fafc;
  font-weight: 600;
}

#${IDS.banner}.disabled .state {
  color: #64748b;
}

#${IDS.banner} .hint {
  color: #64748b;
  font-weight: 500;
}
`;
