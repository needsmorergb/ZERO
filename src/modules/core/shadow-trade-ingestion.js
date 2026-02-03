/**
 * Shadow Trade Ingestion
 * Listens for SHADOW_TRADE_DETECTED and SHADOW_SWAP_SIGNATURE messages from
 * bridge scripts and records real trades into shadow state using identical PnL
 * logic as OrderExecution.
 *
 * Layer 1 (instant): Bridge fetch/XHR interception → SHADOW_TRADE_DETECTED (when quote cached)
 * Layer 2 (~1-3s):   Wallet hook → SHADOW_SWAP_SIGNATURE → single RPC getTransaction
 * Layer 3 (200ms):   Platform header scraping → PNL_TICK (continuous live P&L)
 * Price source: Padre/Axiom header bar scraping (matches displayed price exactly)
 */
import { Store } from "../store.js";
import { PnlCalculator } from "./pnl-calculator.js";
import { Analytics } from "./analytics.js";
import { Market } from "./market.js";

export const ShadowTradeIngestion = {
  initialized: false,
  walletBalanceFetched: false,
  _pendingSignatures: new Set(),

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const isShadow = Store.isShadowMode();
    console.log(`[ShadowIngestion] Mode: ${isShadow ? "SHADOW" : Store.state?.settings?.tradingMode || "unknown"}`);

    // Listen for bridge-level swap detection and wallet hook signatures
    window.addEventListener("message", (e) => {
      if (e.source !== window) return;
      if (!e.data?.__paper) return;

      // Layer 1: Instant trade detection (bridge fetch/XHR intercepted a swap response with cached quote)
      if (e.data.type === "SHADOW_TRADE_DETECTED") {
        console.log(`[ShadowIngestion] Bridge swap event received: ${e.data.side} ${e.data.mint?.slice(0, 8) || "?"}`);
        this.handleDetectedTrade(e.data);
      }

      // Layer 2: Wallet hook fired but no cached quote — resolve via single RPC call
      if (e.data.type === "SHADOW_SWAP_SIGNATURE") {
        this.resolveSwapSignature(e.data);
      }

      if (e.data.type === "WALLET_ADDRESS_DETECTED") {
        console.log(`[ShadowIngestion] Wallet address message received: ${e.data.walletAddress?.slice(0, 8) || "none"}`);
        this.handleWalletAddress(e.data.walletAddress);
      }

      // Layer 3: Platform PnL ticks (from Padre/Axiom header scraping)
      if (e.data.type === "PADRE_PNL_TICK" || e.data.type === "AXIOM_PNL_TICK") {
        Market.platformPnl = e.data.tpnl;
        Market.platformPnlTs = e.data.ts;
      }
    });

    // If wallet address already known from a previous session, fetch balance
    const storedAddr = Store.state?.shadow?.walletAddress;
    if (storedAddr) {
      console.log(`[ShadowIngestion] Stored wallet found: ${storedAddr.slice(0, 8)}...`);
      this.proactiveFetchBalance();
    } else {
      console.log("[ShadowIngestion] No stored wallet — waiting for bridge detection");
    }

    console.log("[ShadowIngestion] Initialized — event-driven swap detection active");
  },

  // --- Event-Driven Swap Resolution (Layer 2) ---
  // Called when wallet hook fires but no cached quote was available.
  // Makes a single getTransaction RPC call to resolve the trade details.

  async resolveSwapSignature(data) {
    const { signature, mint, symbol } = data;

    if (!signature || typeof signature !== "string" || signature.length < 30) {
      console.warn("[ShadowIngestion] Invalid swap signature:", signature?.slice(0, 20));
      return;
    }

    // Check dedup: already recorded?
    const existingTrade = Object.values(Store.state?.shadowTrades || {}).find(
      (t) => t.signature === signature,
    );
    if (existingTrade) {
      console.log(`[ShadowIngestion] Signature already recorded, skipping: ${signature.slice(0, 16)}`);
      return;
    }

    // Prevent concurrent resolve loops (wallet hook + RPC detection may both fire)
    if (this._pendingSignatures.has(signature)) {
      console.log(`[ShadowIngestion] Already resolving signature, skipping: ${signature.slice(0, 16)}`);
      return;
    }
    this._pendingSignatures.add(signature);

    const walletAddress = Store.state?.shadow?.walletAddress;
    if (!walletAddress) {
      console.warn("[ShadowIngestion] Cannot resolve tx — no wallet address");
      this._pendingSignatures.delete(signature);
      return;
    }

    console.log(
      `[ShadowIngestion] Swap signature received: ${signature.slice(0, 16)}... — resolving via RPC`,
    );

    // Retry loop: 3 attempts with increasing delays (tx needs time to be indexed on-chain)
    const delays = [1500, 3000, 5000];

    try {
    for (let attempt = 0; attempt < delays.length; attempt++) {
      await new Promise((r) => setTimeout(r, delays[attempt]));

      // Re-check dedup before each retry (Layer 1 fast path may have won the race)
      const alreadyRecorded = Object.values(Store.state?.shadowTrades || {}).find(
        (t) => t.signature === signature,
      );
      if (alreadyRecorded) {
        console.log(
          `[ShadowIngestion] Signature resolved by fast path, skipping RPC attempt ${attempt + 1}`,
        );
        return;
      }

      try {
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("sendMessage timeout (12s)")),
            12000,
          );
          chrome.runtime.sendMessage(
            {
              type: "RESOLVE_SWAP_TX",
              signature,
              walletAddress,
            },
            (resp) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve(resp);
            },
          );
        });

        if (!response || !response.ok) {
          console.warn(
            `[ShadowIngestion] RPC resolve attempt ${attempt + 1} error:`,
            response?.error,
          );
          continue;
        }

        if (!response.swap) {
          console.log(
            `[ShadowIngestion] RPC attempt ${attempt + 1}: tx not indexed yet`,
          );
          continue;
        }

        // Enrich with Market.price if priceUsd is 0
        const swap = response.swap;
        if ((!swap.priceUsd || swap.priceUsd <= 0) && Market.price > 0) {
          swap.priceUsd = Market.price;
        }

        console.log(
          `[ShadowIngestion] RPC resolved: ${swap.side} ${swap.solAmount?.toFixed(4)} SOL → ${swap.mint?.slice(0, 8)} (attempt ${attempt + 1})`,
        );

        await this.handleDetectedTrade(swap);
        return; // Success
      } catch (e) {
        console.warn(
          `[ShadowIngestion] RPC resolve attempt ${attempt + 1} failed:`,
          e?.message || e,
        );
      }
    }

    console.warn(
      `[ShadowIngestion] Failed to resolve tx after ${delays.length} attempts: ${signature.slice(0, 16)}`,
    );
    } finally {
      this._pendingSignatures.delete(signature);
    }
  },

  // --- Wallet Address Detection ---

  async handleWalletAddress(addr) {
    if (!addr || typeof addr !== "string") return;

    const shadow = Store.state?.shadow;
    if (!shadow) return;

    if (shadow.walletAddress === addr) return; // Already stored

    shadow.walletAddress = addr;
    await Store.save();
    console.log(`[ShadowIngestion] Wallet address stored: ${addr.slice(0, 8)}...`);

    // Proactively fetch balance when in shadow mode
    this.proactiveFetchBalance();
  },

  async proactiveFetchBalance() {
    if (this.walletBalanceFetched) return;
    if (!Store.isShadowMode()) return;

    const session = Store.state?.shadowSession;
    if (!session || session.balance > 0) return;

    const walletAddress = Store.state?.shadow?.walletAddress;
    if (!walletAddress) return;

    this.walletBalanceFetched = true;

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "GET_WALLET_BALANCE", walletAddress },
          (resp) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(resp);
          },
        );
      });

      if (response && response.ok && response.balance > 0) {
        session.balance = response.balance;
        session.equity = response.balance;
        session.walletBalance = response.balance;
        await Store.save();
        console.log(
          `[ShadowIngestion] Wallet balance: ${response.balance.toFixed(4)} SOL`,
        );
        if (window.ZeroHUD && window.ZeroHUD.updateAll) {
          window.ZeroHUD.updateAll();
        }
      }
    } catch (e) {
      console.warn("[ShadowIngestion] Proactive balance fetch failed:", e);
      this.walletBalanceFetched = false; // Allow retry
    }
  },

  // --- Trade Processing ---

  async handleDetectedTrade(data) {
    if (!Store.isShadowMode()) {
      console.log(`[ShadowIngestion] Trade ignored — not in shadow mode (current: ${Store.state?.settings?.tradingMode || "?"})`);
      return;
    }

    const state = Store.state;
    if (!state) return;

    const { side, mint, symbol, tokenAmount, priceUsd, signature } = data;
    let solAmount = data.solAmount;

    // Handle USD-only trades (from header delta detection — no SOL amount available)
    if ((!solAmount || solAmount <= 0) && data.usdAmount > 0) {
      const solUsd = PnlCalculator.getSolPrice();
      if (solUsd > 0) {
        solAmount = data.usdAmount / solUsd;
        console.log(
          `[ShadowIngestion] USD→SOL: $${data.usdAmount.toFixed(4)} / $${solUsd.toFixed(2)} = ${solAmount.toFixed(6)} SOL`,
        );
      } else {
        console.warn("[ShadowIngestion] Cannot convert USD→SOL — no SOL price available");
        return;
      }
    }

    if (!mint || !solAmount || solAmount <= 0) {
      console.warn("[ShadowIngestion] Invalid swap data:", data);
      return;
    }

    // Update data.solAmount so downstream recordShadowBuy/Sell gets the converted value
    data.solAmount = solAmount;

    // Deduplicate: check if we've already recorded this tx
    const existingTrade = Object.values(state.shadowTrades || {}).find(
      (t) => t.signature === signature,
    );
    if (existingTrade) {
      return; // Silent skip for duplicates (Helius + bridge may both fire)
    }

    const src = data.source === "helius" ? "RPC" : "Bridge";
    console.log(
      `[ShadowIngestion] Processing ${side} via ${src} — ${symbol || mint.slice(0, 8)}, ${solAmount.toFixed(4)} SOL`,
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
      tradeSource: "REAL_SHADOW",
    });

    // Deduct from session balance
    session.balance -= solAmount;
    session.totalSolInvested = (session.totalSolInvested || 0) + solAmount;

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
      `[ShadowIngestion] BUY recorded: ${pos.symbol} +${qtyDelta.toFixed(2)} tokens, ${solAmount.toFixed(4)} SOL`,
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
      tradeSource: "REAL_SHADOW",
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
      `[ShadowIngestion] SELL recorded: ${pos.symbol} -${qtyDelta.toFixed(2)} tokens, PnL: ${pnlEventSol.toFixed(4)} SOL`,
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

    const walletAddress = Store.state?.shadow?.walletAddress;

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "GET_WALLET_BALANCE", walletAddress },
          (resp) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(resp);
          },
        );
      });

      if (response && response.ok && response.balance > 0) {
        session.balance = response.balance;
        session.walletBalance = response.balance;
        console.log(
          `[ShadowIngestion] Wallet balance detected: ${response.balance.toFixed(4)} SOL`,
        );
        return;
      }
    } catch (e) {
      console.warn("[ShadowIngestion] Wallet balance fetch failed:", e);
    }

    // Fallback: estimate as 10x first trade size
    session.balance = firstTradeAmount * 10;
    session.walletBalance = session.balance;
    console.log(
      `[ShadowIngestion] Wallet balance estimated: ~${session.balance.toFixed(4)} SOL`,
    );
  },

  cleanup() {
    this.initialized = false;
    this.walletBalanceFetched = false;
    this._pendingSignatures = new Set();
    console.log("[ShadowIngestion] Cleanup complete");
  },
};
