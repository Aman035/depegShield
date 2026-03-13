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
import { generateCurveData, ZONE1_UPPER, ZONE2_UPPER, ZONE3_UPPER, ZONE4_UPPER, ZONE_LABELS, ZONE_COLORS, ratioToSplit } from "@/lib/feeCurve";

interface FeeCurveChartProps {
  currentRatio?: number;
  height?: number;
}

export function FeeCurveChart({ currentRatio, height = 340 }: FeeCurveChartProps) {
  // Default range covers zones 1-5 with some headroom; extend if current ratio exceeds
  const maxRange = Math.max(11000, currentRatio ? currentRatio + 200 : 11000);
  const data = useMemo(() => generateCurveData(5, 10000, maxRange), [maxRange]);

  // Custom x-axis ticks at zone boundaries
  const xTicks = [10000, ZONE1_UPPER, ZONE2_UPPER, ZONE3_UPPER, ZONE4_UPPER].filter(t => t <= maxRange);
  if (maxRange > ZONE4_UPPER) xTicks.push(maxRange);

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
            fill="rgba(52, 211, 153, 0.02)"
            fillOpacity={1}
          />
          <ReferenceArea
            x1={ZONE2_UPPER}
            x2={ZONE3_UPPER}
            fill="rgba(245, 166, 35, 0.02)"
            fillOpacity={1}
          />
          <ReferenceArea
            x1={ZONE3_UPPER}
            x2={ZONE4_UPPER}
            fill="rgba(229, 57, 53, 0.02)"
            fillOpacity={1}
          />
          <ReferenceArea
            x1={ZONE4_UPPER}
            x2={maxRange}
            fill="rgba(183, 28, 28, 0.02)"
            fillOpacity={1}
          />

          {/* Zone boundary lines */}
          <ReferenceLine
            x={ZONE1_UPPER}
            stroke="rgba(52, 211, 153, 0.2)"
            strokeDasharray="6 4"
          />
          <ReferenceLine
            x={ZONE2_UPPER}
            stroke="rgba(245, 166, 35, 0.2)"
            strokeDasharray="6 4"
          />
          <ReferenceLine
            x={ZONE3_UPPER}
            stroke="rgba(229, 57, 53, 0.2)"
            strokeDasharray="6 4"
          />
          <ReferenceLine
            x={ZONE4_UPPER}
            stroke="rgba(183, 28, 28, 0.2)"
            strokeDasharray="6 4"
          />

          {/* Current position */}
          {currentRatio && (
            <ReferenceLine x={currentRatio} stroke="var(--green)" strokeWidth={1.5} />
          )}

          <XAxis
            dataKey="ratio"
            ticks={xTicks}
            tickFormatter={(v: number) => (v / 10000).toFixed(2) + "x"}
            stroke="transparent"
            tick={{ fill: "var(--text-dim)", fontSize: 12, fontFamily: "var(--font-display)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            domain={[10000, maxRange]}
            type="number"
          />
          <YAxis
            tickFormatter={(v: number) => v + "bp"}
            stroke="transparent"
            tick={{ fill: "var(--text-dim)", fontSize: 12, fontFamily: "var(--font-display)" }}
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
                    const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: { ratio: number }; index: number };
                    // Find the single closest data point to currentRatio
                    const closestIdx = data.reduce((best, pt, i) =>
                      Math.abs(pt.ratio - currentRatio!) < Math.abs(data[best].ratio - currentRatio!) ? i : best
                    , 0);
                    if (index === closestIdx) {
                      return (
                        <g key="current">
                          <circle cx={cx} cy={cy} r={10} fill="#fff" opacity={0.08} />
                          <circle cx={cx} cy={cy} r={6} fill="#fff" opacity={0.15} />
                          <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="var(--bg)" strokeWidth={1.5} />
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

  const zone = d.zone as keyof typeof ZONE_COLORS;
  const zoneColor = ZONE_COLORS[zone]?.text ?? "var(--text)";
  const zoneLabel = ZONE_LABELS[zone] ?? d.zone;

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3.5 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: zoneColor }}
        />
        <span
          className="text-[12px] font-mono uppercase tracking-widest font-medium"
          style={{ color: zoneColor }}
        >
          {zoneLabel}
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Ratio{" "}
          <span className="text-[var(--text)] font-mono font-medium">
            {(d.ratio / 10000).toFixed(3)}x
          </span>{" "}
          <span className="text-[var(--text-secondary)]">({ratioToSplit(d.ratio)})</span>
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
