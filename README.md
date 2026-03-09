# DepegShield

### Risk-Responsive Fee Hook for Stablecoin Pools

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
  - [Measure Pool Health in Real Time](#1-measure-pool-health-in-real-time)
  - [Charge Fees Based on Direction](#2-charge-fees-based-on-direction)
  - [Detect Cross-Chain Depegs Before They Arrive](#3-detect-cross-chain-depegs-before-they-arrive)
- [Simulations: Real Depeg Events](#simulations-real-depeg-events)
  - [UST/LUNA Collapse (No Recovery)](#1-ustluna-collapse--may-2022--no-recovery)
  - [SVB / USDC Depeg (Recovery in 48h)](#2-svb--usdc-depeg--march-2023--recovery-in-48h)
  - [USDT Whale Attack (Quick Recovery)](#3-usdt-whale-attack--june-2023--quick-recovery)
- [Theoretical Foundation](#theoretical-foundation)
- [Project Structure](#project-structure)
- [Setup Guide](#setup-guide)

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

```
  Normal \$5M swap in a balanced pool:     1bp  -->  \$500 fee to LPs
  Panic  \$5M swap during active depeg:    1bp  -->  \$500 fee to LPs
                                                     ↑
                                            Same fee. Wildly different risk.
```

The LP earns \$500 in both cases. In the second case, they've absorbed \$5M of a potentially collapsing asset. That's not a fee. It's a rounding error on the risk they're taking.

**The result:** LPs in stablecoin pools are involuntary insurance underwriters. They provide exit liquidity to panicking traders at the exact moment they face maximum downside, and they're compensated with effectively nothing. The expected value of providing liquidity through a depeg event is negative.

---

## The Solution

DepegShield is a Uniswap v4 hook that makes stablecoin pool fees **responsive to risk**.

1. **Dynamic fees** - The hook reads the pool's reserves every swap and computes an imbalance ratio (`max(reserveA, reserveB) / min(reserveA, reserveB)`). Fees scale with this ratio: 1bp when balanced, escalating through a quadratic warning zone to an exponential circuit breaker that can reach 200bp+ at extreme imbalance.
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

| Pool State  | Reserve Split | Ratio | What It Means                                     |
| ----------- | ------------- | ----- | ------------------------------------------------- |
| Balanced    | 10M / 10M     | 1.00  | Healthy. Normal trading.                          |
| Minor drift | 11M / 9M      | 1.22  | Slight tilt. Could be normal volume fluctuation.  |
| Tilting     | 12M / 8M      | 1.50  | Directional pressure building. Caution.           |
| Stressed    | 14M / 6M      | 2.33  | Significant one-sided selling. Something's wrong. |
| Critical    | 16M / 4M      | 4.00  | Pool is being drained. Active crisis.             |

**How this helps LPs:** The pool now has a real-time risk signal. Instead of treating a \$5M panic swap the same as a \$5M routine swap, the hook knows the difference.

### 2. Charge Fees Based on Direction

This is the core insight. The fee is **asymmetric**: it depends on whether the swap is making the pool healthier or sicker.

```
             Balanced Pool                    Imbalanced Pool (65/35 split)
          ┌─────────────────┐              ┌──────────────────────────────────┐
          │                 │              │                                  │
 tokenA → │    1bp fee      │    tokenA →  │  50-200bp+ fee (worsening)       │
          │                 │              │                                  │
 tokenB → │    1bp fee      │    tokenB →  │  0bp fee (rebalancing)           │
          │                 │              │                                  │
          └─────────────────┘              └──────────────────────────────────┘
```

If the pool is already heavy on tokenA and you're dumping more tokenA into it, you're extracting the scarce token during a crisis. You pay an elevated fee.

If you're bringing tokenB back (the token the pool is running low on), you're helping it recover. You pay **zero fees**. Free.

**How this helps LPs:**

- LPs earn 50-200x more fees on the exact swaps that put them at greatest risk.
- Zero-fee rebalancing turns every imbalanced state into an arbitrage opportunity. Anyone can profit by bringing the scarce token back, and the more stressed the pool is, the stronger that incentive becomes. The pool actively pulls itself back to health.
- Panic sellers can still exit, but they pay a premium that reflects the real cost they impose on LPs.

The fee escalates across three zones as the pool gets more stressed:

```
                        Fee charged on imbalance-worsening swaps
                        (rebalancing swaps always pay 0bp)

  Fee
  (bps)
    │
200 ┤                                                        ●
    │                                                      ╱
    │                                                    ╱
150 ┤                                                  ╱
    │                                                ╱
    │                                              ╱
100 ┤                                            ╱
    │                                          ╱
    │                                       ╱╱
 50 ┤                                    ╱╱
    │                                ╱╱╱
    │                           ╱╱╱╱
 15 ┤                     ·····
    │                ····
  5 ┤           ····
    │       ···
  1 ┤───────
    │
  0 ┼───────┬──────────────┬─────────────────┬──────────────────
          55/45          60/40              70/30             80/20
            │              │                  │
            │   WARNING    │  CIRCUIT BREAKER │
   SAFE     │  quadratic   │   exponential    │
   1bp      │   5-15bp     │    50-200bp+     │
```

```
fee(r) =
  baseFee                                if r ≤ 1.22    (safe zone)
  baseFee + k₁ × (r - 1.22)²            if 1.22 < r ≤ 1.5  (warning zone)
  baseFee + k₂ × (r - 1.22)ⁿ            if r > 1.5    (circuit breaker)
```

All parameters (`k₁`, `k₂`, `n`, zone boundaries, max cap) are configurable per pool.

### 3. Detect Cross-Chain Depegs Before They Arrive

Depeg events don't start on one chain. When a stablecoin loses its peg, higher-volume pools elsewhere typically reflect it first. A DepegShield-protected pool on any chain might still look perfectly healthy while pools on other chains are already in crisis. Cross-chain arbitrageurs exploit this window: they bridge the depegging token over and extract the paired token at near-par rates before the local pool has any signal that something is wrong.

DepegShield closes this gap using [Reactive Network](https://reactive.network/), a decentralized cross-chain event monitoring system.

```
  Source Chains               Reactive Network              Protected Pool's Chain
 ┌──────────────┐            ┌──────────────────┐          ┌───────────────────┐
 │ Ethereum,    │            │                  │          │                   │
 │ Base,        │  Swap      │ ReactiveMonitor  │ callback │  AlertReceiver    │
 │ Arbitrum,    │──events──▶ │ (RSC)            │────────▶ │       │           │
 │ any chain... │            │ tracks cumulative│          │       ▼           │
 │              │            │ imbalance ratio  │          │  DepegShieldHook  │
 │ pool depeg   │            │                  │          │  fees tightened   │
 │ detected     │            │                  │          │  BEFORE arbs      │
 └──────────────┘            └──────────────────┘          │  arrive           │
                                                           └───────────────────┘
```

- **ReactiveMonitor** (Reactive Network) - Subscribes to swap events on stablecoin pools across any supported chain. Tracks cumulative sell pressure over a rolling window. When imbalance crosses a configurable threshold, it fires a cross-chain callback to the protected pool's chain.
- **AlertReceiver** (deployed alongside the hook) - Receives callbacks and stores alert state with TTL-based expiry. Alerts decay automatically if not refreshed.
- **DepegShieldHook** reads the alert state in `beforeSwap`. When an alert is active, the hook multiplies its fee curve by a severity factor. Even a locally-balanced pool charges elevated fees if a cross-chain depeg is underway.

No off-chain bots. No centralized keepers. Fully on-chain. The source chains to monitor and the alert thresholds are configurable per deployment.

**How this helps LPs:** The #1 way LPs get hurt is information asymmetry: someone knows the token is depegging, the LP doesn't. Cross-chain alerts close that gap. LPs are protected before the first arbitrageur even arrives.

---

## Simulations: Real Depeg Events

Each simulation uses a \$20M stablecoin pool (10M/10M) and models the actual sell pressure observed in historical events. We compare total LP fees earned and net LP outcome under a standard flat-fee pool vs a DepegShield-protected pool.

---

### 1. UST/LUNA Collapse | May 2022 | No Recovery

UST lost its algorithmic peg and collapsed to \$0. Over \$50B in market cap was destroyed. LPs in UST pairs suffered total loss as positions converted entirely to a worthless token.

**Modeled scenario:** \$18M of UST dumped into the pool over 72 hours. Token never recovers. Final price: \$0.

| Wave          | Sell Volume   | Pool State       | Ratio | Standard Fee | DepegShield Fee          |
| ------------- | ------------- | ---------------- | ----- | ------------ | ------------------------ |
| Initial panic | \$3M UST sold | 13M / 7M (65/35) | 1.86  | 1bp = \$300  | ~30bp = \$9,000          |
| Cascade       | \$5M UST sold | 18M / 2M (90/10) | 9.00  | 1bp = \$500  | ~200bp = \$100,000       |
| Final drain   | \$5M UST sold | ~20M / ~0        | max   | 1bp = \$500  | ~200bp (cap) = \$100,000 |
| Trickle       | \$5M UST sold | 20M / 0          | max   | 1bp = \$500  | ~200bp (cap) = \$100,000 |

|                                | Standard Pool    | DepegShield Pool |
| ------------------------------ | ---------------- | ---------------- |
| Crisis fees earned             | \$1,800          | \$309,000        |
| LP position value (UST at \$0) | \$0              | \$0              |
| **Net LP outcome**             | **-\$9,998,200** | **-\$9,691,000** |
| Fees as % of loss              | 0.02%            | 3.1%             |

DepegShield cannot save LPs from a total collapse. But it extracts \$309,000 in fees from the panic sellers who drained the pool. In a standard pool, LPs earned \$1,800 for absorbing \$18M of a token going to zero.

---

### 2. SVB / USDC Depeg | March 2023 | Recovery in 48h

Circle disclosed \$3.3B in reserves at the failed Silicon Valley Bank. USDC dropped to \$0.87. On Aave, 3,400 positions were liquidated (\$24M, 86% in USDC). The peg recovered in 48 hours after the FDIC backstopped depositors.

**Modeled scenario:** \$10M of USDC dumped into the pool over 48 hours, pushing it to 80/20. Then \$8M flows back as peg recovers.

| Wave         | Sell Volume    | Pool State       | Ratio | Standard Fee | DepegShield Fee         |
| ------------ | -------------- | ---------------- | ----- | ------------ | ----------------------- |
| Early sells  | \$2M USDC sold | 12M / 8M (60/40) | 1.50  | 1bp = \$200  | ~15bp = \$3,000         |
| Panic builds | \$3M USDC sold | 15M / 5M (75/25) | 3.00  | 1bp = \$300  | ~100bp = \$30,000       |
| Peak crisis  | \$3M USDC sold | 18M / 2M (90/10) | 9.00  | 1bp = \$300  | ~200bp = \$60,000       |
| Late sellers | \$2M USDC sold | ~20M / ~0        | max   | 1bp = \$200  | ~200bp (cap) = \$40,000 |

|                                 | Standard Pool  | DepegShield Pool             |
| ------------------------------- | -------------- | ---------------------------- |
| Crisis fees earned              | \$1,000        | \$133,000                    |
| Recovery fees (\$8M flows back) | 1bp = \$800    | 0bp = \$0 (free rebalancing) |
| LP position after recovery      | Back to ~50/50 | Back to ~50/50               |
| **Net LP outcome**              | **+\$1,800**   | **+\$133,000**               |

The peg recovered. Both sets of LPs broke even on their positions. The difference: standard pool LPs earned \$1,800 for bearing 48 hours of existential risk. DepegShield LPs earned \$133,000. That's **74x more** for the same risk.

Zero-fee rebalancing also means recovery flow arrives faster since arbitrageurs face no friction when bringing back the scarce token.

---

### 3. USDT Whale Attack | June 2023 | Quick Recovery

A single entity dumped 31.5M USDT across DEX pools in a coordinated sell. USDT depegged to \$0.997. Over \$120M in sell pressure was absorbed at flat fees. Recovery within hours.

**Modeled scenario:** \$8M whale dump hits the pool in a single concentrated burst, pushing it from 50/50 to 80/20. Pool recovers within hours as arbitrageurs rebalance.

| Wave                      | Sell Volume    | Pool State       | Ratio | Standard Fee | DepegShield Fee        |
| ------------------------- | -------------- | ---------------- | ----- | ------------ | ---------------------- |
| Whale dump (single burst) | \$8M USDT sold | 18M / 2M (90/10) | 9.00  | 1bp = \$800  | ~150bp avg = \$120,000 |

|                                 | Standard Pool  | DepegShield Pool |
| ------------------------------- | -------------- | ---------------- |
| Attack fees earned              | \$800          | \$120,000        |
| Recovery fees (\$6M flows back) | 1bp = \$600    | 0bp = \$0        |
| LP position after recovery      | Back to ~50/50 | Back to ~50/50   |
| **Net LP outcome**              | **+\$1,400**   | **+\$120,000**   |
| **Cost to attacker**            | **\$800**      | **\$120,000**    |

This is where DepegShield doubles as an anti-manipulation mechanism. In a standard pool, a whale can tilt \$20M of liquidity for \$800 in fees. Under DepegShield, the same attack costs \$120,000. The exponential fee curve makes pool manipulation at scale economically prohibitive.

---

**[Moody's tracked 1,900+ depeg events through mid-2023](https://www.theblock.co/post/261727/large-cap-stablecoins-have-depegged-609-times-this-year-moodys-analytics-says), and they haven't stopped.** In October 2025, [\$3.8B in stablecoin value swung off parity](https://www.coingecko.com/learn/october-10-crypto-crash-explained) during a single flash crash that liquidated 1.6M traders. Across all three scenarios above, the pattern is the same: DepegShield LPs earn 74-150x more than standard pool LPs for bearing identical risk. In recovery scenarios, that's pure profit. In loss scenarios, it's meaningful damage offset.

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
├── src/
│   └── DepegShieldHook.sol       # Core hook: beforeSwap fee logic, afterSwap events
│                                 #   _getVirtualReserves(), _computeImbalanceRatio()
│                                 #   _doesSwapWorsenImbalance(), view functions
│
├── test/
│   └── DepegShieldHook.t.sol     # Hook behavior tests (fee correctness, directionality)
│
├── script/
    └── 00_DeployHook.s.sol       # CREATE2 deployment with flag-encoded address mining
```

---

## Setup Guide

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (run `foundryup` to install or update)
- Git

### Installation

```bash
git clone https://github.com/aman035/depegShield.git
cd depegShield
forge install
```

### Build

```bash
forge build
```

### Test

```bash
forge test -vv
```

### Deploy

```bash
forge script script/00_DeployHook.s.sol --rpc-url <your-rpc-url> --broadcast
```
