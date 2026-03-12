// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title FeeCurve
/// @notice Pure library for computing dynamic swap fees based on pool imbalance ratio.
///
///         The fee curve has 5 progressive zones calibrated for realistic stablecoin depeg detection:
///
///         Pool State:   Balanced    Drifting     Stressed      Crisis      Emergency
///         Depeg:        <0.5%     0.5%-1.0%     1.0%-3.0%    3.0%-5.0%      >5.0%
///         Ratio:        <=1.005x  1.005-1.01x  1.01-1.03x   1.03-1.05x    >1.05x
///                       |--Z1--|----Z2----|------Z3------|-----Z4------|----Z5--->
///                       | 1bp  |  1-5bp   |   5-50bp     |  50-200bp   | 200bp+  |
///                       | flat |  linear  |  quadratic   |  quadratic  | quadratic|
///
///         Zone 1 (Stable):     ratio <= 1.005x  -> 1bp flat. Normal trading.
///         Zone 2 (Drift):      1.005x - 1.01x   -> Linear ramp 1bp to 5bp. Early warning.
///         Zone 3 (Stress):     1.01x  - 1.03x   -> Quadratic 5bp to 50bp. Significant depeg.
///         Zone 4 (Crisis):     1.03x  - 1.05x   -> Quadratic 50bp to 200bp. Major depeg event.
///         Zone 5 (Emergency):  > 1.05x           -> Quadratic from 200bp, capped at 50%. Full circuit breaker.
///
///         The curve is value-continuous at all zone boundaries (no fee jumps).
///         Reference: USDT 2022 dipped ~0.5%, USDC SVB dipped ~13%, UST collapsed 50-90%.
library FeeCurve {
    // --- Fee constants (in hundredths of a bip: 100 = 1bp, 5000 = 50bp) ---
    uint24 public constant BASE_FEE = 100;     // 1bp - charged when pool is balanced
    uint24 public constant MAX_FEE = 500_000;  // 50% - absolute safety cap

    // --- Zone boundaries (ratio scaled by 10000) ---
    uint256 public constant ZONE1_UPPER = 10_050;  // 0.5% depeg (Stable/Drift)
    uint256 public constant ZONE2_UPPER = 10_100;  // 1.0% depeg (Drift/Stress)
    uint256 public constant ZONE3_UPPER = 10_300;  // 3.0% depeg (Stress/Crisis)
    uint256 public constant ZONE4_UPPER = 10_500;  // 5.0% depeg (Crisis/Emergency)

    // --- Precomputed fees at zone boundaries ---
    uint24 public constant ZONE2_END_FEE = 500;    // 5bp at Zone2/3 boundary
    uint24 public constant ZONE3_END_FEE = 5_000;  // 50bp at Zone3/4 boundary
    uint24 public constant ZONE4_END_FEE = 20_000; // 200bp at Zone4/5 boundary

    // --- Zone 5 overflow guard ---
    // At d = ZONE5_MAX_D (ratio 15500, ~55% depeg), fee hits MAX_FEE.
    // Beyond this, d*d could produce large values; early-return MAX_FEE.
    uint256 private constant ZONE5_MAX_D = 5_000;

    /// @notice Calculate the fee for a given imbalance ratio
    /// @param ratio Imbalance ratio scaled by 10000 (1.0 = 10000, 1.005 = 10050)
    /// @return fee Fee in hundredths of a bip
    function calculateFee(uint256 ratio) internal pure returns (uint24) {
        // Zone 1 (Stable): ratio <= 1.005x -> flat 1bp
        if (ratio <= ZONE1_UPPER) {
            return BASE_FEE;
        }

        uint256 fee;

        if (ratio <= ZONE2_UPPER) {
            // Zone 2 (Drift): 1.005x - 1.01x -> linear ramp 1bp to 5bp
            // fee = 100 + (ratio - 10050) * 8
            // At 10050: 100 + 0 = 100 (1bp). At 10100: 100 + 50*8 = 500 (5bp).
            uint256 d = ratio - ZONE1_UPPER;
            fee = BASE_FEE + d * 8;
        } else if (ratio <= ZONE3_UPPER) {
            // Zone 3 (Stress): 1.01x - 1.03x -> quadratic 5bp to 50bp
            // fee = 500 + 9 * d^2 / 80
            // At 10100: 500 + 0 = 500 (5bp). At 10300: 500 + 9*200^2/80 = 5000 (50bp).
            uint256 d = ratio - ZONE2_UPPER;
            fee = ZONE2_END_FEE + (9 * d * d) / 80;
        } else if (ratio <= ZONE4_UPPER) {
            // Zone 4 (Crisis): 1.03x - 1.05x -> quadratic 50bp to 200bp
            // fee = 5000 + 3 * d^2 / 8
            // At 10300: 5000 + 0 = 5000 (50bp). At 10500: 5000 + 3*200^2/8 = 20000 (200bp).
            uint256 d = ratio - ZONE3_UPPER;
            fee = ZONE3_END_FEE + (3 * d * d) / 8;
        } else {
            // Zone 5 (Emergency): > 1.05x -> quadratic from 200bp, capped at 50%
            // fee = 20000 + d^2 / 50
            // At 10500: 20000 (200bp). At 15000: 20000 + 4500^2/50 = 425000 (~42.5%).
            uint256 d = ratio - ZONE4_UPPER;
            // Guard overflow for extreme ratios
            if (d > ZONE5_MAX_D) {
                return MAX_FEE;
            }
            fee = ZONE4_END_FEE + (d * d) / 50;
        }

        if (fee > MAX_FEE) {
            return MAX_FEE;
        }
        return uint24(fee);
    }
}
