"use client";

import { useEffect, useState } from "react";

/**
 * Premium animated shield for the hero section.
 * Layered SVG with glow filters, gradient strokes, and CSS animations.
 */
export function HeroShield() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="hero-shield-wrap">
      <svg
        viewBox="0 0 400 480"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="hero-shield-svg"
      >
        <defs>
          {/* Glow filter */}
          <filter id="hs-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger glow for accents */}
          <filter id="hs-glow-strong" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Shield body gradient */}
          <linearGradient id="hs-fill" x1="200" y1="40" x2="200" y2="420" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.07" />
            <stop offset="40%" stopColor="#34d399" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>

          {/* Stroke gradient */}
          <linearGradient id="hs-stroke" x1="200" y1="40" x2="200" y2="420" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
          </linearGradient>

          {/* Inner stroke gradient */}
          <linearGradient id="hs-stroke-inner" x1="200" y1="70" x2="200" y2="390" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.05" />
          </linearGradient>

          {/* Pulse line gradient */}
          <linearGradient id="hs-pulse" x1="100" y1="240" x2="300" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
            <stop offset="15%" stopColor="#34d399" stopOpacity="0.6" />
            <stop offset="45%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="55%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="85%" stopColor="#34d399" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>

          {/* Radial center glow */}
          <radialGradient id="hs-center-glow" cx="200" cy="200" r="160" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>

          {/* Scan line gradient */}
          <linearGradient id="hs-scan" x1="200" y1="0" x2="200" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>

          {/* Clip path for scan line */}
          <clipPath id="hs-shield-clip">
            <path d="M200 42 L340 110 C345 112 348 117 348 122 L348 220 C348 300 280 375 205 408 C202 409 198 409 195 408 C120 375 52 300 52 220 L52 122 C52 117 55 112 60 110 Z" />
          </clipPath>
        </defs>

        {/* Background ambient glow */}
        <ellipse cx="200" cy="220" rx="180" ry="200" fill="url(#hs-center-glow)" className="hs-breathe" />

        {/* Outer shield - main shape */}
        <path
          d="M200 42 L340 110 C345 112 348 117 348 122 L348 220 C348 300 280 375 205 408 C202 409 198 409 195 408 C120 375 52 300 52 220 L52 122 C52 117 55 112 60 110 Z"
          fill="url(#hs-fill)"
          stroke="url(#hs-stroke)"
          strokeWidth="1.5"
          className={mounted ? "hs-draw" : ""}
        />

        {/* Inner shield outline */}
        <path
          d="M200 68 L322 126 C325 127 327 130 327 133 L327 222 C327 290 268 355 203 384 C201 385 199 385 197 384 C132 355 73 290 73 222 L73 133 C73 130 75 127 78 126 Z"
          fill="none"
          stroke="url(#hs-stroke-inner)"
          strokeWidth="1"
          className={mounted ? "hs-draw-delayed" : ""}
        />

        {/* Scan line that sweeps down */}
        <g clipPath="url(#hs-shield-clip)">
          <rect x="50" y="0" width="300" height="60" fill="url(#hs-scan)" className="hs-scan-line" />
        </g>

        {/* Horizontal grid lines (subtle) */}
        <g clipPath="url(#hs-shield-clip)" opacity="0.04" stroke="#34d399" strokeWidth="0.5">
          <line x1="60" y1="160" x2="340" y2="160" />
          <line x1="60" y1="200" x2="340" y2="200" />
          <line x1="60" y1="280" x2="340" y2="280" />
          <line x1="60" y1="320" x2="340" y2="320" />
        </g>

        {/* Fee curve pulse line - the signature element */}
        <g filter="url(#hs-glow)">
          <polyline
            points="105,245 140,245 160,245 175,243 185,238 192,225 200,190 208,220 216,238 225,243 240,245 270,245 300,245"
            stroke="url(#hs-pulse)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className={mounted ? "hs-pulse-draw" : ""}
          />
        </g>

        {/* Spike peak dot with glow */}
        <g className={mounted ? "hs-dot-appear" : ""} style={{ opacity: 0 }}>
          <circle cx="200" cy="190" r="16" fill="#34d399" opacity="0.08" filter="url(#hs-glow-strong)" />
          <circle cx="200" cy="190" r="4" fill="#34d399" opacity="0.9" className="hs-dot-pulse" />
          <circle cx="200" cy="190" r="8" fill="none" stroke="#34d399" strokeWidth="0.5" opacity="0.3" className="hs-ring-expand" />
        </g>

        {/* Corner accent marks */}
        <g opacity="0.25" stroke="#34d399" strokeWidth="1" strokeLinecap="round">
          {/* Top */}
          <line x1="190" y1="72" x2="210" y2="72" className="hs-accent-fade" />
          {/* Left shoulder */}
          <line x1="78" y1="145" x2="78" y2="160" className="hs-accent-fade" />
          {/* Right shoulder */}
          <line x1="322" y1="145" x2="322" y2="160" className="hs-accent-fade" />
        </g>

      </svg>

      <style jsx>{`
        .hero-shield-wrap {
          width: 100%;
          max-width: 380px;
          aspect-ratio: 400 / 480;
          position: relative;
        }

        .hero-shield-svg {
          width: 100%;
          height: 100%;
        }

        /* Breathing ambient glow */
        .hs-breathe {
          animation: hs-breathe 4s ease-in-out infinite;
        }

        @keyframes hs-breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Shield outline draw-in */
        .hs-draw {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: hs-draw-in 2s ease-out 0.2s forwards;
        }

        .hs-draw-delayed {
          stroke-dasharray: 1100;
          stroke-dashoffset: 1100;
          animation: hs-draw-in-inner 1.8s ease-out 0.8s forwards;
        }

        @keyframes hs-draw-in {
          to { stroke-dashoffset: 0; }
        }

        @keyframes hs-draw-in-inner {
          to { stroke-dashoffset: 0; }
        }

        /* Pulse line draw-in */
        .hs-pulse-draw {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: hs-pulse-in 1.2s ease-out 1.5s forwards;
        }

        @keyframes hs-pulse-in {
          to { stroke-dashoffset: 0; }
        }

        /* Peak dot appear */
        .hs-dot-appear {
          animation: hs-fade-in 0.5s ease-out 2.5s forwards;
        }

        @keyframes hs-fade-in {
          to { opacity: 1; }
        }

        /* Dot pulse */
        .hs-dot-pulse {
          animation: hs-dot-glow 2s ease-in-out infinite 2.5s;
        }

        @keyframes hs-dot-glow {
          0%, 100% { opacity: 0.9; r: 4; }
          50% { opacity: 0.5; r: 3; }
        }

        /* Expanding ring */
        .hs-ring-expand {
          animation: hs-ring 3s ease-out infinite 2.5s;
        }

        @keyframes hs-ring {
          0% { r: 8; opacity: 0.3; }
          100% { r: 24; opacity: 0; }
        }

        /* Scan line sweep */
        .hs-scan-line {
          animation: hs-scan-sweep 4s ease-in-out infinite 1s;
        }

        @keyframes hs-scan-sweep {
          0% { transform: translateY(40px); }
          100% { transform: translateY(420px); }
        }

        /* Accent fade in */
        .hs-accent-fade {
          animation: hs-accent-in 1s ease-out 1.8s both;
          opacity: 0;
        }

        @keyframes hs-accent-in {
          to { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
