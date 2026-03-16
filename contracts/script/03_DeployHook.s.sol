// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {AddressConstants} from "hookmate/constants/AddressConstants.sol";
import {DepegShieldHook} from "../src/DepegShieldHook.sol";

/// @notice Mine a CREATE2 salt and deploy DepegShieldHook with the correct flag-encoded address.
///         Requires ALERT_RECEIVER env var (address(0) to disable cross-chain).
///
/// Usage:
///   ALERT_RECEIVER=0x... forge script script/03_DeployHook.s.sol --rpc-url <chain> --broadcast
contract DeployHookScript is Script {
    function run() external {
        address alertReceiverAddr = vm.envOr("ALERT_RECEIVER", address(0));
        IPoolManager poolManager = IPoolManager(AddressConstants.getPoolManagerAddress(block.chainid));

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        bytes memory constructorArgs = abi.encode(poolManager, alertReceiverAddr);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(DepegShieldHook).creationCode, constructorArgs);

        vm.startBroadcast();
        DepegShieldHook hook = new DepegShieldHook{salt: salt}(poolManager, alertReceiverAddr);
        vm.stopBroadcast();

        require(address(hook) == hookAddress, "Hook address mismatch");

        console.log("Hook:", address(hook));
        console.log("AlertReceiver:", alertReceiverAddr);
        console.log("PoolManager:", address(poolManager));
        console.log("Chain ID:", block.chainid);
    }
}
