import { IDS } from "./ids.js";

export const THEME_OVERRIDES_CSS = `
/* Shadow Mode Overrides (Gold/Orange Theme) */
.zero-shadow-mode .slider {
  background-color: #451a03;
}

.zero-shadow-mode input:checked + .slider {
  background-color: #f59e0b;
  border-color: #f59e0b;
}

.zero-shadow-mode #${IDS.pnlHud} .title .dot {
  background: #f59e0b;
  box-shadow: 0 0 10px rgba(245,158,11,0.5);
}

.zero-shadow-mode #${IDS.pnlHud} .title {
  color: #f59e0b;
}

.zero-shadow-mode #${IDS.buyHud} .panelTitle .dot {
  background: #f59e0b;
  box-shadow: 0 0 10px rgba(245,158,11,0.5);
}

.zero-shadow-mode #${IDS.buyHud} .panelTitle {
  color: #f59e0b;
}

.zero-shadow-mode #${IDS.buyHud} .action {
  background: #f59e0b;
  color: #000;
}

.zero-shadow-mode #${IDS.buyHud} .action:hover {
  background: #fbbf24;
}

:host(.zero-shadow-mode) #${IDS.banner} .label {
  color: #f59e0b;
}

:host(.zero-shadow-mode) #${IDS.banner} .dot {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245,158,11,0.5);
}

:host(.zero-shadow-mode) #${IDS.banner} {
  border-color: rgba(245,158,11,0.3);
}

.zero-shadow-mode #${IDS.shadowHud} .sh-header-title {
  color: #f59e0b;
}

.zero-shadow-mode #${IDS.shadowHud} .sh-header-icon {
  color: #f59e0b;
}
`;
