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
            poolId: 0xdc52a01aabd01f0ec5c0eeccef433e918a36eadf468983f2c9f0ec7a96d364e0
        });

        // Base Sepolia: PoolManager + PoolId
        pools[1] = ReactiveMonitor.PoolConfig({
            chainId: 84532,
            poolAddr: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408,
            pairId: pairId,
            poolType: ReactiveMonitor.PoolType.UNISWAP_V4,
            poolId: 0x52e35422afb4629f1124e5c6db7f265f53689ee4752a105c80c0ff31145b6291
        });

        // Unichain Sepolia: PoolManager + PoolId
        pools[2] = ReactiveMonitor.PoolConfig({
            chainId: 1301,
            poolAddr: 0x00B036B58a818B1BC34d502D3fE730Db729e62AC,
            pairId: pairId,
            poolType: ReactiveMonitor.PoolType.UNISWAP_V4,
            poolId: 0x00b590714f08485053f3fd2354d1479503c3de52aa2756a32c4f174c8a9e7d11
        });

        ReactiveMonitor.DestConfig[] memory dests = new ReactiveMonitor.DestConfig[](3);

        // Sepolia AlertReceiver
        dests[0] = ReactiveMonitor.DestConfig({
            chainId: 11155111,
            alertReceiver: 0x38f09Ee073E52cb2B18cDec0b7626Ec5f3D93C79
        });

        // Base Sepolia AlertReceiver
        dests[1] = ReactiveMonitor.DestConfig({
            chainId: 84532,
            alertReceiver: 0xB25AC436f9BC71Ab36745bF3bC550649e3ec2A48
        });

        // Unichain Sepolia AlertReceiver
        dests[2] = ReactiveMonitor.DestConfig({
            chainId: 1301,
            alertReceiver: 0xB25AC436f9BC71Ab36745bF3bC550649e3ec2A48
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
