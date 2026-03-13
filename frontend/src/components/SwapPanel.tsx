"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits, formatUnits, type Address, maxUint256 } from "viem";
import {
  SWAP_ROUTER_ABI, MOCK_STABLECOIN_ABI,
  DYNAMIC_FEE_FLAG, DEFAULT_TICK_SPACING,
  TOKEN_ADDRESSES, TOKEN_DECIMALS, SWAP_ROUTER_ADDRESSES, HOOK_ADDRESSES,
} from "@/config/contracts";
import { calculateFee, toBps, getZone, getZoneColor, ZONE1_UPPER } from "@/lib/feeCurve";

interface SwapPanelProps {
  chainId: number;
  ratio: number;
  currency0: Address;
  currency1: Address;
  reserve0: bigint;
  reserve1: bigint;
  sqrtPriceX96: string;
  liquidity: string;
  onSwapComplete?: () => void;
}

type TokenKey = "mUSDC" | "mUSDT";

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 3.0];
const Q96 = BigInt(2) ** BigInt(96);

function getTokenName(addr: Address): TokenKey {
  return addr.toLowerCase() === TOKEN_ADDRESSES.mUSDC.toLowerCase() ? "mUSDC" : "mUSDT";
}

/**
 * Estimate output amount for an exactInput swap using constant-product math.
 * For selling token0 (zeroForOne): output1 = L * (sqrtP_old - sqrtP_new) / Q96
 *   where sqrtP_new = sqrtP * L / (L + amountIn * sqrtP / Q96)  (simplified for token0)
 * For selling token1 (!zeroForOne): output0 = L * Q96 * (1/sqrtP_old - 1/sqrtP_new)
 *   where sqrtP_new = sqrtP + amountIn * Q96 / L
 */
function estimateOutput(
  amountIn: bigint,
  zeroForOne: boolean,
  sqrtP: bigint,
  L: bigint,
  feeBps: number,
): { amountOut: bigint; priceImpact: number; newSqrtP: bigint } {
  if (amountIn <= BigInt(0) || L <= BigInt(0) || sqrtP <= BigInt(0)) {
    return { amountOut: BigInt(0), priceImpact: 0, newSqrtP: sqrtP };
  }

  // Deduct fee from input (feeBps is in bps, convert to fraction: feeBps / 10000)
  // Fee in hundredths of a bip internally, but we receive bps here
  const feeNumerator = BigInt(Math.round(feeBps * 100)); // convert bps to hundredths-of-bip
  const amountAfterFee = amountIn - (amountIn * feeNumerator) / BigInt(1_000_000);

  let amountOut: bigint;
  let newSqrtP: bigint;

  if (zeroForOne) {
    // Selling token0: sqrtP decreases
    // sqrtP_new = sqrtP * L * Q96 / (L * Q96 + amountAfterFee * sqrtP)
    const numerator = sqrtP * L;
    const denominator = L + (amountAfterFee * sqrtP) / Q96;
    if (denominator === BigInt(0)) return { amountOut: BigInt(0), priceImpact: 100, newSqrtP: BigInt(0) };
    newSqrtP = numerator / denominator;

    // output1 = L * (sqrtP_old - sqrtP_new) / Q96
    amountOut = (L * (sqrtP - newSqrtP)) / Q96;
  } else {
    // Selling token1: sqrtP increases
    // sqrtP_new = sqrtP + amountAfterFee * Q96 / L
    const delta = (amountAfterFee * Q96) / L;
    newSqrtP = sqrtP + delta;

    // output0 = L * Q96 * (1/sqrtP_old - 1/sqrtP_new) = L * Q96 * (sqrtP_new - sqrtP_old) / (sqrtP_old * sqrtP_new)
    const numerator = L * (newSqrtP - sqrtP);
    const denominator = (sqrtP * newSqrtP) / Q96;
    if (denominator === BigInt(0)) return { amountOut: BigInt(0), priceImpact: 100, newSqrtP };
    amountOut = numerator / denominator;
  }

  // Price impact: how much the effective price deviates from the spot price
  // spot rate = 1.0 for stablecoins, so impact = 1 - (amountOut / amountIn)
  const impactRaw = amountIn > BigInt(0)
    ? (1 - Number(amountOut) / Number(amountIn)) * 100
    : 0;
  const priceImpact = Math.max(0, impactRaw);

  return { amountOut: amountOut > BigInt(0) ? amountOut : BigInt(0), priceImpact, newSqrtP };
}

