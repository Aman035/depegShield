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
  const depegPct = ((crossChainRatio - 10000) / 100).toFixed(1);

  if (hasAlert) {
    return (
      <div
        className="rounded-xl overflow-hidden relative"
        style={{
          border: `1px solid color-mix(in srgb, ${zoneColor} 25%, var(--border))`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${zoneColor} 4%, var(--bg-raised)) 0%, var(--bg-raised) 100%)`,
        }}
      >
        {/* Scanning line animation */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ opacity: 0.06 }}
        >
          <div
            className="absolute w-full h-[1px] animate-scan"
            style={{ background: `linear-gradient(90deg, transparent, ${zoneColor}, transparent)` }}
          />
        </div>

        {/* Header bar */}
        <div
          className="px-5 py-3 flex items-center justify-between border-b"
          style={{ borderColor: `color-mix(in srgb, ${zoneColor} 15%, var(--border))` }}
        >
          <div className="flex items-center gap-3">
            {/* Shield icon with pulse ring */}
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1L14 4.5V9.5C14 12.5 11 14.5 8 15.5C5 14.5 2 12.5 2 9.5V4.5L8 1Z"
                  stroke={zoneColor}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  fill={`color-mix(in srgb, ${zoneColor} 15%, transparent)`}
                />
                <path d="M6 8L7.5 9.5L10 6.5" stroke={zoneColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: zoneColor }}
              />
            </div>
            <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">
              Cross-Chain Shield
            </span>
          </div>

          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded font-mono text-[11px] uppercase tracking-wider"
            style={{
              color: zoneColor,
              background: `color-mix(in srgb, ${zoneColor} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${zoneColor} 20%, transparent)`,
            }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
                style={{ backgroundColor: zoneColor }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: zoneColor }}
              />
            </span>
            {zone ? getZoneLabel(zone) : "Alert"}
          </div>
        </div>

        {/* Content: two-column asymmetric layout */}
        <div className="px-5 py-4">
          {/* Source info line */}
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-mono text-[11px] text-[var(--text-dim)] uppercase tracking-wider">Origin</span>
            <span className="font-mono text-[13px] font-medium" style={{ color: zoneColor }}>
              {sourceChainName}
            </span>
            <span className="font-mono text-[11px] text-[var(--text-dim)]">
              -- {depegPct}% deviation detected
            </span>
          </div>

          {/* Metrics row */}
          <div className="flex items-end gap-8">
            {/* Hero metric: ratio */}
            <div>
              <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">
                Source Ratio
              </p>
              <p className="font-mono text-[36px] leading-none font-semibold tracking-tight" style={{ color: zoneColor }}>
                {ratioToMultiplier(crossChainRatio)}
              </p>
            </div>

            {/* Divider */}
            <div
              className="h-12 w-px self-center"
              style={{ background: `color-mix(in srgb, ${zoneColor} 20%, transparent)` }}
            />

            {/* Fee floor */}
            <div>
              <p className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">
                Fee Floor
              </p>
              <p className="font-mono text-[36px] leading-none font-semibold tracking-tight" style={{ color: zoneColor }}>
                {feeFloorBps.toFixed(1)}
                <span className="text-[14px] font-normal text-[var(--text-dim)] ml-1">bps</span>
              </p>
            </div>

            {/* Spacer + impact note */}
            <div className="ml-auto self-end pb-1">
              <p className="font-mono text-[11px] text-[var(--text-dim)] text-right leading-relaxed max-w-[260px]">
                Worsening swaps pay <span className="text-[var(--text-secondary)]">{feeFloorBps.toFixed(1)} bps min</span>.
                <br />
                Rebalancing swaps remain free.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${zoneColor} 20%, ${zoneColor} 80%, transparent 100%)`,
            opacity: 0.3,
          }}
        />

        {/* Inline style for scan animation */}
        <style jsx>{`
          @keyframes scan {
            0% { top: 0%; }
            100% { top: 100%; }
          }
          .animate-scan {
            animation: scan 3s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // ---- ALL CLEAR ----
  const currentChainName = CHAIN_NAMES[chainId] ?? "Unknown";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1L14 4.5V9.5C14 12.5 11 14.5 8 15.5C5 14.5 2 12.5 2 9.5V4.5L8 1Z"
              stroke="var(--green)"
              strokeWidth="1.2"
              strokeLinejoin="round"
              fill="none"
              strokeOpacity="0.4"
            />
            <path d="M6 8L7.5 9.5L10 6.5" stroke="var(--green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
          </svg>
          <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">
            Cross-Chain Shield
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--green)]/8 border border-[var(--green)]/15 text-[11px] font-mono uppercase tracking-wider text-[var(--green)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
          Nominal
        </span>
      </div>

      {/* Network topology */}
      <div className="px-5 py-4">
        {/* Chain nodes with connection lines */}
        <div className="flex items-center justify-between mb-4">
          {MONITORED_CHAINS.map((cId, i) => {
            const isSelf = cId === chainId;
            const explorerUrl = EXPLORER_URLS[cId];
            const alertAddr = ALERT_RECEIVER_ADDRESSES[cId];
            return (
              <div key={cId} className="flex items-center" style={{ flex: 1 }}>
                {/* Node */}
                <a
                  href={explorerUrl && alertAddr ? `${explorerUrl}/address/${alertAddr}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center gap-1.5 group transition-colors flex-1 ${isSelf ? "" : "opacity-70 hover:opacity-100"}`}
                >
                  {/* Circle node */}
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                      isSelf
                        ? "border-[var(--green)]/40 bg-[var(--green)]/10"
                        : "border-[var(--border)] bg-[var(--bg)] group-hover:border-[var(--green)]/30"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelf ? "bg-[var(--green)] pulse-dot" : "bg-[var(--green)]/50"
                      }`}
                    />
                  </div>
                  <span className={`font-mono text-[11px] ${isSelf ? "text-[var(--green)]" : "text-[var(--text-dim)] group-hover:text-[var(--text-secondary)]"}`}>
                    {CHAIN_NAMES[cId]?.replace(" Sepolia", "")}
                  </span>
                  {isSelf && (
                    <span className="font-mono text-[9px] text-[var(--green)]/60 uppercase tracking-wider -mt-0.5">
                      This Pool
                    </span>
                  )}
                </a>
                {/* Connection line between nodes */}
                {i < MONITORED_CHAINS.length - 1 && (
                  <div className="flex-1 h-px bg-[var(--green)]/10 mx-2 relative -mt-4">
                    <div className="absolute inset-0 bg-[var(--green)]/20" style={{
                      maskImage: "linear-gradient(90deg, transparent 0%, black 30%, black 70%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 30%, black 70%, transparent 100%)",
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info line */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <p className="font-mono text-[11px] text-[var(--text-dim)] leading-relaxed">
            Depeg on {otherChains.map((c) => CHAIN_NAMES[c]?.replace(" Sepolia", "")).join(" or ")} triggers automatic fee floor on {currentChainName?.replace(" Sepolia", "")}
          </p>
          <span className="font-mono text-[10px] text-[var(--text-dim)] shrink-0 ml-4">
            Reactive Network
          </span>
        </div>
      </div>
    </div>
  );
}
