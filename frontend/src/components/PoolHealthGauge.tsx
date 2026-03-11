"use client";

import { getZone, ZONE_LABELS, ratioToMultiplier, ratioToSplit } from "@/lib/feeCurve";

interface PoolHealthGaugeProps {
  ratio: number;
  reserve0: string;
  reserve1: string;
}

export function PoolHealthGauge({ ratio, reserve0, reserve1 }: PoolHealthGaugeProps) {
  const zone = getZone(ratio);
  const color = zone === "safe" ? "var(--green)" : zone === "warning" ? "var(--amber)" : "var(--red)";

  // Bar fill: map ratio 10000-40000 to 0-100%
  const fill = Math.min(((ratio - 10000) / 30000) * 100, 100);

  return (
    <div className="border border-[var(--border)] rounded-lg p-5">
      {/* Zone + Ratio */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Pool Health</p>
          <p className="text-2xl font-mono font-semibold mt-1">{ratioToMultiplier(ratio)}</p>
        </div>
        <span
          className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          {ZONE_LABELS[zone]}
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 bg-[var(--bg-raised)] rounded-full overflow-hidden mb-5">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${fill}%`, backgroundColor: color }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Reserve 0" value={formatReserve(reserve0)} />
        <Stat label="Reserve 1" value={formatReserve(reserve1)} />
        <Stat label="Split" value={ratioToSplit(ratio)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">{label}</p>
      <p className="font-mono text-sm mt-0.5">{value}</p>
    </div>
  );
}

function formatReserve(weiStr: string): string {
  try {
    const val = BigInt(weiStr);
    const whole = val / BigInt(1e18);
    const frac = (val % BigInt(1e18)) / BigInt(1e14);
    if (whole > BigInt(1_000_000)) return `${(Number(whole) / 1_000_000).toFixed(1)}M`;
    if (whole > BigInt(1_000)) return `${(Number(whole) / 1_000).toFixed(1)}K`;
    return `${whole}.${frac.toString().padStart(4, "0").slice(0, 2)}`;
  } catch {
    return weiStr;
  }
}
