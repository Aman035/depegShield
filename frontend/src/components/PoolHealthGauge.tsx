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

  // Arc gauge: map ratio 10000-40000 to 0-180 degrees
  const angle = Math.min(((ratio - 10000) / 30000) * 180, 180);
  const rad = (angle * Math.PI) / 180;
  // SVG arc from left (0 deg) to right (180 deg), radius 70, center at (80, 75)
  const cx = 80, cy = 75, r = 62;
  const needleX = cx - r * Math.cos(rad);
  const needleY = cy - r * Math.sin(rad);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          </span>
          <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Pool Health</p>
        </div>
        <span
          className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          {ZONE_LABELS[zone]}
        </span>
      </div>

      {/* Arc gauge */}
      <div className="flex justify-center my-1">
        <svg width="160" height="90" viewBox="0 0 160 90">
          {/* Background arc */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Green zone: 0-73% of arc (ratio 10000-32000) */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * Math.PI * r} ${Math.PI * r}`}
          />
          {/* Zone boundary ticks */}
          {[12200, 15000].map((zoneRatio) => {
            const a = ((zoneRatio - 10000) / 30000) * 180;
            const aRad = (a * Math.PI) / 180;
            const tx = cx - (r + 4) * Math.cos(aRad);
            const ty = cy - (r + 4) * Math.sin(aRad);
            const tx2 = cx - (r - 4) * Math.cos(aRad);
            const ty2 = cy - (r - 4) * Math.sin(aRad);
            return <line key={zoneRatio} x1={tx} y1={ty} x2={tx2} y2={ty2} stroke="var(--text-dim)" strokeWidth="1" strokeOpacity="0.5" />;
          })}
          {/* Needle dot */}
          <circle cx={needleX} cy={needleY} r="5" fill={color} />
          <circle cx={needleX} cy={needleY} r="5" fill={color} opacity="0.3">
            <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Gradient def */}
          <defs>
            <linearGradient id="gaugeGrad" x1="18" y1="75" x2="142" y2="75" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--green)" />
              <stop offset="40%" stopColor="var(--amber)" />
              <stop offset="100%" stopColor="var(--red)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Ratio display */}
      <div className="text-center -mt-2 mb-4">
        <p className="text-2xl font-mono font-semibold tracking-tight" style={{ color }}>{ratioToMultiplier(ratio)}</p>
        <p className="text-[12px] font-mono text-[var(--text-dim)]">{ratioToSplit(ratio)}</p>
      </div>

      {/* Reserve stats */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border)]">
        <div>
          <p className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Reserve 0</p>
          <p className="font-mono text-[13px] mt-0.5 text-[var(--text-secondary)]">{formatReserve(reserve0)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Reserve 1</p>
          <p className="font-mono text-[13px] mt-0.5 text-[var(--text-secondary)]">{formatReserve(reserve1)}</p>
        </div>
      </div>
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
