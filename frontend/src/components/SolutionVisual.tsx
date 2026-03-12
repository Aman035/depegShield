"use client";

import { useEffect, useState, useRef } from "react";
import { calculateFee, toBps, ZONE1_UPPER } from "@/lib/feeCurve";

/**
 * Interactive comparison: same pool degradation but with DepegShield.
 * Fee escalates as imbalance grows, rebalancing swaps get 0bp.
 */
export function SolutionVisual() {
  const [ratio, setRatio] = useState(50);
  const [phase, setPhase] = useState<"depegging" | "recovering">("depegging");
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let current = 50;
    let dir = 1;

    const interval = setInterval(() => {
      const speed = dir === 1 ? 0.1 : 0.3;
      current += dir * speed;
      if (current >= 65) {
        dir = -1;
        setPhase("recovering");
      } else if (current <= 50) {
        dir = 1;
        setPhase("depegging");
      }
      setRatio(current);
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Piecewise map: spread each zone across equal visual bar segments
  // Zone 1 (Stable):    bar 50-52 -> ratio 10000-10050
  // Zone 2 (Drift):     bar 52-54 -> ratio 10050-10100
  // Zone 3 (Stress):    bar 54-57 -> ratio 10100-10300
  // Zone 4 (Crisis):    bar 57-60 -> ratio 10300-10500
  // Zone 5 (Emergency): bar 60-65 -> ratio 10500-15500
  const scaledRatio = Math.round(barToRatio(ratio));
  const fee = Math.round(toBps(calculateFee(scaledRatio)));

  function barToRatio(bar: number): number {
    if (bar <= 52) return 10000 + ((bar - 50) / 2) * 50;       // 10000-10050
    if (bar <= 54) return 10050 + ((bar - 52) / 2) * 50;       // 10050-10100
    if (bar <= 57) return 10100 + ((bar - 54) / 3) * 200;      // 10100-10300
    if (bar <= 60) return 10300 + ((bar - 57) / 3) * 200;      // 10300-10500
    return 10500 + ((bar - 60) / 5) * 5000;                    // 10500-15500
  }

  const isRecovering = phase === "recovering";
  const displayFee = isRecovering && scaledRatio > ZONE1_UPPER ? 0 : fee;

  const tokenA = ratio;
  const tokenB = 100 - ratio;

  /** Map ratio to meter needle position (0-100%) across 5 zones */
  function meterPct(r: number): number {
    if (r <= 10050) return ((r - 10000) / 50) * 10;              // Zone 1: 0-10%
    if (r <= 10100) return 10 + ((r - 10050) / 50) * 10;         // Zone 2: 10-20%
    if (r <= 10300) return 20 + ((r - 10100) / 200) * 30;        // Zone 3: 20-50%
    if (r <= 10500) return 50 + ((r - 10300) / 200) * 25;        // Zone 4: 50-75%
    return Math.min(75 + ((r - 10500) / 2000) * 25, 100);        // Zone 5: 75-100%
  }

  return (
    <div ref={ref} className="solution-visual">
      <div className="sv-pool-bar">
        <div className="sv-bar-a" style={{ width: `${tokenA}%` }}>
          <span className="sv-bar-label">
            Token A &middot; {tokenA.toFixed(0)}%
          </span>
        </div>
        <div className="sv-bar-b" style={{ width: `${tokenB}%` }}>
          {tokenB >= 20 && (
            <span className="sv-bar-label">
              Token B &middot; {tokenB.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      <div className="sv-status-row">
        <div className="sv-status-left">
          <span className="sv-direction-badge" data-recovering={isRecovering}>
            {isRecovering ? (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M13 8H3m0 0l4 4M3 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Rebalancing
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Worsening
              </>
            )}
          </span>
        </div>

        <div className="sv-fee-badge" data-zero={displayFee === 0}>
          <span className="sv-fee-label">Dynamic fee</span>
          <span className="sv-fee-value">{displayFee}bp</span>
          {displayFee === 0 && (
            <span className="sv-fee-free">free recovery</span>
          )}
          {displayFee > 50 && (
            <span className="sv-fee-escalated">emergency</span>
          )}
        </div>
      </div>

      {/* Fee meter -- 5 zones */}
      <div className="sv-meter">
        <div className="sv-meter-track">
          <div className="sv-meter-zone sv-zone-stable" style={{ width: "10%" }} />
          <div className="sv-meter-zone sv-zone-drift" style={{ width: "10%" }} />
          <div className="sv-meter-zone sv-zone-stress" style={{ width: "30%" }} />
          <div className="sv-meter-zone sv-zone-crisis" style={{ width: "25%" }} />
          <div className="sv-meter-zone sv-zone-emergency" style={{ width: "25%" }} />
          <div
            className="sv-meter-needle"
            style={{
              left: `${meterPct(scaledRatio)}%`,
            }}
          />
        </div>
        <div className="sv-meter-labels">
          <span>1bp</span>
          <span>5bp</span>
          <span>50bp</span>
          <span>200bp</span>
          <span>MAX</span>
        </div>
      </div>

      <style jsx>{`
        .solution-visual {
          width: 100%;
        }

        .sv-pool-bar {
          display: flex;
          height: 56px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--border);
        }

        .sv-bar-a {
          background: linear-gradient(
            135deg,
            ${displayFee > 15
              ? "rgba(229, 57, 53, 0.25), rgba(229, 57, 53, 0.15)"
              : displayFee > 1
              ? "rgba(245, 166, 35, 0.2), rgba(245, 166, 35, 0.1)"
              : "rgba(52, 211, 153, 0.15), rgba(52, 211, 153, 0.08)"}
          );
          border-right: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 16px;
          transition: width 0.05s linear, background 0.3s;
          min-width: 80px;
        }

        .sv-bar-b {
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(52, 211, 153, 0.08));
          display: flex;
          align-items: center;
          padding: 0 16px;
          transition: width 0.05s linear;
          overflow: hidden;
        }

        .sv-bar-label {
          font-family: var(--font-display), monospace;
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .sv-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
        }

        .sv-status-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sv-direction-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          padding: 4px 12px;
          border-radius: 6px;
          transition: all 0.3s;
        }

        .sv-direction-badge[data-recovering="false"] {
          color: var(--red);
          background: rgba(229, 57, 53, 0.1);
          border: 1px solid rgba(229, 57, 53, 0.2);
        }

        .sv-direction-badge[data-recovering="true"] {
          color: var(--green);
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.2);
        }

        .sv-fee-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 8px;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          transition: border-color 0.3s;
        }

        .sv-fee-badge[data-zero="true"] {
          border-color: rgba(52, 211, 153, 0.3);
        }

        .sv-fee-label {
          font-size: 12px;
          color: var(--text-dim);
        }

        .sv-fee-value {
          font-family: var(--font-display), monospace;
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
          min-width: 36px;
        }

        .sv-fee-free {
          font-size: 11px;
          color: var(--green);
        }

        .sv-fee-escalated {
          font-size: 11px;
          color: var(--red);
        }

        .sv-meter {
          margin-top: 20px;
        }

        .sv-meter-track {
          position: relative;
          height: 6px;
          border-radius: 3px;
          display: flex;
          overflow: hidden;
        }

        .sv-meter-zone {
          height: 100%;
        }

        .sv-zone-stable {
          background: rgba(0, 200, 83, 0.3);
        }

        .sv-zone-drift {
          background: rgba(102, 187, 106, 0.3);
        }

        .sv-zone-stress {
          background: rgba(245, 166, 35, 0.3);
        }

        .sv-zone-crisis {
          background: rgba(229, 57, 53, 0.3);
        }

        .sv-zone-emergency {
          background: rgba(183, 28, 28, 0.3);
        }

        .sv-meter-needle {
          position: absolute;
          top: -4px;
          width: 3px;
          height: 14px;
          border-radius: 2px;
          background: var(--text);
          transition: left 0.05s linear;
          transform: translateX(-50%);
        }

        .sv-meter-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 11px;
          font-family: var(--font-display), monospace;
          color: var(--text-dim);
        }
      `}</style>
    </div>
  );
}
