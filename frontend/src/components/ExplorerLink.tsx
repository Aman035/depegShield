"use client";

import { EXPLORER_URLS } from "@/config/contracts";

interface ExplorerLinkProps {
  chainId: number;
  address?: string;
  tx?: string;
  label?: string;
  className?: string;
}

export function ExplorerLink({ chainId, address, tx, label, className = "" }: ExplorerLinkProps) {
  const base = EXPLORER_URLS[chainId];
  if (!base) return null;

  const href = tx ? `${base}/tx/${tx}` : `${base}/address/${address}`;
  const display = label ?? (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : tx ? `${tx.slice(0, 6)}...` : "");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-[var(--text-dim)] hover:text-[var(--green)] transition-colors ${className}`}
    >
      {display}
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M4.5 2H2.5v7h7V7M7 2h3v3M10 2L5.5 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
