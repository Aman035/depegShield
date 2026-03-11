"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none" as const, userSelect: "none" as const },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="h-9 px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-[13px] font-medium text-[var(--text)] hover:border-[var(--green)]/40 hover:text-[var(--green)] transition-all flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
                      <path d="M11 8.5a0.5 0.5 0 1 1 1 0 0.5 0.5 0 0 1-1 0Z" fill="currentColor" />
                      <path d="M4 4V3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    </svg>
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="h-9 px-4 rounded-lg border border-[var(--red)]/30 bg-[var(--red-muted)] text-[13px] font-medium text-[var(--red)] hover:border-[var(--red)]/50 transition-all"
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-[12px] font-mono text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-all flex items-center gap-1.5"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img src={chain.iconUrl} alt={chain.name ?? ""} className="w-4 h-4 rounded-full" />
                    )}
                    {chain.name}
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="h-9 px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-[13px] font-mono text-[var(--text)] hover:border-[var(--green)]/40 transition-all flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
