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

**Fee logic** (via `FeeCurve.sol` library -- 5-zone adaptive curve):
- Zone 1 Stable (ratio <= 10050, <=0.5% deviation): 1bp flat (BASE_FEE = 100)
- Zone 2 Drift (10050 < ratio <= 10100, 0.5-1%): linear ramp 1-5bp
- Zone 3 Stress (10100 < ratio <= 10300, 1-3%): quadratic 5-50bp
- Zone 4 Crisis (10300 < ratio <= 10500, 3-5%): quadratic 50-200bp
- Zone 5 Emergency (ratio > 10500, >5%): quadratic from 200bp, capped at MAX_FEE (500000 = 50%)
- Rebalancing swaps on imbalanced pools -> 0bp (incentivize recovery)

**Cross-chain contagion shield** (Phase 4):
- `AlertReceiver.sol` stores per-token cross-chain imbalance ratios from Reactive Network callbacks
- `DepegShieldHook` constructor takes `(IPoolManager, address alertReceiver)` -- address(0) disables
- Fee floor: `effectiveFee = max(localFee, FeeCurve.calculateFee(crossChainRatio))` -- same curve, earlier activation
- Rebalancing swaps stay 0bp regardless of cross-chain signals
- `ReactiveMonitor.sol` runs on Reactive Lasna, subscribes to V2/V3/V4 pool events, relays raw ratio

**Pool requirement:** Must initialize with `LPFeeLibrary.DYNAMIC_FEE_FLAG` (0x800000) in `PoolKey.fee`.

**Fee units:** Hundredths of a bip (100 = 1bp, 5000 = 50bp, 1000000 = 100%).

## Test Infrastructure

Tests use a custom `BaseTest` -> `Deployers` chain that deploys the full v4 stack (PoolManager, PositionManager, Permit2, Router). Hook is deployed via `deployCodeTo()` at a flag-encoded address (`BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG`). The `swapRouter` helper handles token approvals and swap execution.

## Key Configuration

- **Solidity:** 0.8.30, cancun EVM, FFI enabled
- **Dependencies** are git submodules in `contracts/lib/` (forge-std, uniswap-hooks, hookmate, reactive-lib)
- **Remappings:** `@uniswap/v4-core/` and `@uniswap/v4-periphery/` resolve through `contracts/lib/uniswap-hooks/lib/`
- **Frontend:** Next.js 14+ (App Router), Tailwind CSS, viem + wagmi, RainbowKit, Recharts

## Implementation Plan

See `PLAN.md` for phased implementation spec. All 4 phases are complete. Phase 4 added Reactive Network cross-chain early warning (AlertReceiver, ReactiveMonitor, hook fee floor via same curve).

## Testnet Deployment Guide

Deployment order matters. Scripts are in `contracts/script/` numbered 01-05.

### Step 1: Deploy Mock Tokens (01_DeployTokens.s.sol)
Uses CREATE2 so addresses are the same on all chains. Run on each chain.
```bash
forge script script/01_DeployTokens.s.sol --rpc-url <RPC> --broadcast
```
- mUSDC: `0x58C414Bd85bf1d39985476Dfa5fBd59af356E8f0`
- mUSDT: `0x2170d1eC7B1392611323A4c1793e580349CC5CC0`
- **Token ordering:** mUSDT < mUSDC, so currency0 = mUSDT, currency1 = mUSDC

### Step 2: Deploy AlertReceiver (02_DeployAlertReceiver.s.sol)
Run on each destination chain. Constructor takes the chain's callback proxy address.
```bash
CALLBACK_PROXY=<proxy_addr> forge script script/02_DeployAlertReceiver.s.sol --rpc-url <RPC> --broadcast
```
Callback proxy addresses (Reactive Network infrastructure):
- Sepolia: `0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA`
- Base Sepolia: `0xa6eA49Ed671B8a4dfCDd34E36b7a75Ac79B8A5a6`
- Unichain Sepolia: `0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4`

### Step 3: Deploy Hook (03_DeployHook.s.sol)
Run on each chain. Needs AlertReceiver address from step 2.
```bash
ALERT_RECEIVER=<addr> forge script script/03_DeployHook.s.sol --rpc-url <RPC> --broadcast
```

### Step 4: Create Pool + Seed Liquidity (04_CreatePool.s.sol)
Run on each chain. Needs hook address from step 3.
```bash
HOOK=<addr> forge script script/04_CreatePool.s.sol --rpc-url <RPC> --broadcast
```

### Step 5: Deploy ReactiveMonitor on Reactive Lasna

**CRITICAL: Reactive Network has dual-state (RNK + ReactVM). They share bytecode but NOT storage. Only the constructor runs in both environments. Any state needed by `react()` (which runs in ReactVM) MUST be set in the constructor. Post-deploy external calls like `addMonitoredPool()` only write to RNK state and will cause "Unknown pool" errors in ReactVM.**

**CRITICAL: `forge create` times out on Reactive Lasna. Use `cast send --create` instead.**

```bash
# 1. Get bytecode
BYTECODE=\$(forge inspect src/reactive/ReactiveMonitor.sol:ReactiveMonitor bytecode)

# 2. Encode constructor args: PoolConfig[] and DestConfig[]
ARGS=\$(cast abi-encode "constructor((uint256,address,bytes32,uint8,bytes32)[],(uint256,address)[])" \
  "[(chainId,poolManagerAddr,pairId,poolType,poolId),...]" \
  "[(chainId,alertReceiverAddr),...]")

# 3. Deploy (concat bytecode + args without 0x prefix)
cast send --rpc-url https://lasna-rpc.rnk.dev/ --private-key \$PK \
  --legacy --value 0.1ether --gas-limit 3000000 \
  --create "\${BYTECODE}\${ARGS#0x}"
```

- PoolType enum: 0 = UNISWAP_V4, 1 = UNISWAP_V3, 2 = UNISWAP_V2
- poolId: only for V4 pools (the PoolKey hash). For V3/V2, use bytes32(0).
- pairId: owner-assigned label, e.g. `keccak256("USDC/USDT")`. Must be consistent across all chains.
- `--value 0.1ether` funds the REACT subscription balance
- `--legacy` required for Reactive Lasna (no EIP-1559)

See `script/05_DeployReactive.s.sol` for the current pool/destination config values.

### Step 6: Fund Callback Proxies
Each destination chain's callback proxy must be funded for the ReactiveMonitor address:
```bash
cast send --rpc-url <dest_chain_rpc> --private-key \$PK \
  <callback_proxy_addr> "depositTo(address)" <reactive_monitor_addr> --value 0.001ether
```
Do this for all 3 destination chains (Sepolia, Base Sepolia, Unichain Sepolia).

### Step 7: Register Pairs on AlertReceivers
Each AlertReceiver needs local token addresses mapped to the pairId:
```bash
cast send --rpc-url <chain_rpc> --private-key \$PK \
  <alert_receiver_addr> "registerPair(bytes32,address,address)" \
  <pairId> <localToken0> <localToken1>
```

### Step 8: Trigger and Verify
Do a swap on any chain to trigger a V4 Swap event. The ReactiveMonitor should:
1. Detect the event on Reactive Lasna
2. Decode the imbalance ratio
3. Emit Callback events to other chains' AlertReceivers
4. Callback proxies deliver to AlertReceivers
5. AlertReceivers store the alert
6. Hooks on other chains read the cross-chain ratio as fee floor

Check reactscan: `https://lasna.reactscan.net/address/<deployer>/contract/<monitor_addr>`
