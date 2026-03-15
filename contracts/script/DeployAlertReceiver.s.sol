// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AlertReceiver} from "../src/AlertReceiver.sol";

/// @notice Deploy AlertReceiver on a destination chain.
/// Pass the chain-specific Callback Proxy address as constructor arg.
///
/// Usage:
///   CALLBACK_PROXY=0x... forge script script/DeployAlertReceiver.s.sol --rpc-url <chain> --broadcast
contract DeployAlertReceiverScript is Script {
    function run() external {
        address callbackProxy = vm.envAddress("CALLBACK_PROXY");

        vm.startBroadcast();
        AlertReceiver receiver = new AlertReceiver(callbackProxy);
        vm.stopBroadcast();

        console.log("AlertReceiver deployed:", address(receiver));
        console.log("Callback Proxy:", callbackProxy);
        console.log("Chain ID:", block.chainid);
    }
}
