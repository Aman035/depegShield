"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useReadContract, useAccount } from "wagmi";
import { type Address } from "viem";
import { FeeCurveChart } from "@/components/FeeCurveChart";
import { PoolHealthGauge } from "@/components/PoolHealthGauge";
import { DEPEG_SHIELD_ABI, DYNAMIC_FEE_FLAG, DEFAULT_TICK_SPACING } from "@/config/contracts";
import { supportedChains, chainNames } from "@/config/chains";
import { calculateFee, toBps, getZone } from "@/lib/feeCurve";

interface PoolConfig {
  hookAddress: Address;
  currency0: Address;
  currency1: Address;
  chainId: number;
}

export default function ExplorePage() {
  const { isConnected } = useAccount();
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

  useEffect(() => {
    if (!isQuerying || !hasValidAddresses) return;
    const interval = setInterval(() => { refetchRatio(); refetchReserves(); }, 12000);
    return () => clearInterval(interval);
  }, [isQuerying, hasValidAddresses, refetchRatio, refetchReserves]);

  const currentFeeBps = ratio ? toBps(calculateFee(ratio)) : null;
  const zone = ratio ? getZone(ratio) : null;
  const zoneColor = zone === "safe" ? "var(--green)" : zone === "warning" ? "var(--amber)" : "var(--red)";

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-dim)]">Explorer</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">Pool Health Monitor</h1>
          </div>
          <ConnectButton />
        </div>

        {/* Input */}
        <div className="border border-[var(--border)] rounded-lg p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <InputField label="Hook Address" placeholder="0x..." value={poolConfig.hookAddress}
              onChange={(v) => { setPoolConfig((p) => ({ ...p, hookAddress: v as Address })); setIsQuerying(false); }} />
            <div>
              <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Chain</label>
              <select
                value={poolConfig.chainId}
                onChange={(e) => { setPoolConfig((p) => ({ ...p, chainId: Number(e.target.value) })); setIsQuerying(false); }}
                className="w-full h-9 px-3 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-sm font-mono focus:outline-none focus:border-[var(--border-hover)] transition-colors"
              >
                {supportedChains.map((c) => (
                  <option key={c.id} value={c.id}>{chainNames[c.id]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <InputField label="Currency 0" placeholder="0x..." value={poolConfig.currency0}
              onChange={(v) => { setPoolConfig((p) => ({ ...p, currency0: v as Address })); setIsQuerying(false); }} />
            <InputField label="Currency 1" placeholder="0x..." value={poolConfig.currency1}
              onChange={(v) => { setPoolConfig((p) => ({ ...p, currency1: v as Address })); setIsQuerying(false); }} />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => hasValidAddresses && setIsQuerying(true)}
              disabled={!hasValidAddresses || !isConnected}
              className="h-9 px-5 rounded-md bg-[var(--text)] text-[var(--bg)] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
            >
              {isLoading ? "Loading..." : "Query Pool"}
            </button>

            {!isConnected && <p className="text-[13px] text-[var(--text-dim)]">Connect wallet to query</p>}
            {ratioError && isQuerying && <p className="text-[13px] text-[var(--red)]">Failed to read. Check addresses and chain.</p>}

            {isQuerying && hasData && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse-dot" />
                <span className="text-[11px] font-mono text-[var(--text-dim)]">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Data */}
        {hasData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <PoolHealthGauge ratio={ratio} reserve0={reserve0} reserve1={reserve1} />

              <div className="border border-[var(--border)] rounded-lg p-5">
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Worsening Fee</p>
                <p className="text-3xl font-mono font-semibold mt-2" style={{ color: zoneColor }}>
                  {currentFeeBps?.toFixed(1)} <span className="text-sm text-[var(--text-dim)]">bps</span>
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-2">
                  Fee for swaps that increase the pool imbalance
                </p>
              </div>

              <div className="border border-[var(--border)] rounded-lg p-5 flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Rebalancing Fee</p>
                  <p className="text-3xl font-mono font-semibold text-[var(--green)] mt-2">
                    {ratio > 12200 ? "0" : "1.0"} <span className="text-sm text-[var(--text-dim)]">bps</span>
                  </p>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-2">
                    {ratio > 12200 ? "Free -- incentivizing recovery" : "Safe zone, standard rate"}
                  </p>
                </div>
                <a
                  href="https://app.uniswap.org/swap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-9 mt-4 rounded-md border border-[var(--border)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors"
                >
                  Swap on Uniswap
                </a>
              </div>
            </div>

            <div className="border border-[var(--border)] rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium">Fee Curve</p>
                  <p className="text-[13px] text-[var(--text-dim)]">White marker = current position</p>
                </div>
                <p className="font-mono text-sm">{currentFeeBps?.toFixed(1)} bps</p>
              </div>
              <FeeCurveChart currentRatio={ratio} height={340} />
            </div>
          </div>
        )}

        {!hasData && !isLoading && (
          <div className="border border-[var(--border)] rounded-lg py-20 text-center">
            <p className="text-[var(--text-secondary)]">Enter pool details above to view health data</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-sm font-mono placeholder:text-[var(--text-dim)]/40 focus:outline-none focus:border-[var(--border-hover)] transition-colors"
      />
    </div>
  );
}
