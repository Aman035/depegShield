"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { generateCurveData, ZONE1_UPPER, ZONE2_UPPER, ratioToSplit } from "@/lib/feeCurve";

interface FeeCurveChartProps {
  currentRatio?: number;
  height?: number;
}

export function FeeCurveChart({ currentRatio, height = 340 }: FeeCurveChartProps) {
  const data = useMemo(() => generateCurveData(200, 10000, 35000), []);

  // Custom x-axis ticks: only show key ratios
  const xTicks = [10000, 15000, 20000, 25000, 30000, 35000];

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 24, left: 4, bottom: 4 }}>
          {/* Zone background bands */}
          <ReferenceArea
            x1={10000}
            x2={ZONE1_UPPER}
            fill="rgba(52, 211, 153, 0.02)"
            fillOpacity={1}
          />
          <ReferenceArea
            x1={ZONE1_UPPER}
            x2={ZONE2_UPPER}
            fill="rgba(245, 166, 35, 0.02)"
            fillOpacity={1}
          />
          <ReferenceArea
            x1={ZONE2_UPPER}
            x2={35000}
            fill="rgba(229, 57, 53, 0.02)"
            fillOpacity={1}
          />

          {/* Zone boundary lines */}
          <ReferenceLine
            x={ZONE1_UPPER}
            stroke="rgba(245, 166, 35, 0.15)"
            strokeDasharray="6 4"
          />
          <ReferenceLine
            x={ZONE2_UPPER}
            stroke="rgba(229, 57, 53, 0.15)"
            strokeDasharray="6 4"
          />

          {/* Current position */}
          {currentRatio && (
            <ReferenceLine x={currentRatio} stroke="var(--green)" strokeWidth={1.5} />
          )}

          <XAxis
            dataKey="ratio"
            ticks={xTicks}
            tickFormatter={(v: number) => (v / 10000).toFixed(1) + "x"}
            stroke="transparent"
            tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "var(--font-display)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            domain={[10000, 35000]}
            type="number"
          />
          <YAxis
            tickFormatter={(v: number) => v + "bp"}
            stroke="transparent"
            tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "var(--font-display)" }}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={[0, "auto"]}
          />

          <Tooltip content={<CurveTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />

          <defs>
            <linearGradient id="feeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="feeBps"
            stroke="var(--green)"
            strokeWidth={2}
            fill="url(#feeGradient)"
            dot={
              currentRatio
                ? (props: Record<string, unknown>) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { ratio: number } };
                    if (currentRatio && Math.abs(payload.ratio - currentRatio) < 150) {
                      return (
                        <g key="current">
                          <circle cx={cx} cy={cy} r={8} fill="var(--green)" opacity={0.15} />
                          <circle cx={cx} cy={cy} r={4} fill="var(--green)" stroke="var(--bg)" strokeWidth={2} />
                        </g>
                      );
                    }
                    return <g key={`d-${payload.ratio}`} />;
                  }
                : false
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { ratio: number; feeBps: number; zone: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  const zoneColor =
    d.zone === "safe" ? "var(--green)" : d.zone === "warning" ? "var(--amber)" : "var(--red)";
  const zoneLabel = d.zone === "safe" ? "Safe" : d.zone === "warning" ? "Warning" : "Circuit Breaker";

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: zoneColor }}
        />
        <span
          className="text-[11px] font-mono uppercase tracking-widest"
          style={{ color: zoneColor }}
        >
          {zoneLabel}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Ratio{" "}
          <span className="text-[var(--text)] font-mono font-medium">
            {(d.ratio / 10000).toFixed(2)}x
          </span>{" "}
          <span className="text-[var(--text-dim)]">({ratioToSplit(d.ratio)})</span>
        </p>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Fee{" "}
          <span className="text-[var(--text)] font-mono font-medium">
            {d.feeBps.toFixed(1)} bps
          </span>
        </p>
      </div>
    </div>
  );
}
