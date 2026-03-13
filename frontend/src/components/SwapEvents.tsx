"use client";

import { useWatchContractEvent } from "wagmi";
import { useState, useCallback } from "react";
import { DEPEG_SHIELD_ABI, HOOK_ADDRESSES, EXPLORER_URLS } from "@/config/contracts";
import { toBps, getZone, getZoneColor } from "@/lib/feeCurve";

interface SwapEvent {
  ratio: number;
  worsens: boolean;
  feeBps: number;
  timestamp: number;
  txHash?: string;
}

interface SwapEventsProps {
  chainId: number;
}

export function SwapEvents({ chainId }: SwapEventsProps) {
  const [events, setEvents] = useState<SwapEvent[]>([]);
  const hookAddress = HOOK_ADDRESSES[chainId];
  const explorerUrl = EXPLORER_URLS[chainId];

  const onLogs = useCallback((logs: unknown[]) => {
    const newEvents: SwapEvent[] = [];
    for (const log of logs) {
      const l = log as { args?: { imbalanceRatio?: bigint; worsensImbalance?: boolean; feeApplied?: number }; transactionHash?: string };
      if (!l.args) continue;
      const ratio = Number(l.args.imbalanceRatio ?? 0);
      newEvents.push({
        ratio,
        worsens: l.args.worsensImbalance ?? false,
        feeBps: toBps(Number(l.args.feeApplied ?? 0)),
        timestamp: Date.now(),
        txHash: l.transactionHash,
      });
    }
    if (newEvents.length > 0) {
      setEvents((prev) => [...newEvents, ...prev].slice(0, 20));
    }
  }, []);

  useWatchContractEvent({
    address: hookAddress,
    abi: DEPEG_SHIELD_ABI,
    eventName: "SwapFeeApplied",
    onLogs,
    chainId,
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.6" />
          </svg>
          <span className="font-mono text-[13px] uppercase tracking-wider text-[var(--text-secondary)]">Recent Swaps</span>
        </div>
        <span className="text-[12px] font-mono text-[var(--text-secondary)]">{events.length} events</span>
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-[14px] text-[var(--text-secondary)]">Listening for SwapFeeApplied events...</p>
          <p className="text-[13px] text-[var(--text-dim)] mt-1.5">Execute a swap to see events appear here</p>
        </div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[12px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="text-left px-5 py-3 font-medium">Direction</th>
                <th className="text-left px-3 py-3 font-medium">Ratio</th>
                <th className="text-right px-3 py-3 font-medium">Fee</th>
                <th className="text-right px-5 py-3 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt, i) => {
                const zone = getZone(evt.ratio);
                const color = evt.feeBps === 0 ? "var(--green)" : getZoneColor(zone);
                return (
                  <tr key={`${evt.timestamp}-${i}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[13px] font-mono ${evt.worsens ? "text-[var(--red)]" : "text-[var(--green)]"}`}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: evt.worsens ? "var(--red)" : "var(--green)" }} />
                        {evt.worsens ? "Worsening" : "Rebalancing"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[var(--text)]">
                      {(evt.ratio / 10000).toFixed(2)}x
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-medium" style={{ color }}>
                      {evt.feeBps.toFixed(1)}bp
                    </td>
                    <td className="px-5 py-3 text-right">
                      {evt.txHash ? (
                        <a
                          href={`${explorerUrl}/tx/${evt.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--text-secondary)] hover:text-[var(--green)] transition-colors font-mono"
                        >
                          {evt.txHash.slice(0, 6)}...
                        </a>
                      ) : (
                        <span className="text-[var(--text-dim)]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
