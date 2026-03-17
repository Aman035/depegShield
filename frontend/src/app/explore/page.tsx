"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { CustomConnectButton } from "@/components/CustomConnectButton";
import { useReadContract, useAccount } from "wagmi";
import { type Address } from "viem";
import { FeeCurveChart } from "@/components/FeeCurveChart";
import { PoolHealthGauge } from "@/components/PoolHealthGauge";
import { SwapPanel } from "@/components/SwapPanel";
import { Faucet } from "@/components/Faucet";
import { SwapEvents } from "@/components/SwapEvents";
import { PoolLiquidity } from "@/components/PoolLiquidity";
import { CrossChainAlert } from "@/components/CrossChainAlert";
import { DEPEG_SHIELD_ABI, DYNAMIC_FEE_FLAG, DEFAULT_TICK_SPACING, HOOK_ADDRESSES, TOKEN_ADDRESSES, CHAIN_NAMES } from "@/config/contracts";
import { supportedChains } from "@/config/chains";
import { calculateFee, toBps, getZone, getZoneColor, getZoneLabel, ratioToMultiplier, ZONE1_UPPER } from "@/lib/feeCurve";
import { EXTSLOAD_ABI, POOL_MANAGER_ADDRESSES, computePoolId, getSlot0Key, getLiquidityKey, parseSlot0, parseLiquidity } from "@/lib/poolState";

const StarsBackground = dynamic(
  () => import("@/components/StarsBackground").then((m) => m.StarsBackground),
  { ssr: false }
);

const DEFAULT_CHAIN_ID = supportedChains[0].id;

