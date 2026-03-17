// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {AlertReceiver} from "../src/AlertReceiver.sol";

contract AlertReceiverTest is Test {
    AlertReceiver receiver;
    address callbackSender = address(0xCAFE);
    address tokenA = address(0xA);
    address tokenB = address(0xB);
    address tokenC = address(0xC);
    bytes32 pairAB = keccak256("USDC/USDT");
    bytes32 pairAC = keccak256("USDC/DAI");

    function setUp() public {
        vm.prank(address(this));
        receiver = new AlertReceiver(callbackSender);

        // Register pair (tokenA, tokenB) under pairAB
        receiver.registerPair(pairAB, tokenA, tokenB);
    }

    function test_alertReceiver_setAndGet() public {
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10400, 11155111, 600);

        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10400);
        AlertReceiver.Alert memory alert = receiver.getAlert(pairAB);
        assertEq(uint256(alert.sourceRatio), 10400);
        assertEq(uint256(alert.sourceChainId), 11155111);
        assertEq(uint256(alert.ttl), 600);
    }

    function test_alertReceiver_clearAlert() public {
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10800, 84532, 600);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10800);

        // Clear by sending ratio <= RATIO_PRECISION
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10000, 84532, 0);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 0);
    }

    function test_alertReceiver_ttlExpiry() public {
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10400, 11155111, 300);

        // Before expiry
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10400);

        // Warp past TTL
        vm.warp(block.timestamp + 301);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 0);
    }

    function test_alertReceiver_accessControl() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert("Authorized sender only");
        receiver.handleAlert(address(0), pairAB, 10200, 1301, 600);
    }

    function test_alertReceiver_multiplePairs() public {
        // Register second pair
        receiver.registerPair(pairAC, tokenA, tokenC);

        vm.startPrank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10150, 1301, 600);
        receiver.handleAlert(address(0), pairAC, 10800, 84532, 600);
        vm.stopPrank();

        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10150);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenC), 10800);
    }

    function test_alertReceiver_overwrite() public {
        vm.startPrank(callbackSender);

        receiver.handleAlert(address(0), pairAB, 10150, 1301, 600);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10150);

        // Overwrite with higher ratio
        receiver.handleAlert(address(0), pairAB, 10800, 11155111, 300);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10800);

        AlertReceiver.Alert memory alert = receiver.getAlert(pairAB);
        assertEq(uint256(alert.sourceChainId), 11155111);
        assertEq(uint256(alert.sourceRatio), 10800);
        assertEq(uint256(alert.ttl), 300);

        vm.stopPrank();
    }

    function test_alertReceiver_noAlertReturnsZero() public view {
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 0);
    }

    function test_alertReceiver_unregisteredPairReturnsZero() public {
        // Set an alert on pairAB
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10400, 11155111, 600);

        // Query with unregistered pair (tokenB, tokenC) -- should return 0
        assertEq(receiver.getCrossChainRatio(tokenB, tokenC), 0);
    }

    function test_alertReceiver_registerPair() public {
        // Register a new pair
        receiver.registerPair(pairAC, tokenA, tokenC);

        // Set alert on pairAC
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAC, 10500, 84532, 600);

        // Lookup via token addresses works
        assertEq(receiver.getCrossChainRatio(tokenA, tokenC), 10500);
        // Reverse order also works (order-independent)
        assertEq(receiver.getCrossChainRatio(tokenC, tokenA), 10500);
    }

    function test_alertReceiver_pairIsolation() public {
        // Register second pair
        receiver.registerPair(pairAC, tokenA, tokenC);

        // Set alert only on pairAB
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10500, 11155111, 600);

        // pairAB should have alert
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10500);
        // pairAC should NOT be affected
        assertEq(receiver.getCrossChainRatio(tokenA, tokenC), 0);
    }

    function test_alertReceiver_registerPairOnlyOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert("Only owner");
        receiver.registerPair(pairAC, tokenA, tokenC);
    }

    function test_alertReceiver_registerPairRejectsIdentical() public {
        vm.expectRevert("Identical tokens");
        receiver.registerPair(pairAB, tokenA, tokenA);
    }

    function test_alertReceiver_registerPairRejectsZero() public {
        vm.expectRevert("Zero address");
        receiver.registerPair(pairAB, address(0), tokenA);
    }

    function test_alertReceiver_getAlertForTokens() public {
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10400, 11155111, 600);

        AlertReceiver.Alert memory alert = receiver.getAlertForTokens(tokenA, tokenB);
        assertEq(uint256(alert.sourceRatio), 10400);
        assertEq(uint256(alert.sourceChainId), 11155111);
    }

    function test_alertReceiver_nearBalancedClearsAlert() public {
        // Set a real alert
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10400, 11155111, 600);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10400);

        // Ratio 10001 is within CLEAR_THRESHOLD (10050) -- should clear, not store
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10001, 11155111, 600);
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 0);
    }

    function test_alertReceiver_tokenOrderIndependent() public {
        vm.prank(callbackSender);
        receiver.handleAlert(address(0), pairAB, 10400, 11155111, 600);

        // Both orderings should return same ratio
        assertEq(receiver.getCrossChainRatio(tokenA, tokenB), 10400);
        assertEq(receiver.getCrossChainRatio(tokenB, tokenA), 10400);
    }
}
