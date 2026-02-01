/**
 * Shadow Trade Ingestion
 * Listens for SHADOW_TRADE_DETECTED messages from bridge scripts and records
 * real trades into shadow state using identical PnL logic as OrderExecution.
 */
import { Store } from "../store.js";
import { PnlCalculator } from "./pnl-calculator.js";
import { Analytics } from "./analytics.js";
import { Market } from "./market.js";

export const ShadowTradeIngestion = {
  initialized: false,
  walletBalanceFetched: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener("message", (e) => {
      if (e.source !== window) return;
      if (e.data?.type !== "SHADOW_TRADE_DETECTED") return;
      if (!e.data?.__paper) return;

      this.handleDetectedTrade(e.data);
    });

    console.log("[ShadowIngestion] Initialized — listening for swap events");
  },

  async handleDetectedTrade(data) {
    if (!Store.isShadowMode()) {
      console.log("[ShadowIngestion] Ignoring swap — not in shadow mode");
      return;
    }

    const state = Store.state;
    if (!state) return;

    const { side, mint, symbol, solAmount, tokenAmount, priceUsd, signature } = data;

    if (!mint || !solAmount || solAmount <= 0) {
      console.warn("[ShadowIngestion] Invalid swap data:", data);
      return;
    }

    // Deduplicate: check if we've already recorded this tx
    const existingTrade = Object.values(state.shadowTrades || {}).find(
      (t) => t.signature === signature
    );
    if (existingTrade) {
      console.log(`[ShadowIngestion] Duplicate tx ${signature.slice(0, 12)}... — skipping`);
      return;
    }

    console.log(
      `[ShadowIngestion] Processing ${side} — ${symbol || mint.slice(0, 8)}, ${solAmount.toFixed(4)} SOL`
    );

    if (side === "BUY") {
      await this.recordShadowBuy(state, data);
    } else if (side === "SELL") {
      await this.recordShadowSell(state, data);
    }

    await Store.save();

    // Trigger HUD update
    if (window.ZeroHUD && window.ZeroHUD.updateAll) {
      window.ZeroHUD.updateAll();
    }
  },

  async recordShadowBuy(state, data) {
    const { mint, symbol, solAmount, tokenAmount, priceUsd, signature } = data;
    const session = state.shadowSession;

    // On first BUY: auto-detect wallet balance
    if (!this.walletBalanceFetched && session.balance === 0) {
      await this.fetchWalletBalance(session, solAmount);
    }

    const solUsd = PnlCalculator.getSolPrice();
    const buyUsd = solAmount * solUsd;

    // Determine token price: use bridge data, Market price, or derive from amounts
    let tokenPriceUsd = priceUsd;
    if (!tokenPriceUsd || tokenPriceUsd <= 0) {
      tokenPriceUsd = Market.price || 0;
    }

    // Calculate qty from USD / price, or use raw token amount
    let qtyDelta;
    if (tokenPriceUsd > 0) {
      qtyDelta = buyUsd / tokenPriceUsd;
    } else if (tokenAmount > 0) {
      qtyDelta = tokenAmount;
      // Derive price from amounts if we have both
      if (buyUsd > 0 && qtyDelta > 0) {
        tokenPriceUsd = buyUsd / qtyDelta;
      }
    } else {
      console.warn("[ShadowIngestion] Cannot determine token quantity — no price or amount");
      return;
    }

    // Init position if new
    if (!state.shadowPositions[mint]) {
      state.shadowPositions[mint] = {
        mint,
        symbol: symbol || Market.currentSymbol || "UNKNOWN",
        qtyTokens: 0,
        costBasisUsd: 0,
        avgCostUsdPerToken: 0,
        realizedPnlUsd: 0,
        totalSolSpent: 0,
        entryMarketCapUsdReference: null,
        lastMarkPriceUsd: tokenPriceUsd,
        ts: Date.now(),
      };
    }

    const pos = state.shadowPositions[mint];

    // Update WAC (identical to OrderExecution.buy)
    pos.qtyTokens += qtyDelta;
    pos.costBasisUsd += buyUsd;
    pos.totalSolSpent += solAmount;
    pos.avgCostUsdPerToken = pos.qtyTokens > 0 ? pos.costBasisUsd / pos.qtyTokens : 0;
    pos.lastMarkPriceUsd = tokenPriceUsd;

    // Set entry MC reference if first buy
    if (pos.entryMarketCapUsdReference === null && Market.marketCap > 0) {
      pos.entryMarketCapUsdReference = Market.marketCap;
    }

    // Record fill
    const fillId = this.recordShadowFill(state, {
      side: "BUY",
      mint,
      symbol: pos.symbol,
      solAmount,
      usdNotional: buyUsd,
      qtyTokensDelta: qtyDelta,
      fillPriceUsd: tokenPriceUsd,
      marketCapUsdAtFill: Market.marketCap || 0,
      priceSource: "shadow_swap",
      strategy: "Real Trade",
      signature,
      mode: "shadow",
    });

    // Deduct from session balance
    session.balance -= solAmount;

    // Discipline scoring
    try {
      const trade = state.shadowTrades[fillId];
      if (trade) {
        Analytics.calculateDiscipline(trade, state);
        Analytics.logTradeEvent(state, trade);
      }
    } catch (e) {
      console.warn("[ShadowIngestion] Analytics error:", e);
    }

    console.log(
      `[ShadowIngestion] BUY recorded: ${pos.symbol} +${qtyDelta.toFixed(2)} tokens, ${solAmount.toFixed(4)} SOL`
    );
  },

  async recordShadowSell(state, data) {
    const { mint, symbol, solAmount, tokenAmount, priceUsd, signature } = data;
    const session = state.shadowSession;
    const pos = state.shadowPositions[mint];

    if (!pos || pos.qtyTokens <= 0) {
      console.warn(`[ShadowIngestion] SELL for unknown/empty position: ${mint.slice(0, 8)}`);
      return;
    }

    const solUsd = PnlCalculator.getSolPrice();

    // Determine token price
    let tokenPriceUsd = priceUsd;
    if (!tokenPriceUsd || tokenPriceUsd <= 0) {
      tokenPriceUsd = Market.price || pos.lastMarkPriceUsd || 0;
    }

    // Calculate qty sold: if we have token amount from swap, use it. Otherwise derive.
    let qtyDelta;
    if (tokenAmount > 0 && tokenAmount <= pos.qtyTokens * 1.01) {
      // Direct from swap response (with small tolerance for rounding)
      qtyDelta = Math.min(tokenAmount, pos.qtyTokens);
    } else if (solAmount > 0 && tokenPriceUsd > 0) {
      // Derive from SOL proceeds / price
      const sellUsd = solAmount * solUsd;
      qtyDelta = sellUsd / tokenPriceUsd;
      qtyDelta = Math.min(qtyDelta, pos.qtyTokens);
    } else {
      console.warn("[ShadowIngestion] Cannot determine sell quantity");
      return;
    }

    if (qtyDelta <= 0) return;

    const proceedsUsd = qtyDelta * tokenPriceUsd;

    // WAC Close Math (identical to OrderExecution.sell)
    const costRemovedUsd = qtyDelta * pos.avgCostUsdPerToken;
    const pnlEventUsd = proceedsUsd - costRemovedUsd;

    pos.realizedPnlUsd += pnlEventUsd;
    pos.qtyTokens -= qtyDelta;
    pos.costBasisUsd -= costRemovedUsd;
    pos.totalSolSpent -= costRemovedUsd / solUsd;

    if (pos.qtyTokens < 0.000001) {
      pos.qtyTokens = 0;
      pos.costBasisUsd = 0;
      pos.avgCostUsdPerToken = 0;
      pos.entryMarketCapUsdReference = null;
    }

    // Convert to SOL
    const proceedsSol = proceedsUsd / solUsd;
    const pnlEventSol = pnlEventUsd / solUsd;

    // Record fill
    const fillId = this.recordShadowFill(state, {
      side: "SELL",
      mint,
      symbol: pos.symbol,
      solAmount: proceedsSol,
      qtyTokensDelta: -qtyDelta,
      proceedsUsd,
      fillPriceUsd: tokenPriceUsd,
      marketCapUsdAtFill: Market.marketCap || 0,
      priceSource: "shadow_swap",
      strategy: "Real Trade",
      signature,
      realizedPnlSol: pnlEventSol,
      mode: "shadow",
    });

    // Update session
    session.balance += proceedsSol;
    session.realized = (session.realized || 0) + pnlEventSol;

    // Update streaks + behavioral analytics
    try {
      Analytics.updateStreaks({ side: "SELL", realizedPnlSol: pnlEventSol }, state);
      const trade = state.shadowTrades[fillId];
      if (trade) {
        Analytics.calculateDiscipline(trade, state);
        Analytics.logTradeEvent(state, trade);
      }
    } catch (e) {
      console.warn("[ShadowIngestion] Analytics error:", e);
    }

    console.log(
      `[ShadowIngestion] SELL recorded: ${pos.symbol} -${qtyDelta.toFixed(2)} tokens, PnL: ${pnlEventSol.toFixed(4)} SOL`
    );
  },

  recordShadowFill(state, fillData) {
    if (!state.shadowTrades) state.shadowTrades = {};
    const id = "sh_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const fill = {
      id,
      ts: Date.now(),
      ...fillData,
    };
    state.shadowTrades[id] = fill;

    // Track in shadow session
    if (state.shadowSession) {
      if (!state.shadowSession.trades) state.shadowSession.trades = [];
      state.shadowSession.trades.push(id);
      state.shadowSession.tradeCount = (state.shadowSession.tradeCount || 0) + 1;
    }

    return id;
  },

  async fetchWalletBalance(session, firstTradeAmount) {
    this.walletBalanceFetched = true;

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "GET_WALLET_BALANCE" }, (resp) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(resp);
          }
        });
      });

      if (response && response.balance > 0) {
        session.balance = response.balance;
        console.log(
          `[ShadowIngestion] Wallet balance detected: ${response.balance.toFixed(4)} SOL`
        );
        return;
      }
    } catch (e) {
      console.warn("[ShadowIngestion] Wallet balance fetch failed:", e);
    }

    // Fallback: estimate as 10x first trade size
    session.balance = firstTradeAmount * 10;
    console.log(`[ShadowIngestion] Wallet balance estimated: ~${session.balance.toFixed(4)} SOL`);
  },

  cleanup() {
    this.initialized = false;
    this.walletBalanceFetched = false;
    console.log("[ShadowIngestion] Cleanup complete");
  },
};
