// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title FeeCurve
/// @notice Pure library for computing dynamic swap fees based on pool imbalance ratio.
///
///         The fee curve has 3 zones based on how lopsided the pool's reserves are:
///
///         Pool State:    Balanced         Tilting            Crisis
///         Ratio:         1.0         1.22         1.50                   4.0+
///                        |---Zone 1---|---Zone 2---|--------Zone 3--------|
///                        |   SAFE     |  WARNING   |   CIRCUIT BREAKER    |
///                        |   1bp flat | 1bp -> 15bp|   15bp -> 265bp+     |
///                        |            | quadratic  |   linear             |
///
///         Zone 1 (Safe):            ratio <= 1.22x (55/45 split)
///                                   Fee = 1bp. Pool is healthy, normal trading.
///
///         Zone 2 (Warning):         1.22x < ratio <= 1.50x (55/45 to 60/40)
///                                   Fee ramps quadratically from 1bp to 15bp.
///                                   Starts slow, accelerates as imbalance grows.
///
///         Zone 3 (Circuit Breaker): ratio > 1.50x (worse than 60/40)
///                                   Fee grows linearly: ~50bp at 65/35, ~98bp at 70/30,
///                                   ~265bp at 80/20. Capped at MAX_FEE (50%).
///
///         The curve is continuous (no sudden jumps) at both zone boundaries.
///         Both the fee value and the rate of increase match at each transition.
library FeeCurve {
    // --- Fee constants (in hundredths of a bip: 100 = 1bp, 5000 = 50bp) ---
    uint24 public constant BASE_FEE = 100;     // 1bp - charged when pool is balanced
    uint24 public constant MAX_FEE = 500_000;  // 50% - absolute safety cap

    // --- Zone boundaries ---
    // Ratio is scaled by 10000 (e.g. 1.0 = 10000, 1.22 = 12200, 1.50 = 15000)
    uint256 public constant ZONE1_UPPER = 12_200; // Safe/Warning boundary (55/45 split)
    uint256 public constant ZONE2_UPPER = 15_000; // Warning/Circuit Breaker boundary (60/40 split)

    // --- Zone 2 math ---
    // fee = BASE_FEE + (ratio - ZONE1_UPPER)^2 / ZONE2_DIVISOR
    // ZONE2_DIVISOR is chosen so the fee = 1500 (15bp) at ZONE2_UPPER:
    //   100 + (15000 - 12200)^2 / 5600 = 100 + 2800^2 / 5600 = 100 + 1400 = 1500
    uint256 public constant ZONE2_DIVISOR = 5_600;
    uint24 public constant ZONE2_END_FEE = 1_500; // 15bp (precomputed fee at Zone 2/3 boundary)

    /// @notice Calculate the fee for a given imbalance ratio
    /// @param ratio Imbalance ratio scaled by 10000 (1.0 = 10000, 1.22 = 12200)
    /// @return fee Fee in hundredths of a bip
    function calculateFee(uint256 ratio) internal pure returns (uint24) {
        // Zone 1 (Safe): ratio <= 1.22x -> flat 1bp
        if (ratio <= ZONE1_UPPER) {
            return BASE_FEE;
        }

        uint256 fee;

        if (ratio <= ZONE2_UPPER) {
            // Zone 2 (Warning): 1.22x < ratio <= 1.50x -> quadratic ramp from 1bp to 15bp
            // Example: at 57/43 (ratio ~13256) -> ~4.5bp, at 60/40 (ratio 15000) -> 15bp
            uint256 d = ratio - ZONE1_UPPER;
            fee = BASE_FEE + (d * d) / ZONE2_DIVISOR;
        } else {
            // Zone 3 (Circuit Breaker): ratio > 1.50x -> linear growth from 15bp
            // Example: 65/35 -> ~50bp, 70/30 -> ~98bp, 80/20 -> ~265bp
            // Guard against overflow for extreme ratios (e.g. when one reserve = 0)
            uint256 e = ratio - ZONE2_UPPER;
            if (e > MAX_FEE - ZONE2_END_FEE) {
                return MAX_FEE;
            }
            fee = ZONE2_END_FEE + e;
        }

        if (fee > MAX_FEE) {
            return MAX_FEE;
        }
        return uint24(fee);
    }
}
