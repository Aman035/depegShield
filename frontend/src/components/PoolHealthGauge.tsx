"use client";

import { useMemo } from "react";
import { getZone, ZONE_COLORS, ZONE_LABELS, ratioToMultiplier, ratioToSplit } from "@/lib/feeCurve";

interface PoolHealthGaugeProps {
  ratio: number;
  reserve0: string;
  reserve1: string;
}

export function PoolHealthGauge({ ratio, reserve0, reserve1 }: PoolHealthGaugeProps) {
  const zone = getZone(ratio);
  const colors = ZONE_COLORS[zone];

  // Gauge needle position: map ratio 10000-40000 to 0-180 degrees
  const needleAngle = useMemo(() => {
    const clamped = Math.min(Math.max(ratio, 10000), 40000);
    return ((clamped - 10000) / 30000) * 180;
  }, [ratio]);

  const r0Display = formatReserve(reserve0);
  const r1Display = formatReserve(reserve1);

  return (
    <div className="glass-card rounded-2xl p-8 flex flex-col items-center">
      {/* SVG Gauge */}
      <div className="relative w-64 h-36 mb-6">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Safe zone (0-40deg) */}
          <path
            d="M 10 100 A 90 90 0 0 1 41.5 30.7"
            fill="none"
            stroke="#065f46"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Warning zone (40-73deg) */}
          <path
            d="M 41.5 30.7 A 90 90 0 0 1 73.2 14.5"
            fill="none"
            stroke="#78350f"
            strokeWidth="12"
          />
          {/* Circuit breaker zone (73-180deg) */}
          <path
            d="M 73.2 14.5 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="#7f1d1d"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Needle */}
          <g transform={`rotate(${needleAngle}, 100, 100)`}>
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="22"
              stroke={colors.text}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="5" fill={colors.text} />
            <circle cx="100" cy="100" r="2.5" fill="var(--bg-card)" />
          </g>

          {/* Labels */}
          <text x="10" y="108" fill="var(--text-muted)" fontSize="7" fontFamily="JetBrains Mono">
            1.0x
          </text>
          <text x="170" y="108" fill="var(--text-muted)" fontSize="7" fontFamily="JetBrains Mono">
            4.0x
          </text>
        </svg>

        {/* Center label */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <p className="font-display text-2xl font-bold" style={{ color: colors.text }}>
            {ratioToMultiplier(ratio)}
          </p>
        </div>
      </div>

      {/* Zone badge */}
      <div
        className="px-4 py-1.5 rounded-full text-sm font-display font-medium mb-6"
        style={{ color: colors.text, backgroundColor: colors.bg + "66", border: `1px solid ${colors.border}44` }}
      >
        {ZONE_LABELS[zone]}
      </div>

      {/* Stats */}
      <div className="w-full grid grid-cols-3 gap-4 text-center">
        <StatBlock label="Reserve 0" value={r0Display} />
        <StatBlock label="Reserve 1" value={r1Display} />
        <StatBlock label="Pool Split" value={ratioToSplit(ratio)} />
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] font-display uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-display text-sm font-semibold text-[var(--text-primary)]">
        {value}
      </p>
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
