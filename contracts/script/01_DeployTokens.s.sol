// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";

/// @notice Deploy mUSDC and mUSDT via CREATE2 (deterministic addresses across all chains).
///         Run once per chain. Tokens are mintable by anyone (testnet only).
///
/// Usage:
///   forge script script/01_DeployTokens.s.sol --rpc-url <chain> --broadcast
contract DeployTokensScript is Script {
    uint256 constant MINT_AMOUNT = 1_000_000e6; // 1M tokens (6 decimals)

    function run() external {
        vm.startBroadcast();

        MockStablecoin mUSDC = new MockStablecoin{salt: bytes32("mUSDC")}("Mock USDC", "mUSDC");
        MockStablecoin mUSDT = new MockStablecoin{salt: bytes32("mUSDT")}("Mock USDT", "mUSDT");
        mUSDC.mint(msg.sender, MINT_AMOUNT);
        mUSDT.mint(msg.sender, MINT_AMOUNT);

        vm.stopBroadcast();

        console.log("mUSDC:", address(mUSDC));
        console.log("mUSDT:", address(mUSDT));
        console.log("Minted %s tokens to deployer", MINT_AMOUNT);
    }
}
