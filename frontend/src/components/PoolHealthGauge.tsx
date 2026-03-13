"use client";

import { getZone, ZONE_LABELS, ratioToMultiplier, ratioToSplit, getZoneColor } from "@/lib/feeCurve";
import { TOKEN_DECIMALS } from "@/config/contracts";

interface PoolHealthGaugeProps {
  ratio: number;
  reserve0: string;
  reserve1: string;
}

export function PoolHealthGauge({ ratio, reserve0, reserve1 }: PoolHealthGaugeProps) {
  const zone = getZone(ratio);
  const color = getZoneColor(zone);

  // Arc gauge: map ratio 10000-11000 to 0-180 degrees (covers 0-10% depeg)
  const angle = Math.min(((ratio - 10000) / 1000) * 180, 180);
  const rad = (angle * Math.PI) / 180;
  // SVG arc from left (0 deg) to right (180 deg), radius 70, center at (80, 75)
  const cx = 80, cy = 75, r = 62;
  const needleX = cx - r * Math.cos(rad);
  const needleY = cy - r * Math.sin(rad);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          </span>
          <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Pool Health</p>
        </div>
        <span
          className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md font-medium"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          {ZONE_LABELS[zone]}
        </span>
      </div>

      {/* Arc gauge */}
      <div className="flex justify-center my-2">
        <svg width="200" height="110" viewBox="0 0 160 90">
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
          {[10050, 10100, 10300, 10500].map((zoneRatio) => {
            const a = ((zoneRatio - 10000) / 1000) * 180;
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
      <div className="text-center -mt-1 mb-5">
        <p className="text-3xl font-mono font-semibold tracking-tight" style={{ color }}>{ratioToMultiplier(ratio)}</p>
        <p className="text-[13px] font-mono text-[var(--text-secondary)] mt-0.5">{ratioToSplit(ratio)}</p>
      </div>

      {/* Reserve stats */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--border)]">
        <div>
          <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Reserve 0</p>
          <p className="font-mono text-[15px] mt-1 font-medium text-[var(--text)]">{formatReserve(reserve0)}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Reserve 1</p>
          <p className="font-mono text-[15px] mt-1 font-medium text-[var(--text)]">{formatReserve(reserve1)}</p>
        </div>
      </div>
    </div>
  );
}

function formatReserve(rawStr: string): string {
  try {
    const val = Number(BigInt(rawStr)) / 10 ** TOKEN_DECIMALS;
    if (val === 0) return "0";
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return rawStr;
  }
}
