export const Precision = {
  /**
   * Round to N decimals with epsilon handling to prevent float errors
   */
  round(value, decimals) {
    if (!Number.isFinite(value)) return 0;
    const multiplier = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
  },

  /**
   * Token quantities (6 decimals - SPL token standard)
   */
  tokenQty(value) {
    return this.round(value, 6);
  },

  /**
   * SOL amounts (4 decimals - matches display precision)
   */
  sol(value) {
    return this.round(value, 4);
  },

  /**
   * USD prices (8 decimals - handles micro-cap tokens)
   */
  usdPrice(value) {
    return this.round(value, 8);
  },

  /**
   * Percentages (2 decimals)
   */
  pct(value) {
    return this.round(value, 2);
  },

  /**
   * Weighted average with precision protection
   */
  weightedAvg(val1, weight1, val2, weight2) {
    const totalWeight = weight1 + weight2;
    if (totalWeight === 0) return 0;

    const result = (val1 * weight1 + val2 * weight2) / totalWeight;
    return this.round(result, 8); // USD price precision
  },
};
