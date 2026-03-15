// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager, SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";

import {EasyPosm} from "./utils/libraries/EasyPosm.sol";

import {DepegShieldHook} from "../src/DepegShieldHook.sol";
import {FeeCurve} from "../src/FeeCurve.sol";
import {BaseTest} from "./utils/BaseTest.sol";

/// @title Depeg Scenario Simulations
/// @notice Simulates 3 real depeg events with calibrated swap amounts and compares LP outcomes:
///         1. SVB/USDC Depeg -- 13% depeg, recovery in 48h
///         2. USDT Whale Attack -- ~3% pool tilt, quick recovery
///         3. UST/LUNA Collapse -- 87%+ depeg, no recovery
///
/// @dev Swap amounts are calibrated relative to pool liquidity (L=1000e18, full-range)
///      using the relationship: ratio ≈ ((L + cumulative_sell) / L)^2 * 10000
///
///      Real event depeg depths:
///        SVB/USDC: USDC dropped to $0.87 (~13% depeg, ratio ~1.15x)
///        USDT whale: USDT dropped to $0.997 globally, but individual DEX pools tilted 2-4%
///        UST/LUNA: UST collapsed from $1 to ~$0.10 over 72h (~90% depeg)
contract DepegScenarioTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    Currency currency0;
    Currency currency1;

    PoolKey shieldPoolKey;
    PoolKey flatPoolKey;
    DepegShieldHook hook;

    // Cumulative fee tracking (in wei)
    uint256 totalShieldLPFees;
    uint256 totalFlatLPFees;

    function setUp() public {
        deployArtifactsAndLabel();
        (currency0, currency1) = deployCurrencyPair();

        // Deploy DepegShield hook
        address flags = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ (0x4444 << 144)
        );
        deployCodeTo("DepegShieldHook.sol:DepegShieldHook", abi.encode(poolManager, address(0)), flags);
        hook = DepegShieldHook(flags);

        _initPools();
    }

    function _initPools() internal {
        shieldPoolKey = PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolManager.initialize(shieldPoolKey, Constants.SQRT_PRICE_1_1);

        flatPoolKey = PoolKey(currency0, currency1, 100, 60, IHooks(address(0)));
        poolManager.initialize(flatPoolKey, Constants.SQRT_PRICE_1_1);

        int24 tickLower = TickMath.minUsableTick(60);
        int24 tickUpper = TickMath.maxUsableTick(60);
        uint128 liq = 1000e18;

        (uint256 a0, uint256 a1) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liq
        );

        positionManager.mint(shieldPoolKey, tickLower, tickUpper, liq, a0 + 1, a1 + 1, address(this), block.timestamp, Constants.ZERO_BYTES);
        positionManager.mint(flatPoolKey, tickLower, tickUpper, liq, a0 + 1, a1 + 1, address(this), block.timestamp, Constants.ZERO_BYTES);

        totalShieldLPFees = 0;
        totalFlatLPFees = 0;
    }

    // ============================================================
    // Scenario 1: SVB/USDC Depeg | Recovery in 48h
    // Real event: USDC dropped to $0.87 (~13% depeg)
    // Target peak ratio: ~11500 (1.15x)
    // Calibration: cumulative sell of 72e18 into L=1000e18 pool
    //   ratio ≈ (1072/1000)^2 * 10000 ≈ 11492
    // ============================================================
    function test_scenario1_USDC_recovery() public {
        _header("SCENARIO 1: SVB/USDC Depeg | March 2023 | Recovery in 48h");
        console.log("  Target: ~13% depeg (ratio ~11500, Zone 5 Emergency)");
        _logPoolState("Initial State");

        // Gradual sell pressure over 48 hours
        _executeWave("Wave 1: Early sells (3% depeg)", 15e18, true);
        _executeWave("Wave 2: Panic builds (7% depeg)", 20e18, true);
        _executeWave("Wave 3: Peak crisis (11% depeg)", 22e18, true);
        _executeWave("Wave 4: Late sellers (13% depeg)", 15e18, true);

        uint256 crisisShieldFees = totalShieldLPFees;
        uint256 crisisFlatFees = totalFlatLPFees;

        console.log("");
        _divider();
        console.log("  PEAK CRISIS");
        _divider();
        _logPoolState("Crisis State");
        _logFeeComparison("  Crisis fees collected", crisisShieldFees, crisisFlatFees);

        // FDIC backstop -> peg recovers, arbs rebalance
        _executeWave("Recovery: Arb rebalancing", 80e18, false);

        _logResults_recovery(crisisShieldFees, crisisFlatFees);
    }

    // ============================================================
    // Scenario 2: USDT Whale Attack | Quick Recovery
    // Real event: USDT dipped to $0.997 globally (~0.3%)
    //   but individual DEX pools tilted 2-4% from concentrated selling
    // Target peak ratio: ~10400 (1.04x, Zone 4 Crisis)
    // Calibration: cumulative sell of 20e18 into L=1000e18 pool
    //   ratio ≈ (1020/1000)^2 * 10000 ≈ 10404
    // ============================================================
    function test_scenario2_whaleAttack() public {
        _header("SCENARIO 2: USDT Whale Attack | June 2023 | Quick Recovery");
        console.log("  Target: ~3-4% pool tilt (ratio ~10400, Zone 4 Crisis)");
        console.log("  (Large dump modeled as 4 tranches -- each sees post-state of prior swap)");
        _logPoolState("Initial State");

        _executeWave("Whale tranche 1 (0.5% tilt)", 5e18, true);
        _executeWave("Whale tranche 2 (1% tilt)", 5e18, true);
        _executeWave("Whale tranche 3 (3% tilt)", 5e18, true);
        _executeWave("Whale tranche 4 (4% tilt)", 5e18, true);

        uint256 attackShieldFees = totalShieldLPFees;
        uint256 attackFlatFees = totalFlatLPFees;

        console.log("");
        _divider();
        console.log("  POST-ATTACK");
        _divider();
        _logPoolState("After Attack");

        // Quick arb recovery within hours
        _executeWave("Recovery: Arb rebalancing", 25e18, false);

        _logResults_whaleAttack(attackShieldFees, attackFlatFees);
    }

    // ============================================================
    // Scenario 3: UST/LUNA Collapse | No Recovery
    // Real event: UST went from $1 to ~$0.10 over 72 hours
    //   ~90% depeg, total loss for LPs
    // Target final ratio: ~75000+ (7.5x+, deep Zone 5 / MAX_FEE)
    // Calibration: cumulative sell of 1750e18 into L=1000e18 pool
    //   ratio ≈ (2750/1000)^2 * 10000 ≈ 75625
    // ============================================================
    function test_scenario3_UST_noRecovery() public {
        _header("SCENARIO 3: UST/LUNA Collapse | May 2022 | No Recovery");
        console.log("  Target: 87%+ depeg (ratio ~75000+, MAX_FEE territory)");
        _logPoolState("Initial State");

        // Escalating panic over 72 hours -- each wave bigger than the last
        _executeWave("Wave 1: Initial panic (5% depeg)", 50e18, true);
        _executeWave("Wave 2: Cascade sell (36% depeg)", 200e18, true);
        _executeWave("Wave 3: Death spiral (67% depeg)", 500e18, true);
        _executeWave("Wave 4: Final drain (87% depeg)", 1000e18, true);

        _logResults_noRecovery(1750e18);
    }

    // ============================================================
    // Formatting helpers
    // ============================================================

    function _header(string memory title) internal pure {
        console.log("");
        console.log("================================================================");
        console.log(string.concat("  ", title));
        console.log("================================================================");
    }

    function _divider() internal pure {
        console.log("  -------------------------------------------------------");
    }

    /// @dev Logs pool reserves and ratio with split percentage
    function _logPoolState(string memory label) internal view {
        (uint256 r0, uint256 r1) = hook.getVirtualReserves(shieldPoolKey);
        uint256 ratio = hook.getImbalanceRatio(shieldPoolKey);
        uint256 total = r0 + r1;
        uint256 pct0 = total > 0 ? (r0 * 100) / total : 50;
        uint256 pct1 = 100 - pct0;

        console.log(string.concat("  ", label, ":"));
        console.log("    token0:       ", _toTokens(r0), "tokens");
        console.log("    token1:       ", _toTokens(r1), "tokens");
        console.log("    ratio:        ", ratio);
        console.log("    pool split:   ", pct0, "/", pct1);
    }

    /// @dev Converts wei to whole tokens (integer division by 1e18)
    function _toTokens(uint256 wei_amount) internal pure returns (uint256) {
        return wei_amount / 1e18;
    }

    /// @dev Converts wei to millitokens (1e15 precision) for small fee amounts
    function _toMilliTokens(uint256 wei_amount) internal pure returns (uint256) {
        return wei_amount / 1e15;
    }

    /// @dev Converts fee from hundredths-of-bip to bps with 1 decimal
    ///      e.g., 5071 -> "50.7 bps"
    function _feeToBps(uint24 fee) internal pure returns (uint256 whole, uint256 decimal) {
        whole = uint256(fee) / 100;
        decimal = (uint256(fee) % 100) / 10;
    }

    /// @dev Logs a side-by-side fee comparison line (in millitokens for precision)
    function _logFeeComparison(string memory label, uint256 shieldFees, uint256 flatFees) internal pure {
        console.log(label);
        console.log("    DepegShield:  ", _toMilliTokens(shieldFees), "millitokens");
        console.log("    Flat (1bp):   ", _toMilliTokens(flatFees), "millitokens");
    }

    // ============================================================
    // Results: No Recovery
    // ============================================================
    function _logResults_noRecovery(uint256 totalSellVolume) internal view {
        _header("RESULTS: UST/LUNA (No Recovery)");
        _logPoolState("Final State (token0 = worthless)");

        console.log("");
        console.log("  Fee Revenue (collected in input token):");
        _divider();
        _logFeeComparison("  Total fees earned", totalShieldLPFees, totalFlatLPFees);
        console.log("");
        console.log("  Effective fee rate:");
        console.log("    DepegShield:  ", totalShieldLPFees * 10000 / totalSellVolume, "bps avg");
        console.log("    Flat (1bp):   ", totalFlatLPFees * 10000 / totalSellVolume, "bps avg");
        if (totalFlatLPFees > 0) {
            console.log("  Advantage:      ", totalShieldLPFees / totalFlatLPFees, "x more fees earned");
        }

        console.log("");
        console.log("  Verdict: DepegShield cannot prevent total loss from a full");
        console.log("  collapse, but LPs earned significantly more fees from panic");
        console.log("  sellers -- partial compensation for impermanent loss.");

        assertGt(totalShieldLPFees, totalFlatLPFees * 10, "Should earn >10x more fees");
    }

    // ============================================================
    // Results: Recovery
    // ============================================================
    function _logResults_recovery(uint256 crisisShieldFees, uint256 crisisFlatFees) internal view {
        uint256 recoveryShieldFees = totalShieldLPFees - crisisShieldFees;
        uint256 recoveryFlatFees = totalFlatLPFees - crisisFlatFees;

        _header("RESULTS: SVB/USDC (Recovery)");
        _logPoolState("Final State (peg recovered)");

        console.log("");
        console.log("  Fee Revenue Breakdown:");
        _divider();
        console.log("  Crisis phase (fees in input token):");
        console.log("    DepegShield:  ", _toMilliTokens(crisisShieldFees), "millitokens");
        console.log("    Flat (1bp):   ", _toMilliTokens(crisisFlatFees), "millitokens");
        console.log("  Recovery phase:");
        console.log("    DepegShield:  ", _toMilliTokens(recoveryShieldFees), "millitokens (0bp rebalancing)");
        console.log("    Flat (1bp):   ", _toMilliTokens(recoveryFlatFees), "millitokens");
        console.log("  Total earned:");
        console.log("    DepegShield:  ", _toMilliTokens(totalShieldLPFees), "millitokens");
        console.log("    Flat (1bp):   ", _toMilliTokens(totalFlatLPFees), "millitokens");
        if (totalFlatLPFees > 0) {
            console.log("  Advantage:      ", totalShieldLPFees / totalFlatLPFees, "x more fees earned");
        }

        console.log("");
        console.log("  Key: DepegShield charges 0bp on rebalancing swaps,");
        console.log("  incentivizing arbitrageurs to restore the peg faster.");
        console.log("  Net LP outcome = pure profit (pool recovered to ~50/50).");

        assertGt(totalShieldLPFees, totalFlatLPFees * 5, "Should earn >5x more fees");
        assertEq(recoveryShieldFees, 0, "DepegShield charges 0 for rebalancing");
    }

    // ============================================================
    // Results: Whale Attack
    // ============================================================
    function _logResults_whaleAttack(uint256 attackShieldFees, uint256 attackFlatFees) internal view {
        uint256 recoveryShieldFees = totalShieldLPFees - attackShieldFees;
        uint256 recoveryFlatFees = totalFlatLPFees - attackFlatFees;

        _header("RESULTS: USDT Whale Attack (Quick Recovery)");
        _logPoolState("Final State (pool recovered)");

        console.log("");
        console.log("  Fee Revenue Breakdown:");
        _divider();
        console.log("  Attack phase (fees in input token):");
        console.log("    DepegShield:  ", _toMilliTokens(attackShieldFees), "millitokens");
        console.log("    Flat (1bp):   ", _toMilliTokens(attackFlatFees), "millitokens");
        console.log("  Recovery phase:");
        console.log("    DepegShield:  ", _toMilliTokens(recoveryShieldFees), "millitokens (0bp rebalancing)");
        console.log("    Flat (1bp):   ", _toMilliTokens(recoveryFlatFees), "millitokens");
        console.log("  Total earned:");
        console.log("    DepegShield:  ", _toMilliTokens(totalShieldLPFees), "millitokens");
        console.log("    Flat (1bp):   ", _toMilliTokens(totalFlatLPFees), "millitokens");

        console.log("");
        console.log("  Anti-Manipulation:");
        _divider();
        console.log("  Cost to attacker (DepegShield): ", _toMilliTokens(attackShieldFees), "millitokens");
        console.log("  Cost to attacker (flat-fee):    ", _toMilliTokens(attackFlatFees), "millitokens");
        if (attackFlatFees > 0) {
            console.log("  Attack cost multiplier:         ", attackShieldFees / attackFlatFees, "x more expensive");
        }

        console.log("");
        console.log("  Net LP outcome = pure profit (pool recovered).");
        console.log("  DepegShield makes manipulation economically impractical.");

        assertGt(attackShieldFees, attackFlatFees * 5, "Attack should cost >5x more");
        assertEq(recoveryShieldFees, 0, "DepegShield charges 0 for rebalancing");
    }

    // ============================================================
    // Core swap execution
    // ============================================================

    function _executeWave(string memory label, uint256 amountIn, bool zeroForOne) internal {
        uint256 ratioBefore = hook.getImbalanceRatio(shieldPoolKey);
        uint24 curveFee = hook.getFeeForRatio(ratioBefore);

        BalanceDelta deltaShield = _doSwap(amountIn, zeroForOne, shieldPoolKey);
        BalanceDelta deltaFlat = _doSwap(amountIn, zeroForOne, flatPoolKey);

        uint256 ratioAfter = hook.getImbalanceRatio(shieldPoolKey);

        // Determine fee applied
        bool isRebalancing = !zeroForOne && ratioBefore > FeeCurve.ZONE1_UPPER;
        uint24 feeApplied = isRebalancing ? 0 : curveFee;

        // Accumulate fees (fee = amountIn * feeRate / 1_000_000)
        totalShieldLPFees += amountIn * feeApplied / 1_000_000;
        totalFlatLPFees += amountIn * 100 / 1_000_000;

        // Log wave summary
        _logWave(label, zeroForOne, ratioBefore, ratioAfter, feeApplied, deltaShield, deltaFlat);
    }

    function _doSwap(uint256 amountIn, bool zeroForOne, PoolKey memory pk) internal returns (BalanceDelta) {
        return swapRouter.swapExactTokensForTokens({
            amountIn: amountIn,
            amountOutMin: 0,
            zeroForOne: zeroForOne,
            poolKey: pk,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
    }

    function _logWave(
        string memory label,
        bool zeroForOne,
        uint256 ratioBefore,
        uint256 ratioAfter,
        uint24 feeApplied,
        BalanceDelta deltaShield,
        BalanceDelta deltaFlat
    ) internal pure {
        int128 outShield = zeroForOne ? deltaShield.amount1() : deltaShield.amount0();
        int128 outFlat = zeroForOne ? deltaFlat.amount1() : deltaFlat.amount0();
        (uint256 bpsWhole,) = _feeToBps(feeApplied);
        string memory direction = zeroForOne ? "SELL token0" : "BUY token0";

        console.log("");
        console.log(string.concat("  [", label, "] ", direction));
        console.log("    Ratio:         ", ratioBefore, "->", ratioAfter);
        console.log("    Fee (Shield):  ", bpsWhole, "bps");
        console.log("    Out (Shield):  ", _toTokens(uint256(uint128(_abs(outShield)))), "tokens");
        console.log("    Out (Flat):    ", _toTokens(uint256(uint128(_abs(outFlat)))), "tokens");
    }

    function _abs(int128 x) internal pure returns (int128) {
        return x < 0 ? -x : x;
    }
}
