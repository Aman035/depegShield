"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useReadContract, useAccount } from "wagmi";
import { type Address } from "viem";
import { FeeCurveChart } from "@/components/FeeCurveChart";
import { PoolHealthGauge } from "@/components/PoolHealthGauge";
import { DEPEG_SHIELD_ABI, DYNAMIC_FEE_FLAG, DEFAULT_TICK_SPACING } from "@/config/contracts";
import { supportedChains, chainNames } from "@/config/chains";
import { calculateFee, toBps, getZone, ZONE_COLORS, ZONE_LABELS } from "@/lib/feeCurve";

interface PoolConfig {
  hookAddress: Address;
  currency0: Address;
  currency1: Address;
  chainId: number;
}

export default function ExplorePage() {
  const { isConnected, chain } = useAccount();
  const [poolConfig, setPoolConfig] = useState<PoolConfig>({
    hookAddress: "" as Address,
    currency0: "" as Address,
    currency1: "" as Address,
    chainId: supportedChains[0].id,
  });
  const [isQuerying, setIsQuerying] = useState(false);

  const poolKey = {
    currency0: poolConfig.currency0,
    currency1: poolConfig.currency1,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: DEFAULT_TICK_SPACING,
    hooks: poolConfig.hookAddress,
  };

  const hasValidAddresses =
    poolConfig.hookAddress.length === 42 &&
    poolConfig.currency0.length === 42 &&
    poolConfig.currency1.length === 42;

  // Read imbalance ratio
  const {
    data: ratioData,
    isLoading: ratioLoading,
    isError: ratioError,
    refetch: refetchRatio,
  } = useReadContract({
    address: poolConfig.hookAddress,
    abi: DEPEG_SHIELD_ABI,
    functionName: "getImbalanceRatio",
    args: [poolKey],
    chainId: poolConfig.chainId,
    query: { enabled: isQuerying && hasValidAddresses },
  });

  // Read virtual reserves
  const {
    data: reservesData,
    isLoading: reservesLoading,
    refetch: refetchReserves,
  } = useReadContract({
    address: poolConfig.hookAddress,
    abi: DEPEG_SHIELD_ABI,
    functionName: "getVirtualReserves",
    args: [poolKey],
    chainId: poolConfig.chainId,
    query: { enabled: isQuerying && hasValidAddresses },
  });

  const ratio = ratioData ? Number(ratioData) : null;
  const reserve0 = reservesData ? reservesData[0].toString() : null;
  const reserve1 = reservesData ? reservesData[1].toString() : null;
  const isLoading = ratioLoading || reservesLoading;
  const hasData = ratio !== null && reserve0 !== null && reserve1 !== null;

  // Auto-refresh every 12 seconds when querying
  useEffect(() => {
    if (!isQuerying || !hasValidAddresses) return;
    const interval = setInterval(() => {
      refetchRatio();
      refetchReserves();
    }, 12000);
    return () => clearInterval(interval);
  }, [isQuerying, hasValidAddresses, refetchRatio, refetchReserves]);

  const handleQuery = () => {
    if (hasValidAddresses) {
      setIsQuerying(true);
    }
  };

  // Computed fee data
  const currentFee = ratio ? calculateFee(ratio) : null;
  const currentFeeBps = currentFee ? toBps(currentFee) : null;
  const zone = ratio ? getZone(ratio) : null;
  const zoneColors = zone ? ZONE_COLORS[zone] : null;

  return (
    <div className="min-h-screen pt-16">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-10">
          <div>
            <span className="font-display text-xs uppercase tracking-widest text-[var(--accent-green)]">
              Explorer
            </span>
            <h1 className="text-3xl md:text-4xl font-body font-bold text-[var(--text-primary)] mt-1">
              Pool Health Monitor
            </h1>
          </div>
          <ConnectButton />
        </div>

        {/* Pool Input */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <InputField
              label="Hook Address"
              placeholder="0x..."
              value={poolConfig.hookAddress}
              onChange={(v) => {
                setPoolConfig((p) => ({ ...p, hookAddress: v as Address }));
                setIsQuerying(false);
              }}
            />
            <div>
              <label className="block text-xs font-display text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Chain
              </label>
              <select
                value={poolConfig.chainId}
                onChange={(e) => {
                  setPoolConfig((p) => ({ ...p, chainId: Number(e.target.value) }));
                  setIsQuerying(false);
                }}
                className="w-full h-11 px-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-display focus:outline-none focus:border-[var(--accent-green)]/50 transition-colors"
              >
                {supportedChains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {chainNames[c.id]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <InputField
              label="Currency 0 (Token Address)"
              placeholder="0x..."
              value={poolConfig.currency0}
              onChange={(v) => {
                setPoolConfig((p) => ({ ...p, currency0: v as Address }));
                setIsQuerying(false);
              }}
            />
            <InputField
              label="Currency 1 (Token Address)"
              placeholder="0x..."
              value={poolConfig.currency1}
              onChange={(v) => {
                setPoolConfig((p) => ({ ...p, currency1: v as Address }));
                setIsQuerying(false);
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleQuery}
              disabled={!hasValidAddresses || !isConnected}
              className="px-6 py-2.5 rounded-lg bg-[var(--accent-green)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isLoading ? "Loading..." : "Query Pool"}
            </button>

            {!isConnected && (
              <p className="text-sm text-[var(--text-muted)]">
                Connect wallet to query on-chain data
              </p>
            )}

            {ratioError && isQuerying && (
              <p className="text-sm text-[var(--accent-red)]">
                Failed to read pool data. Check addresses and chain.
              </p>
            )}

            {isQuerying && hasData && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] pulse-dot" />
                <span className="text-xs text-[var(--text-muted)] font-display">
                  Live (refreshing every 12s)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pool Data */}
        {hasData && (
          <div className="space-y-8">
            {/* Top row: Gauge + Fee Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gauge */}
              <div className="lg:col-span-1">
                <PoolHealthGauge
                  ratio={ratio}
                  reserve0={reserve0}
                  reserve1={reserve1}
                />
              </div>

              {/* Fee Info Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FeeCard
                  label="Worsening Swap Fee"
                  description="Fee charged when swapping in the direction that increases imbalance"
                  feeBps={currentFeeBps!}
                  color={zoneColors!.text}
                  zone={ZONE_LABELS[zone!]}
                />
                <FeeCard
                  label="Rebalancing Swap Fee"
                  description="Fee charged when swapping to restore balance"
                  feeBps={ratio > 12200 ? 0 : toBps(calculateFee(ratio))}
                  color="var(--accent-green)"
                  zone={ratio > 12200 ? "Free (incentivized)" : "Safe Zone (1bp)"}
                />
                <div className="sm:col-span-2">
                  <a
                    href={`https://app.uniswap.org/swap`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[var(--border-medium)] text-[var(--text-secondary)] font-semibold text-sm hover:text-[var(--text-primary)] hover:border-[var(--accent-green)]/30 hover:bg-[var(--accent-green)]/5 transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                    Swap on Uniswap
                  </a>
                </div>
              </div>
            </div>

            {/* Fee Curve with live position */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Fee Curve
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Blue marker shows current pool position
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--accent-blue)]" />
                  <span className="font-display text-sm text-[var(--accent-blue)]">
                    {currentFeeBps?.toFixed(1)} bps
                  </span>
                </div>
              </div>
              <FeeCurveChart currentRatio={ratio} height={360} />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasData && !isLoading && (
          <div className="glass-card rounded-2xl p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              No pool loaded
            </h3>
            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
              Enter a DepegShield hook address, the two token addresses, and select a chain above. Then click &quot;Query Pool&quot; to see live pool health data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-display text-[var(--text-muted)] uppercase tracking-wider mb-2">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-display placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--accent-green)]/50 transition-colors"
      />
    </div>
  );
}

function FeeCard({
  label,
  description,
  feeBps,
  color,
  zone,
}: {
  label: string;
  description: string;
  feeBps: number;
  color: string;
  zone: string;
}) {
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-xs font-display text-[var(--text-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-display text-3xl font-bold mb-1" style={{ color }}>
        {feeBps.toFixed(1)} <span className="text-base font-normal">bps</span>
      </p>
      <p className="text-xs font-display mb-2" style={{ color, opacity: 0.7 }}>
        {zone}
      </p>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
