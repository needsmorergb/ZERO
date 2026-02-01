import { Market } from "../core/market.js";

export const TokenDetector = {
  getCurrentToken() {
    return {
      symbol: Market.currentSymbol || "SOL",
      mint: Market.currentMint || "So11111111111111111111111111111111111111112",
    };
  },
};
