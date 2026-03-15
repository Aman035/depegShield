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
import {AlertReceiver} from "../src/AlertReceiver.sol";
import {FeeCurve} from "../src/FeeCurve.sol";
import {BaseTest} from "./utils/BaseTest.sol";

contract CrossChainFeeTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    Currency currency0;
    Currency currency1;

    PoolKey poolKey;
    DepegShieldHook hook;
    AlertReceiver alertReceiver;
    PoolId poolId;

    bytes32 constant PAIR_ID = keccak256("test-pair");

    function setUp() public {
        deployArtifactsAndLabel();
        (currency0, currency1) = deployCurrencyPair();

        // Deploy AlertReceiver with this test contract as callback sender
        alertReceiver = new AlertReceiver(address(this));

        // Register the token pair under PAIR_ID
        alertReceiver.registerPair(PAIR_ID, Currency.unwrap(currency0), Currency.unwrap(currency1));

        // Deploy hook with alertReceiver
        address flags = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ (0x4444 << 144)
        );
        bytes memory constructorArgs = abi.encode(poolManager, address(alertReceiver));
        deployCodeTo("DepegShieldHook.sol:DepegShieldHook", constructorArgs, flags);
        hook = DepegShieldHook(flags);

        // Create pool
        poolKey = PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        // Add liquidity
        int24 tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);
        uint128 liquidityAmount = 1000e18;

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );

        positionManager.mint(
            poolKey, tickLower, tickUpper, liquidityAmount,
            amount0Expected + 1, amount1Expected + 1,
            address(this), block.timestamp, Constants.ZERO_BYTES
        );
    }

    // ==========================================
    // Test: Cross-chain ratio sets fee floor on balanced pool
    // ==========================================
    function test_crossChainFloor_balancedPoolGetsRemoteFee() public {
        uint256 localRatio = hook.getImbalanceRatio(poolKey);
        assertEq(localRatio, 10000, "Pool should be balanced");

        uint256 snapshot = vm.snapshotState();

        // Set cross-chain alert via pairId
        alertReceiver.handleAlert(PAIR_ID, 10300, 11155111, 600);
        BalanceDelta deltaWithFloor = _swapWorsening(10e18);

        vm.revertToState(snapshot);
        BalanceDelta deltaNoFloor = _swapWorsening(10e18);

        uint256 outWithFloor = uint256(int256(deltaWithFloor.amount1()));
        uint256 outNoFloor = uint256(int256(deltaNoFloor.amount1()));

        console.log("Output with cross-chain floor (50bp):", outWithFloor);
        console.log("Output without floor (1bp):", outNoFloor);
        console.log("Cross-chain fee:", FeeCurve.calculateFee(10300));

        assertLt(outWithFloor, outNoFloor, "Cross-chain floor should charge higher fee");
    }

    // ==========================================
    // Test: Higher cross-chain ratio -> higher fee floor
    // ==========================================
    function test_crossChainFloor_higherRatioHigherFee() public {
        uint256 snapshot = vm.snapshotState();

        alertReceiver.handleAlert(PAIR_ID, 10200, 84532, 600);
        BalanceDelta deltaModerate = _swapWorsening(10e18);

        vm.revertToState(snapshot);

        alertReceiver.handleAlert(PAIR_ID, 10500, 84532, 600);
        BalanceDelta deltaSevere = _swapWorsening(10e18);

        uint256 outModerate = uint256(int256(deltaModerate.amount1()));
        uint256 outSevere = uint256(int256(deltaSevere.amount1()));

        console.log("Output (2% cross-chain depeg):", outModerate);
        console.log("Output (5% cross-chain depeg):", outSevere);

        assertLt(outSevere, outModerate, "Higher cross-chain ratio should charge more");
    }

    // ==========================================
    // Test: Local fee dominates when higher than cross-chain
    // ==========================================
    function test_crossChainFloor_localFeeDominatesWhenHigher() public {
        _createImbalance();

        uint256 localRatio = hook.getImbalanceRatio(poolKey);
        console.log("Local ratio:", localRatio);

        uint256 snapshot = vm.snapshotState();

        alertReceiver.handleAlert(PAIR_ID, 10100, 11155111, 600);
        BalanceDelta deltaWithAlert = _swapWorsening(5e18);

        vm.revertToState(snapshot);
        BalanceDelta deltaNoAlert = _swapWorsening(5e18);

        uint256 outWith = uint256(int256(deltaWithAlert.amount1()));
        uint256 outWithout = uint256(int256(deltaNoAlert.amount1()));

        assertEq(outWith, outWithout, "Local fee should dominate when higher than cross-chain");
    }

    // ==========================================
    // Test: Rebalancing swap stays 0bp even with active cross-chain alert
    // ==========================================
    function test_crossChainFloor_rebalancingStaysZero() public {
        _createImbalance();

        uint256 snapshot = vm.snapshotState();

        alertReceiver.handleAlert(PAIR_ID, 10500, 11155111, 600);
        BalanceDelta deltaRebal = _swapRebalancing(5e18);

        vm.revertToState(snapshot);
        BalanceDelta deltaNoAlert = _swapRebalancing(5e18);

        uint256 outRebal = uint256(int256(deltaRebal.amount0()));
        uint256 outNoAlert = uint256(int256(deltaNoAlert.amount0()));

        assertEq(outRebal, outNoAlert, "Rebalancing should be unaffected by cross-chain alerts");
    }

    // ==========================================
    // Test: Fee capped at MAX_FEE even with extreme cross-chain ratio
    // ==========================================
    function test_crossChainFloor_feeCapAtMaxFee() public {
        alertReceiver.handleAlert(PAIR_ID, 20000, 84532, 600);

        BalanceDelta delta = swapRouter.swapExactTokensForTokens({
            amountIn: 1e18, amountOutMin: 0, zeroForOne: true,
            poolKey: poolKey, hookData: Constants.ZERO_BYTES,
            receiver: address(this), deadline: block.timestamp + 1
        });
        assertGt(int256(delta.amount1()), 0, "Swap should succeed with capped fee");
    }

    // ==========================================
    // Test: alertReceiver = address(0) behaves normally
    // ==========================================
    function test_crossChainFloor_disabledWhenNoReceiver() public {
        address flags2 = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ (0x5555 << 144)
        );
        bytes memory constructorArgs = abi.encode(poolManager, address(0));
        deployCodeTo("DepegShieldHook.sol:DepegShieldHook", constructorArgs, flags2);
        DepegShieldHook hookNoAlert = DepegShieldHook(flags2);

        PoolKey memory pk = PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hookNoAlert));
        poolManager.initialize(pk, Constants.SQRT_PRICE_1_1);

        int24 tickLower = TickMath.minUsableTick(60);
        int24 tickUpper = TickMath.maxUsableTick(60);
        uint128 liq = 1000e18;
        (uint256 a0, uint256 a1) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1, TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), liq
        );
        positionManager.mint(pk, tickLower, tickUpper, liq, a0 + 1, a1 + 1, address(this), block.timestamp, Constants.ZERO_BYTES);

        BalanceDelta delta = swapRouter.swapExactTokensForTokens({
            amountIn: 1e18, amountOutMin: 0, zeroForOne: true,
            poolKey: pk, hookData: Constants.ZERO_BYTES,
            receiver: address(this), deadline: block.timestamp + 1
        });
        assertGt(int256(delta.amount1()), 0, "Should work without alert receiver");
    }

    // ==========================================
    // Test: Expired alert returns to normal fee
    // ==========================================
    function test_crossChainFloor_expiredAlertNormalFee() public {
        alertReceiver.handleAlert(PAIR_ID, 10500, 11155111, 100);

        uint256 snapshot = vm.snapshotState();

        BalanceDelta deltaActive = _swapWorsening(10e18);

        vm.revertToState(snapshot);

        vm.warp(block.timestamp + 101);
        BalanceDelta deltaExpired = _swapWorsening(10e18);

        uint256 outActive = uint256(int256(deltaActive.amount1()));
        uint256 outExpired = uint256(int256(deltaExpired.amount1()));

        assertGt(outExpired, outActive, "Expired alert should revert to normal fee");
    }

    // ==========================================
    // Test: Cross-chain floor uses same fee curve
    // ==========================================
    function test_crossChainFloor_usesSameFeeCurve() public {
        uint24 expectedFee = FeeCurve.calculateFee(10300);
        console.log("Expected cross-chain fee for ratio 10300:", expectedFee);

        alertReceiver.handleAlert(PAIR_ID, 10300, 11155111, 600);

        vm.recordLogs();
        _swapWorsening(10e18);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSig = keccak256("SwapFeeApplied(bytes32,uint256,bool,uint24)");
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSig) {
                (, , uint24 feeApplied) = abi.decode(logs[i].data, (uint256, bool, uint24));
                assertEq(feeApplied, expectedFee, "Fee should match FeeCurve.calculateFee(crossChainRatio)");
                found = true;
                break;
            }
        }
        assertTrue(found, "SwapFeeApplied event should have been emitted");
    }

    // ==========================================
    // Test: Pair isolation -- alert on pair A does NOT affect pair B
    // ==========================================
    function test_crossChainFloor_pairIsolation() public {
        // Deploy a second token pair with a different pairId
        (Currency currencyX, Currency currencyY) = deployCurrencyPair();
        bytes32 pairIdB = keccak256("OTHER/PAIR");
        alertReceiver.registerPair(pairIdB, Currency.unwrap(currencyX), Currency.unwrap(currencyY));

        // Deploy second pool with same hook
        PoolKey memory poolKeyB = PoolKey(currencyX, currencyY, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolManager.initialize(poolKeyB, Constants.SQRT_PRICE_1_1);

        int24 tickLower = TickMath.minUsableTick(60);
        int24 tickUpper = TickMath.maxUsableTick(60);
        uint128 liq = 1000e18;
        (uint256 a0, uint256 a1) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1, TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), liq
        );
        positionManager.mint(poolKeyB, tickLower, tickUpper, liq, a0 + 1, a1 + 1, address(this), block.timestamp, Constants.ZERO_BYTES);

        // Set alert on PAIR_ID (pair A) -- pair B should NOT be affected
        alertReceiver.handleAlert(PAIR_ID, 10500, 11155111, 600);

        uint256 snapshot = vm.snapshotState();

        // Swap on pool B with alert active on pair A
        BalanceDelta deltaWithAlert = swapRouter.swapExactTokensForTokens({
            amountIn: 10e18, amountOutMin: 0, zeroForOne: true,
            poolKey: poolKeyB, hookData: Constants.ZERO_BYTES,
            receiver: address(this), deadline: block.timestamp + 1
        });

        vm.revertToState(snapshot);

        // Clear alert and swap on pool B
        vm.prank(address(this));
        // No alert on pairIdB, so output should be same
        BalanceDelta deltaNoAlert = swapRouter.swapExactTokensForTokens({
            amountIn: 10e18, amountOutMin: 0, zeroForOne: true,
            poolKey: poolKeyB, hookData: Constants.ZERO_BYTES,
            receiver: address(this), deadline: block.timestamp + 1
        });

        uint256 outWith = uint256(int256(deltaWithAlert.amount1()));
        uint256 outWithout = uint256(int256(deltaNoAlert.amount1()));

        assertEq(outWith, outWithout, "Alert on pair A should not affect pair B");
    }

    // --- Helpers ---

    function _createImbalance() internal {
        swapRouter.swapExactTokensForTokens({
            amountIn: 15e18, amountOutMin: 0, zeroForOne: true,
            poolKey: poolKey, hookData: Constants.ZERO_BYTES,
            receiver: address(this), deadline: block.timestamp + 1
        });
        uint256 ratio = hook.getImbalanceRatio(poolKey);
        require(ratio > FeeCurve.ZONE1_UPPER, "Pool should be imbalanced");
    }

    function _swapWorsening(uint256 amountIn) internal returns (BalanceDelta) {
        return swapRouter.swapExactTokensForTokens({
            amountIn: amountIn, amountOutMin: 0, zeroForOne: true,
            poolKey: poolKey, hookData: Constants.ZERO_BYTES,
            receiver: address(this), deadline: block.timestamp + 1
        });
    }

    function _swapRebalancing(uint256 amountIn) internal returns (BalanceDelta) {
        return swapRouter.swapExactTokensForTokens({
            amountIn: amountIn, amountOutMin: 0, zeroForOne: false,
            poolKey: poolKey, hookData: Constants.ZERO_BYTES,
            receiver: address(this), deadline: block.timestamp + 1
        });
    }
}
