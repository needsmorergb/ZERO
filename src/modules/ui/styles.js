// Import and re-export IDS from separate file
export { IDS } from './ids.js';

// Import all style modules
import { COMMON_CSS } from './common-styles.js';
import { BANNER_CSS } from './banner-styles.js';
import { PNL_HUD_CSS } from './pnl-hud-styles.js';
import { BUY_HUD_CSS } from './buy-hud-styles.js';
import { MODALS_CSS } from './modals-styles.js';
import { PROFESSOR_CSS } from './professor-styles.js';
import { THEME_OVERRIDES_CSS } from './theme-overrides.js';
import { ELITE_CSS } from './elite-styles.js';

// Concatenate all CSS modules
export const CSS =
  COMMON_CSS +
  BANNER_CSS +
  PNL_HUD_CSS +
  BUY_HUD_CSS +
  MODALS_CSS +
  PROFESSOR_CSS +
  THEME_OVERRIDES_CSS +
  ELITE_CSS;
