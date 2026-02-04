import { Market } from "./market.js";
import { Store } from "../store.js";
import { Analytics } from "./analytics.js"; // Ensure we keep analytics hooks
import { proxyFetch } from "../../services/shared/proxy-fetch.js";

export const PnlCalculator = {
  cachedSolPrice: 200, // Default fallback
  lastValidSolPrice: null,
  lastSolPriceFetch: 0,
  priceUpdateInterval: null,
  lastPriceSave: 0,

  init() {
    console.log("[PNL] Initializing WAC PnL Calculator");
    // Fetch immediately
    this.fetchSolPrice();

    // Refresh every 5 minutes (300,000ms)
    if (!this.priceUpdateInterval) {
      this.priceUpdateInterval = setInterval(() => {
        this.fetchSolPrice();
      }, 300000);
    }
  },

  /**
   * Fetches SOL/USD from Kraken + Coinbase and computes Median.
   */
  async fetchSolPrice() {
    console.log("[PNL] Fetching SOL Price (Kraken + Coinbase)...");

    const fetchKraken = async () => {
      try {
        const res = await proxyFetch("https://api.kraken.com/0/public/Ticker?pair=SOLUSD", {
          method: "GET",
        });
        if (res.ok && res.data?.result?.SOLUSD?.c?.[0]) {
          return parseFloat(res.data.result.SOLUSD.c[0]);
        }
      } catch (e) {
        console.warn("[PNL] Kraken failed", e);
      }
      return null;
    };

    const fetchCoinbase = async () => {
      try {
        const res = await proxyFetch("https://api.coinbase.com/v2/prices/SOL-USD/spot", {
          method: "GET",
        });
        if (res.ok && res.data?.data?.amount) {
          return parseFloat(res.data.data.amount);
        }
      } catch (e) {
        console.warn("[PNL] Coinbase failed", e);
      }
      return null;
    };

    const [kPrice, cPrice] = await Promise.all([fetchKraken(), fetchCoinbase()]);

    const validPrices = [];
    if (kPrice) validPrices.push(kPrice);
    if (cPrice) validPrices.push(cPrice);

    if (validPrices.length > 0) {
      // Median of 2 is Average
      const sum = validPrices.reduce((a, b) => a + b, 0);
      const median = sum / validPrices.length;

      this.cachedSolPrice = median;
      this.lastValidSolPrice = median;
      this.lastSolPriceFetch = Date.now();
      console.log(`[PNL] SOL/USD Updated: $${median.toFixed(2)} (Sources: ${validPrices.length})`);
    } else {
      console.error("[PNL] All SOL price sources failed. Using fallback.");
      if (this.lastValidSolPrice) this.cachedSolPrice = this.lastValidSolPrice;
    }
  },

  getSolPrice() {
    return this.cachedSolPrice;
  },

  fmtSol(n) {
    if (!Number.isFinite(n)) return "0.0000";
    if (Math.abs(n) < 1 && n !== 0) return n.toFixed(9);
    return n.toFixed(4);
  },

  /**
   * Calculates WAC-based PnL for all positions.
   */
  getUnrealizedPnl(state, currentTokenMint = null) {
    let totalUnrealizedSol = 0; // Using SOL for aggregation ? Spec says USD pnl mainly.
    // Existing HUD expects SOL likely? "Realized/Unrealized/Total PnL (USD and optional SOL equivalent)"
    // I will calculate both.

    const solUsd = this.getSolPrice();
    let priceWasUpdated = false;
    let totalUnrealizedUsd = 0;

    const isRealTrading = state.settings?.tradingMode === "shadow" || state.settings?.tradingMode === "analysis";
    const positions = Object.values(isRealTrading ? state.shadowPositions || {} : state.positions || {});
    const currentSymbol = (Market.currentSymbol || "").toUpperCase();

    const currentMC = Market.marketCap || 0;

    positions.forEach((pos) => {
      // 1. Determine Mark Price — always update from live data
      const mintMatches = currentTokenMint && pos.mint === currentTokenMint;
      const symbolMatches =
        !currentTokenMint &&
        currentSymbol &&
        pos.symbol &&
        pos.symbol.toUpperCase() === currentSymbol;

      if ((mintMatches || symbolMatches) && Market.price > 0) {
        pos.lastMarkPriceUsd = Market.price;
        pos.lastMarketCapUsd = Market.marketCap;
        priceWasUpdated = true;
      }

      if (pos.qtyTokens <= 0) return;

      // 2. Method 1: MC Ratio (most accurate when both MCs available)
      // Formula: currentValue = totalSolSpent × (currentMC / entryMC)
      const entryMC = pos.entryMarketCapUsdReference || 0;
      const totalSolSpent = pos.totalSolSpent || 0;

      if (currentMC > 0 && entryMC > 0 && totalSolSpent > 0) {
        const mcRatio = currentMC / entryMC;

        // SANITY CHECK: MC ratio > 100,000x likely indicates corrupted entry/current MC data
        if (mcRatio > 100000 || mcRatio < 0.00001) {
          console.warn(
            `[PNL] ${pos.symbol}: SUSPICIOUS MC RATIO ${mcRatio.toFixed(2)}x (entry=$${entryMC.toFixed(0)}, current=$${currentMC.toFixed(0)}) — falling back to WAC method`
          );
          // Fall through to Method 2 (WAC fallback)
        } else {
          const currentValueSol = totalSolSpent * mcRatio;
          const unrealizedPnlSol = currentValueSol - totalSolSpent;
          const unrealizedPnlUsd = unrealizedPnlSol * solUsd;

          const pnlPct = totalSolSpent > 0 ? (unrealizedPnlSol / totalSolSpent) * 100 : 0;
          pos.pnlPct = pnlPct;
          if (pos.peakPnlPct === undefined || pnlPct > pos.peakPnlPct) pos.peakPnlPct = pnlPct;

          totalUnrealizedUsd += unrealizedPnlUsd;
          totalUnrealizedSol += unrealizedPnlSol;

          console.log(
            `[PNL] ${pos.symbol}: MC Ratio — entryMC=$${entryMC.toFixed(0)}, currentMC=$${currentMC.toFixed(0)}, ratio=${mcRatio.toFixed(4)}, pnl=${unrealizedPnlSol.toFixed(4)} SOL (${pnlPct.toFixed(1)}%)`
          );
          return;
        }
      }

      // 3. Method 2: WAC fallback if MC not available
      const markPriceUsd = pos.lastMarkPriceUsd || 0;
      if (markPriceUsd <= 0) return;

      const currentValueUsd = pos.qtyTokens * markPriceUsd;
      const unrealizedPnlUsd = currentValueUsd - pos.costBasisUsd;
      const unrealizedPnlSol = unrealizedPnlUsd / solUsd;

      const pnlPct = pos.costBasisUsd > 0 ? (unrealizedPnlUsd / pos.costBasisUsd) * 100 : 0;
      pos.pnlPct = pnlPct;
      if (pos.peakPnlPct === undefined || pnlPct > pos.peakPnlPct) pos.peakPnlPct = pnlPct;

      totalUnrealizedUsd += unrealizedPnlUsd;
      totalUnrealizedSol += unrealizedPnlSol;

      console.log(
        `[PNL] ${pos.symbol}: WAC fallback — qty=${pos.qtyTokens.toFixed(2)}, price=$${markPriceUsd.toFixed(6)}, pnl=${unrealizedPnlSol.toFixed(4)} SOL (${pnlPct.toFixed(1)}%)`
      );
    });

    // Trigger Analytics
    Analytics.monitorProfitOverstay(state);
    Analytics.detectOvertrading(state);

    // Save if updated
    const now = Date.now();
    if (priceWasUpdated && now - this.lastPriceSave > 5000) {
      this.lastPriceSave = now;
      Store.save();
    }

    return totalUnrealizedSol; // Legacy return type (SOL) for HUD
  },
};
