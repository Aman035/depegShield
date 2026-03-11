"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { CustomConnectButton } from "@/components/CustomConnectButton";
import { useReadContract, useAccount } from "wagmi";
import { type Address } from "viem";
import { FeeCurveChart } from "@/components/FeeCurveChart";
import { PoolHealthGauge } from "@/components/PoolHealthGauge";
import { DEPEG_SHIELD_ABI, DYNAMIC_FEE_FLAG, DEFAULT_TICK_SPACING, HOOK_ADDRESSES } from "@/config/contracts";
import { supportedChains } from "@/config/chains";
import { calculateFee, toBps, getZone, ratioToMultiplier } from "@/lib/feeCurve";

const StarsBackground = dynamic(
  () => import("@/components/StarsBackground").then((m) => m.StarsBackground),
  { ssr: false }
);

const CHAIN_ID = supportedChains[0].id;

export default function ExplorePage() {
  const { isConnected } = useAccount();
  const [currency0, setCurrency0] = useState<Address>("" as Address);
  const [currency1, setCurrency1] = useState<Address>("" as Address);
  const [isQuerying, setIsQuerying] = useState(false);

  const hookAddress = HOOK_ADDRESSES[CHAIN_ID];

  const poolKey = {
    currency0,
    currency1,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: DEFAULT_TICK_SPACING,
    hooks: hookAddress,
  };

  const hasValidAddresses =
    currency0.length === 42 &&
    currency1.length === 42;

  const {
    data: ratioData,
    isLoading: ratioLoading,
    isError: ratioError,
    refetch: refetchRatio,
  } = useReadContract({
    address: hookAddress,
    abi: DEPEG_SHIELD_ABI,
    functionName: "getImbalanceRatio",
    args: [poolKey],
    chainId: CHAIN_ID,
    query: { enabled: isQuerying && hasValidAddresses },
  });

  const {
    data: reservesData,
    isLoading: reservesLoading,
    refetch: refetchReserves,
  } = useReadContract({
    address: hookAddress,
    abi: DEPEG_SHIELD_ABI,
    functionName: "getVirtualReserves",
    args: [poolKey],
    chainId: CHAIN_ID,
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
    <div className="min-h-screen pt-14 relative">
      <StarsBackground />

      <div className="mx-auto max-w-5xl px-6 py-12 relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-widest text-[var(--green)]">Explorer</p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-1">Pool Health Monitor</h1>
            <p className="text-[15px] text-[var(--text-secondary)] mt-2">
              Query any DepegShield pool to view live imbalance ratio, fee state, and health zone.
            </p>
          </div>
          <CustomConnectButton />
        </div>

        {/* Pool Configuration */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="var(--green)" strokeWidth="1.2" strokeLinejoin="round" fill="none" strokeOpacity="0.6" />
                <circle cx="8" cy="8" r="2" fill="var(--green)" fillOpacity="0.4" />
              </svg>
              <span className="font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)]">Pool Configuration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--green)]/10 border border-[var(--green)]/20 text-[11px] font-mono text-[var(--green)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                Testnet
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-dim)]">
                Mainnet (Coming Soon)
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <InputField label="Token 0" placeholder="0x..." value={currency0}
                onChange={(v) => { setCurrency0(v as Address); setIsQuerying(false); }} />
              <InputField label="Token 1" placeholder="0x..." value={currency1}
                onChange={(v) => { setCurrency1(v as Address); setIsQuerying(false); }} />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => hasValidAddresses && setIsQuerying(true)}
                disabled={!hasValidAddresses || !isConnected}
                className="h-10 px-6 rounded-lg bg-[var(--green)] text-[var(--bg)] text-[13px] font-semibold hover:brightness-110 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" /></svg>
                    Querying...
                  </span>
                ) : "Query Pool"}
              </button>

              {!isConnected && (
                <p className="text-[13px] text-[var(--text-dim)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                  Connect wallet to query
                </p>
              )}
              {ratioError && isQuerying && (
                <p className="text-[13px] text-[var(--red)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
                  Failed to read. Check token addresses and chain.
                </p>
              )}

              {isQuerying && hasData && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse-dot" />
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">Live / refreshing every 12s</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pool Data */}
        {hasData && (
          <div className="space-y-6 animate-in">
            {/* Top row: Health + Fees */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <PoolHealthGauge ratio={ratio} reserve0={reserve0} reserve1={reserve1} />

              {/* Worsening Fee */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${zoneColor} 15%, transparent)` }}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 2L8 7H2L5 2Z" fill={zoneColor} /></svg>
                  </span>
                  <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Worsening Fee</p>
                </div>
                <p className="text-4xl font-mono font-semibold tracking-tight" style={{ color: zoneColor }}>
                  {currentFeeBps?.toFixed(1)}
                  <span className="text-sm font-normal text-[var(--text-dim)] ml-1">bps</span>
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-3 leading-relaxed flex-1">
                  Current fee for swaps that increase pool imbalance
                </p>
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between text-[12px] font-mono">
                    <span className="text-[var(--text-dim)]">Zone</span>
                    <span style={{ color: zoneColor }}>{zone === "safe" ? "SAFE" : zone === "warning" ? "WARNING" : "CIRCUIT BREAKER"}</span>
                  </div>
                </div>
              </div>

              {/* Rebalancing Fee */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center bg-[var(--green)]/10">
                    <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 8L2 3H8L5 8Z" fill="var(--green)" /></svg>
                  </span>
                  <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Rebalancing Fee</p>
                </div>
                <p className="text-4xl font-mono font-semibold tracking-tight text-[var(--green)]">
                  {ratio > 12200 ? "0" : "1.0"}
                  <span className="text-sm font-normal text-[var(--text-dim)] ml-1">bps</span>
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-3 leading-relaxed flex-1">
                  {ratio > 12200 ? "Zero fee to incentivize recovery swaps" : "Safe zone, standard flat rate"}
                </p>
                <a
                  href="https://app.uniswap.org/swap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-10 mt-3 rounded-lg bg-[var(--green)]/10 border border-[var(--green)]/20 text-[13px] font-medium text-[var(--green)] hover:bg-[var(--green)]/15 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Swap on Uniswap
                </a>
              </div>
            </div>

            {/* Fee Curve */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <polyline points="1,12 5,8 9,10 15,3" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.6" />
                  </svg>
                  <span className="font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)]">Fee Curve</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[12px]">
                  <span className="text-[var(--text-dim)]">Current position</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span style={{ color: zoneColor }}>{ratioToMultiplier(ratio)} / {currentFeeBps?.toFixed(1)} bps</span>
                  </span>
                </div>
              </div>
              <div className="p-4">
                <FeeCurveChart currentRatio={ratio} height={300} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasData && !isLoading && (
          <div className="rounded-xl border border-[var(--border)] border-dashed bg-[var(--bg-raised)]/20 py-24 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 120 120" fill="none">
                <path d="M60 10 L100 30 L100 60 C100 85 75 105 60 112 C45 105 20 85 20 60 L20 30 Z" stroke="var(--text-dim)" strokeWidth="3" strokeLinejoin="round" fill="none" strokeOpacity="0.3" />
                <polyline points="30,62 45,62 52,58 60,40 68,55 75,62 90,62" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.3" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] text-[15px]">Enter token addresses above to view pool health</p>
            <p className="text-[var(--text-dim)] text-[13px] mt-1">Connect your wallet and provide the token pair addresses</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .animate-in {
          animation: fadeSlideIn 0.4s ease-out;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function InputField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-2">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm font-mono placeholder:text-[var(--text-dim)]/30 focus:outline-none focus:border-[var(--green)]/40 focus:ring-1 focus:ring-[var(--green)]/10 transition-all"
      />
    </div>
  );
}
