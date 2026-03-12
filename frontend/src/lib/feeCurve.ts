// Fee curve constants matching FeeCurve.sol (5-zone progressive system)
export const BASE_FEE = 100;
export const MAX_FEE = 500_000;
export const ZONE1_UPPER = 10_050;  // 0.5% depeg
export const ZONE2_UPPER = 10_100;  // 1.0% depeg
export const ZONE3_UPPER = 10_300;  // 3.0% depeg
export const ZONE4_UPPER = 10_500;  // 5.0% depeg

// Precomputed fees at zone boundaries
export const ZONE2_END_FEE = 500;    // 5bp
export const ZONE3_END_FEE = 5_000;  // 50bp
export const ZONE4_END_FEE = 20_000; // 200bp

/**
 * Calculate fee in hundredths-of-bip for a given imbalance ratio.
 * Matches FeeCurve.sol logic exactly.
 */
export function calculateFee(ratio: number): number {
  if (ratio <= ZONE1_UPPER) return BASE_FEE;

  if (ratio <= ZONE2_UPPER) {
    // Zone 2 (Drift): linear 1bp to 5bp
    const d = ratio - ZONE1_UPPER;
    return Math.min(BASE_FEE + d * 8, MAX_FEE);
  }

  if (ratio <= ZONE3_UPPER) {
    // Zone 3 (Stress): quadratic 5bp to 50bp
    const d = ratio - ZONE2_UPPER;
    return Math.min(ZONE2_END_FEE + Math.floor((9 * d * d) / 80), MAX_FEE);
  }

  if (ratio <= ZONE4_UPPER) {
    // Zone 4 (Crisis): quadratic 50bp to 200bp
    const d = ratio - ZONE3_UPPER;
    return Math.min(ZONE3_END_FEE + Math.floor((3 * d * d) / 8), MAX_FEE);
  }

  // Zone 5 (Emergency): quadratic from 200bp, capped at 50%
  const d = ratio - ZONE4_UPPER;
  if (d > 5000) return MAX_FEE;
  return Math.min(ZONE4_END_FEE + Math.floor((d * d) / 50), MAX_FEE);
}

/** Convert hundredths-of-bip to bps */
export function toBps(fee: number): number {
  return fee / 100;
}

/** Convert ratio (scaled by 10000) to human-readable multiplier */
export function ratioToMultiplier(ratio: number): string {
  return (ratio / 10000).toFixed(3) + "x";
}

/** Convert ratio to pool split string like "50.2/49.8" */
export function ratioToSplit(ratio: number): string {
  const r = ratio / 10000;
  const pct0 = (r / (r + 1)) * 100;
  const pct1 = 100 - pct0;
  return `${pct0.toFixed(1)}/${pct1.toFixed(1)}`;
}

/** Get zone name for a ratio */
export function getZone(ratio: number): "stable" | "drift" | "stress" | "crisis" | "emergency" {
  if (ratio <= ZONE1_UPPER) return "stable";
  if (ratio <= ZONE2_UPPER) return "drift";
  if (ratio <= ZONE3_UPPER) return "stress";
  if (ratio <= ZONE4_UPPER) return "crisis";
  return "emergency";
}

export const ZONE_LABELS = {
  stable: "Stable",
  drift: "Drift",
  stress: "Stress",
  crisis: "Crisis",
  emergency: "Emergency",
} as const;

export const ZONE_COLORS = {
  stable: { text: "#00c853", bg: "#1a3a2a" },
  drift: { text: "#66bb6a", bg: "#1a3a2a" },
  stress: { text: "#f5a623", bg: "#3a2e1a" },
  crisis: { text: "#e53935", bg: "#3a1a1a" },
  emergency: { text: "#b71c1c", bg: "#3a1010" },
} as const;

/** Get CSS color for a zone */
export function getZoneColor(zone: ReturnType<typeof getZone>): string {
  return ZONE_COLORS[zone].text;
}

/** Get display label for a zone (uppercase) */
export function getZoneLabel(zone: ReturnType<typeof getZone>): string {
  return ZONE_LABELS[zone].toUpperCase();
}

/** Generate fee curve data points for charting */
export function generateCurveData(
  step = 10,
  min = 10000,
  max = 11000
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
