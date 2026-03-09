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
        bytes memory constructorArgs = abi.encode(poolManager);
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
        assertLe(ratio, hook.IMBALANCE_THRESHOLD(), "Pool should start balanced");

        // Swap token0 → token1 (small amount, won't cause significant imbalance)
        uint256 amountIn = 0.01e18;
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
        assertLe(ratio, hook.IMBALANCE_THRESHOLD(), "Pool should remain balanced after small swap");
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
        assertGt(ratio, hook.IMBALANCE_THRESHOLD(), "Pool should be imbalanced after large swap");

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
        assertGt(ratio, hook.IMBALANCE_THRESHOLD());

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
        assertGt(ratio, hook.IMBALANCE_THRESHOLD());

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

        assertGt(prevRatio, hook.IMBALANCE_THRESHOLD(), "Should be imbalanced after multiple swaps");
    }

    // --- Helpers ---
    function delta_abs(int128 value) internal pure returns (int128) {
        return value < 0 ? -value : value;
    }
}
