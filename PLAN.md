# DepegShield — Implementation Spec

> This file is the source of truth for implementation. Each phase builds on the last.
> Status: Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅

---

## Codebase Context

- **Framework:** Foundry + v4-template (OpenZeppelin BaseHook)
- **Solidity:** 0.8.30, cancun EVM
- **Key imports:** `BaseHook`, `StateLibrary`, `LPFeeLibrary`, `FullMath`, `TickMath`
- **Pool setup:** `PoolKey.fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` (0x800000)
- **Fee return:** `beforeSwap` returns `fee | LPFeeLibrary.OVERRIDE_FEE_FLAG` (0x400000) as uint24
- **Fee units:** hundredths of a bip (100 = 1bp, 5000 = 50bp, 1000000 = 100%)
- **Reserve derivation:** `reserve0 = L * 2^96 / sqrtPriceX96`, `reserve1 = L * sqrtPriceX96 / 2^96`
- **Imbalance ratio:** `max(r0, r1) / min(r0, r1)` scaled by 10000 (1.0 = 10000, 1.22 = 12200)

---

## Phase 1: Directional Fee Hook ✅

**Files created:**
- `contracts/src/DepegShieldHook.sol` — hook with `_beforeSwap` (fee logic) + `_afterSwap` (events)
- `contracts/test/DepegShieldHook.t.sol` — 6 tests, all passing

**What it does:**
- Computes imbalance ratio from virtual reserves
- If ratio > 12200 (1.22x, ~55/45 split) AND swap worsens imbalance → 50bp fee
- If ratio > 12200 AND swap rebalances → 0bp fee (incentivize rebalancing)
- If ratio ≤ 12200 (balanced) → 1bp base fee regardless of direction
- View functions: `getImbalanceRatio(key)`, `getVirtualReserves(key)`
- Event: `SwapFeeApplied(poolId, imbalanceRatio, worsensImbalance, feeApplied)`

**Constants:** `BASE_FEE=100`, `ELEVATED_FEE=5000`, `MAX_FEE=500000`, `IMBALANCE_THRESHOLD=12200`

---

## Phase 2: Dynamic Fee Curve + Depeg Simulation ✅

**Goal:** Replace the binary BASE/ELEVATED fee with a continuous 3-zone curve.

**New file: `contracts/src/FeeCurve.sol`** (pure library)
```
function calculateFee(uint256 ratio) returns (uint24 fee)

Zone 1 — Safe (ratio ≤ 12200, i.e. ≤55/45):
  fee = BASE_FEE (100 = 1bp)

Zone 2 — Warning (12200 < ratio ≤ 15000, i.e. 55/45 to 60/40):
  fee = BASE_FEE + k1 * (ratio - 12200)^2 / PRECISION
  Target: ~5bp at 55/45, ~15bp at 60/40

Zone 3 — Circuit Breaker (ratio > 15000, i.e. > 60/40):
  fee = BASE_FEE + k2 * (ratio - 12200)^n / PRECISION
  Target: ~50bp at 65/35, ~100bp at 70/30, ~200bp at 80/20
  Cap at MAX_FEE
```

**Modify: `contracts/src/DepegShieldHook.sol`**
- Replace the if/else fee logic with `FeeCurve.calculateFee(imbalanceRatio)`
- Add configurable parameters struct (k1, k2, n, zone boundaries) set at pool init
- Keep directional logic unchanged (curve fee for worsening, 0bp for rebalancing)

**New file: `contracts/test/FeeCurve.t.sol`**
- Unit tests for fee values at known ratios (boundary conditions, overflow, max cap)
- Fuzz test: fee should be monotonically increasing with ratio

**New file: `contracts/test/DepegScenario.t.sol`**
- Simulate March 2023 USDC depeg: sequence of sells pushing pool from 50/50 → 80/20
- Then recovery: buys pushing back to 50/50
- Track cumulative fees earned by LPs with DepegShield
- Compare against same scenario with flat 1bp fee (use vm.snapshot)
- Log the comparison for demo purposes

**Update existing tests** to work with new curve instead of fixed thresholds.

---

## Phase 3: Frontend 🔲

**Stack:** Next.js 14+ (App Router), React, Tailwind CSS, viem + wagmi, Recharts, RainbowKit

