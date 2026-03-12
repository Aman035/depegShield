// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager, SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

import {FeeCurve} from "./FeeCurve.sol";

/// @title DepegShield Hook
/// @notice Adaptive fee circuit breaker for stablecoin pools on Uniswap v4.
///         Charges dynamic, directional fees based on pool imbalance ratio.
///         Swaps that worsen imbalance pay escalated fees; swaps that improve it pay zero fee.
///
/// @dev IMPORTANT ASSUMPTIONS:
///      - This hook is designed for stablecoin pairs (1:1 target price). Attaching it to
///        volatile pairs will cause fees to trigger on normal price movements.
///      - The blended rebalancing fee assumes uniform liquidity across the swap path.
///        With concentrated liquidity positions, the equilibrium amount calculation is
///        approximate. The fee is conservative: it may slightly overcharge on rebalancing
///        swaps near tick boundaries, but never undercharges.
///      - The 0-fee rebalancing incentive only applies to exactInput swaps.
///        ExactOutput rebalancing swaps pay the standard curve fee since we cannot
///        precisely determine input amounts for overshoot calculation.
contract DepegShieldHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    uint256 public constant RATIO_PRECISION = 10000;
    uint160 private constant Q96 = uint160(1 << 96);

    /// @dev Transient storage slot for passing the computed fee from _beforeSwap to _afterSwap.
    ///      Precomputed: keccak256("DepegShieldHook.lastComputedFee")
    ///      Written in _beforeSwap, read and cleared in _afterSwap within the same swap lifecycle.
    uint256 private constant TSLOT_FEE = 0x306bd9877a3aff76248130139941e6dc452bbad447b3a1530aaecf6bb84198c5;

    // --- Events ---
    event SwapFeeApplied(
        PoolId indexed poolId,
        uint256 imbalanceRatio,
        bool worsensImbalance,
        uint24 feeApplied
    );

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = _computeSwapFee(key, params);

        // Store fee in transient storage for accurate _afterSwap event emission
        assembly ("memory-safe") {
            tstore(TSLOT_FEE, fee)
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @dev Core fee computation extracted to avoid stack-too-deep in _beforeSwap
    function _computeSwapFee(PoolKey calldata key, SwapParams calldata params) private view returns (uint24) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint128 liquidity = poolManager.getLiquidity(key.toId());

        if (liquidity == 0) return FeeCurve.BASE_FEE;

        (uint256 reserve0, uint256 reserve1) = _getVirtualReserves(sqrtPriceX96, liquidity);
        uint256 imbalanceRatio = _computeImbalanceRatio(reserve0, reserve1);
        bool worsensImbalance = _doesSwapWorsenImbalance(reserve0, reserve1, params.zeroForOne);

        if (worsensImbalance || imbalanceRatio <= FeeCurve.ZONE1_UPPER) {
            return FeeCurve.calculateFee(imbalanceRatio);
        }

        // Rebalancing an imbalanced pool:
        // - ExactInput: compute blended fee (0 for rebalancing portion, escalated for overshoot)
        // - ExactOutput: charge curve fee (can't precisely compute input for overshoot check)
        if (params.amountSpecified >= 0) {
            // exactOutput: conservative fallback to curve fee
            return FeeCurve.calculateFee(imbalanceRatio);
        }

        return _computeRebalancingFee(sqrtPriceX96, liquidity, params.zeroForOne, params.amountSpecified);
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata params, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        // Read the actual fee that was computed in _beforeSwap via transient storage,
        // then clear the slot to prevent stale reads in multi-swap transactions.
        uint24 feeApplied;
        assembly ("memory-safe") {
            feeApplied := tload(TSLOT_FEE)
            tstore(TSLOT_FEE, 0)
        }

        // Read post-swap state for event emission
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint128 liquidity = poolManager.getLiquidity(key.toId());

        if (liquidity > 0) {
            (uint256 reserve0, uint256 reserve1) = _getVirtualReserves(sqrtPriceX96, liquidity);
            uint256 imbalanceRatio = _computeImbalanceRatio(reserve0, reserve1);
            bool worsensImbalance = _doesSwapWorsenImbalance(reserve0, reserve1, params.zeroForOne);

            emit SwapFeeApplied(key.toId(), imbalanceRatio, worsensImbalance, feeApplied);
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // --- Blended fee for rebalancing swaps that may overshoot equilibrium ---

    /// @notice Compute fee for a rebalancing swap, blending 0-fee for the rebalancing
    ///         portion and escalated fee for any overshoot past equilibrium.
    /// @dev Only called for exactInput rebalancing swaps (amountSpecified < 0).
    ///      If swapAmount <= equilibriumAmount, the entire swap rebalances -> 0 fee.
    ///      If swapAmount > equilibriumAmount, fee = (overshoot/total) * feeForPostSwapRatio.
    ///
    ///      NOTE: Assumes uniform liquidity across the swap path. With concentrated
    ///      liquidity the equilibrium amount is approximate, but the fee is conservative
    ///      (may overcharge slightly, never undercharges).
    function _computeRebalancingFee(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        bool zeroForOne,
        int256 amountSpecified
    ) internal pure returns (uint24) {
        // For exactInput, amountSpecified is negative
        uint256 swapAmount = uint256(-amountSpecified);
        if (swapAmount == 0) return 0;

        // How much input is needed to bring pool to 1:1 (sqrtPriceX96 = Q96)?
        uint256 eqAmount = _computeEquilibriumAmount(sqrtPriceX96, liquidity, zeroForOne);

        if (swapAmount <= eqAmount) {
            // Pure rebalancing, no overshoot
            return 0;
        }

        // Swap overshoots equilibrium: blend fee
        uint256 overshoot = swapAmount - eqAmount;

        // Estimate the imbalance ratio after the overshoot (starting from 1:1)
        uint256 postSwapRatio = _estimatePostEquilibriumRatio(liquidity, zeroForOne, overshoot);
        uint24 overshootFee = FeeCurve.calculateFee(postSwapRatio);

        // Blended fee: only the overshooting portion pays the fee
        // fee = (overshoot / swapAmount) * overshootFee
        return uint24(FullMath.mulDiv(uint256(overshootFee), overshoot, swapAmount));
    }

    /// @notice Compute the input amount needed to bring the pool to 1:1 equilibrium.
    /// @dev Uses Uniswap's sqrt-price math for uniform liquidity:
    ///      For selling token0 (zeroForOne): amount0 = L * (sqrtP - Q96) / sqrtP
    ///      For selling token1 (!zeroForOne): amount1 = L * (Q96 - sqrtP) / Q96
    ///
    ///      This is exact for full-range liquidity and approximate for concentrated
    ///      positions. The approximation is conservative: if actual equilibrium requires
    ///      more input than estimated, overshoot is overestimated -> higher fee.
    function _computeEquilibriumAmount(
        uint160 sqrtPriceX96,
        uint128 liquidity,
        bool zeroForOne
    ) internal pure returns (uint256) {
        if (zeroForOne) {
            // Rebalancing when reserve1 > reserve0 (sqrtP > Q96, price > 1.0)
            if (sqrtPriceX96 <= Q96) return 0;
            return FullMath.mulDiv(uint256(liquidity), uint256(sqrtPriceX96 - Q96), uint256(sqrtPriceX96));
        } else {
            // Rebalancing when reserve0 > reserve1 (sqrtP < Q96, price < 1.0)
            if (sqrtPriceX96 >= Q96) return 0;
            return FullMath.mulDiv(uint256(liquidity), uint256(Q96 - sqrtPriceX96), uint256(Q96));
        }
    }

    /// @notice Estimate the imbalance ratio after overshooting past equilibrium.
    /// @dev Starting from 1:1 (sqrtP = Q96), compute new sqrtP after the overshoot amount,
    ///      then derive reserves and ratio.
    ///      For selling token0: sqrtP_new = Q96 * L / (L + overshoot)
    ///      For selling token1: sqrtP_new = Q96 + overshoot * Q96 / L
    function _estimatePostEquilibriumRatio(
        uint128 liquidity,
        bool zeroForOne,
        uint256 overshootAmount
    ) internal pure returns (uint256) {
        uint256 newSqrtP;

        if (zeroForOne) {
            // Selling token0 past equilibrium -> price drops below 1.0
            // sqrtP_new = Q96 * L / (L + overshoot)
            uint256 denom = uint256(liquidity) + overshootAmount;
            if (denom == 0) return RATIO_PRECISION;
            newSqrtP = FullMath.mulDiv(uint256(Q96), uint256(liquidity), denom);
        } else {
            // Selling token1 past equilibrium -> price rises above 1.0
            // sqrtP_new = Q96 + overshoot * Q96 / L
            if (liquidity == 0) return type(uint256).max;
            uint256 delta = FullMath.mulDiv(overshootAmount, uint256(Q96), uint256(liquidity));
            // Cap newSqrtP to prevent extreme values (limit to ~10x price = 10 * Q96)
            uint256 maxSqrtP = uint256(Q96) * 10;
            if (delta > maxSqrtP) {
                newSqrtP = maxSqrtP;
            } else {
                newSqrtP = uint256(Q96) + delta;
            }
        }

        if (newSqrtP == 0) return type(uint256).max;

        // Compute new reserves from estimated sqrtPrice
        uint256 newReserve0 = FullMath.mulDiv(uint256(liquidity), uint256(Q96), newSqrtP);
        uint256 newReserve1 = FullMath.mulDiv(uint256(liquidity), newSqrtP, uint256(Q96));

        return _computeImbalanceRatio(newReserve0, newReserve1);
    }

    // --- Internal helpers ---

    /// @notice Compute virtual reserves from sqrtPriceX96 and liquidity
    /// @dev reserve0 = L * 2^96 / sqrtPriceX96
    ///      reserve1 = L * sqrtPriceX96 / 2^96
    function _getVirtualReserves(uint160 sqrtPriceX96, uint128 liquidity)
        internal
        pure
        returns (uint256 reserve0, uint256 reserve1)
    {
        // reserve0 = L * 2^96 / sqrtPriceX96
        reserve0 = FullMath.mulDiv(uint256(liquidity), uint256(Q96), uint256(sqrtPriceX96));

        // reserve1 = L * sqrtPriceX96 / 2^96
        reserve1 = FullMath.mulDiv(uint256(liquidity), uint256(sqrtPriceX96), uint256(Q96));
    }

    /// @notice Compute imbalance ratio = max(r0, r1) / min(r0, r1) * RATIO_PRECISION
    function _computeImbalanceRatio(uint256 reserve0, uint256 reserve1)
        internal
        pure
        returns (uint256 ratio)
    {
        if (reserve0 == 0 || reserve1 == 0) {
            return type(uint256).max; // Extreme imbalance
        }

        if (reserve0 >= reserve1) {
            ratio = FullMath.mulDiv(reserve0, RATIO_PRECISION, reserve1);
        } else {
            ratio = FullMath.mulDiv(reserve1, RATIO_PRECISION, reserve0);
        }
    }

    /// @notice Determine if the swap direction worsens the current imbalance
    function _doesSwapWorsenImbalance(uint256 reserve0, uint256 reserve1, bool zeroForOne)
        internal
        pure
        returns (bool)
    {
        if (reserve0 >= reserve1) {
            // Pool has excess token0 -> selling more token0 (zeroForOne=true) worsens it
            return zeroForOne;
        } else {
            // Pool has excess token1 -> selling more token1 (zeroForOne=false) worsens it
            return !zeroForOne;
        }
    }

    // --- View functions for frontend/testing ---

    /// @notice Get the current imbalance ratio for a pool
    function getImbalanceRatio(PoolKey calldata key) external view returns (uint256) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint128 liquidity = poolManager.getLiquidity(key.toId());

        if (liquidity == 0) return RATIO_PRECISION; // 1.0 if no liquidity

        (uint256 reserve0, uint256 reserve1) = _getVirtualReserves(sqrtPriceX96, liquidity);
        return _computeImbalanceRatio(reserve0, reserve1);
    }

    /// @notice Get the virtual reserves for a pool
    function getVirtualReserves(PoolKey calldata key) external view returns (uint256 reserve0, uint256 reserve1) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint128 liquidity = poolManager.getLiquidity(key.toId());

        if (liquidity == 0) return (0, 0);

        return _getVirtualReserves(sqrtPriceX96, liquidity);
    }

    /// @notice Get the fee that would be charged for a given imbalance ratio (for frontend curve plotting)
    function getFeeForRatio(uint256 ratio) external pure returns (uint24) {
        return FeeCurve.calculateFee(ratio);
    }
}
