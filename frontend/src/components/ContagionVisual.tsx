"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Animated visual showing a depeg spreading across 3 chains.
 * Red pulse originates from left node, propagates right with staggered delay.
 * Each node has a mini pool-bar that degrades when the pulse arrives.
 */
export function ContagionVisual() {
  const [phase, setPhase] = useState(0); // 0=idle, 1=chain1 depeg, 2=chain2 hit, 3=chain3 hit, 4=all red
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const sequence = [0, 1, 2, 3, 4, 4, 4, 0];
    const durations = [800, 1200, 1000, 1000, 1200, 800, 800, 600];
    let step = 0;

    const advance = () => {
      setPhase(sequence[step]);
      const timeout = setTimeout(() => {
        step = (step + 1) % sequence.length;
        advance();
      }, durations[step]);
      return timeout;
    };

    const timeout = advance();
    return () => clearTimeout(timeout);
  }, [isVisible]);

  const chains = [
    { name: "Ethereum", x: 60 },
    { name: "Arbitrum", x: 230 },
    { name: "Base", x: 400 },
  ];

  const getChainState = (index: number) => {
    if (index === 0) return phase >= 1 ? "depegged" : "healthy";
    if (index === 1) return phase >= 2 ? "depegged" : phase >= 1 ? "lagging" : "healthy";
    if (index === 2) return phase >= 3 ? "depegged" : phase >= 2 ? "lagging" : "healthy";
    return "healthy";
  };

  const getPoolRatio = (index: number) => {
    const state = getChainState(index);
    if (state === "depegged") return 78;
    if (state === "lagging") return 55;
    return 50;
  };

  return (
    <div ref={ref} className="contagion-visual">
      <svg viewBox="0 0 460 175" fill="none" xmlns="http://www.w3.org/2000/svg" className="cv-svg">
        {/* Dashed connection lines */}
        <line x1="100" y1="50" x2="190" y2="50" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="270" y1="50" x2="360" y2="50" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />

        {/* Pulse animations on connections */}
        {phase >= 1 && phase <= 3 && (
          <circle r="4" fill="var(--red)" opacity="0.8" className="cv-pulse-dot-1">
            <animate attributeName="cx" from="100" to="190" dur="1s" fill="freeze" />
            <animate attributeName="cy" values="50" dur="1s" fill="freeze" />
          </circle>
        )}
        {phase >= 2 && phase <= 3 && (
          <circle r="4" fill="var(--red)" opacity="0.8" className="cv-pulse-dot-2">
            <animate attributeName="cx" from="270" to="360" dur="1s" fill="freeze" />
            <animate attributeName="cy" values="50" dur="1s" fill="freeze" />
          </circle>
        )}

        {/* Chain nodes */}
        {chains.map((chain, i) => {
          const state = getChainState(i);
          const poolRatio = getPoolRatio(i);
          const isDepegged = state === "depegged";
          const nodeColor = isDepegged ? "var(--red)" : "var(--green)";

          return (
            <g key={chain.name} transform={`translate(${chain.x}, 0)`}>
              {/* Node circle */}
              <circle
                cx="0" cy="50" r="28"
                fill={isDepegged ? "rgba(229, 57, 53, 0.08)" : "rgba(52, 211, 153, 0.05)"}
                stroke={nodeColor}
                strokeWidth="1"
                opacity={state === "lagging" ? 0.5 : 1}
                style={{ transition: "all 0.5s" }}
              />
              {/* Status dot */}
              <circle
                cx="0" cy="50" r="4"
                fill={nodeColor}
                style={{ transition: "fill 0.3s" }}
              />

              {/* Chain label */}
              <text x="0" y="95" textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-display), monospace">
                {chain.name}
              </text>

              {/* Mini pool bar */}
              <rect x="-30" y="108" width="60" height="10" rx="3" fill="var(--bg-raised)" stroke="var(--border)" strokeWidth="0.5" />
              <rect
                x="-30" y="108" rx="3"
                width={60 * (poolRatio / 100)}
                height="10"
                fill={isDepegged ? "rgba(229, 57, 53, 0.4)" : "rgba(52, 211, 153, 0.2)"}
                style={{ transition: "width 0.8s ease, fill 0.5s" }}
              />
              <text x="0" y="134" textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-display), monospace">
                {poolRatio}/{100 - poolRatio}
              </text>

              {/* Depeg warning */}
              {isDepegged && (
                <text x="0" y="150" textAnchor="middle" fill="var(--red)" fontSize="9" fontFamily="var(--font-display), monospace" opacity="0.8">
                  drained
                </text>
              )}
            </g>
          );
        })}

        {/* Time lag indicator */}
        {phase >= 2 && phase < 4 && (
          <text x="230" y="14" textAnchor="middle" fill="var(--amber)" fontSize="10" fontFamily="var(--font-display), monospace" opacity="0.7">
            minutes later...
          </text>
        )}
      </svg>

      <style jsx>{`
        .contagion-visual {
          width: 100%;
        }

        .cv-svg {
          width: 100%;
          max-width: 640px;
          height: auto;
          margin: 0 auto;
          display: block;
        }

        .cv-pulse-dot-1 {
          animation: cv-travel-1 1s ease-in-out forwards;
        }

        .cv-pulse-dot-2 {
          animation: cv-travel-2 1s ease-in-out forwards;
        }

        @keyframes cv-travel-1 {
          0% { cx: 100; opacity: 0.8; }
          100% { cx: 190; opacity: 0; }
        }

        @keyframes cv-travel-2 {
          0% { cx: 270; opacity: 0.8; }
          100% { cx: 360; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