**Location:** `frontend/` subdirectory of the Foundry project

**Chains:** Unichain Sepolia, Sepolia, Base Sepolia

### Page 1: Landing Page (`/`)

1. **Hero Section**
   - Tagline + one-liner explaining DepegShield
   - CTA button to Explore page

2. **Problem / Solution**
   - Condensed version of README content
   - Why flat-fee pools fail during depegs

3. **Fee Curve Visualization** (interactive)
   - 3-zone fee curve chart (ratio on x-axis, fee in bps on y-axis)
   - Zone backgrounds color-coded (green/yellow/red)
   - Hover to see exact fee at any ratio
   - Two lines: "Worsening swap fee" (curve) vs "Rebalancing fee" (0bp)
   - Client-side math using FeeCurve constants (no contract call needed)

4. **Simulation Replay** (the demo centerpiece)
   - Dropdown: SVB/USDC Recovery, USDT Whale Attack, UST/LUNA Collapse
   - Play/pause/step controls to walk through each wave
   - Animates: gauge changes, dot moves on curve, fee counters increment
   - Side-by-side: "DepegShield LP fees" vs "Flat-fee LP fees"
   - Pre-computed data hardcoded from forge test output

5. **How It Works**
   - Brief 3-step technical flow: measure imbalance -> directional fee -> protect LPs

### Page 2: Explore Page (`/explore`)

1. **Pool Input**
   - Pool address input field
   - Chain selector dropdown (Unichain Sepolia, Sepolia, Base Sepolia)
   - Wallet connection via RainbowKit

2. **Pool Health Gauge**
   - Large gauge/meter: Safe (green) / Warning (yellow) / Circuit Breaker (red)
   - Reads `getImbalanceRatio(key)` on-chain
   - Shows reserves, ratio, pool split (e.g., "54/46") numerically

3. **Fee Curve with Live Position**
   - Same fee curve chart as landing page
   - Animated dot showing where this pool currently sits on the curve
   - Current fee displayed for worsening vs rebalancing direction

4. **Swap Button**
   - Links to Uniswap frontend with pool pre-selected
   - Enables live demo: swap -> see gauge/curve update in real time

**Contract reads:** `getImbalanceRatio(key)`, `getVirtualReserves(key)`, `getFeeForRatio(ratio)`

**Fee curve constants (replicated client-side):**
```
BASE_FEE = 100, MAX_FEE = 500_000
ZONE1_UPPER = 12_200, ZONE2_UPPER = 15_000
ZONE2_DIVISOR = 5_600, ZONE2_END_FEE = 1_500
Zone 1: fee = 100
Zone 2: fee = 100 + (ratio - 12200)^2 / 5600
Zone 3: fee = 1500 + (ratio - 15000), capped at 500000
```

---

## Phase 4: Reactive Network Cross-Chain Integration 🔲

**New file: `contracts/src/AlertReceiver.sol`** (deployed on Unichain)
- `setAlert(address token, uint8 severity)` — callable only by Reactive Network
- `clearAlert(address token)` — callable by Reactive Network when source pool recovers
- Stores: `mapping(address => Alert)` where Alert = {severity, timestamp}
- `getAlertSeverity(address token) → uint8` — view for hook to read

**Modify: `contracts/src/DepegShieldHook.sol`**
- In `_beforeSwap`: if `alertReceiver.getAlertSeverity(token) > 0`, multiply fee curve output by severity factor
- This means a locally-balanced pool still charges elevated fees if cross-chain depeg detected
- Severity levels: 1 = 1.5x multiplier, 2 = 2x, 3 = 3x

**New file: `reactive/ReactiveMonitor.sol`** (deployed on Reactive Network)
- Subscribe to Swap events on major Ethereum stablecoin pools (Uniswap v3 USDC/USDT, Curve 3pool)
- Track cumulative sell pressure over rolling window
- When imbalance exceeds threshold → emit callback to AlertReceiver on Unichain
- When imbalance normalizes → emit clearAlert callback

**Frontend update:**
- Add alert status indicator (banner or icon) showing cross-chain alert state
- "Alert from Ethereum: USDC imbalance detected" with severity level
