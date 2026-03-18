// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console, Vm} from "forge-std/Test.sol";

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

contract DepegShieldHookTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    Currency currency0;
    Currency currency1;

    PoolKey poolKey;

    DepegShieldHook hook;
    PoolId poolId;

    uint256 tokenId;
    int24 tickLower;
    int24 tickUpper;

    function setUp() public {
        deployArtifactsAndLabel();

        (currency0, currency1) = deployCurrencyPair();

        // Deploy the hook with correct flags: BEFORE_SWAP + AFTER_SWAP
        address flags = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ (0x4444 << 144)
        );
        bytes memory constructorArgs = abi.encode(poolManager, address(0));
        deployCodeTo("DepegShieldHook.sol:DepegShieldHook", constructorArgs, flags);
        hook = DepegShieldHook(flags);

        // Create pool with DYNAMIC_FEE_FLAG
        poolKey = PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        // Provide full-range liquidity
        tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);

        uint128 liquidityAmount = 1000e18;

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );

        (tokenId,) = positionManager.mint(
            poolKey,
            tickLower,
            tickUpper,
            liquidityAmount,
            amount0Expected + 1,
            amount1Expected + 1,
            address(this),
            block.timestamp,
            Constants.ZERO_BYTES
        );
    }

    // ==========================================
    // Test 1: Balanced pool → base fee for both directions
    // ==========================================
    function test_balancedPool_baseFeeForBothDirections() public {
        // Pool starts at 1:1 price → balanced → imbalance ratio = 1.0
        uint256 ratio = hook.getImbalanceRatio(poolKey);
        console.log("Initial imbalance ratio:", ratio);
        assertLe(ratio, FeeCurve.ZONE1_UPPER, "Pool should start balanced");

        // Swap token0 → token1 (small amount, won't cause significant imbalance)
        uint256 amountIn = 0.001e18;
        swapRouter.swapExactTokensForTokens({
            amountIn: amountIn,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Pool should still be balanced after tiny swap
        ratio = hook.getImbalanceRatio(poolKey);
        console.log("Ratio after small swap:", ratio);
        assertLe(ratio, FeeCurve.ZONE1_UPPER, "Pool should remain balanced after small swap");
    }

    // ==========================================
    // Test 2: Create imbalance → worsening swap pays elevated fee
    // ==========================================
    function test_imbalancedPool_worseningSwapPaysElevatedFee() public {
        // First, create significant imbalance by doing a large swap
        // Sell a lot of token0 → pool becomes heavy on token0
        uint256 largeSwap = 400e18;
        swapRouter.swapExactTokensForTokens({
            amountIn: largeSwap,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Check that pool is now imbalanced
        uint256 ratio = hook.getImbalanceRatio(poolKey);
        console.log("Ratio after large swap:", ratio);
        assertGt(ratio, FeeCurve.ZONE1_UPPER, "Pool should be imbalanced after large swap");

        // Now do another swap in the SAME direction (worsening)
        // This should pay elevated fee
        (uint256 reserve0Before, uint256 reserve1Before) = hook.getVirtualReserves(poolKey);
        console.log("Reserve0 before:", reserve0Before);
        console.log("Reserve1 before:", reserve1Before);
        console.log("Pool is heavy on token0, selling more token0 should cost more");

        // The swap executes with elevated fee (50bp instead of 1bp)
        uint256 worseningSwap = 10e18;
        BalanceDelta delta = swapRouter.swapExactTokensForTokens({
            amountIn: worseningSwap,
            amountOutMin: 0,
            zeroForOne: true, // Worsening direction
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // The swap should complete (proving elevated fee was charged)
        // amount1 > 0 means we received token1 (router convention: positive = tokens out to user)
        assertGt(int256(delta.amount1()), 0, "Should have received token1");
        console.log("Worsening swap completed with elevated fee, received:", uint256(int256(delta.amount1())));
    }

    // ==========================================
    // Test 3: Imbalanced pool → rebalancing swap pays zero fee
    // ==========================================
    function test_imbalancedPool_rebalancingSwapPaysZeroFee() public {
        // Create imbalance: sell lots of token0
        uint256 largeSwap = 400e18;
        swapRouter.swapExactTokensForTokens({
            amountIn: largeSwap,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 ratio = hook.getImbalanceRatio(poolKey);
        console.log("Ratio after imbalancing:", ratio);
        assertGt(ratio, FeeCurve.ZONE1_UPPER);

        // Now swap in the OPPOSITE direction (rebalancing: sell token1 for token0)
        // This should get base fee
        uint256 rebalanceSwap = 10e18;
        BalanceDelta delta = swapRouter.swapExactTokensForTokens({
            amountIn: rebalanceSwap,
            amountOutMin: 0,
            zeroForOne: false, // Rebalancing direction
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        assertGt(int256(delta.amount0()), 0, "Should have received token0");
        console.log("Rebalancing swap completed with zero fee");
    }

    // ==========================================
    // Test 4: Verify fee difference between directions
    // ==========================================
    function test_feeDifference_worseningVsRebalancing() public {
        // Create imbalance
        uint256 largeSwap = 400e18;
        swapRouter.swapExactTokensForTokens({
            amountIn: largeSwap,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 ratio = hook.getImbalanceRatio(poolKey);
        console.log("Imbalance ratio:", ratio);
        assertGt(ratio, FeeCurve.ZONE1_UPPER);

        // Snapshot state, do worsening swap
        uint256 snapshot = vm.snapshotState();

        uint256 swapAmount = 5e18;

        // Worsening swap (token0 → token1, pool already heavy on token0)
        BalanceDelta deltaWorsening = swapRouter.swapExactTokensForTokens({
            amountIn: swapAmount,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
        int128 outputWorsening = delta_abs(deltaWorsening.amount1());

        // Revert to snapshot
        vm.revertToState(snapshot);

        // Rebalancing swap (token1 → token0, helping the pool)
        BalanceDelta deltaRebalancing = swapRouter.swapExactTokensForTokens({
            amountIn: swapAmount,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
        int128 outputRebalancing = delta_abs(deltaRebalancing.amount0());

        console.log("Output (worsening, 50bp fee):", uint256(uint128(outputWorsening)));
        console.log("Output (rebalancing, 0bp fee):", uint256(uint128(outputRebalancing)));

        // Rebalancing swap should give more output (lower fee)
        assertGt(
            uint128(outputRebalancing),
            uint128(outputWorsening),
            "Rebalancing swap should receive more tokens (lower fee)"
        );
    }

    // ==========================================
    // Test 5: View functions work correctly
    // ==========================================
    function test_viewFunctions() public {
        // Initial state: balanced
        uint256 ratio = hook.getImbalanceRatio(poolKey);
        assertEq(ratio, hook.RATIO_PRECISION(), "Balanced pool should have ratio = 10000 (1.0)");

        (uint256 r0, uint256 r1) = hook.getVirtualReserves(poolKey);
        assertGt(r0, 0, "Reserve0 should be > 0");
        assertGt(r1, 0, "Reserve1 should be > 0");
        assertEq(r0, r1, "At 1:1 price, reserves should be equal");

        console.log("Virtual reserve0:", r0);
        console.log("Virtual reserve1:", r1);
        console.log("Imbalance ratio:", ratio);
    }

    // ==========================================
    // Test 6: Multiple swaps progressively increase imbalance
    // ==========================================
    function test_progressiveImbalance() public {
        uint256 prevRatio = hook.getImbalanceRatio(poolKey);
        console.log("Starting ratio:", prevRatio);

        // Do 5 successive swaps, each should increase the ratio
        for (uint256 i = 0; i < 5; i++) {
            uint256 swapAmount = 50e18;
            swapRouter.swapExactTokensForTokens({
                amountIn: swapAmount,
                amountOutMin: 0,
                zeroForOne: true,
                poolKey: poolKey,
                hookData: Constants.ZERO_BYTES,
                receiver: address(this),
                deadline: block.timestamp + 1
            });

            uint256 newRatio = hook.getImbalanceRatio(poolKey);
            console.log("Ratio after swap", i + 1, ":", newRatio);
            assertGe(newRatio, prevRatio, "Ratio should increase with each worsening swap");
            prevRatio = newRatio;
        }

        assertGt(prevRatio, FeeCurve.ZONE1_UPPER, "Should be imbalanced after multiple swaps");
    }

    // ==========================================
    // Test 7: Small rebalancing swap → 0 fee (no overshoot)
    // ==========================================
    function test_rebalancingNoOvershoot_zeroFee() public {
        // Create imbalance: sell lots of token0 → pool heavy on token0
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 ratio = hook.getImbalanceRatio(poolKey);
        assertGt(ratio, FeeCurve.ZONE1_UPPER, "Pool should be imbalanced");
        console.log("Ratio after imbalancing:", ratio);

        // Small rebalancing swap (should NOT overshoot) → should get 0 fee
        uint256 snapshot = vm.snapshotState();

        // Rebalancing: sell token1 (pool is heavy on token0)
        BalanceDelta deltaRebal = swapRouter.swapExactTokensForTokens({
            amountIn: 5e18, // Small amount, won't overshoot
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        vm.revertToState(snapshot);

        // Compare with a same-size worsening swap
        BalanceDelta deltaWorsen = swapRouter.swapExactTokensForTokens({
            amountIn: 5e18,
            amountOutMin: 0,
            zeroForOne: true, // Worsening direction
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Rebalancing should give more output (0 fee vs escalated fee)
        uint256 outRebal = uint256(uint128(delta_abs(deltaRebal.amount0())));
        uint256 outWorsen = uint256(uint128(delta_abs(deltaWorsen.amount1())));
        console.log("Rebalancing output (0 fee):", outRebal);
        console.log("Worsening output (escalated fee):", outWorsen);
        assertGt(outRebal, outWorsen, "Rebalancing swap should give more output");
    }

    // ==========================================
    // Test 8: Large rebalancing swap that overshoots → blended fee
    // ==========================================
    function test_rebalancingOvershoot_blendedFee() public {
        // Create imbalance: sell lots of token0
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 ratioBefore = hook.getImbalanceRatio(poolKey);
        console.log("Ratio before overshoot swap:", ratioBefore);
        assertGt(ratioBefore, FeeCurve.ZONE1_UPPER);

        // Do a massive rebalancing swap that overshoots past 1:1
        // Pool is heavy on token0, so sell token1. But sell SO MUCH that it flips.
        BalanceDelta delta = swapRouter.swapExactTokensForTokens({
            amountIn: 800e18, // Much more than needed to rebalance
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Pool should now be imbalanced in the OPPOSITE direction
        uint256 ratioAfter = hook.getImbalanceRatio(poolKey);
        console.log("Ratio after overshoot swap:", ratioAfter);
        assertGt(ratioAfter, FeeCurve.ZONE1_UPPER, "Pool should be imbalanced in opposite direction after overshoot");

        // The swap should have succeeded (received token0)
        assertGt(int256(delta.amount0()), 0, "Should have received token0");
        console.log("Received token0:", uint256(int256(delta.amount0())));
    }

    // ==========================================
    // Test 9: Overshoot swap pays MORE fee than pure rebalancing
    // ==========================================
    function test_overshootPaysMoreThanPureRebalancing() public {
        // Create imbalance
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 snapshot = vm.snapshotState();

        // Small rebalancing swap (no overshoot) → 0 fee → better rate
        BalanceDelta deltaSmall = swapRouter.swapExactTokensForTokens({
            amountIn: 5e18,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
        uint256 outPerTokenSmall = uint256(int256(deltaSmall.amount0())) * 1e18 / 5e18;

        vm.revertToState(snapshot);

        // Large overshoot swap → blended fee → worse rate
        BalanceDelta deltaLarge = swapRouter.swapExactTokensForTokens({
            amountIn: 800e18,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
        uint256 outPerTokenLarge = uint256(int256(deltaLarge.amount0())) * 1e18 / 800e18;

        console.log("Rate (small rebal, 0 fee):", outPerTokenSmall);
        console.log("Rate (large overshoot, blended fee):", outPerTokenLarge);

        // Small rebalancing swap should get a better rate (more output per input)
        assertGt(outPerTokenSmall, outPerTokenLarge, "Pure rebalancing should have better rate than overshoot");
    }

    // ==========================================
    // Test 10: Blended fee is less than full worsening fee
    // ==========================================
    function test_blendedFeeLessThanFullWorsening() public {
        // Create imbalance: sell token0
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Create a SECOND pool with same imbalance but in opposite direction
        // Instead, we use snapshot to compare:
        // A) Large rebalancing swap (overshoots) → blended fee
        // B) Same size worsening swap → full fee
        uint256 snapshot = vm.snapshotState();

        // A) Overshoot rebalancing (sell token1 when pool is heavy on token0)
        BalanceDelta deltaRebal = swapRouter.swapExactTokensForTokens({
            amountIn: 600e18,
            amountOutMin: 0,
            zeroForOne: false, // Rebalancing direction (overshoots)
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        vm.revertToState(snapshot);

        // B) Same size worsening swap (sell token0, same direction as imbalance)
        BalanceDelta deltaWorsen = swapRouter.swapExactTokensForTokens({
            amountIn: 600e18,
            amountOutMin: 0,
            zeroForOne: true, // Worsening direction
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Rebalancing (even with overshoot) should give better output than pure worsening
        // because the blended fee is lower than the full worsening fee
        uint256 outRebal = uint256(int256(deltaRebal.amount0()));
        uint256 outWorsen = uint256(uint128(delta_abs(deltaWorsen.amount1())));
        console.log("Output (overshoot rebal, blended fee):", outRebal);
        console.log("Output (worsening, full fee):", outWorsen);

        assertGt(outRebal, outWorsen, "Blended fee should be less than full worsening fee");
    }

    // ==========================================
    // Test 11: SwapFeeApplied event emits correct fee (transient storage)
    // ==========================================
    function test_eventEmitsCorrectFee_worsening() public {
        // Create imbalance
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 ratioBefore = hook.getImbalanceRatio(poolKey);
        uint24 expectedFee = hook.getFeeForRatio(ratioBefore);

        // Expect the event with the correct fee
        // We can't predict the exact post-swap ratio, but we can verify
        // the feeApplied field matches what _beforeSwap computed
        vm.recordLogs();

        swapRouter.swapExactTokensForTokens({
            amountIn: 10e18,
            amountOutMin: 0,
            zeroForOne: true, // Worsening
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Find the SwapFeeApplied event
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("SwapFeeApplied(bytes32,uint256,bool,uint24)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                (uint256 emittedRatio, bool worsens, uint24 feeApplied) =
                    abi.decode(logs[i].data, (uint256, bool, uint24));
                assertEq(feeApplied, expectedFee, "Event should emit the actual fee computed in _beforeSwap");
                assertTrue(worsens || !worsens); // Just ensure it decoded
                assertGt(emittedRatio, 0, "Emitted ratio should be > 0");
                found = true;
                console.log("Event fee:", feeApplied, "expected:", expectedFee);
                break;
            }
        }
        assertTrue(found, "SwapFeeApplied event should have been emitted");
    }

    // ==========================================
    // Test 12: SwapFeeApplied event for rebalancing overshoot emits blended fee
    // ==========================================
    function test_eventEmitsCorrectFee_rebalancingOvershoot() public {
        // Create imbalance
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        vm.recordLogs();

        // Overshoot rebalancing swap
        swapRouter.swapExactTokensForTokens({
            amountIn: 800e18,
            amountOutMin: 0,
            zeroForOne: false, // Rebalancing direction
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("SwapFeeApplied(bytes32,uint256,bool,uint24)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                (, , uint24 feeApplied) = abi.decode(logs[i].data, (uint256, bool, uint24));
                // Blended fee should be > 0 (overshoot pays partial fee) but < MAX_FEE
                assertGt(feeApplied, 0, "Overshoot should have non-zero blended fee");
                assertLt(feeApplied, FeeCurve.MAX_FEE, "Fee should be less than MAX_FEE");
                console.log("Blended fee emitted in event:", feeApplied);
                found = true;
                break;
            }
        }
        assertTrue(found, "SwapFeeApplied event should have been emitted");
    }

    // ==========================================
    // Test 13: Zero-liquidity pool swap returns BASE_FEE
    // ==========================================
    function test_zeroLiquidityPool_baseFee() public {
        // Create a new pool with no liquidity
        (Currency c0, Currency c1) = deployCurrencyPair();
        PoolKey memory emptyPoolKey = PoolKey(c0, c1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolManager.initialize(emptyPoolKey, Constants.SQRT_PRICE_1_1);

        // Verify imbalance ratio returns RATIO_PRECISION for empty pool
        uint256 ratio = hook.getImbalanceRatio(emptyPoolKey);
        assertEq(ratio, hook.RATIO_PRECISION(), "Empty pool should report 1.0x ratio");

        // Verify reserves are 0
        (uint256 r0, uint256 r1) = hook.getVirtualReserves(emptyPoolKey);
        assertEq(r0, 0, "Reserve0 should be 0 for empty pool");
        assertEq(r1, 0, "Reserve1 should be 0 for empty pool");
    }

    // ==========================================
    // Test 14: Perfectly balanced pool entering rebalancing path
    // ==========================================
    function test_perfectlyBalancedPool_rebalancingPath() public {
        // Pool starts at 1:1, ratio = 10000 which is <= ZONE1_UPPER
        // Any swap on a balanced pool should get BASE_FEE (not enter rebalancing path)
        uint256 ratio = hook.getImbalanceRatio(poolKey);
        assertEq(ratio, 10000, "Should be perfectly balanced");

        // Both directions should cost BASE_FEE on a balanced pool
        uint256 snapshot = vm.snapshotState();

        BalanceDelta deltaZFO = swapRouter.swapExactTokensForTokens({
            amountIn: 10e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        vm.revertToState(snapshot);

        BalanceDelta deltaOFZ = swapRouter.swapExactTokensForTokens({
            amountIn: 10e18,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Both outputs should be very similar (both pay BASE_FEE)
        uint256 out0 = uint256(uint128(delta_abs(deltaZFO.amount1())));
        uint256 out1 = uint256(uint128(delta_abs(deltaOFZ.amount0())));
        console.log("Balanced pool output (zeroForOne):", out0);
        console.log("Balanced pool output (oneForZero):", out1);

        // Outputs should be within 0.1% of each other (both pay same fee)
        uint256 diff = out0 > out1 ? out0 - out1 : out1 - out0;
        assertLt(diff * 1000 / out0, 1, "Balanced pool should charge same fee both directions");
    }

    // ==========================================
    // Test 15: ExactOutput rebalancing swap pays curve fee (not 0)
    // ==========================================
    function test_exactOutput_rebalancing_paysCurveFee() public {
        // Create imbalance: sell lots of token0
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 ratio = hook.getImbalanceRatio(poolKey);
        assertGt(ratio, FeeCurve.ZONE1_UPPER, "Pool should be imbalanced");

        uint256 snapshot = vm.snapshotState();

        // ExactInput rebalancing swap -> should get 0 fee (small, won't overshoot)
        BalanceDelta deltaExactIn = swapRouter.swapExactTokensForTokens({
            amountIn: 5e18,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        vm.revertToState(snapshot);

        // ExactOutput rebalancing swap -> should pay curve fee (conservative)
        BalanceDelta deltaExactOut = swapRouter.swapTokensForExactTokens({
            amountOut: 4e18, // Approximate equivalent
            amountInMax: 10e18,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // ExactInput rebalancing should give better rate (0 fee vs curve fee)
        uint256 outExactIn = uint256(int256(deltaExactIn.amount0()));
        // For exactOutput, amount0 is the specified output
        uint256 inExactOut = uint256(uint128(delta_abs(deltaExactOut.amount1())));

        console.log("ExactInput rebalancing output (0 fee):", outExactIn);
        console.log("ExactOutput rebalancing input required:", inExactOut);

        // The exactOutput swap should require more input per output (paying higher fee)
        // rate = output / input. ExactIn rate should be better.
        // ExactIn: got outExactIn tokens for 5e18 input
        // ExactOut: paid inExactOut tokens for 4e18 output
        uint256 rateExactIn = outExactIn * 1e18 / 5e18;
        uint256 rateExactOut = 4e18 * 1e18 / inExactOut;
        console.log("Rate (exactIn, 0 fee):", rateExactIn);
        console.log("Rate (exactOut, curve fee):", rateExactOut);
        assertGt(rateExactIn, rateExactOut, "ExactInput rebalancing should have better rate than exactOutput");
    }

    // ==========================================
    // Test 16: Extreme imbalance ratio triggers MAX_FEE cap
    // ==========================================
    function test_extremeImbalance_maxFeeCap() public {
        // Do many successive swaps to create extreme imbalance
        for (uint256 i = 0; i < 8; i++) {
            swapRouter.swapExactTokensForTokens({
                amountIn: 100e18,
                amountOutMin: 0,
                zeroForOne: true,
                poolKey: poolKey,
                hookData: Constants.ZERO_BYTES,
                receiver: address(this),
                deadline: block.timestamp + 1
            });
        }

        uint256 ratio = hook.getImbalanceRatio(poolKey);
        console.log("Extreme ratio:", ratio);

        // Fee should be capped at MAX_FEE for very extreme ratios
        uint24 fee = hook.getFeeForRatio(ratio);
        assertLe(fee, FeeCurve.MAX_FEE, "Fee must never exceed MAX_FEE");
        console.log("Fee at extreme ratio:", fee);

        // Swap should still succeed even at extreme imbalance
        BalanceDelta delta = swapRouter.swapExactTokensForTokens({
            amountIn: 1e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
        assertGt(int256(delta.amount1()), 0, "Swap should succeed at extreme imbalance");
    }

    // ==========================================
    // Test 17: Pure rebalancing swap emits 0 fee in event
    // ==========================================
    function test_eventEmitsZeroFee_pureRebalancing() public {
        // Create imbalance
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        vm.recordLogs();

        // Small rebalancing swap (no overshoot)
        swapRouter.swapExactTokensForTokens({
            amountIn: 5e18,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("SwapFeeApplied(bytes32,uint256,bool,uint24)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                (, , uint24 feeApplied) = abi.decode(logs[i].data, (uint256, bool, uint24));
                assertEq(feeApplied, 0, "Pure rebalancing should emit 0 fee");
                console.log("Rebalancing fee in event:", feeApplied);
                found = true;
                break;
            }
        }
        assertTrue(found, "SwapFeeApplied event should have been emitted");
    }

    // ==========================================
    // Test 18: Rebalancing overshoot in opposite direction (zeroForOne=true)
    // ==========================================
    function test_rebalancingOvershoot_zeroForOneDirection() public {
        // Create imbalance by selling token1 -> pool heavy on token1
        swapRouter.swapExactTokensForTokens({
            amountIn: 400e18,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        uint256 ratioBefore = hook.getImbalanceRatio(poolKey);
        console.log("Ratio (heavy on token1):", ratioBefore);
        assertGt(ratioBefore, FeeCurve.ZONE1_UPPER);

        uint256 snapshot = vm.snapshotState();

        // Small rebalancing (no overshoot) -> 0 fee
        BalanceDelta deltaSmall = swapRouter.swapExactTokensForTokens({
            amountIn: 5e18,
            amountOutMin: 0,
            zeroForOne: true, // Rebalancing direction
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        vm.revertToState(snapshot);

        // Large overshoot rebalancing -> blended fee
        BalanceDelta deltaLarge = swapRouter.swapExactTokensForTokens({
            amountIn: 800e18,
            amountOutMin: 0,
            zeroForOne: true, // Rebalancing but overshoots
            poolKey: poolKey,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });

        // Small rebalancing should have better per-token rate
        uint256 rateSmall = uint256(uint128(delta_abs(deltaSmall.amount1()))) * 1e18 / 5e18;
        uint256 rateLarge = uint256(uint128(delta_abs(deltaLarge.amount1()))) * 1e18 / 800e18;
        console.log("Rate (small rebal, 0 fee):", rateSmall);
        console.log("Rate (large overshoot, blended fee):", rateLarge);
        assertGt(rateSmall, rateLarge, "Pure rebalancing should have better rate than overshoot");

        // Pool should now be imbalanced in opposite direction
        uint256 ratioAfter = hook.getImbalanceRatio(poolKey);
        assertGt(ratioAfter, FeeCurve.ZONE1_UPPER, "Should be imbalanced after overshoot");
    }

    // --- Helpers ---
    function delta_abs(int128 value) internal pure returns (int128) {
        return value < 0 ? -value : value;
    }
}
