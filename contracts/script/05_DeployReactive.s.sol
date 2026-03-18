// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ReactiveMonitor} from "../src/reactive/ReactiveMonitor.sol";

/// @notice Deploy ReactiveMonitor on Reactive Lasna testnet (chain 5318007).
/// All pool and destination configuration is passed in the constructor so that
/// the RVM instance has the same state (see dual-state environment docs).
///
/// Usage:
///   forge create --rpc-url https://lasna-rpc.rnk.dev/ \
///     --private-key $PK --broadcast \
///     src/reactive/ReactiveMonitor.sol:ReactiveMonitor \
///     --constructor-args "[(chainId,poolAddr,pairId,poolType,poolId),...]" "[...]"
///
/// Or use this script for readability:
///   forge script script/DeployReactive.s.sol --rpc-url https://lasna-rpc.rnk.dev/ --broadcast
contract DeployReactiveScript is Script {
    function run() external {
        // --- Configuration ---
        bytes32 pairId = keccak256("USDC/USDT");

        ReactiveMonitor.PoolConfig[] memory pools = new ReactiveMonitor.PoolConfig[](3);

        // Sepolia: PoolManager + PoolId
        pools[0] = ReactiveMonitor.PoolConfig({
            chainId: 11155111,
            poolAddr: 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543,
            pairId: pairId,
            poolType: ReactiveMonitor.PoolType.UNISWAP_V4,
            poolId: 0xbc0c75c7f605631b306f1422bd419fcf72448f2eb5650a4950631082ac9e2e1d
        });

        // Base Sepolia: PoolManager + PoolId
        pools[1] = ReactiveMonitor.PoolConfig({
            chainId: 84532,
            poolAddr: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408,
            pairId: pairId,
            poolType: ReactiveMonitor.PoolType.UNISWAP_V4,
            poolId: 0xbf3bb13efd5d8a8770a2ac977e396f0ba4f8cc469ff66f93e0c309d33475aebc
        });

        // Unichain Sepolia: PoolManager + PoolId
        pools[2] = ReactiveMonitor.PoolConfig({
            chainId: 1301,
            poolAddr: 0x00B036B58a818B1BC34d502D3fE730Db729e62AC,
            pairId: pairId,
            poolType: ReactiveMonitor.PoolType.UNISWAP_V4,
            poolId: 0x6a076d9f4fd931f2a6f507011e5c50a06ff424695d002ac8e5db45d4125045b3
        });

        ReactiveMonitor.DestConfig[] memory dests = new ReactiveMonitor.DestConfig[](3);

        // Sepolia AlertReceiver
        dests[0] = ReactiveMonitor.DestConfig({
            chainId: 11155111,
            alertReceiver: 0x6bFe889e87A51634194B9447201548BEc8D825C3
        });

        // Base Sepolia AlertReceiver
        dests[1] = ReactiveMonitor.DestConfig({
            chainId: 84532,
            alertReceiver: 0x92a8497C788d43572Fe29f144E6FF015AE3Ff22d
        });

        // Unichain Sepolia AlertReceiver
        dests[2] = ReactiveMonitor.DestConfig({
            chainId: 1301,
            alertReceiver: 0xfe8BA3Fa183C98d637fd549f579670b3cB63b199
        });

        // --- Deploy ---
        vm.startBroadcast();
        ReactiveMonitor monitor = new ReactiveMonitor(pools, dests);
        vm.stopBroadcast();

        console.log("ReactiveMonitor deployed:", address(monitor));
        console.log("Chain ID:", block.chainid);
        console.log("Pools:", pools.length);
        console.log("Destinations:", dests.length);
        console.log("PairId:", vm.toString(pairId));
        console.log("");
        console.log("Next: fund the contract with lREACT for callback gas");
    }
}
