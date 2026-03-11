"use client";

import { useEffect, useState, useRef } from "react";

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
      current += dir * 0.4;
      if (current >= 85) {
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

  // Calculate fee using the same logic as FeeCurve.sol
  const imbalanceRatio = Math.max(ratio, 100 - ratio) / Math.min(ratio, 100 - ratio);
  const scaledRatio = Math.round(imbalanceRatio * 10000);

  let fee = 1; // bps
  if (scaledRatio <= 12200) {
    fee = 1;
  } else if (scaledRatio <= 15000) {
    const d = scaledRatio - 12200;
    fee = Math.round((100 + (d * d) / 5600) / 100);
  } else {
    fee = Math.round((1500 + (scaledRatio - 15000)) / 100);
  }

  const isRecovering = phase === "recovering";
  const displayFee = isRecovering && scaledRatio > 12200 ? 0 : fee;

  const tokenA = ratio;
  const tokenB = 100 - ratio;

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
          {displayFee > 15 && (
            <span className="sv-fee-escalated">circuit breaker</span>
          )}
        </div>
      </div>

      {/* Fee meter */}
      <div className="sv-meter">
        <div className="sv-meter-track">
          <div className="sv-meter-zone sv-zone-safe" style={{ width: "22%" }} />
          <div className="sv-meter-zone sv-zone-warn" style={{ width: "28%" }} />
          <div className="sv-meter-zone sv-zone-crit" style={{ width: "50%" }} />
          <div
            className="sv-meter-needle"
            style={{
              left: `${Math.min(((scaledRatio - 10000) / 25000) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="sv-meter-labels">
          <span>1bp</span>
          <span>15bp</span>
          <span>50bp+</span>
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

        .sv-zone-safe {
          background: rgba(52, 211, 153, 0.3);
        }

        .sv-zone-warn {
          background: rgba(245, 166, 35, 0.3);
        }

        .sv-zone-crit {
          background: rgba(229, 57, 53, 0.3);
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
