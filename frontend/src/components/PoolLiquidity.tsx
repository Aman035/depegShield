"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getZone, getZoneColor, getZoneLabel } from "@/lib/feeCurve";
import { TOKEN_DECIMALS } from "@/config/contracts";

interface PoolLiquidityProps {
  liquidity: string;
  sqrtPriceX96: string;
  tick: number;
  reserve0: string;
  reserve1: string;
  ratio: number;
}

// Resolved color values from CSS variables for Recharts SVG rendering
const COLORS = {
  textDim: "#666",
  textSecondary: "#a0a0a0",
  text: "#ececec",
  bg: "#0a0a0a",
  bgRaised: "#141414",
  border: "#222",
  green: "#34d399",
  indigo: "#818cf8",
};

/** Format raw bigint string with auto-scaling suffix */
function formatBigValue(rawStr: string): string {
  try {
    const val = Number(BigInt(rawStr));
    if (val === 0) return "0";
    if (val >= 1e18) return `${(val / 1e18).toFixed(2)}E`;
    if (val >= 1e15) return `${(val / 1e15).toFixed(2)}P`;
    if (val >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
    return val.toFixed(2);
  } catch {
    return rawStr;
  }
}

/** Format raw reserve value to human-readable token amount (divide by 10^decimals) */
function formatTokenAmount(rawStr: string): string {
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

function computePrice(sqrtPriceX96: string): string {
  try {
    const sqrtP = Number(BigInt(sqrtPriceX96)) / 2 ** 96;
    const price = sqrtP * sqrtP;
    if (price >= 1000) return price.toFixed(0);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(8);
  } catch {
    return "-";
  }
}

export function PoolLiquidity({ liquidity, sqrtPriceX96, tick, reserve0, reserve1, ratio }: PoolLiquidityProps) {
  const zone = getZone(ratio);
  const zoneColor = getZoneColor(zone);
  const price = computePrice(sqrtPriceX96);
  const [showInfo, setShowInfo] = useState(false);

  const reserveData = useMemo(() => {
    const r0 = Number(BigInt(reserve0)) / 10 ** TOKEN_DECIMALS;
    const r1 = Number(BigInt(reserve1)) / 10 ** TOKEN_DECIMALS;
    const total = r0 + r1;
    const pct0 = total > 0 ? (r0 / total) * 100 : 50;
    const pct1 = total > 0 ? (r1 / total) * 100 : 50;

    return [
      { name: "Token 0", value: r0, pct: pct0, fill: COLORS.green },
      { name: "Token 1", value: r1, pct: pct1, fill: COLORS.indigo },
    ];
  }, [reserve0, reserve1]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="8" width="3" height="6" rx="0.5" fill="var(--green)" fillOpacity="0.6" />
            <rect x="6.5" y="4" width="3" height="10" rx="0.5" fill="var(--green)" fillOpacity="0.6" />
            <rect x="11" y="6" width="3" height="8" rx="0.5" fill="var(--green)" fillOpacity="0.6" />
          </svg>
          <span className="font-mono text-[13px] uppercase tracking-wider text-[var(--text-secondary)]">Pool State</span>
        </div>
      </div>

      <div className="p-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
          <StatCard label="Liquidity (L)" value={formatBigValue(liquidity)} />
          <StatCard label="Price (token1/token0)" value={price} />
          <StatCard label="Current Tick" value={tick.toLocaleString()} />
          <StatCard label="Health Zone" value={getZoneLabel(zone)} valueColor={zoneColor} />
        </div>

        {/* Virtual reserve distribution */}
        <div className="border-t border-[var(--border)] pt-5">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Virtual Reserves</p>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="w-4 h-4 rounded-full border border-[var(--border-hover)] flex items-center justify-center text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-dim)] transition-colors"
              title="What are virtual reserves?"
            >
              ?
            </button>
          </div>
          {showInfo && (
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4 -mt-2">
              Virtual reserves represent the effective liquidity depth at the current price. Concentrated liquidity amplifies these beyond actual deposited amounts. The hook uses these values to compute the imbalance ratio that drives fees.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Bar chart */}
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reserveData} layout="vertical" barCategoryGap="35%" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={64}
                    tick={{ fill: COLORS.textDim, fontSize: 11, fontFamily: "var(--font-display), monospace" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    content={<ReserveTooltip />}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                    {reserveData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} fillOpacity={0.65} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Proportion bar + stats */}
            <div className="space-y-4">
              {/* Stacked proportion bar */}
              <div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--bg)]">
                  <div
                    className="transition-all duration-700 rounded-l-full"
                    style={{ width: `${reserveData[0].pct}%`, backgroundColor: COLORS.green, opacity: 0.65 }}
                  />
                  <div
                    className="transition-all duration-700 rounded-r-full"
                    style={{ width: `${reserveData[1].pct}%`, backgroundColor: COLORS.indigo, opacity: 0.65 }}
                  />
                </div>
                <div className="flex justify-between mt-2.5">
                  <span className="text-[12px] font-mono tracking-wide" style={{ color: COLORS.green }}>
                    {reserveData[0].pct.toFixed(1)}% Token 0
                  </span>
                  <span className="text-[12px] font-mono tracking-wide" style={{ color: COLORS.indigo }}>
                    Token 1 {reserveData[1].pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Reserve values */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[var(--border)] px-4 py-3 bg-[var(--bg)]/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.green, opacity: 0.65 }} />
                    <span className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Token 0</span>
                  </div>
                  <p className="text-[16px] font-mono font-semibold text-[var(--text)]">{formatTokenAmount(reserve0)}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] px-4 py-3 bg-[var(--bg)]/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.indigo, opacity: 0.65 }} />
                    <span className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Token 1</span>
                  </div>
                  <p className="text-[16px] font-mono font-semibold text-[var(--text)]">{formatTokenAmount(reserve1)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReserveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; pct: number; fill: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3.5 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
        <span className="text-[12px] font-mono uppercase tracking-widest text-[var(--text-secondary)] font-medium">
          {d.name}
        </span>
      </div>
      <p className="text-[13px] text-[var(--text-secondary)]">
        Virtual Reserve{" "}
        <span className="text-[var(--text)] font-mono font-medium">{d.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
      </p>
      <p className="text-[13px] text-[var(--text-secondary)] mt-1">
        Share{" "}
        <span className="text-[var(--text)] font-mono font-medium">{d.pct.toFixed(1)}%</span>
      </p>
    </div>
  );
}

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-[17px] font-mono font-semibold tracking-tight" style={{ color: valueColor ?? "var(--text)" }}>{value}</p>
    </div>
  );
}
