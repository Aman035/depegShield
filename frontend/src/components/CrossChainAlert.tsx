"use client";

import { useReadContract } from "wagmi";
import { type Address } from "viem";
import {
  ALERT_RECEIVER_ABI,
  ALERT_RECEIVER_ADDRESSES,
  HOOK_ADDRESSES,
  CHAIN_NAMES,
  EXPLORER_URLS,
  TOKEN_ADDRESSES,
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
}

interface AlertData {
  sourceRatio: bigint;
  timestamp: number;
  ttl: number;
  sourceChainId: bigint;
}

// All monitored chains
const MONITORED_CHAINS = [11155111, 84532, 1301] as const;

const CHAIN_ICONS: Record<number, string> = {
  11155111: "E", // Ethereum
  84532: "B", // Base
  1301: "U", // Unichain
};

function ChainStatusDot({ status }: { status: "active" | "idle" | "alert" }) {
  const colors = {
    active: "bg-[var(--green)]",
    idle: "bg-[var(--text-dim)]/40",
    alert: "bg-[var(--amber)]",
  };
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${colors[status]} ${status === "alert" ? "animate-pulse" : ""}`}
    />
  );
}

export function CrossChainAlert({
  chainId,
  currency0,
  currency1,
}: CrossChainAlertProps) {
  const alertReceiverAddress = ALERT_RECEIVER_ADDRESSES[chainId];
  const isConfigured =
    alertReceiverAddress &&
    alertReceiverAddress !== "0x0000000000000000000000000000000000000000";

  const { data: ratio } = useReadContract({
    address: alertReceiverAddress,
    abi: ALERT_RECEIVER_ABI,
    functionName: "getCrossChainRatio",
    args: [currency0, currency1],
    chainId,
    query: { enabled: isConfigured, refetchInterval: 5000 },
  });

  const crossChainRatio = Number(ratio ?? 0);

  const { data: alertData } = useReadContract({
    address: alertReceiverAddress,
    abi: ALERT_RECEIVER_ABI,
    functionName: "getAlertForTokens",
    args: [currency0, currency1],
    chainId,
    query: {
      enabled: isConfigured && crossChainRatio > 10000,
      refetchInterval: 5000,
    },
  });

  const hasAlert = crossChainRatio > 10000;
  const alert = alertData as AlertData | undefined;
  const sourceChainName = alert
    ? (CHAIN_NAMES[Number(alert.sourceChainId)] ?? `Chain ${alert.sourceChainId}`)
    : null;
  const ttlRemaining = alert
    ? Math.max(
        0,
        Number(alert.timestamp) +
          Number(alert.ttl) -
          Math.floor(Date.now() / 1000),
      )
    : 0;
  const ttlMinutes = Math.floor(ttlRemaining / 60);
  const ttlSeconds = ttlRemaining % 60;

  const feeFloorBps = hasAlert ? toBps(calculateFee(crossChainRatio)) : 0;
  const zone = hasAlert ? getZone(crossChainRatio) : null;
  const zoneColor = zone ? getZoneColor(zone) : "var(--green)";

  // Determine which chains are "other" chains being monitored
  const otherChains = MONITORED_CHAINS.filter((c) => c !== chainId);
  const sourceChainId = alert ? Number(alert.sourceChainId) : null;

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
            <path
              d="M8 6v1.5M8 9v1.5M3.5 5.5L8 8M12.5 5.5L8 8M3.5 10.5L8 8M12.5 10.5L8 8"
              stroke={hasAlert ? zoneColor : "var(--green)"}
              strokeWidth="0.7"
              strokeOpacity="0.3"
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

      {/* Monitoring Network */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-3">
          Monitoring Network
        </p>
        <div className="grid grid-cols-3 gap-3">
          {MONITORED_CHAINS.map((cId) => {
            const isSelf = cId === chainId;
            const isSource = sourceChainId === cId;
            const hasHook = !!HOOK_ADDRESSES[cId];
            const explorerUrl = EXPLORER_URLS[cId];
            const hookAddr = HOOK_ADDRESSES[cId];
            const alertAddr = ALERT_RECEIVER_ADDRESSES[cId];

            let status: "active" | "idle" | "alert" = hasHook
              ? "active"
              : "idle";
            if (isSource && hasAlert) status = "alert";

            const borderColor = isSource && hasAlert
              ? `color-mix(in srgb, ${zoneColor} 40%, transparent)`
              : isSelf
                ? "color-mix(in srgb, var(--green) 30%, transparent)"
                : "var(--border)";

            const bgColor = isSource && hasAlert
              ? `color-mix(in srgb, ${zoneColor} 6%, transparent)`
              : "transparent";

            return (
              <div
                key={cId}
                className="rounded-lg border px-3.5 py-3 relative"
                style={{ borderColor, backgroundColor: bgColor }}
              >
                {/* Chain header */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold"
                    style={{
                      backgroundColor:
                        isSource && hasAlert
                          ? `color-mix(in srgb, ${zoneColor} 20%, transparent)`
                          : isSelf
                            ? "color-mix(in srgb, var(--green) 15%, transparent)"
                            : "var(--bg)",
                      color:
                        isSource && hasAlert
                          ? zoneColor
                          : isSelf
                            ? "var(--green)"
                            : "var(--text-secondary)",
                      border: `1px solid ${
                        isSource && hasAlert
                          ? `color-mix(in srgb, ${zoneColor} 30%, transparent)`
                          : "var(--border)"
                      }`,
                    }}
                  >
                    {CHAIN_ICONS[cId]}
                  </span>
                  <span className="text-[12px] font-mono font-medium text-[var(--text)]">
                    {CHAIN_NAMES[cId]}
                  </span>
                  <ChainStatusDot status={status} />
                </div>

                {/* Status line */}
                <p
                  className="text-[11px] font-mono mb-2"
                  style={{
                    color:
                      isSource && hasAlert ? zoneColor : "var(--text-secondary)",
                  }}
                >
                  {isSource && hasAlert
                    ? `Depeg: ${ratioToMultiplier(crossChainRatio)}`
                    : isSelf
                      ? "This pool"
                      : "Monitoring"}
                </p>

                {/* Links */}
                {explorerUrl && hookAddr && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`${explorerUrl}/address/${isSelf ? hookAddr : alertAddr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--green)] transition-colors flex items-center gap-0.5"
                    >
                      {isSelf ? "Hook" : "Receiver"}
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M4.5 2H2.5v7h7V7M7 2h3v3M10 2L5.5 6.5"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Alert Details */}
      {hasAlert && (
        <div
          className="mx-5 mb-4 rounded-lg border px-4 py-3.5"
          style={{
            borderColor: `color-mix(in srgb, ${zoneColor} 30%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${zoneColor} 6%, transparent)`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: zoneColor }}
            />
            <span
              className="font-mono text-[12px] uppercase tracking-wider font-medium"
              style={{ color: zoneColor }}
            >
              {zone ? getZoneLabel(zone) : "Alert"} -- Cross-Chain Contagion
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px] font-mono mb-3">
            <div>
              <p className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider mb-0.5">
                Source
              </p>
              <p className="text-[var(--text)] font-medium">
                {sourceChainName}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider mb-0.5">
                Imbalance
              </p>
              <p className="font-medium" style={{ color: zoneColor }}>
                {ratioToMultiplier(crossChainRatio)}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider mb-0.5">
                Fee Floor
              </p>
              <p className="font-medium" style={{ color: zoneColor }}>
                {feeFloorBps.toFixed(1)} bps
              </p>
            </div>
            <div>
              <p className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider mb-0.5">
                Expires
              </p>
              <p className="text-[var(--text)] font-medium">
                {ttlMinutes}m {ttlSeconds}s
              </p>
            </div>
          </div>

          {/* Visual bar showing fee floor impact */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)] mb-1">
              <span>Fee floor applied</span>
              <span style={{ color: zoneColor }}>
                {feeFloorBps.toFixed(1)} bps minimum
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
      )}

      {/* Footer explanation */}
      <div className="px-5 pb-4">
        <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
          {hasAlert ? (
            <>
              Depeg detected on{" "}
              <span style={{ color: zoneColor }}>{sourceChainName}</span>. This
              pool preemptively charges{" "}
              <span className="text-[var(--text-secondary)]">
                {feeFloorBps.toFixed(1)} bps minimum
              </span>{" "}
              on imbalance-worsening swaps. Rebalancing swaps remain fee-free.
            </>
          ) : (
            <>
              Reactive Network monitors mUSDC/mUSDT pools across{" "}
              {otherChains.map((c) => CHAIN_NAMES[c]).join(" and ")}. If a
              depeg is detected elsewhere, fees tighten here automatically
              before arbitrageurs arrive.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
