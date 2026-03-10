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
  CartesianGrid,
} from "recharts";
import { generateCurveData, ZONE1_UPPER, ZONE2_UPPER, toBps, ratioToSplit } from "@/lib/feeCurve";

interface FeeCurveChartProps {
  currentRatio?: number; // If provided, shows a marker dot
  height?: number;
}

export function FeeCurveChart({ currentRatio, height = 360 }: FeeCurveChartProps) {
  const data = useMemo(() => generateCurveData(50, 10000, 40000), []);

  const currentPoint = useMemo(() => {
    if (!currentRatio) return null;
    const closest = data.reduce((prev, curr) =>
      Math.abs(curr.ratio - currentRatio) < Math.abs(prev.ratio - currentRatio)
        ? curr
        : prev
    );
    return closest;
  }, [currentRatio, data]);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="feeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="30%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(30, 42, 58, 0.5)"
            vertical={false}
          />

          {/* Zone backgrounds */}
          <ReferenceArea
            x1={10000}
            x2={ZONE1_UPPER}
            fill="#065f46"
            fillOpacity={0.08}
          />
          <ReferenceArea
            x1={ZONE1_UPPER}
            x2={ZONE2_UPPER}
            fill="#78350f"
            fillOpacity={0.08}
          />
          <ReferenceArea
            x1={ZONE2_UPPER}
            x2={40000}
            fill="#7f1d1d"
            fillOpacity={0.08}
          />

          {/* Zone boundary lines */}
          <ReferenceLine
            x={ZONE1_UPPER}
            stroke="#059669"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: "1.22x", position: "top", fill: "#059669", fontSize: 11 }}
          />
          <ReferenceLine
            x={ZONE2_UPPER}
            stroke="#d97706"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: "1.50x", position: "top", fill: "#d97706", fontSize: 11 }}
          />

          {/* Current position marker */}
          {currentRatio && (
            <ReferenceLine
              x={currentRatio}
              stroke="#60a5fa"
              strokeWidth={2}
              strokeOpacity={0.8}
            />
          )}

          <XAxis
            dataKey="ratio"
            tickFormatter={(v: number) => (v / 10000).toFixed(1) + "x"}
            stroke="#4a5a72"
            tick={{ fill: "#4a5a72", fontSize: 11 }}
            axisLine={{ stroke: "#1e2a3a" }}
            tickLine={{ stroke: "#1e2a3a" }}
          />
          <YAxis
            tickFormatter={(v: number) => v + "bp"}
            stroke="#4a5a72"
            tick={{ fill: "#4a5a72", fontSize: 11 }}
            axisLine={{ stroke: "#1e2a3a" }}
            tickLine={{ stroke: "#1e2a3a" }}
            width={55}
          />

          <Tooltip content={<CustomTooltip currentRatio={currentRatio} />} />

          <Area
            type="monotone"
            dataKey="feeBps"
            stroke="url(#lineGradient)"
            strokeWidth={2}
            fill="url(#feeGradient)"
            dot={
              currentPoint
                ? (props: Record<string, unknown>) => {
                    const { cx, cy, payload } = props as {
                      cx: number;
                      cy: number;
                      payload: { ratio: number };
                    };
                    if (
                      currentPoint &&
                      Math.abs(payload.ratio - currentPoint.ratio) < 75
                    ) {
                      return (
                        <g key="current-dot">
                          <circle
                            cx={cx}
                            cy={cy}
                            r={8}
                            fill="#60a5fa"
                            fillOpacity={0.2}
                            className="pulse-dot"
                          />
                          <circle cx={cx} cy={cy} r={4} fill="#60a5fa" stroke="#0d1117" strokeWidth={2} />
                        </g>
                      );
                    }
                    return <g key={`dot-${payload.ratio}`} />;
                  }
                : false
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { ratio: number; feeBps: number; zone: string } }>;
  currentRatio?: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const zone = d.zone;
  const zoneColor =
    zone === "safe" ? "#34d399" : zone === "warning" ? "#fbbf24" : "#f87171";

  return (
    <div className="glass-card rounded-lg px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: zoneColor }}
        />
        <span className="font-display text-xs uppercase tracking-wider" style={{ color: zoneColor }}>
          {zone === "safe" ? "Safe Zone" : zone === "warning" ? "Warning Zone" : "Circuit Breaker"}
        </span>
      </div>
      <div className="space-y-0.5 text-sm">
        <p className="text-[var(--text-secondary)]">
          Ratio: <span className="text-[var(--text-primary)] font-display">{(d.ratio / 10000).toFixed(2)}x</span>
          <span className="text-[var(--text-muted)] ml-1">({ratioToSplit(d.ratio)})</span>
        </p>
        <p className="text-[var(--text-secondary)]">
          Worsening fee: <span className="text-[var(--text-primary)] font-display">{d.feeBps.toFixed(1)} bps</span>
        </p>
        <p className="text-[var(--text-secondary)]">
          Rebalancing fee: <span className="text-[var(--accent-green)] font-display">0 bps</span>
        </p>
      </div>
    </div>
  );
}
