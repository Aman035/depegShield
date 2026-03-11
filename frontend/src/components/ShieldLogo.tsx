"use client";

/**
 * Custom DepegShield emblem.
 * A shield outline with a fee-curve pulse line running through it,
 * representing protection against depeg volatility.
 */
export function ShieldLogo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer glow */}
      <defs>
        <linearGradient id="shieldGrad" x1="60" y1="10" x2="60" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pulseGrad" x1="20" y1="60" x2="100" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--green)" stopOpacity="0.2" />
          <stop offset="30%" stopColor="var(--green)" stopOpacity="1" />
          <stop offset="70%" stopColor="var(--green)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--green)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Shield body fill */}
      <path
        d="M60 10 L100 30 L100 60 C100 85 75 105 60 112 C45 105 20 85 20 60 L20 30 Z"
        fill="url(#shieldGrad)"
      />

      {/* Shield outline */}
      <path
        d="M60 10 L100 30 L100 60 C100 85 75 105 60 112 C45 105 20 85 20 60 L20 30 Z"
        stroke="var(--green)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* Inner shield line */}
      <path
        d="M60 20 L90 36 L90 60 C90 80 70 96 60 102 C50 96 30 80 30 60 L30 36 Z"
        stroke="var(--green)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeOpacity="0.15"
        fill="none"
      />

      {/* Fee curve pulse line -- flat, ramp up, spike, recover */}
      <polyline
        points="25,62 40,62 48,62 55,58 60,40 65,55 70,62 78,62 95,62"
        stroke="url(#pulseGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Pulse dot at the spike peak */}
      <circle cx="60" cy="40" r="3" fill="var(--green)" opacity="0.8" />
      <circle cx="60" cy="40" r="6" fill="var(--green)" opacity="0.15" />
    </svg>
  );
}