/**
 * Mirror the hook's blended fee logic for exactInput rebalancing swaps that may overshoot.
 * The frontend only does exactInput swaps, matching the hook's 0-fee rebalancing path.
 */
function computeEffectiveFee(
  ratio: number,
  reserve0: bigint,
  reserve1: bigint,
  zeroForOne: boolean,
  sqrtP: bigint,
  L: bigint,
  swapAmount: bigint,
): number {
  const worsens = reserve0 >= reserve1 ? zeroForOne : !zeroForOne;
  const isImbalanced = ratio > ZONE1_UPPER;

  if (worsens || !isImbalanced) {
    return toBps(calculateFee(ratio));
  }

  // Rebalancing an imbalanced pool -- check for overshoot
  if (swapAmount <= BigInt(0) || L <= BigInt(0)) return 0;

  // Compute equilibrium amount (to reach sqrtP = Q96)
  let eqAmount: bigint;
  if (zeroForOne) {
    if (sqrtP <= Q96) return 0;
    eqAmount = (L * (sqrtP - Q96)) / sqrtP;
  } else {
    if (sqrtP >= Q96) return 0;
    eqAmount = (L * (Q96 - sqrtP)) / Q96;
  }

  if (swapAmount <= eqAmount) {
    return 0; // Pure rebalancing
  }

  // Overshoot: compute blended fee
  const overshoot = swapAmount - eqAmount;
  let newSqrtP: bigint;

  if (zeroForOne) {
    const denom = L + overshoot;
    newSqrtP = denom > BigInt(0) ? (Q96 * L) / denom : BigInt(0);
  } else {
    const delta = (overshoot * Q96) / L;
    newSqrtP = Q96 + delta;
  }

  if (newSqrtP <= BigInt(0)) return toBps(500000); // MAX_FEE

  const newR0 = (L * Q96) / newSqrtP;
  const newR1 = (L * newSqrtP) / Q96;
  const postRatio = newR0 >= newR1
    ? Number((newR0 * BigInt(10000)) / newR1)
    : Number((newR1 * BigInt(10000)) / newR0);

  const overshootFee = calculateFee(postRatio);
  const blendedFee = (toBps(overshootFee) * Number(overshoot)) / Number(swapAmount);
  return blendedFee;
}

