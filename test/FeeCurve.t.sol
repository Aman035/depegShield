// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {FeeCurve} from "../src/FeeCurve.sol";

contract FeeCurveTest is Test {
    // ==========================================
    // Zone 1: Safe zone (ratio <= 12200)
    // ==========================================
    function test_zone1_balancedPool() public pure {
        assertEq(FeeCurve.calculateFee(10000), 100, "1.0x ratio should return BASE_FEE");
    }

    function test_zone1_atBoundary() public pure {
        assertEq(FeeCurve.calculateFee(12200), 100, "Zone 1/2 boundary should return BASE_FEE");
    }

    function test_zone1_belowThreshold() public pure {
        assertEq(FeeCurve.calculateFee(11000), 100);
        assertEq(FeeCurve.calculateFee(12000), 100);
        assertEq(FeeCurve.calculateFee(12199), 100);
    }

    // ==========================================
    // Zone 2: Warning zone (12200 < ratio <= 15000)
    // ==========================================
    function test_zone2_justAboveBoundary() public pure {
        // d=1, fee = 100 + 1/5600 = 100 (integer division)
        assertEq(FeeCurve.calculateFee(12201), 100);
    }

    function test_zone2_midpoint() public pure {
        // d=1400, fee = 100 + 1400^2/5600 = 100 + 350 = 450 (~4.5bp)
        assertEq(FeeCurve.calculateFee(13600), 450);
    }

    function test_zone2_atUpperBoundary() public pure {
        // d=2800, fee = 100 + 2800^2/5600 = 100 + 1400 = 1500 (15bp)
        assertEq(FeeCurve.calculateFee(15000), 1500);
    }

    // ==========================================
    // Zone 3: Circuit Breaker (ratio > 15000)
    // ==========================================
    function test_zone3_justAboveBoundary() public pure {
        // e=1, fee = 1500 + 1 = 1501 (continuity check)
        assertEq(FeeCurve.calculateFee(15001), 1501);
    }

    function test_zone3_65_35_split() public pure {
        // ratio 1.857 = 18571, e=3571, fee = 1500 + 3571 = 5071 (~50bp)
        assertEq(FeeCurve.calculateFee(18571), 5071);
    }

    function test_zone3_70_30_split() public pure {
        // ratio 2.333 = 23333, e=8333, fee = 1500 + 8333 = 9833 (~98bp)
        assertEq(FeeCurve.calculateFee(23333), 9833);
    }

    function test_zone3_80_20_split() public pure {
        // ratio 4.0 = 40000, e=25000, fee = 1500 + 25000 = 26500 (~265bp)
        assertEq(FeeCurve.calculateFee(40000), 26500);
    }

    function test_zone3_90_10_split() public pure {
        // ratio 9.0 = 90000, e=75000, fee = 1500 + 75000 = 76500 (~765bp)
        assertEq(FeeCurve.calculateFee(90000), 76500);
    }

    // ==========================================
    // Cap at MAX_FEE
    // ==========================================
    function test_maxFeeCap() public pure {
        // MAX_FEE = 500000. fee = 1500 + e, so e = 498500 → ratio = 513500
        assertEq(FeeCurve.calculateFee(513500), 500000);
    }

    function test_maxFeeCap_extremeRatio() public pure {
        assertEq(FeeCurve.calculateFee(1000000), 500000);
    }

    function test_maxFeeCap_maxUint() public pure {
        assertEq(FeeCurve.calculateFee(type(uint256).max), 500000);
    }

    // ==========================================
    // Continuity at zone boundaries
    // ==========================================
    function test_continuity_zone12() public pure {
        uint24 atBoundary = FeeCurve.calculateFee(12200);
        uint24 justAbove = FeeCurve.calculateFee(12201);
        // Should be continuous (no jump)
        assertLe(justAbove - atBoundary, 1, "Zone 1/2 transition should be smooth");
    }

    function test_continuity_zone23() public pure {
        uint24 atBoundary = FeeCurve.calculateFee(15000);
        uint24 justAbove = FeeCurve.calculateFee(15001);
        // fee goes from 1500 to 1501, delta = 1
        assertEq(justAbove - atBoundary, 1, "Zone 2/3 transition should be smooth");
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
        console.log("=== Fee Curve Values ===");
        console.log("Ratio 10000 (50/50):  fee =", FeeCurve.calculateFee(10000));
        console.log("Ratio 12200 (55/45):  fee =", FeeCurve.calculateFee(12200));
        console.log("Ratio 13600 (mid-Z2): fee =", FeeCurve.calculateFee(13600));
        console.log("Ratio 15000 (60/40):  fee =", FeeCurve.calculateFee(15000));
        console.log("Ratio 18571 (65/35):  fee =", FeeCurve.calculateFee(18571));
        console.log("Ratio 23333 (70/30):  fee =", FeeCurve.calculateFee(23333));
        console.log("Ratio 40000 (80/20):  fee =", FeeCurve.calculateFee(40000));
        console.log("Ratio 90000 (90/10):  fee =", FeeCurve.calculateFee(90000));
    }
}
