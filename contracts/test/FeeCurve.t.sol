// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {FeeCurve} from "../src/FeeCurve.sol";

contract FeeCurveTest is Test {
    // ==========================================
    // Zone 1: Stable (ratio <= 10050, <0.5% depeg)
    // ==========================================
    function test_zone1_balancedPool() public pure {
        assertEq(FeeCurve.calculateFee(10000), 100, "1.0x ratio should return BASE_FEE");
    }

    function test_zone1_atBoundary() public pure {
        assertEq(FeeCurve.calculateFee(10050), 100, "Zone 1/2 boundary should return BASE_FEE");
    }

    function test_zone1_belowThreshold() public pure {
        assertEq(FeeCurve.calculateFee(10010), 100);
        assertEq(FeeCurve.calculateFee(10030), 100);
        assertEq(FeeCurve.calculateFee(10049), 100);
    }

    // ==========================================
    // Zone 2: Drift (10050 < ratio <= 10100, 0.5%-1% depeg)
    // Linear: fee = 100 + (ratio - 10050) * 8
    // ==========================================
    function test_zone2_justAboveBoundary() public pure {
        // d=1, fee = 100 + 1*8 = 108
        assertEq(FeeCurve.calculateFee(10051), 108);
    }

    function test_zone2_midpoint() public pure {
        // d=25, fee = 100 + 25*8 = 300 (3bp)
        assertEq(FeeCurve.calculateFee(10075), 300);
    }

    function test_zone2_atUpperBoundary() public pure {
        // d=50, fee = 100 + 50*8 = 500 (5bp)
        assertEq(FeeCurve.calculateFee(10100), 500);
    }

    // ==========================================
    // Zone 3: Stress (10100 < ratio <= 10300, 1%-3% depeg)
    // Quadratic: fee = 500 + 9*d^2/80
    // ==========================================
    function test_zone3_justAboveBoundary() public pure {
        // d=1, fee = 500 + 9*1/80 = 500 + 0 = 500 (integer division)
        assertEq(FeeCurve.calculateFee(10101), 500);
    }

    function test_zone3_midpoint() public pure {
        // d=100 (ratio 10200, 2% depeg), fee = 500 + 9*10000/80 = 500 + 1125 = 1625 (~16.25bp)
        assertEq(FeeCurve.calculateFee(10200), 1625);
    }

    function test_zone3_atUpperBoundary() public pure {
        // d=200, fee = 500 + 9*40000/80 = 500 + 4500 = 5000 (50bp)
        assertEq(FeeCurve.calculateFee(10300), 5000);
    }

    // ==========================================
    // Zone 4: Crisis (10300 < ratio <= 10500, 3%-5% depeg)
    // Quadratic: fee = 5000 + 3*d^2/8
    // ==========================================
    function test_zone4_justAboveBoundary() public pure {
        // d=1, fee = 5000 + 3*1/8 = 5000 + 0 = 5000 (integer division)
        assertEq(FeeCurve.calculateFee(10301), 5000);
    }

    function test_zone4_midpoint() public pure {
        // d=100 (ratio 10400, 4% depeg), fee = 5000 + 3*10000/8 = 5000 + 3750 = 8750 (87.5bp)
        assertEq(FeeCurve.calculateFee(10400), 8750);
    }

    function test_zone4_atUpperBoundary() public pure {
        // d=200, fee = 5000 + 3*40000/8 = 5000 + 15000 = 20000 (200bp)
        assertEq(FeeCurve.calculateFee(10500), 20000);
    }

    // ==========================================
    // Zone 5: Emergency (ratio > 10500, >5% depeg)
    // Quadratic: fee = 20000 + d^2/50
    // ==========================================
    function test_zone5_justAboveBoundary() public pure {
        // d=1, fee = 20000 + 1/50 = 20000 (integer division)
        assertEq(FeeCurve.calculateFee(10501), 20000);
    }

    function test_zone5_10pct_depeg() public pure {
        // ratio 11000, d=500, fee = 20000 + 250000/50 = 20000 + 5000 = 25000 (250bp)
        assertEq(FeeCurve.calculateFee(11000), 25000);
    }

    function test_zone5_20pct_depeg() public pure {
        // ratio 12000, d=1500, fee = 20000 + 2250000/50 = 20000 + 45000 = 65000 (650bp)
        assertEq(FeeCurve.calculateFee(12000), 65000);
    }

    function test_zone5_33pct_depeg() public pure {
        // ratio ~13333 (67/33 split), d=2833, fee = 20000 + 8025889/50 = 20000 + 160517 = 180517
        assertEq(FeeCurve.calculateFee(13333), 180517);
    }

    function test_zone5_50pct_depeg() public pure {
        // ratio 15000 (75/25 split), d=4500, fee = 20000 + 20250000/50 = 20000 + 405000 = 425000
        assertEq(FeeCurve.calculateFee(15000), 425000);
    }

    // ==========================================
    // Cap at MAX_FEE
    // ==========================================
    function test_maxFeeCap() public pure {
        // d=5000 triggers the overflow guard → MAX_FEE
        assertEq(FeeCurve.calculateFee(15500), 500000);
    }

    function test_maxFeeCap_extremeRatio() public pure {
        assertEq(FeeCurve.calculateFee(100000), 500000);
    }

    function test_maxFeeCap_maxUint() public pure {
        assertEq(FeeCurve.calculateFee(type(uint256).max), 500000);
    }

    // ==========================================
    // Continuity at zone boundaries
    // ==========================================
    function test_continuity_zone12() public pure {
        uint24 atBoundary = FeeCurve.calculateFee(10050);
        uint24 justAbove = FeeCurve.calculateFee(10051);
        // Zone 1: 100, Zone 2 at d=1: 108. Delta = 8 (small jump from flat to linear)
        assertEq(atBoundary, 100);
        assertEq(justAbove, 108);
        assertLe(justAbove - atBoundary, 10, "Zone 1/2 transition should be smooth");
    }

    function test_continuity_zone23() public pure {
        uint24 atBoundary = FeeCurve.calculateFee(10100);
        uint24 justAbove = FeeCurve.calculateFee(10101);
        // Both should be 500 (quadratic starts with 0 increment at d=1)
        assertEq(atBoundary, 500);
        assertEq(justAbove, 500);
    }

    function test_continuity_zone34() public pure {
        uint24 atBoundary = FeeCurve.calculateFee(10300);
        uint24 justAbove = FeeCurve.calculateFee(10301);
        assertEq(atBoundary, 5000);
        assertEq(justAbove, 5000);
    }

    function test_continuity_zone45() public pure {
        uint24 atBoundary = FeeCurve.calculateFee(10500);
        uint24 justAbove = FeeCurve.calculateFee(10501);
        assertEq(atBoundary, 20000);
        assertEq(justAbove, 20000);
    }

    // ==========================================
    // Fuzz: monotonically increasing
    // ==========================================
    function testFuzz_monotonicallyIncreasing(uint256 a, uint256 b) public pure {
        a = bound(a, 10000, 600000);
        b = bound(b, a, 600000);
        assertLe(FeeCurve.calculateFee(a), FeeCurve.calculateFee(b), "Fee must be monotonically increasing");
    }

    // ==========================================
    // Fuzz: never exceeds MAX_FEE
    // ==========================================
    function testFuzz_neverExceedsMaxFee(uint256 ratio) public pure {
        ratio = bound(ratio, 0, type(uint128).max);
        assertLe(FeeCurve.calculateFee(ratio), FeeCurve.MAX_FEE, "Fee must never exceed MAX_FEE");
    }

    // ==========================================
    // Log fee curve for visualization
    // ==========================================
    function test_logFeeCurve() public pure {
        console.log("=== 5-Zone Fee Curve Values ===");
        console.log("Ratio 10000 (balanced):   fee =", FeeCurve.calculateFee(10000), "(1bp)");
        console.log("Ratio 10050 (0.5% depeg): fee =", FeeCurve.calculateFee(10050), "(1bp)");
        console.log("Ratio 10075 (mid drift):  fee =", FeeCurve.calculateFee(10075), "(3bp)");
        console.log("Ratio 10100 (1% depeg):   fee =", FeeCurve.calculateFee(10100), "(5bp)");
        console.log("Ratio 10200 (2% depeg):   fee =", FeeCurve.calculateFee(10200), "(16.25bp)");
        console.log("Ratio 10300 (3% depeg):   fee =", FeeCurve.calculateFee(10300), "(50bp)");
        console.log("Ratio 10400 (4% depeg):   fee =", FeeCurve.calculateFee(10400), "(87.5bp)");
        console.log("Ratio 10500 (5% depeg):   fee =", FeeCurve.calculateFee(10500), "(200bp)");
        console.log("Ratio 11000 (10% depeg):  fee =", FeeCurve.calculateFee(11000), "(250bp)");
        console.log("Ratio 12000 (20% depeg):  fee =", FeeCurve.calculateFee(12000), "(650bp)");
        console.log("Ratio 15000 (50% depeg):  fee =", FeeCurve.calculateFee(15000), "(4250bp)");
    }
}
