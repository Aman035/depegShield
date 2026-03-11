"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Animated pool bar that shows a balanced pool degrading into a 90/10 split,
 * with the fee staying flat at 1bp the whole time -- visualizing the problem.
 */
export function ProblemVisual() {
  const [ratio, setRatio] = useState(50);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Animate: 50 -> 90 over ~4s, then reset
    let current = 50;
    let direction = 1;

    intervalRef.current = setInterval(() => {
      current += direction * 0.5;
      if (current >= 90) {
        direction = -1;
      } else if (current <= 50) {
        direction = 1;
      }
      setRatio(current);
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible]);

  const tokenA = ratio;
  const tokenB = 100 - ratio;
  const isImbalanced = ratio > 65;
  const isCritical = ratio > 80;

  return (
    <div ref={ref} className="problem-visual">
      {/* Pool bar */}
      <div className="pool-bar-container">
        <div className="pool-bar">
          <div
            className="pool-bar-a"
            style={{ width: `${tokenA}%` }}
          >
            <span className="pool-bar-label">
              Token A &middot; {tokenA.toFixed(0)}%
            </span>
          </div>
          <div
            className="pool-bar-b"
            style={{ width: `${tokenB}%` }}
          >
            {tokenB >= 20 && (
              <span className="pool-bar-label">
                Token B &middot; {tokenB.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Status indicators */}
        <div className="pool-status-row">
          <div className="pool-status-left">
            <span
              className="pool-status-dot"
              style={{
                background: isCritical
                  ? "var(--red)"
                  : isImbalanced
                  ? "var(--amber)"
                  : "var(--green)",
              }}
            />
            <span className="pool-status-text">
              {isCritical
                ? "Death spiral"
                : isImbalanced
                ? "Imbalanced"
                : "Balanced"}
            </span>
          </div>
          <div className="pool-fee-badge">
            <span className="pool-fee-label">Swap fee</span>
            <span className="pool-fee-value">1bp</span>
            <span className="pool-fee-same">always the same</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .problem-visual {
          width: 100%;
        }

        .pool-bar-container {
          width: 100%;
        }

        .pool-bar {
          display: flex;
          height: 56px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--border);
        }

        .pool-bar-a {
          background: linear-gradient(135deg, rgba(229, 57, 53, 0.25), rgba(229, 57, 53, 0.15));
          border-right: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 16px;
          transition: width 0.05s linear;
          min-width: 80px;
        }

        .pool-bar-b {
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(52, 211, 153, 0.08));
          display: flex;
          align-items: center;
          padding: 0 16px;
          transition: width 0.05s linear;
          overflow: hidden;
        }

        .pool-bar-label {
          font-family: var(--font-display), monospace;
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .pool-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
        }

        .pool-status-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pool-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: background 0.3s;
        }

        .pool-status-text {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .pool-fee-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 8px;
          background: var(--bg-raised);
          border: 1px solid var(--border);
        }

        .pool-fee-label {
          font-size: 12px;
          color: var(--text-dim);
        }

        .pool-fee-value {
          font-family: var(--font-display), monospace;
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
        }

        .pool-fee-same {
          font-size: 11px;
          color: var(--red);
          opacity: ${isImbalanced ? 1 : 0};
          transition: opacity 0.3s;
        }
      `}</style>
    </div>
  );
}
