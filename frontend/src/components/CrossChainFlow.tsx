"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Animated flow diagram showing the Reactive Network cross-chain shield.
 * 3 chain nodes at bottom + 1 Reactive Network node at top center.
 * Animation sequence: idle -> depeg detected -> relay to Reactive -> broadcast shield to all chains.
 */
export function CrossChainFlow() {
  // Phases: 0=idle, 1=depeg on chain1, 2=pulse to reactive, 3=reactive processing,
  // 4=broadcast to other chains, 5=shields active, 6=hold, 7=reset
  const [phase, setPhase] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const sequence = [0, 1, 2, 3, 4, 5, 5, 0];
    const durations = [1200, 1000, 1000, 800, 1000, 1500, 1000, 800];
    let step = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const advance = () => {
      setPhase(sequence[step]);
      timeout = setTimeout(() => {
        step = (step + 1) % sequence.length;
        advance();
      }, durations[step]);
    };

    advance();
    return () => clearTimeout(timeout);
  }, [isVisible]);

  const chains = [
    { name: "Ethereum", cx: 80, cy: 170 },
    { name: "Arbitrum", cx: 230, cy: 170 },
    { name: "Base", cx: 380, cy: 170 },
  ];

  const reactive = { cx: 230, cy: 40 };

  const getChainColor = (index: number) => {
    if (index === 0 && phase >= 1) return "var(--red)";
    if (phase >= 5) return index === 0 ? "var(--red)" : "var(--amber)";
    return "var(--green)";
  };

  const getChainBg = (index: number) => {
    if (index === 0 && phase >= 1) return "rgba(229, 57, 53, 0.08)";
    if (phase >= 5 && index !== 0) return "rgba(245, 166, 35, 0.08)";
    return "rgba(52, 211, 153, 0.05)";
  };

  const isShielded = (index: number) => phase >= 5 && index !== 0;

  const reactiveActive = phase >= 3 && phase <= 5;
  const reactiveColor = reactiveActive ? "var(--amber)" : "var(--text-dim)";
  const reactiveBg = reactiveActive ? "rgba(245, 166, 35, 0.08)" : "rgba(255,255,255,0.02)";

  return (
    <div ref={ref} className="ccf-visual">
      <svg viewBox="0 0 460 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="ccf-svg">
        <defs>
          <filter id="ccf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        {/* Connection paths from chains to Reactive Network */}
        {chains.map((chain, i) => {
          const isUpPath = phase === 2 && i === 0;
          const isDownPath = phase === 4 && i !== 0;
          const pathColor = isUpPath ? "var(--red)" : isDownPath ? "var(--amber)" : "var(--border)";
          const pathOpacity = isUpPath || isDownPath ? 0.6 : 0.15;

          // Curved path from chain to reactive node
          const midY = (chain.cy + reactive.cy) / 2;

          return (
            <g key={`path-${i}`}>
              <path
                d={`M${chain.cx},${chain.cy - 24} Q${chain.cx},${midY} ${reactive.cx},${reactive.cy + 26}`}
                stroke={pathColor}
                strokeWidth="1.5"
                strokeDasharray={isUpPath || isDownPath ? "none" : "4 4"}
                fill="none"
                opacity={pathOpacity}
                style={{ transition: "stroke 0.4s, opacity 0.4s" }}
              />

              {/* Animated pulse traveling along path */}
              {isUpPath && (
                <circle r="5" fill="var(--red)" opacity="0.9" filter="url(#ccf-glow)">
                  <animateMotion
                    dur="1s"
                    fill="freeze"
                    path={`M${chain.cx},${chain.cy - 24} Q${chain.cx},${midY} ${reactive.cx},${reactive.cy + 26}`}
                  />
                </circle>
              )}
              {isDownPath && (
                <circle r="5" fill="var(--amber)" opacity="0.9" filter="url(#ccf-glow)">
                  <animateMotion
                    dur="1s"
                    fill="freeze"
                    path={`M${reactive.cx},${reactive.cy + 26} Q${chain.cx},${midY} ${chain.cx},${chain.cy - 24}`}
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Reactive Network node */}
        <g>
          {/* Outer glow ring */}
          {reactiveActive && (
            <circle cx={reactive.cx} cy={reactive.cy} r="32" fill="none" stroke="var(--amber)" strokeWidth="1" opacity="0.2" className="ccf-ring-pulse" />
          )}
          <circle
            cx={reactive.cx} cy={reactive.cy} r="26"
            fill={reactiveBg}
            stroke={reactiveColor}
            strokeWidth="1.5"
            style={{ transition: "all 0.4s" }}
          />
          {/* Icon: network/relay symbol */}
          <g transform={`translate(${reactive.cx - 8}, ${reactive.cy - 8})`}>
            <circle cx="8" cy="4" r="2" fill={reactiveColor} style={{ transition: "fill 0.4s" }} />
            <circle cx="2" cy="13" r="2" fill={reactiveColor} style={{ transition: "fill 0.4s" }} />
            <circle cx="14" cy="13" r="2" fill={reactiveColor} style={{ transition: "fill 0.4s" }} />
            <line x1="8" y1="4" x2="2" y2="13" stroke={reactiveColor} strokeWidth="1" style={{ transition: "stroke 0.4s" }} />
            <line x1="8" y1="4" x2="14" y2="13" stroke={reactiveColor} strokeWidth="1" style={{ transition: "stroke 0.4s" }} />
          </g>
          <text x={reactive.cx} y={reactive.cy + 42} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-display), monospace">
            Reactive Network
          </text>
        </g>

        {/* Chain nodes */}
        {chains.map((chain, i) => {
          const color = getChainColor(i);
          const bg = getChainBg(i);
          const shielded = isShielded(i);

          return (
            <g key={chain.name}>
              {/* Shield glow when protected */}
              {shielded && (
                <circle cx={chain.cx} cy={chain.cy} r="30" fill="none" stroke="var(--amber)" strokeWidth="1.5" opacity="0.3" className="ccf-shield-pulse" />
              )}

              <circle
                cx={chain.cx} cy={chain.cy} r="24"
                fill={bg}
                stroke={color}
                strokeWidth="1"
                style={{ transition: "all 0.5s" }}
              />

              {/* Status dot */}
              <circle
                cx={chain.cx} cy={chain.cy} r="4"
                fill={color}
                style={{ transition: "fill 0.3s" }}
              />

              {/* Chain label */}
              <text x={chain.cx} y={chain.cy + 44} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-display), monospace">
                {chain.name}
              </text>

              {/* Status text */}
              {phase >= 1 && i === 0 && (
                <text x={chain.cx} y={chain.cy + 58} textAnchor="middle" fill="var(--red)" fontSize="9" fontFamily="var(--font-display), monospace" opacity="0.8">
                  depeg detected
                </text>
              )}
              {shielded && (
                <text x={chain.cx} y={chain.cy + 58} textAnchor="middle" fill="var(--amber)" fontSize="9" fontFamily="var(--font-display), monospace" opacity="0.8">
                  fee floor active
                </text>
              )}
              {phase === 0 && (
                <text x={chain.cx} y={chain.cy + 58} textAnchor="middle" fill="var(--green)" fontSize="9" fontFamily="var(--font-display), monospace" opacity="0.5">
                  monitoring
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <style jsx>{`
        .ccf-visual {
          width: 100%;
        }

        .ccf-svg {
          width: 100%;
          max-width: 100%;
          height: auto;
        }

        .ccf-ring-pulse {
          animation: ccf-ring 2s ease-in-out infinite;
        }

        @keyframes ccf-ring {
          0%, 100% { r: 32; opacity: 0.2; }
          50% { r: 36; opacity: 0.1; }
        }

        .ccf-shield-pulse {
          animation: ccf-shield 1.5s ease-in-out infinite;
        }

        @keyframes ccf-shield {
          0%, 100% { r: 30; opacity: 0.3; }
          50% { r: 34; opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
