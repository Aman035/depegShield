<p align="center">
  <img src="assets/banner.png" alt="DepegShield - The first Uniswap v4 hook that shields LPs across every chain" width="100%" />
</p>

<p align="center">
  <a href="https://depeg-shield.vercel.app/"><strong>Live Demo</strong></a>
</p>

---

## The Problem

Stablecoin pools on Uniswap v3/v4 have a structural flaw: **LPs absorb catastrophic risk during depeg events and receive near-zero compensation for it.**

Three properties of concentrated liquidity combine to create this:

**1. Concentration amplifies exposure.**

LPs in stablecoin pools concentrate liquidity in tight ranges around the 1:1 peg, typically [0.998, 1.002]. This is what makes stablecoin DEX trading viable: near-zero slippage on large swaps. But it also means that when selling pressure pushes the price through an LP's range, their entire position converts to the depegging asset. An LP who started with a balanced 50/50 split ends up holding 100% of whatever token the market is running from.

**2. The AMM sells the good asset at the worst possible time.**

As the pool price drops tick by tick during a depeg, the AMM mechanically sells the LP's "safe" token to incoming panic sellers at near-par rates, replacing it with the asset under stress. Informed traders extract the scarce token at prices that don't reflect the actual risk. LPs are on the wrong side of an information asymmetry enforced by the protocol itself.

**3. Fees are completely disconnected from risk.**

A flat 1bp fee applies regardless of market conditions:

<p align="center">
  <img src="assets/fee_comparison.svg" alt="Same $5M swap earns LPs $500 in both a balanced pool and an active depeg -- same fee, wildly different risk" width="680" />
</p>

The LP earns \$500 in both cases. In the second case, they've absorbed \$5M of a potentially collapsing asset. That's not a fee. It's a rounding error on the risk they're taking.

**4. Depegs propagate cross-chain; pools are blind to it.**

Stablecoins trade on dozens of chains simultaneously. A depeg shows up first on the highest-volume pools -- typically Ethereum mainnet -- where the deepest liquidity means informed sellers hit first. Pools on other chains (Base, Arbitrum, etc.) have zero visibility into what's happening elsewhere. Their local reserves still look perfectly balanced.

Cross-chain arbitrageurs exploit this information lag. They bridge the depegging token to a chain where the pool hasn't reacted yet, extract the paired "safe" token at near-par prices, and exit before the local pool has any signal. Each chain's pool is independently blind, creating a cascading extraction pattern where arbs drain one chain after another in sequence.

This is not hypothetical. During the SVB/USDC event in March 2023, DEX pools on L2s were still trading USDC near par while Ethereum mainnet pools were already in crisis at \$0.87. The information lag between chains was free money for anyone fast enough to bridge.

**The result:** LPs in stablecoin pools are involuntary insurance underwriters with no information edge. They provide exit liquidity to panicking traders and cross-chain arbitrageurs at the exact moment they face maximum downside, compensated with effectively nothing. The expected value of providing liquidity through a depeg event is negative.

---

## The Solution

DepegShield is a Uniswap v4 hook that makes stablecoin pool fees **responsive to risk**.

