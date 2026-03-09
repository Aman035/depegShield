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

/// @title DepegShield Hook
/// @notice Adaptive fee circuit breaker for stablecoin pools on Uniswap v4.
///         Charges dynamic, directional fees based on pool imbalance ratio.
///         Swaps that worsen imbalance pay escalated fees; swaps that improve it pay base fee.
contract DepegShieldHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // --- Fee constants (in hundredths of a bip) ---
    // 1 bip = 100 units in v4's fee system
    // So 1bp = 100, 50bp = 5000
    uint24 public constant BASE_FEE = 100; // 1bp
    uint24 public constant ELEVATED_FEE = 5000; // 50bp
    uint24 public constant MAX_FEE = 500000; // 50% cap (safety)

    // --- Imbalance threshold ---
    // Ratio is stored as fixed-point with 4 decimal places (1.0 = 10000)
    // imbalanceRatio = max(reserve0, reserve1) / min(reserve0, reserve1)
    // Threshold: 1.22 (55/45 split) = 12200 in our fixed-point
    uint256 public constant IMBALANCE_THRESHOLD = 12200; // 1.22 * 10000
    uint256 public constant RATIO_PRECISION = 10000;

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
        // 1. Read pool state
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint128 liquidity = poolManager.getLiquidity(key.toId());

        // If no liquidity, return base fee
        if (liquidity == 0) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, BASE_FEE | LPFeeLibrary.OVERRIDE_FEE_FLAG);
        }

        // 2. Compute virtual reserves from sqrtPriceX96 and liquidity
        // reserve0 = L / sqrtPrice, reserve1 = L * sqrtPrice
        // Using Q96 fixed-point math
        (uint256 reserve0, uint256 reserve1) = _getVirtualReserves(sqrtPriceX96, liquidity);

        // 3. Compute imbalance ratio = max/min (scaled by RATIO_PRECISION)
        uint256 imbalanceRatio = _computeImbalanceRatio(reserve0, reserve1);

        // 4. Determine if this swap worsens the imbalance
        // zeroForOne = true means selling token0 for token1 (token0 increases, token1 decreases)
        // If reserve0 > reserve1 and we're selling token0 (zeroForOne=true), that worsens imbalance
        // If reserve1 > reserve0 and we're selling token1 (zeroForOne=false), that worsens imbalance
        bool worsensImbalance = _doesSwapWorsenImbalance(reserve0, reserve1, params.zeroForOne);

        // 5. Compute fee
        uint24 fee;
        if (!worsensImbalance && imbalanceRatio > IMBALANCE_THRESHOLD) {
            // Pool is imbalanced AND swap helps rebalance → zero fee to incentivize rebalancing
            fee = 0;
        } else if (imbalanceRatio <= IMBALANCE_THRESHOLD) {
            // Pool is balanced → base fee regardless of direction
            fee = BASE_FEE;
        } else {
            // Pool is imbalanced AND swap makes it worse → elevated fee
            fee = ELEVATED_FEE;
        }

        // Cap the fee
        if (fee > MAX_FEE) {
            fee = MAX_FEE;
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata params, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        // Read post-swap state for event emission
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint128 liquidity = poolManager.getLiquidity(key.toId());

        if (liquidity > 0) {
            (uint256 reserve0, uint256 reserve1) = _getVirtualReserves(sqrtPriceX96, liquidity);
            uint256 imbalanceRatio = _computeImbalanceRatio(reserve0, reserve1);
            bool worsensImbalance = _doesSwapWorsenImbalance(reserve0, reserve1, params.zeroForOne);

            uint24 feeApplied;
            if (imbalanceRatio > IMBALANCE_THRESHOLD && worsensImbalance) {
                feeApplied = ELEVATED_FEE;
            } else if (imbalanceRatio > IMBALANCE_THRESHOLD && !worsensImbalance) {
                feeApplied = 0;
            } else {
                feeApplied = BASE_FEE;
            }

            emit SwapFeeApplied(key.toId(), imbalanceRatio, worsensImbalance, feeApplied);
        }

        return (BaseHook.afterSwap.selector, 0);
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
        uint256 Q96 = 1 << 96;

        // reserve0 = L * 2^96 / sqrtPriceX96
        reserve0 = FullMath.mulDiv(uint256(liquidity), Q96, uint256(sqrtPriceX96));

        // reserve1 = L * sqrtPriceX96 / 2^96
        reserve1 = FullMath.mulDiv(uint256(liquidity), uint256(sqrtPriceX96), Q96);
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
            // Pool has excess token0 → selling more token0 (zeroForOne=true) worsens it
            return zeroForOne;
        } else {
            // Pool has excess token1 → selling more token1 (zeroForOne=false) worsens it
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
}
