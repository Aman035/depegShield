"use client";

import { useReadContract } from "wagmi";
import { type Address } from "viem";
import {
  ALERT_RECEIVER_ABI,
  ALERT_RECEIVER_ADDRESSES,
  CHAIN_NAMES,
  EXPLORER_URLS,
} from "@/config/contracts";
import {
  calculateFee,
  toBps,
  getZone,
  getZoneColor,
  getZoneLabel,
  ratioToMultiplier,
} from "@/lib/feeCurve";

interface CrossChainAlertProps {
  chainId: number;
  currency0: Address;
  currency1: Address;
  crossChainRatio?: number;
}

interface AlertData {
  sourceRatio: bigint;
  timestamp: number;
  sourceChainId: bigint;
}

// All monitored chains
const MONITORED_CHAINS = [11155111, 84532, 1301] as const;

export function CrossChainAlert({
  chainId,
  currency0,
  currency1,
  crossChainRatio: externalRatio,
}: CrossChainAlertProps) {
  const alertReceiverAddress = ALERT_RECEIVER_ADDRESSES[chainId];
  const isConfigured =
    alertReceiverAddress &&
    alertReceiverAddress !== "0x0000000000000000000000000000000000000000";

  // Use externally provided ratio if available, otherwise read it ourselves
  const { data: ratioData } = useReadContract({
    address: alertReceiverAddress,
    abi: ALERT_RECEIVER_ABI,
    functionName: "getCrossChainRatio",
    args: [currency0, currency1],
    chainId,
    query: { enabled: isConfigured && externalRatio === undefined, refetchInterval: 5000 },
  });

  const crossChainRatio = externalRatio ?? Number(ratioData ?? 0);
  const hasAlert = crossChainRatio > 10000;

  const { data: alertData } = useReadContract({
    address: alertReceiverAddress,
    abi: ALERT_RECEIVER_ABI,
    functionName: "getAlertForTokens",
    args: [currency0, currency1],
    chainId,
    query: {
      enabled: isConfigured && hasAlert,
      refetchInterval: 5000,
    },
  });

  const alert = alertData as AlertData | undefined;
  const sourceChainName = alert
    ? (CHAIN_NAMES[Number(alert.sourceChainId)] ?? `Chain ${alert.sourceChainId}`)
    : null;

  const feeFloorBps = hasAlert ? toBps(calculateFee(crossChainRatio)) : 0;
  const zone = hasAlert ? getZone(crossChainRatio) : null;
  const zoneColor = zone ? getZoneColor(zone) : "var(--green)";

  const otherChains = MONITORED_CHAINS.filter((c) => c !== chainId);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1L14.5 5v6L8 15 1.5 11V5L8 1Z"
              stroke={hasAlert ? zoneColor : "var(--green)"}
              strokeWidth="1.2"
              strokeLinejoin="round"
              fill="none"
              strokeOpacity="0.6"
            />
            <circle
              cx="8"
              cy="8"
              r="2"
              fill={hasAlert ? zoneColor : "var(--green)"}
              fillOpacity="0.4"
            />
          </svg>
          <span className="font-mono text-[13px] uppercase tracking-wider text-[var(--text-secondary)]">
            Cross-Chain Shield
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasAlert ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] font-mono"
              style={{
                borderColor: `color-mix(in srgb, ${zoneColor} 30%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${zoneColor} 10%, transparent)`,
                color: zoneColor,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: zoneColor }}
              />
              Alert Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--green)]/10 border border-[var(--green)]/20 text-[12px] font-mono text-[var(--green)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
              All Clear
            </span>
          )}
        </div>
      </div>

      {hasAlert ? (
        /* ---- ALERT ACTIVE: prominent details ---- */
        <div className="p-5 space-y-4">
          {/* Main alert banner */}
          <div
            className="rounded-lg border px-5 py-4"
            style={{
              borderColor: `color-mix(in srgb, ${zoneColor} 30%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${zoneColor} 6%, transparent)`,
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: zoneColor }}
              />
              <span
                className="font-mono text-[13px] uppercase tracking-wider font-medium"
                style={{ color: zoneColor }}
              >
                {zone ? getZoneLabel(zone) : "Alert"} -- Depeg Detected on {sourceChainName}
              </span>
            </div>

            {/* Key metrics in a clean 2x2 grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Source Imbalance
                </p>
                <p className="text-2xl font-mono font-semibold" style={{ color: zoneColor }}>
                  {ratioToMultiplier(crossChainRatio)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Fee Floor Applied
                </p>
                <p className="text-2xl font-mono font-semibold" style={{ color: zoneColor }}>
                  {feeFloorBps.toFixed(1)} <span className="text-sm font-normal text-[var(--text-secondary)]">bps</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Source Chain
                </p>
                <p className="text-[14px] font-mono font-medium text-[var(--text)]">
                  {sourceChainName}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  Status
                </p>
                <p className="text-[14px] font-mono font-medium" style={{ color: zoneColor }}>
                  Active until recovered
                </p>
              </div>
            </div>

            {/* Fee floor bar */}
            <div className="mt-4 pt-3 border-t" style={{ borderColor: `color-mix(in srgb, ${zoneColor} 15%, transparent)` }}>
              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-dim)] mb-1.5">
                <span>Fee floor impact</span>
                <span style={{ color: zoneColor }}>
                  {feeFloorBps.toFixed(1)} bps minimum on worsening swaps
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (feeFloorBps / 200) * 100)}%`,
                    backgroundColor: zoneColor,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Explanation */}
          <p className="text-[12px] text-[var(--text-dim)] leading-relaxed">
            Depeg detected on{" "}
            <span style={{ color: zoneColor }}>{sourceChainName}</span>. This
            pool preemptively charges{" "}
            <span className="text-[var(--text-secondary)]">
              {feeFloorBps.toFixed(1)} bps minimum
            </span>{" "}
            on imbalance-worsening swaps to protect LPs. Rebalancing swaps remain fee-free.
          </p>
        </div>
      ) : (
        /* ---- ALL CLEAR: compact monitoring status ---- */
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
              Monitoring
            </span>
            {MONITORED_CHAINS.map((cId) => {
              const isSelf = cId === chainId;
              const explorerUrl = EXPLORER_URLS[cId];
              const alertAddr = ALERT_RECEIVER_ADDRESSES[cId];
              return (
                <a
                  key={cId}
                  href={explorerUrl && alertAddr ? `${explorerUrl}/address/${alertAddr}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] font-mono transition-colors ${
                    isSelf
                      ? "border-[var(--green)]/30 bg-[var(--green)]/5 text-[var(--green)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--green)]/30 hover:text-[var(--green)]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                  {CHAIN_NAMES[cId]}{isSelf ? " (this pool)" : ""}
                </a>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-3 leading-relaxed">
            Reactive Network monitors mUSDC/mUSDT pools across all 3 chains.
            If a depeg is detected on{" "}
            {otherChains.map((c) => CHAIN_NAMES[c]).join(" or ")},
            fees tighten here automatically before arbitrageurs arrive.
          </p>
        </div>
      )}
    </div>
  );
}