1. **Dynamic fees** - The hook reads the pool's reserves every swap and computes an imbalance ratio (`max(reserveA, reserveB) / min(reserveA, reserveB)`). Fees scale with this ratio across 5 progressive zones: 1bp when balanced, ramping through linear drift and quadratic stress/crisis zones, up to 200bp+ in emergency with a 50% hard cap.
2. **Directional fees** - Only swaps that worsen the imbalance pay escalated fees. Swaps that rebalance the pool pay zero fees, creating a self-correcting arbitrage incentive that pulls the pool back to health.
3. **Cross-chain early warning** - A [Reactive Network](https://reactive.network/) smart contract subscribes to swap events on stablecoin pools across other chains (Ethereum, Base, Arbitrum, etc.). When it detects sustained imbalance building up elsewhere, it sends a cross-chain callback that preemptively tightens the local pool's fee curve, so LPs are protected before arbitrageurs bridge over to exploit the price lag. Deployable on any chain.

Three mechanisms work together:

### 1. Measure Pool Health in Real Time

Every swap, the hook reads the pool's own on-chain state and computes an **imbalance ratio**: how lopsided the reserves are.

```
reserve₀ = L × 2⁹⁶ / sqrtPriceX96
reserve₁ = L × sqrtPriceX96 / 2⁹⁶

imbalanceRatio = max(reserve₀, reserve₁) / min(reserve₀, reserve₁)
```

No oracles. No external data feeds. Just the pool's own `sqrtPriceX96` and `liquidity` from the PoolManager. The ratio tells you exactly how stressed the pool is:

| Pool State | Reserve Split    | Ratio  | Depeg | What It Means                                   |
| ---------- | ---------------- | ------ | ----- | ----------------------------------------------- |
| Balanced   | 10M / 10M        | 1.000x | 0%    | Healthy. Normal trading.                        |
| Drifting   | 10.025M / 9.975M | 1.005x | 0.5%  | Minor tilt. Could be normal volume fluctuation. |
| Stressed   | 10.1M / 9.9M     | 1.01x  | 1.0%  | Directional pressure building. Early warning.   |
| Crisis     | 10.3M / 9.7M     | 1.03x  | 3.0%  | Significant selling. Something's wrong.         |
| Emergency  | 10.5M / 9.5M     | 1.05x  | 5.0%  | Active depeg event. Circuit breaker engaged.    |

**How this helps LPs:** The pool now has a real-time risk signal. Instead of treating a \$5M panic swap the same as a \$5M routine swap, the hook knows the difference.

### 2. Charge Fees Based on Direction

This is the core insight. The fee is **asymmetric**: it depends on whether the swap is making the pool healthier or sicker.

<p align="center">
  <img src="assets/directional_fees.svg" alt="Directional fee comparison: balanced pool charges 1bp both ways, imbalanced pool charges 50-200bp+ for worsening swaps and 0bp for rebalancing swaps" width="680" />
</p>

If the pool is already heavy on tokenA and you're dumping more tokenA into it, you're extracting the scarce token during a crisis. You pay an elevated fee.

If you're bringing tokenB back (the token the pool is running low on), you're helping it recover. You pay **zero fees**. Free.

**How this helps LPs:**

- LPs earn 50-200x more fees on the exact swaps that put them at greatest risk.
- Zero-fee rebalancing turns every imbalanced state into an arbitrage opportunity. Anyone can profit by bringing the scarce token back, and the more stressed the pool is, the stronger that incentive becomes. The pool actively pulls itself back to health.
- Panic sellers can still exit, but they pay a premium that reflects the real cost they impose on LPs.

The fee escalates across five progressive zones calibrated to real stablecoin depeg thresholds:

<p align="center">
  <img src="assets/fee_curve.svg" alt="5-zone adaptive fee curve: Stable (1bp), Drift (1-5bp linear), Stress (5-50bp quadratic), Crisis (50-200bp quadratic), Emergency (200bp+ capped at 50%)" width="680" />
</p>

Capped at 50% (safety maximum). The curve is value-continuous at all zone boundaries (no fee jumps). Zone thresholds are calibrated to real events: USDT 2022 dipped ~0.5%, USDC/SVB dipped ~13%, UST collapsed 90%+.

### 3. Detect Cross-Chain Depegs Before They Arrive

Depeg events don't start on one chain. When a stablecoin loses its peg, higher-volume pools elsewhere typically reflect it first. A DepegShield-protected pool on any chain might still look perfectly healthy while pools on other chains are already in crisis. Cross-chain arbitrageurs exploit this window: they bridge the depegging token over and extract the paired token at near-par rates before the local pool has any signal that something is wrong.

DepegShield closes this gap using [Reactive Network](https://reactive.network/), a decentralized cross-chain event monitoring system.

<p align="center">
  <img src="assets/depeg_crosschain_flow.svg" alt="Cross-chain contagion shield flow: source chains emit swap events to ReactiveMonitor on Reactive Network, which sends callbacks to AlertReceivers on protected chains, activating DepegShield fee floors" width="680" />
</p>

- **ReactiveMonitor** (Reactive Network) - Subscribes to swap events on stablecoin pools across any supported chain. Tracks cumulative sell pressure over a rolling window. When imbalance crosses a configurable threshold, it fires a cross-chain callback to the protected pool's chain.
- **AlertReceiver** (deployed alongside the hook) - Receives callbacks and stores alert state. Alerts persist until the source pool recovers (ratio returns to balanced), ensuring continuous protection during ongoing depegs.
- **DepegShieldHook** reads the alert state in `beforeSwap`. When an alert is active, the hook multiplies its fee curve by a severity factor. Even a locally-balanced pool charges elevated fees if a cross-chain depeg is underway.

No off-chain bots. No centralized keepers. Fully on-chain. The source chains to monitor and the alert thresholds are configurable per deployment.

**How this helps LPs:** The #1 way LPs get hurt is information asymmetry: someone knows the token is depegging, the LP doesn't. Cross-chain alerts close that gap. LPs are protected before the first arbitrageur even arrives.

### Hook Flow

The full decision path for every swap, from initiation to fee override:

<p align="center">
  <img src="assets/hook_flow.svg" alt="Hook flow: swap initiated, beforeSwap reads pool state, computes reserves and ratio, checks cross-chain alerts, branches on swap direction (rebalancing = 0bp, worsening = FeeCurve), returns fee override, afterSwap emits event" width="400" />
</p>

---

## Simulations: Real Depeg Events

Each simulation uses a stablecoin pool with equal reserves and models the actual sell pressure observed in historical events. We compare total LP fees earned and net LP outcome under a standard flat-fee pool vs a DepegShield-protected pool. Numbers below are from on-chain Foundry simulations (`test/DepegScenario.t.sol`).

### 1. SVB / USDC Depeg | March 2023 | Recovery in 48h

Circle disclosed \$3.3B in reserves at the failed Silicon Valley Bank. USDC dropped to \$0.87 (~13% depeg). On Aave, 3,400 positions were liquidated (\$24M, 86% in USDC). The peg recovered in 48 hours after the FDIC backstopped depositors.

**Modeled scenario:** Gradual sell pressure over 48h pushes the pool to ~13% depeg (ratio 1.15x, Zone 5 Emergency). Then arbitrageurs rebalance as peg recovers.
| Wave | Pool Ratio After | Zone | Standard Fee | DepegShield Fee |
| ------------ | ---------------- | --------- | ------------ | --------------- |
| Early sells | 1.03x (3% depeg) | Stress | 1bp | 1bp |
| Panic builds | 1.07x (7% depeg) | Emergency | 1bp | ~50bp |
| Peak crisis | 1.12x (11% depeg) | Emergency | 1bp | ~208bp |
| Late sellers | 1.15x (13% depeg) | Emergency | 1bp | ~287bp |
| Recovery | ~1.03x (recovered) | -- | 1bp | 0bp (free) |

|                            | Standard Pool  | DepegShield Pool       |
| -------------------------- | -------------- | ---------------------- |
| Crisis fees earned         | baseline       | **65x more**           |
| Recovery fees              | 1bp            | 0bp (free rebalancing) |
| LP position after recovery | Back to ~50/50 | Back to ~50/50         |

The peg recovered. Both sets of LPs broke even on their positions. The difference: DepegShield LPs earned **65x more fees** for bearing the same 48 hours of existential risk. Zero-fee rebalancing also means recovery flow arrives faster since arbitrageurs face no friction when bringing back the scarce token.

---

### 2. USDT Whale Attack | June 2023 | Quick Recovery

A single entity dumped 31.5M USDT across DEX pools in a coordinated sell. USDT depegged to \$0.997. Over \$120M in sell pressure was absorbed at flat fees. Recovery within hours.

**Modeled scenario:** Whale dump hits the pool in 4 tranches, pushing it to ~4% pool tilt (ratio 1.04x, Zone 4 Crisis). Individual DEX pools tilted more than the aggregate market price suggests. Pool recovers within hours.
| Wave | Pool Ratio After | Zone | Standard Fee | DepegShield Fee |
| ---------- | ------------------ | ------- | ------------ | --------------- |
| Tranche 1 | 1.01x (1% tilt) | Stress | 1bp | 1bp |
| Tranche 2 | 1.02x (2% tilt) | Stress | 1bp | ~5bp |
| Tranche 3 | 1.03x (3% tilt) | Crisis | 1bp | ~16bp |
| Tranche 4 | 1.04x (4% tilt) | Crisis | 1bp | ~50bp |
| Recovery | ~1.01x (recovered) | -- | 1bp | 0bp (free) |

|                            | Standard Pool  | DepegShield Pool |
| -------------------------- | -------------- | ---------------- |
| Attack fees earned         | baseline       | **18x more**     |
| Recovery fees              | 1bp            | 0bp (free)       |
| LP position after recovery | Back to ~50/50 | Back to ~50/50   |
| **Cost to attacker**       | baseline       | **18x more**     |

This is where DepegShield doubles as an anti-manipulation mechanism. The fee curve makes pool manipulation at scale economically prohibitive: the whale pays 18x more in fees, all of which goes to LPs.

---

### 3. UST/LUNA Collapse | May 2022 | No Recovery

UST lost its algorithmic peg and collapsed to \$0. Over \$50B in market cap was destroyed. LPs in UST pairs suffered total loss as positions converted entirely to a worthless token.

**Modeled scenario:** Escalating panic over 72 hours, each wave bigger than the last. Token never recovers.
| Wave | Pool Ratio After | Zone | Standard Fee | DepegShield Fee |
| ------------- | -------------------- | --------- | ------------ | ---------------- |
| Initial panic | 1.10x (10% depeg) | Emergency | 1bp | 1bp |
| Cascade sell | 1.55x (36% depeg) | Emergency | 1bp | ~254bp |
| Death spiral | 2.23x (67% depeg) | Emergency | 1bp | 5000bp (50% cap) |
| Final drain | 3.98x (87% depeg) | Emergency | 1bp | 5000bp (50% cap) |

|                            | Standard Pool | DepegShield Pool   |
| -------------------------- | ------------- | ------------------ |
| Total crisis fees earned   | baseline      | **4,314x more**    |
| LP position value (at \$0) | \$0           | \$0                |
| Average effective fee rate | 1bp           | ~4,314bp (43% avg) |

DepegShield cannot save LPs from a total collapse. But it extracts **4,314x more fees** from the panic sellers who drained the pool. In a standard pool, LPs earned virtually nothing for absorbing a token going to zero. Under DepegShield, crisis fees provide meaningful partial compensation for impermanent loss.

**[Moody's tracked 1,900+ depeg events through mid-2023](https://www.theblock.co/post/261727/large-cap-stablecoins-have-depegged-609-times-this-year-moodys-analytics-says), and they haven't stopped.** In October 2025, [\$3.8B in stablecoin value swung off parity](https://www.coingecko.com/learn/october-10-crypto-crash-explained) during a single flash crash that liquidated 1.6M traders. Across all three scenarios above, the pattern is the same: DepegShield LPs earn 18-4,314x more than standard pool LPs for bearing identical risk. In recovery scenarios, that's pure profit. In loss scenarios, it's meaningful damage offset.

---

## Theoretical Foundation

The mechanism design draws directly from three areas of academic research on stablecoin stability.

### Coordination Game Model

Ahmed, Aldasoro & Duley (BIS Working Paper No. 1164, 2025) model stablecoin stability as a **coordination game** in the tradition of Diamond-Dybvig bank run theory. Each holder decides whether to redeem based on a private signal about fundamentals and their expectation of what others will do. The paper establishes that a critical threshold exists: below it, all holders maintain confidence; above it, a self-fulfilling run occurs. Crucially, this threshold is a function of transaction costs.

**How DepegShield applies this:** By making transaction costs (swap fees) responsive to crisis severity, DepegShield dynamically raises the run threshold. A stronger fundamental shock is required to trigger a run. Temporary depegs that would previously cross the threshold now resolve below it. The hook is, in effect, an on-chain implementation of the paper's theoretical prescription for run prevention.

> Paper: [Public Information and Stablecoin Runs](https://www.bis.org/publ/work1164.pdf)

### Target Zone Model

Hui, Wong & Lo (Journal of International Money and Finance, 2025) apply the **Krugman target zone model** from currency board theory to analyze stablecoin price dynamics. Their central finding is that price stability improves proportionally to the strength of the mean-reverting force acting on the peg.

**How DepegShield applies this:** The fee curve _is_ the mean-reverting force. As the pool's imbalance ratio drifts from parity, increasing fees resist further deviation by making outflows progressively more expensive while simultaneously making corrective inflows cheaper. The asymmetric fee structure creates exactly the kind of directional restoring force the target zone model identifies as stabilizing. The three-zone design (safe, warning, circuit breaker) maps to increasing intervention intensity as deviation grows.

> Paper: [Stablecoin price dynamics under a peg-stabilising mechanism](https://www.sciencedirect.com/science/article/abs/pii/S0261560625000154). _Journal of International Money and Finance_, 2025.

### Large Sales Attack Vector

Zhu (arXiv:2408.07227, 2024) decomposes stablecoin run risk into two components: (1) coordinated small redemptions driven by poor perceived collateral quality, and (2) **large speculative sales** by individual actors that destabilize markets independently of fundamentals.

**How DepegShield applies this:** The exponential fee curve in the circuit breaker zone directly targets the large sales vector. The June 2023 whale attack, where a single entity dumped 31.5M USDT across DEX pools, would have cost exponentially more under DepegShield. Each successive unit of a large dump pushes the imbalance ratio further into the circuit breaker zone, where fees grow exponentially. Pool manipulation at scale becomes economically prohibitive rather than trivially cheap.

> Paper: [Stablecoin Runs and Disclosure Policy in the Presence of Large Sales](https://arxiv.org/abs/2408.07227)

---

## Project Structure

```
depegShield/
├── contracts/                    # Foundry project
│   ├── src/
│   │   ├── DepegShieldHook.sol   # Core hook: beforeSwap fee logic, afterSwap events
│   │   ├── FeeCurve.sol          # 5-zone fee curve library
│   │   ├── AlertReceiver.sol     # Cross-chain alert storage (per destination chain)
│   │   ├── MockStablecoin.sol    # Free-mint ERC20 for testnet demos
│   │   ├── interfaces/
│   │   │   └── IAlertReceiver.sol
│   │   └── reactive/
│   │       └── ReactiveMonitor.sol  # Reactive Network cross-chain monitor
│   ├── test/
│   │   ├── DepegShieldHook.t.sol # Hook behavior tests
│   │   ├── FeeCurve.t.sol        # Fee curve unit + fuzz tests
│   │   ├── DepegScenario.t.sol   # Depeg simulation scenarios
│   │   ├── AlertReceiver.t.sol   # Alert receiver + pair registry tests
│   │   └── CrossChainFee.t.sol   # Cross-chain fee floor tests
│   └── script/
│       ├── 01_DeployTokens.s.sol        # Deploy mUSDC + mUSDT via CREATE2
│       ├── 02_DeployAlertReceiver.s.sol  # Deploy AlertReceiver + register pair
│       ├── 03_DeployHook.s.sol           # Mine salt + deploy hook (CREATE2)
│       ├── 04_CreatePool.s.sol           # Init pool at 1:1 + seed liquidity
│       └── 05_DeployReactive.s.sol       # ReactiveMonitor config reference
│
├── frontend/                     # Next.js app
│   └── src/
│       ├── app/                  # Landing page + Explore page
│       ├── components/           # FeeCurveChart, SimulationReplay, PoolHealthGauge, CrossChainAlert
│       └── lib/                  # Fee curve math, simulation data
```

---

## Setup Guide

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (run `foundryup` to install or update)
- [Node.js](https://nodejs.org/) 20+
- Git

### Installation

```bash
git clone https://github.com/aman035/depegShield.git
cd depegShield
git submodule update --init --recursive
```

### Contracts

```bash
cd contracts
forge build
forge test -vv
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Deploy

Deployment uses 5 isolated scripts, run in order per chain. Each script is self-contained with its own env vars.

```bash
cd contracts
cp .env.example .env    # Fill in PRIVATE_KEY, fund the wallet on target chains
source .env

# Step 1: Deploy mock tokens (once per chain, deterministic addresses via CREATE2)
forge script script/01_DeployTokens.s.sol --rpc-url <RPC_URL> --private-key "\$PRIVATE_KEY" --broadcast

# Step 2: Deploy AlertReceiver + register mUSDC/mUSDT pair
# CALLBACK_PROXY varies per chain (see script comments for addresses)
CALLBACK_PROXY=0x... forge script script/02_DeployAlertReceiver.s.sol --rpc-url <RPC_URL> --private-key "\$PRIVATE_KEY" --broadcast

# Step 3: Deploy DepegShieldHook (mines CREATE2 salt for flag-encoded address)
ALERT_RECEIVER=0x... forge script script/03_DeployHook.s.sol --rpc-url <RPC_URL> --private-key "\$PRIVATE_KEY" --broadcast

# Step 4: Create pool at 1:1 price + seed 100K liquidity per side
HOOK=0x... forge script script/04_CreatePool.s.sol --rpc-url <RPC_URL> --private-key "\$PRIVATE_KEY" --broadcast

# Step 5: Deploy ReactiveMonitor on Reactive Lasna
# All pool/destination config MUST be in the constructor because the ReactVM
# creates an isolated state copy at deploy time. Post-deploy calls only
# affect the RNK chain state, not the ReactVM.
# See 05_DeployReactive.s.sol for the full constructor args with all 3 chains.
#
# Use cast send --create (forge create may time out on Reactive Lasna):
BYTECODE=\$(forge inspect src/reactive/ReactiveMonitor.sol:ReactiveMonitor bytecode)
ARGS=\$(cast abi-encode "c((uint256,address,bytes32,uint8,bytes32)[],(uint256,address)[])" \
  "[(chainId,poolManager,pairId,poolType,poolId),...]" \
  "[(chainId,alertReceiver),...]")
cast send --rpc-url https://lasna-rpc.rnk.dev/ --private-key "\$PRIVATE_KEY" \
  --legacy --value 0.1ether --gas-limit 3000000 \
  --create "\${BYTECODE}\${ARGS#0x}"

# After deployment, fund the callback proxies on each destination chain:
#   cast send <CALLBACK_PROXY> "depositTo(address)" <MONITOR_ADDR> --value 0.01ether
```

---

## Testnet Deployments

All contracts are verified on their respective block explorers.

### Mock Tokens (same address on all chains via CREATE2)

| Token | Address                                                                                                                         | Decimals |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| mUSDC | [`0x58C414Bd85bf1d39985476Dfa5fBd59af356E8f0`](https://sepolia.etherscan.io/address/0x58C414Bd85bf1d39985476Dfa5fBd59af356E8f0) | 6        |
| mUSDT | [`0x2170d1eC7B1392611323A4c1793e580349CC5CC0`](https://sepolia.etherscan.io/address/0x2170d1eC7B1392611323A4c1793e580349CC5CC0) | 6        |

Both have a public `mint(address, uint256)` function for testing.

### Sepolia (Chain ID: 11155111)

| Contract        | Address                                      | Explorer                                                                                |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| DepegShieldHook | `0xEDfFdabADd4263836403BF0D5F92a613Fc9f00C0` | [View](https://sepolia.etherscan.io/address/0xEDfFdabADd4263836403BF0D5F92a613Fc9f00C0) |
| AlertReceiver   | `0x6bFe889e87A51634194B9447201548BEc8D825C3` | [View](https://sepolia.etherscan.io/address/0x6bFe889e87A51634194B9447201548BEc8D825C3) |

### Base Sepolia (Chain ID: 84532)

| Contract        | Address                                      | Explorer                                                                                |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| DepegShieldHook | `0xf8Fd12C76C606cA9bc3dAdeE9706B4357e6780c0` | [View](https://sepolia.basescan.org/address/0xf8Fd12C76C606cA9bc3dAdeE9706B4357e6780c0) |
| AlertReceiver   | `0x92a8497C788d43572Fe29f144E6FF015AE3Ff22d` | [View](https://sepolia.basescan.org/address/0x92a8497C788d43572Fe29f144E6FF015AE3Ff22d) |

### Unichain Sepolia (Chain ID: 1301)

| Contract        | Address                                      | Explorer                                                                               |
| --------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| DepegShieldHook | `0x05e5c38f6ca3e76c30145eb73f1128B7749140C0` | [View](https://sepolia.uniscan.xyz/address/0x05e5c38f6ca3e76c30145eb73f1128B7749140C0) |
| AlertReceiver   | `0xfe8BA3Fa183C98d637fd549f579670b3cB63b199` | [View](https://sepolia.uniscan.xyz/address/0xfe8BA3Fa183C98d637fd549f579670b3cB63b199) |

### Reactive Lasna (Chain ID: 5318007)

| Contract        | Address                                      | Explorer                                                                                                                                   |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ReactiveMonitor | `0xfa5eeb94A58e5E83451C90E0915705E2d3a8EBA1` | [View](https://lasna.reactscan.net/address/0xf30180b9cec36f5a3762332c0f102fe8c024d64e/contract/0xfa5eeb94A58e5E83451C90E0915705E2d3a8EBA1) |

### Pool Configuration (Mock Stablecoin Pools)

| Parameter         | Value                                |
| ----------------- | ------------------------------------ |
| fee               | `0x800000` (DYNAMIC_FEE_FLAG)        |
| tickSpacing       | 10                                   |
| LP range          | +/- 1000 ticks (~+/-10% price range) |
| Initial price     | 1:1 (sqrtPriceX96 = 2^96)            |
| Initial liquidity | 100K per side                        |

Mock tokens have a public `mint(address, uint256)` function for testing.
