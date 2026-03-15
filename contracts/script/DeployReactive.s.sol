// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ReactiveMonitor} from "../src/reactive/ReactiveMonitor.sol";

/// @notice Deploy ReactiveMonitor on Reactive Lasna testnet (chain 5318007).
/// After deployment, call addMonitoredPool and addDestination for each chain.
///
/// Usage:
///   forge script script/DeployReactive.s.sol --rpc-url reactive_lasna --broadcast
contract DeployReactiveScript is Script {
    function run() external {
        vm.startBroadcast();
        ReactiveMonitor monitor = new ReactiveMonitor();
        vm.stopBroadcast();

        console.log("ReactiveMonitor deployed:", address(monitor));
        console.log("Chain ID:", block.chainid);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Call addMonitoredPool(...) for each hook on each chain");
        console.log("  2. Call addDestination(...) for each AlertReceiver");
        console.log("  3. Fund the monitor contract with lREACT");
    }
}