export default function ExplorePage() {
  const { isConnected, chain } = useAccount();
  const [currency0, setCurrency0] = useState<Address>("" as Address);
  const [currency1, setCurrency1] = useState<Address>("" as Address);
  const [isQuerying, setIsQuerying] = useState(false);

  // Use connected chain if it's a supported chain with a hook, otherwise default
  const CHAIN_ID = chain?.id && HOOK_ADDRESSES[chain.id] ? chain.id : DEFAULT_CHAIN_ID;

  // Reset query state when chain changes so the previous chain's pool doesn't persist
  const [prevChainId, setPrevChainId] = useState(CHAIN_ID);
  useEffect(() => {
    if (CHAIN_ID !== prevChainId) {
      setPrevChainId(CHAIN_ID);
      setIsQuerying(false);
    }
  }, [CHAIN_ID, prevChainId]);

  const hookAddress = HOOK_ADDRESSES[CHAIN_ID];

  // --- Input validation ---
  const isValidAddress = (addr: string) =>
    /^0x[0-9a-fA-F]{40}$/.test(addr);

  const addr0Valid = isValidAddress(currency0);
  const addr1Valid = isValidAddress(currency1);
  const hasValidAddresses = addr0Valid && addr1Valid;
  const isSameToken = hasValidAddresses && currency0.toLowerCase() === currency1.toLowerCase();
  const isWrongOrder = hasValidAddresses && !isSameToken && currency0.toLowerCase() > currency1.toLowerCase();

  // Auto-sort if wrong order, lowercase to avoid checksum errors
  const sortedCurrency0 = (isWrongOrder ? currency1 : currency0).toLowerCase() as Address;
  const sortedCurrency1 = (isWrongOrder ? currency0 : currency1).toLowerCase() as Address;

  const sortedPoolKey = {
    currency0: sortedCurrency0,
    currency1: sortedCurrency1,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: DEFAULT_TICK_SPACING,
    hooks: hookAddress,
  };

  const canQuery = isQuerying && hasValidAddresses && !isSameToken;

  // --- Validation error message ---
  const validationError = (() => {
    if (isQuerying && currency0 && !addr0Valid) return "Token 0 is not a valid address";
    if (isQuerying && currency1 && !addr1Valid) return "Token 1 is not a valid address";
    if (isQuerying && isSameToken) return "Token addresses must be different";
    return null;
  })();

  // Hook reads: imbalance ratio + virtual reserves (DepegShield-specific)
  const {
    data: ratioData,
    isLoading: ratioLoading,
    isError: ratioError,
    refetch: refetchRatio,
  } = useReadContract({
    address: hookAddress,
    abi: DEPEG_SHIELD_ABI,
    functionName: "getImbalanceRatio",
    args: [sortedPoolKey],
    chainId: CHAIN_ID,
    query: { enabled: canQuery },
  });

  const {
    data: reservesData,
    isLoading: reservesLoading,
    refetch: refetchReserves,
  } = useReadContract({
    address: hookAddress,
    abi: DEPEG_SHIELD_ABI,
    functionName: "getVirtualReserves",
    args: [sortedPoolKey],
    chainId: CHAIN_ID,
    query: { enabled: canQuery },
  });

  // Direct PoolManager reads via extsload: liquidity, sqrtPriceX96, tick
  const poolManagerAddress = POOL_MANAGER_ADDRESSES[CHAIN_ID];
  const poolId = (() => {
    if (!canQuery) return undefined;
    try {
      return computePoolId(sortedCurrency0, sortedCurrency1, DYNAMIC_FEE_FLAG, DEFAULT_TICK_SPACING, hookAddress);
    } catch {
      return undefined;
    }
  })();

  const {
    data: slot0Raw,
    refetch: refetchSlot0,
  } = useReadContract({
    address: poolManagerAddress,
    abi: EXTSLOAD_ABI,
    functionName: "extsload",
    args: poolId ? [getSlot0Key(poolId)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: canQuery && !!poolId },
  });

  const {
    data: liquidityRaw,
    refetch: refetchLiquidity,
  } = useReadContract({
    address: poolManagerAddress,
    abi: EXTSLOAD_ABI,
    functionName: "extsload",
    args: poolId ? [getLiquidityKey(poolId)] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: canQuery && !!poolId },
  });

  // --- Derived state with safety ---
  const rawRatio = ratioData ? Number(ratioData) : null;
  // Clamp extreme ratios (e.g. uint256.max from zero-reserve pools)
  const ratio = rawRatio !== null && isFinite(rawRatio) && rawRatio > 0 && rawRatio < 1e15 ? rawRatio : null;
  const reserve0 = reservesData ? reservesData[0].toString() : null;
  const reserve1 = reservesData ? reservesData[1].toString() : null;
  const slot0 = slot0Raw ? parseSlot0(slot0Raw) : null;
  const liquidity = liquidityRaw ? parseLiquidity(liquidityRaw).toString() : null;
  const sqrtPriceX96 = slot0 ? slot0.sqrtPriceX96.toString() : null;
  const tick = slot0 ? slot0.tick : null;
  const isLoading = ratioLoading || reservesLoading;
  // sqrtPriceX96 === 0 means the pool was never initialized (doesn't exist)
  const poolInitialized = slot0 !== null && slot0.sqrtPriceX96 > BigInt(0);
  // Pool must be initialized and have non-zero reserves to show data
  const hasReserves = reserve0 !== null && reserve1 !== null && (reserve0 !== "0" || reserve1 !== "0");
  const hasData = ratio !== null && hasReserves && !ratioError && poolInitialized;
  // Queries returned: distinguish "doesn't exist" vs "exists but empty"
  const queriesDone = canQuery && ratioData !== undefined && slot0Raw !== undefined;
  const poolNotFound = queriesDone && !poolInitialized;
  const poolEmpty = queriesDone && poolInitialized && !hasData;

  const refetchAll = () => { refetchRatio(); refetchReserves(); refetchSlot0(); refetchLiquidity(); };

  useEffect(() => {
    if (!canQuery) return;
    const interval = setInterval(refetchAll, 5000);
    return () => clearInterval(interval);
  }, [canQuery]);

  // Check if queried pool is the demo mUSDC/mUSDT pool
  const isDemoPool = hasData &&
    [sortedCurrency0, sortedCurrency1].map(a => a.toLowerCase()).sort().join(",") ===
    [TOKEN_ADDRESSES.mUSDC, TOKEN_ADDRESSES.mUSDT].map(a => a.toLowerCase()).sort().join(",");

  const currentFeeBps = ratio ? toBps(calculateFee(ratio)) : null;
  const zone = ratio ? getZone(ratio) : null;
  const zoneColor = zone ? getZoneColor(zone) : "var(--green)";

  return (
    <div className="min-h-screen pt-14 relative">
      <StarsBackground />

      <div className="mx-auto max-w-5xl px-6 py-12 relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="font-mono text-[13px] uppercase tracking-widest text-[var(--green)]">Explorer</p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.03em] mt-1">Pool Health Monitor</h1>
            <p className="text-[16px] text-[var(--text-secondary)] mt-2 leading-relaxed">
              Query any DepegShield pool to view live imbalance ratio, fee state, and health zone.
            </p>
          </div>
          <CustomConnectButton />
        </div>

        {/* Pool Configuration */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden mb-8">
          <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="var(--green)" strokeWidth="1.2" strokeLinejoin="round" fill="none" strokeOpacity="0.6" />
                <circle cx="8" cy="8" r="2" fill="var(--green)" fillOpacity="0.4" />
              </svg>
              <span className="font-mono text-[13px] uppercase tracking-wider text-[var(--text-secondary)]">Pool Configuration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--green)]/10 border border-[var(--green)]/20 text-[12px] font-mono text-[var(--green)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                {CHAIN_NAMES[CHAIN_ID] ?? "Testnet"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[12px] font-mono text-[var(--text-dim)]">
                Mainnet (Coming Soon)
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <InputField label="Token 0" placeholder="0x..." value={currency0}
                onChange={(v) => { setCurrency0(v as Address); setIsQuerying(false); }}
                error={currency0.length > 0 && !addr0Valid ? "Invalid address" : undefined} />
              <InputField label="Token 1" placeholder="0x..." value={currency1}
                onChange={(v) => { setCurrency1(v as Address); setIsQuerying(false); }}
                error={currency1.length > 0 && !addr1Valid ? "Invalid address" : undefined} />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => hasValidAddresses && !isSameToken && setIsQuerying(true)}
                disabled={!hasValidAddresses || isSameToken || !isConnected}
                className="h-11 px-7 rounded-lg bg-[var(--green)] text-[var(--bg)] text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" /></svg>
                    Querying...
                  </span>
                ) : "Query Pool"}
              </button>

              {!isConnected && (
                <p className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                  Connect wallet to query
                </p>
              )}
              {validationError && (
                <p className="text-[13px] text-[var(--red)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
                  {validationError}
                </p>
              )}
              {isWrongOrder && hasValidAddresses && !isSameToken && (
                <p className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                  Tokens auto-sorted (currency0 &lt; currency1)
                </p>
              )}

              {isQuerying && hasData && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse-dot" />
                  <span className="text-[12px] font-mono text-[var(--text-secondary)]">Live / refreshing every 5s</span>
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
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${zoneColor} 15%, transparent)` }}>
                    <svg width="12" height="12" viewBox="0 0 10 10"><path d="M5 2L8 7H2L5 2Z" fill={zoneColor} /></svg>
                  </span>
                  <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Worsening Fee</p>
                </div>
                <p className="text-5xl font-mono font-semibold tracking-tight" style={{ color: zoneColor }}>
                  {currentFeeBps?.toFixed(1)}
                  <span className="text-base font-normal text-[var(--text-secondary)] ml-1.5">bps</span>
                </p>
                <p className="text-[14px] text-[var(--text-secondary)] mt-4 leading-relaxed flex-1">
                  Current fee for swaps that increase pool imbalance
                </p>
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between text-[13px] font-mono">
                    <span className="text-[var(--text-secondary)]">Zone</span>
                    <span className="font-medium" style={{ color: zoneColor }}>{zone ? getZoneLabel(zone) : ""}</span>
                  </div>
                </div>
              </div>

              {/* Rebalancing Fee */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--green)]/10">
                    <svg width="12" height="12" viewBox="0 0 10 10"><path d="M5 8L2 3H8L5 8Z" fill="var(--green)" /></svg>
                  </span>
                  <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Rebalancing Fee</p>
                </div>
                <p className="text-5xl font-mono font-semibold tracking-tight text-[var(--green)]">
                  {ratio > ZONE1_UPPER ? "0" : "1.0"}
                  <span className="text-base font-normal text-[var(--text-secondary)] ml-1.5">bps</span>
                </p>
                <p className="text-[14px] text-[var(--text-secondary)] mt-4 leading-relaxed flex-1">
                  {ratio > ZONE1_UPPER ? "Zero fee to incentivize recovery swaps" : "Stable zone, standard flat rate"}
                </p>
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between text-[13px] font-mono">
                    <span className="text-[var(--text-secondary)]">Incentive</span>
                    <span className="font-medium text-[var(--green)]">{ratio > ZONE1_UPPER ? "FREE SWAP" : "FLAT RATE"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pool Liquidity */}
            {liquidity && sqrtPriceX96 && tick !== null && (
              <PoolLiquidity
                liquidity={liquidity}
                sqrtPriceX96={sqrtPriceX96}
                tick={tick}
                reserve0={reserve0!}
                reserve1={reserve1!}
                ratio={ratio}
              />
            )}

            {/* Fee Curve */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <polyline points="1,12 5,8 9,10 15,3" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.6" />
                  </svg>
                  <span className="font-mono text-[13px] uppercase tracking-wider text-[var(--text-secondary)]">Fee Curve</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[13px]">
                  <span className="text-[var(--text-secondary)]">Current position</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span className="font-medium" style={{ color: zoneColor }}>{ratioToMultiplier(ratio)} / {currentFeeBps?.toFixed(1)} bps</span>
                  </span>
                </div>
              </div>
              <div className="p-5">
                <FeeCurveChart currentRatio={ratio} height={340} />
              </div>
            </div>

            {/* Cross-Chain Shield */}
            <CrossChainAlert chainId={CHAIN_ID} currency0={sortedCurrency0} currency1={sortedCurrency1} />

            {/* Swap + Faucet */}
            {sqrtPriceX96 && liquidity && reservesData && (
              <div className={`grid grid-cols-1 ${isDemoPool ? "lg:grid-cols-2" : ""} gap-4`}>
                <SwapPanel
                  chainId={CHAIN_ID}
                  ratio={ratio}
                  currency0={sortedCurrency0}
                  currency1={sortedCurrency1}
                  reserve0={reservesData[0]}
                  reserve1={reservesData[1]}
                  sqrtPriceX96={sqrtPriceX96}
                  liquidity={liquidity}
                  onSwapComplete={refetchAll}
                />
                {isDemoPool && (
                  <Faucet
                    chainId={CHAIN_ID}
                    onMinted={refetchAll}
                  />
                )}
              </div>
            )}

            {/* Live Events */}
            <SwapEvents chainId={CHAIN_ID} />
          </div>
        )}

        {/* Pool not found -- never initialized */}
        {poolNotFound && (
          <div className="rounded-xl border border-[var(--red)]/30 border-dashed bg-[var(--red)]/5 py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--bg-raised)] border border-[var(--red)]/30 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="var(--red)" strokeWidth="1.2" />
                <path d="M6 6l4 4M10 6l-4 4" stroke="var(--red)" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[var(--text)] text-[16px] font-medium">Pool does not exist</p>
            <p className="text-[var(--text-secondary)] text-[14px] mt-1.5">No DepegShield pool has been initialized for this token pair.</p>
          </div>
        )}

        {/* Pool exists but has no liquidity */}
        {poolEmpty && (
          <div className="rounded-xl border border-[var(--amber)]/30 border-dashed bg-[var(--amber)]/5 py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--bg-raised)] border border-[var(--amber)]/30 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="var(--amber)" strokeWidth="1.2" />
                <path d="M8 5v3.5M8 10.5v.5" stroke="var(--amber)" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[var(--text)] text-[16px] font-medium">Pool has no liquidity</p>
            <p className="text-[var(--text-secondary)] text-[14px] mt-1.5">This pool exists but has zero liquidity. Add liquidity to see pool data.</p>
          </div>
        )}

        {/* Empty state -- no query yet */}
        {!hasData && !isLoading && !poolEmpty && !poolNotFound && (
          <div className="rounded-xl border border-[var(--border)] border-dashed bg-[var(--bg-raised)]/20 py-20 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 120 120" fill="none">
                <path d="M60 10 L100 30 L100 60 C100 85 75 105 60 112 C45 105 20 85 20 60 L20 30 Z" stroke="var(--text-dim)" strokeWidth="3" strokeLinejoin="round" fill="none" strokeOpacity="0.3" />
                <polyline points="30,62 45,62 52,58 60,40 68,55 75,62 90,62" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.3" />
              </svg>
            </div>
            <p className="text-[var(--text)] text-[16px] font-medium">No pool loaded</p>
            <p className="text-[var(--text-secondary)] text-[14px] mt-1.5 mb-6">Try our deployed mUSDC/mUSDT pool or enter your own token addresses</p>
            <button
              onClick={() => {
                const sorted0 = TOKEN_ADDRESSES.mUSDT < TOKEN_ADDRESSES.mUSDC ? TOKEN_ADDRESSES.mUSDT : TOKEN_ADDRESSES.mUSDC;
                const sorted1 = TOKEN_ADDRESSES.mUSDT < TOKEN_ADDRESSES.mUSDC ? TOKEN_ADDRESSES.mUSDC : TOKEN_ADDRESSES.mUSDT;
                setCurrency0(sorted0);
                setCurrency1(sorted1);
              }}
              className="h-11 px-6 rounded-lg border border-[var(--green)]/30 bg-[var(--green)]/10 text-[14px] font-medium text-[var(--green)] hover:bg-[var(--green)]/15 transition-colors"
            >
              Load Demo Pool (mUSDC / mUSDT)
            </button>
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

function InputField({ label, placeholder, value, onChange, error }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
        {error && <span className="text-[12px] font-mono text-[var(--red)]">{error}</span>}
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-12 px-4 rounded-lg bg-[var(--bg)] border text-[14px] font-mono placeholder:text-[var(--text-dim)]/30 focus:outline-none transition-all ${
          error
            ? "border-[var(--red)]/50 focus:border-[var(--red)]/60 focus:ring-1 focus:ring-[var(--red)]/10"
            : "border-[var(--border)] focus:border-[var(--green)]/40 focus:ring-1 focus:ring-[var(--green)]/10"
        }`}
      />
    </div>
  );
}