export function SwapPanel({ chainId, ratio, currency0, currency1, reserve0, reserve1, sqrtPriceX96, liquidity, onSwapComplete }: SwapPanelProps) {
  const { address } = useAccount();
  const [sellToken, setSellToken] = useState<Address>(currency0);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [showSlippage, setShowSlippage] = useState(false);

  const hookAddress = HOOK_ADDRESSES[chainId];
  const routerAddress = SWAP_ROUTER_ADDRESSES[chainId];
  const buyToken = sellToken === currency0 ? currency1 : currency0;
  const zeroForOne = sellToken === currency0;

  const sellName = getTokenName(sellToken);
  const buyName = getTokenName(buyToken);

  const sqrtP = BigInt(sqrtPriceX96);
  const L = BigInt(liquidity);

  // Check allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: sellToken,
    abi: MOCK_STABLECOIN_ABI,
    functionName: "allowance",
    args: address ? [address, routerAddress] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  // Check balance
  const { data: balance } = useReadContract({
    address: sellToken,
    abi: MOCK_STABLECOIN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  // Separate write hooks for approve and swap
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    reset: resetApprove,
  } = useWriteContract();

  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const {
    writeContract: writeSwap,
    data: swapTxHash,
    isPending: isSwapPending,
    reset: resetSwap,
  } = useWriteContract();

  const {
    isLoading: isSwapConfirming,
    isSuccess: isSwapSuccess,
  } = useWaitForTransactionReceipt({ hash: swapTxHash });

  const parsedAmount = amount ? parseUnits(amount, TOKEN_DECIMALS) : BigInt(0);
  // After approval confirms, allowance refetch is async -- use optimistic override to avoid showing Approve again
  const needsApproval = !isApproveSuccess && allowance !== undefined && parsedAmount > 0 && allowance < parsedAmount;
  const balanceFormatted = balance !== undefined ? formatUnits(balance, TOKEN_DECIMALS) : "0";
  const insufficientBalance = balance !== undefined && parsedAmount > BigInt(0) && parsedAmount > balance;

  // Dynamic fee based on swap amount (mirrors hook's blended fee logic)
  const effectiveFeeBps = useMemo(
    () => computeEffectiveFee(ratio, reserve0, reserve1, zeroForOne, sqrtP, L, parsedAmount),
    [ratio, reserve0, reserve1, zeroForOne, sqrtP, L, parsedAmount],
  );

  const zone = getZone(ratio);
  const feeColor = effectiveFeeBps === 0 ? "var(--green)" : getZoneColor(zone);

  // Output estimation
  const { amountOut, priceImpact } = useMemo(
    () => estimateOutput(parsedAmount, zeroForOne, sqrtP, L, effectiveFeeBps),
    [parsedAmount, zeroForOne, sqrtP, L, effectiveFeeBps],
  );

  const outputFormatted = amountOut > BigInt(0)
    ? Number(formatUnits(amountOut, TOKEN_DECIMALS)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.0";

  const minOutput = amountOut > BigInt(0)
    ? (amountOut * BigInt(Math.round((1 - slippage / 100) * 10000))) / BigInt(10000)
    : BigInt(0);

  const minOutputFormatted = minOutput > BigInt(0)
    ? Number(formatUnits(minOutput, TOKEN_DECIMALS)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.0";

  const impactColor = priceImpact < 0.5 ? "var(--green)" : priceImpact < 2 ? "var(--amber)" : "var(--red)";

  // Rate: how many output tokens per 1 input token
  const rate = parsedAmount > BigInt(0) && amountOut > BigInt(0)
    ? (Number(amountOut) / Number(parsedAmount)).toFixed(4)
    : null;

  // After approval confirms, refetch allowance
  useEffect(() => {
    if (isApproveSuccess) refetchAllowance();
  }, [isApproveSuccess, refetchAllowance]);

  // Reset approval state when sell token changes (approval is per-token)
  useEffect(() => {
    resetApprove();
  }, [sellToken]);

  useEffect(() => {
    if (isSwapSuccess) onSwapComplete?.();
  }, [isSwapSuccess, onSwapComplete]);

  const handleApprove = () => {
    resetApprove();
    writeApprove({
      address: sellToken,
      abi: MOCK_STABLECOIN_ABI,
      functionName: "approve",
      args: [routerAddress, maxUint256],
      chainId,
    });
  };

  const handleSwap = () => {
    if (!address || parsedAmount === BigInt(0)) return;
    resetSwap();
    writeSwap({
      address: routerAddress,
      abi: SWAP_ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [
        parsedAmount,
        minOutput,
        zeroForOne,
        {
          currency0,
          currency1,
          fee: DYNAMIC_FEE_FLAG,
          tickSpacing: DEFAULT_TICK_SPACING,
          hooks: hookAddress,
        },
        "0x" as `0x${string}`,
        address,
        BigInt(Math.floor(Date.now() / 1000) + 600),
      ],
      chainId,
    }, {
      onSuccess: () => setAmount(""),
      onError: () => {},
    });
  };

  const isApproveBusy = isApprovePending || isApproveConfirming;
  const isSwapBusy = isSwapPending || isSwapConfirming;
  const isBusy = isApproveBusy || isSwapBusy;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4-4 4 4M4 10l4 4 4-4" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
          </svg>
          <span className="font-mono text-[13px] uppercase tracking-wider text-[var(--text-secondary)]">Swap</span>
        </div>
        <button
          onClick={() => setShowSlippage(!showSlippage)}
          className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 8h4M8 5v2M8 9v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {slippage}% slippage
        </button>
      </div>

      {/* Slippage settings */}
      {showSlippage && (
        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg)]/50">
          <p className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">Slippage Tolerance</p>
          <div className="flex gap-2">
            {SLIPPAGE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`h-8 px-3.5 rounded-md text-[12px] font-mono transition-all ${
                  slippage === s
                    ? "bg-[var(--green)]/15 border border-[var(--green)]/30 text-[var(--green)]"
                    : "border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Sell */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Sell</label>
            <button
              onClick={() => balance && setAmount(formatUnits(balance, TOKEN_DECIMALS))}
              className="text-[12px] font-mono text-[var(--text-secondary)] hover:text-[var(--green)] transition-colors"
            >
              Balance: {Number(balanceFormatted).toLocaleString()}
              {balance && balance > BigInt(0) && <span className="text-[var(--green)] ml-1">MAX</span>}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`flex-1 h-12 px-4 rounded-lg bg-[var(--bg)] border text-[15px] font-mono placeholder:text-[var(--text-dim)]/30 focus:outline-none transition-all ${
                insufficientBalance
                  ? "border-[var(--red)]/50 focus:border-[var(--red)]/60"
                  : "border-[var(--border)] focus:border-[var(--green)]/40"
              }`}
            />
            <button
              onClick={() => setSellToken(sellToken === currency0 ? currency1 : currency0)}
              className="h-12 px-5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px] font-mono font-medium hover:border-[var(--border-hover)] transition-colors min-w-[100px]"
            >
              {sellName}
            </button>
          </div>
          {insufficientBalance && (
            <p className="text-[12px] font-mono text-[var(--red)] mt-1.5">Insufficient balance</p>
          )}
        </div>

        {/* Swap direction */}
        <div className="flex justify-center -my-1">
          <button
            type="button"
            onClick={() => setSellToken(sellToken === currency0 ? currency1 : currency0)}
            className="w-9 h-9 rounded-full border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center hover:border-[var(--green)]/40 hover:bg-[var(--green)]/5 transition-all group"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="group-hover:text-[var(--green)] text-[var(--text-secondary)] transition-colors">
              <path d="M3 2.5v7M5.5 4L3 1.5.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 9.5v-7M6.5 8L9 10.5 11.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Receive */}
        <div>
          <label className="block text-[12px] font-mono text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">Receive</label>
          <div className="h-12 px-4 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-between">
            <span className={`text-[15px] font-mono ${amountOut > BigInt(0) ? "text-[var(--text)]" : "text-[var(--text-dim)]"}`}>
              {outputFormatted}
            </span>
            <span className="text-[14px] font-mono font-medium">{buyName}</span>
          </div>
        </div>

        {/* Swap details */}
        {parsedAmount > BigInt(0) && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 px-4 py-3.5 space-y-2.5">
            <div className="flex justify-between text-[13px] font-mono">
              <span className="text-[var(--text-secondary)]">Fee</span>
              <span className="font-medium" style={{ color: feeColor }}>
                {effectiveFeeBps === 0 ? "0 bps (rebalancing)" : `${effectiveFeeBps.toFixed(1)} bps`}
              </span>
            </div>
            <div className="flex justify-between text-[13px] font-mono">
              <span className="text-[var(--text-secondary)]">Price impact</span>
              <span className="font-medium" style={{ color: impactColor }}>{priceImpact.toFixed(2)}%</span>
            </div>
            {rate && (
              <div className="flex justify-between text-[13px] font-mono">
                <span className="text-[var(--text-secondary)]">Rate</span>
                <span className="text-[var(--text)]">1 {sellName} = {rate} {buyName}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] font-mono">
              <span className="text-[var(--text-secondary)]">Min. received</span>
              <span className="text-[var(--text)]">{minOutputFormatted} {buyName}</span>
            </div>
            <div className="flex justify-between text-[13px] font-mono">
              <span className="text-[var(--text-secondary)]">Slippage</span>
              <span className="text-[var(--text)]">{slippage}%</span>
            </div>
          </div>
        )}

        {/* Action button(s) */}
        {needsApproval ? (
          <div className="space-y-2.5">
            <button
              onClick={handleApprove}
              disabled={!address || isBusy}
              className="w-full h-12 rounded-lg bg-[var(--green)] text-[var(--bg)] text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isApproveBusy ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" /></svg>
                  {isApprovePending ? "Signing..." : "Confirming approval..."}
                </span>
              ) : `Approve ${sellName}`}
            </button>
            <div className="flex items-center gap-2 text-[12px] font-mono text-[var(--text-secondary)]">
              <span className="flex items-center justify-center w-5 h-5 rounded-full border border-[var(--text-dim)]/40 text-[10px]">1</span>
              Approve token, then swap
            </div>
          </div>
        ) : (
          <button
            onClick={handleSwap}
            disabled={!address || !amount || parsedAmount === BigInt(0) || isBusy || insufficientBalance}
            className="w-full h-12 rounded-lg bg-[var(--green)] text-[var(--bg)] text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isSwapBusy ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" /></svg>
                {isSwapPending ? "Signing..." : "Confirming swap..."}
              </span>
            ) : insufficientBalance ? "Insufficient balance" : "Swap"}
          </button>
        )}

        {isSwapSuccess && (
          <p className="text-[13px] text-[var(--green)] font-mono text-center">Swap executed successfully.</p>
        )}
      </div>
    </div>
  );
}
