'use client'

import { useState } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import {
  MOCK_STABLECOIN_ABI,
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS,
  EXPLORER_URLS,
} from '@/config/contracts'

interface FaucetProps {
  chainId: number
  onMinted?: () => void
}

function formatBalance(raw: bigint): string {
  const num = Number(formatUnits(raw, TOKEN_DECIMALS))
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function Faucet({ chainId, onMinted }: FaucetProps) {
  const { address } = useAccount()
  const [mintingToken, setMintingToken] = useState<'mUSDC' | 'mUSDT' | null>(
    null,
  )

  const { writeContract, data: txHash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Read balances -- poll every 5s to stay fresh
  const { data: balUSDC } = useReadContract({
    address: TOKEN_ADDRESSES.mUSDC,
    abi: MOCK_STABLECOIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address, refetchInterval: 5000 },
  })

  const { data: balUSDT } = useReadContract({
    address: TOKEN_ADDRESSES.mUSDT,
    abi: MOCK_STABLECOIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address, refetchInterval: 2000 },
  })

  // Derive last minted from tx confirmation state
  const lastMintedInfo =
    isSuccess && txHash && mintingToken
      ? { token: mintingToken, hash: txHash }
      : null

  const mint = (token: 'mUSDC' | 'mUSDT') => {
    if (!address) return
    setMintingToken(token)
    reset()
    writeContract(
      {
        address: TOKEN_ADDRESSES[token],
        abi: MOCK_STABLECOIN_ABI,
        functionName: 'mint',
        args: [address, parseUnits('10000', TOKEN_DECIMALS)],
        chainId,
      },
      {
        onSuccess: () => onMinted?.(),
      },
    )
  }

  const isBusy = isPending || isConfirming
  const explorerUrl = EXPLORER_URLS[chainId]

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/40 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2v4M8 10v4M2 8h4M10 8h4"
              stroke="var(--green)"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeOpacity="0.6"
            />
          </svg>
          <span className="font-mono text-[12px] uppercase tracking-wider text-[var(--text-secondary)]">
            Testnet Faucet
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
          Free tokens
        </span>
      </div>

      <div className="p-5">
        {/* Balance display */}
        {address && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <BalanceCard
              token="mUSDC"
              balance={balUSDC !== undefined ? formatBalance(balUSDC) : '--'}
            />
            <BalanceCard
              token="mUSDT"
              balance={balUSDT !== undefined ? formatBalance(balUSDT) : '--'}
            />
          </div>
        )}

        {/* Mint buttons */}
        <div className="flex gap-3">
          <MintButton
            token="mUSDC"
            isBusy={isBusy}
            isActive={mintingToken === 'mUSDC'}
            isConfirming={isConfirming}
            disabled={!address || isBusy}
            onClick={() => mint('mUSDC')}
          />
          <MintButton
            token="mUSDT"
            isBusy={isBusy}
            isActive={mintingToken === 'mUSDT'}
            isConfirming={isConfirming}
            disabled={!address || isBusy}
            onClick={() => mint('mUSDT')}
          />
        </div>

        {/* Success feedback */}
        {lastMintedInfo && isSuccess && (
          <div className="mt-4 rounded-lg border border-[var(--green)]/20 bg-[var(--green)]/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="var(--green)"
                  strokeWidth="1.2"
                />
                <path
                  d="M5.5 8l1.5 1.5L10.5 6"
                  stroke="var(--green)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[13px] font-medium text-[var(--green)]">
                10,000 {lastMintedInfo.token} minted
              </span>
            </div>
            {explorerUrl && (
              <a
                href={`${explorerUrl}/tx/${lastMintedInfo.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
              >
                View transaction
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2H2.5v7h7V7M7 2h3v3M10 2L5.5 6.5"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Not connected hint */}
        {!address && (
          <p className="text-[12px] text-[var(--text-dim)] mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
            Connect wallet to mint tokens
          </p>
        )}
      </div>
    </div>
  )
}

function BalanceCard({ token, balance }: { token: string; balance: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2.5 bg-[var(--bg)]/50">
      <p className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
        {token} Balance
      </p>
      <p className="text-[14px] font-mono font-semibold text-[var(--text)] tracking-tight">
        {balance}
      </p>
    </div>
  )
}

function MintButton({
  token,
  isBusy,
  isActive,
  isConfirming,
  disabled,
  onClick,
}: {
  token: string
  isBusy: boolean
  isActive: boolean
  isConfirming: boolean
  disabled: boolean
  onClick: () => void
}) {
  const label =
    isBusy && isActive
      ? isConfirming
        ? 'Confirming...'
        : 'Signing...'
      : `Mint 10K ${token}`

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[13px] font-mono font-medium text-[var(--text)] hover:border-[var(--green)]/40 hover:bg-[var(--green)]/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {isBusy && isActive ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="32"
              strokeLinecap="round"
            />
          </svg>
          {label}
        </span>
      ) : (
        label
      )}
    </button>
  )
}
