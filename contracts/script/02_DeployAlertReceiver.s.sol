// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AlertReceiver} from "../src/AlertReceiver.sol";

/// @notice Deploy AlertReceiver and register the mUSDC/mUSDT pair.
///         Requires CALLBACK_PROXY env var (chain-specific Reactive Network callback proxy).
///
/// Usage:
///   CALLBACK_PROXY=0x... forge script script/02_DeployAlertReceiver.s.sol --rpc-url <chain> --broadcast
///
/// Callback proxy addresses:
///   Sepolia:          0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA
///   Base Sepolia:     0xa6eA49Ed671B8a4dfCDd34E36b7a75Ac79B8A5a6
///   Unichain Sepolia: 0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4
contract DeployAlertReceiverScript is Script {
    // Existing token addresses (same on all chains via CREATE2)
    address constant MUSDC = 0x58C414Bd85bf1d39985476Dfa5fBd59af356E8f0;
    address constant MUSDT = 0x2170d1eC7B1392611323A4c1793e580349CC5CC0;

    function run() external {
        address callbackProxy = vm.envAddress("CALLBACK_PROXY");

        vm.startBroadcast();

        AlertReceiver receiver = new AlertReceiver(callbackProxy);

        // Register mUSDC/mUSDT pair
        bytes32 pairId = keccak256("USDC/USDT");
        (address token0, address token1) = MUSDC < MUSDT ? (MUSDC, MUSDT) : (MUSDT, MUSDC);
        receiver.registerPair(pairId, token0, token1);

        vm.stopBroadcast();

        console.log("AlertReceiver:", address(receiver));
        console.log("Callback Proxy:", callbackProxy);
        console.log("PairId (USDC/USDT):", vm.toString(pairId));
        console.log("Chain ID:", block.chainid);
    }
}
