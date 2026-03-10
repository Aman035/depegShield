# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DepegShield is a Uniswap v4 hook that charges dynamic, directional swap fees based on pool imbalance ratio to protect stablecoin pool LPs during depeg events. Built on the OpenZeppelin BaseHook framework.

## Monorepo Structure

```
contracts/     # Foundry project (Solidity contracts, tests, scripts)
frontend/      # Next.js 14 app (landing page, pool explorer)
```

## Commands

```bash
# Contracts (run from contracts/)
cd contracts
forge build              # Build contracts
forge test -vv           # Run all tests
forge test --mt test_balancedPool -vvv  # Run single test by name
forge build --sizes      # Check contract sizes

# Frontend (run from frontend/)
cd frontend
npm run dev              # Start dev server
npm run build            # Production build
```

CI uses `FOUNDRY_PROFILE=ci` with `forge test -vvv`.

## Smart Contract Development Rules

Always follow these when making contract changes:

1. **Write test cases** for every new or modified contract function. No contract change ships without tests.
2. **Run `forge coverage`** after changes. Check for uncovered branches and edge cases. Add tests to fill gaps.
3. **Security analysis** -- review for reentrancy, overflow, access control, input validation, and other vulnerabilities. Make sure code is bug-free.
4. **Gas efficiency** -- minimize storage reads, use appropriate data types, avoid redundant computation. Check gas usage in test output.

## Architecture

**Core contract:** `contracts/src/DepegShieldHook.sol` extends `BaseHook` from `@openzeppelin/uniswap-hooks`.

**Hook flow:**
- `_beforeSwap()` reads `sqrtPriceX96` + `liquidity` from PoolManager, derives virtual reserves, computes imbalance ratio (`max/min * 10000`), checks swap direction, and returns a fee with `LPFeeLibrary.OVERRIDE_FEE_FLAG`.
- `_afterSwap()` emits `SwapFeeApplied` event with post-swap state.

**Fee logic** (via `FeeCurve.sol` library):
- Zone 1 (ratio <= 12200, safe): 1bp flat
- Zone 2 (12200 < ratio <= 15000, warning): quadratic ramp, `100 + d^2/5600`
- Zone 3 (ratio > 15000, circuit breaker): linear, `1500 + (ratio - 15000)`
- Capped at MAX_FEE (500000 = 50%)
- Rebalancing swaps on imbalanced pools -> 0bp (incentivize recovery)

**Pool requirement:** Must initialize with `LPFeeLibrary.DYNAMIC_FEE_FLAG` (0x800000) in `PoolKey.fee`.

**Fee units:** Hundredths of a bip (100 = 1bp, 5000 = 50bp, 1000000 = 100%).

## Test Infrastructure

Tests use a custom `BaseTest` -> `Deployers` chain that deploys the full v4 stack (PoolManager, PositionManager, Permit2, Router). Hook is deployed via `deployCodeTo()` at a flag-encoded address (`BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG`). The `swapRouter` helper handles token approvals and swap execution.

## Key Configuration

- **Solidity:** 0.8.30, cancun EVM, FFI enabled
- **Dependencies** are git submodules in `contracts/lib/` (forge-std, uniswap-hooks, hookmate)
- **Remappings:** `@uniswap/v4-core/` and `@uniswap/v4-periphery/` resolve through `contracts/lib/uniswap-hooks/lib/`
- **Frontend:** Next.js 14+ (App Router), Tailwind CSS, viem + wagmi, RainbowKit, Recharts

## Implementation Plan

See `PLAN.md` for phased implementation spec. Phase 1 (directional fee hook) and Phase 2 (fee curve + depeg simulation) are complete. Phase 3 (frontend) is in progress. Phase 4 covers Reactive Network cross-chain integration.
