// Fee curve constants matching FeeCurve.sol
export const BASE_FEE = 100;
export const MAX_FEE = 500_000;
export const ZONE1_UPPER = 12_200;
export const ZONE2_UPPER = 15_000;
export const ZONE2_DIVISOR = 5_600;
export const ZONE2_END_FEE = 1_500;

/**
 * Calculate fee in hundredths-of-bip for a given imbalance ratio.
 * Matches FeeCurve.sol logic exactly.
 */
export function calculateFee(ratio: number): number {
  if (ratio <= ZONE1_UPPER) return BASE_FEE;

  if (ratio <= ZONE2_UPPER) {
    const d = ratio - ZONE1_UPPER;
    return Math.min(BASE_FEE + Math.floor((d * d) / ZONE2_DIVISOR), MAX_FEE);
  }

  const e = ratio - ZONE2_UPPER;
  return Math.min(ZONE2_END_FEE + e, MAX_FEE);
}

/** Convert hundredths-of-bip to bps */
export function toBps(fee: number): number {
  return fee / 100;
}

/** Convert ratio (scaled by 10000) to human-readable multiplier */
export function ratioToMultiplier(ratio: number): string {
  return (ratio / 10000).toFixed(2) + "x";
}

/** Convert ratio to pool split string like "55/45" */
export function ratioToSplit(ratio: number): string {
  const r = ratio / 10000;
  const pct0 = Math.round((r / (r + 1)) * 100);
  const pct1 = 100 - pct0;
  return `${pct0}/${pct1}`;
}

/** Get zone name for a ratio */
export function getZone(ratio: number): "safe" | "warning" | "critical" {
  if (ratio <= ZONE1_UPPER) return "safe";
  if (ratio <= ZONE2_UPPER) return "warning";
  return "critical";
}

export const ZONE_LABELS = {
  safe: "Safe",
  warning: "Warning",
  critical: "Circuit Breaker",
} as const;

export const ZONE_COLORS = {
  safe: { text: "#00c853", bg: "#1a3a2a" },
  warning: { text: "#f5a623", bg: "#3a2e1a" },
  critical: { text: "#e53935", bg: "#3a1a1a" },
} as const;

/** Generate fee curve data points for charting */
export function generateCurveData(
  step = 100,
  min = 10000,
  max = 50000
): Array<{ ratio: number; multiplier: number; fee: number; feeBps: number; zone: string }> {
  const data: Array<{
    ratio: number;
    multiplier: number;
    fee: number;
    feeBps: number;
    zone: string;
  }> = [];

  for (let r = min; r <= max; r += step) {
    const fee = calculateFee(r);
    data.push({
      ratio: r,
      multiplier: r / 10000,
      fee,
      feeBps: toBps(fee),
      zone: getZone(r),
    });
  }

  return data;
}
