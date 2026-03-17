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
            poolId: 0x108bd10edacc12795a6055ee83cb79073fe747f0f7718c7302e98b26e8655029
        });

        // Base Sepolia: PoolManager + PoolId
        pools[1] = ReactiveMonitor.PoolConfig({
            chainId: 84532,
            poolAddr: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408,
            pairId: pairId,
            poolType: ReactiveMonitor.PoolType.UNISWAP_V4,
            poolId: 0x6e94cdca9867ed71c973be329f1dc07d8637394f4d88a0903b56a7913c00fc99
        });

        // Unichain Sepolia: PoolManager + PoolId
        pools[2] = ReactiveMonitor.PoolConfig({
            chainId: 1301,
            poolAddr: 0x00B036B58a818B1BC34d502D3fE730Db729e62AC,
            pairId: pairId,
            poolType: ReactiveMonitor.PoolType.UNISWAP_V4,
            poolId: 0x99a19ea3120e6cf78bb8887c846e2659bb48644213f8256be4c371768ca86215
        });

        ReactiveMonitor.DestConfig[] memory dests = new ReactiveMonitor.DestConfig[](3);

        // Sepolia AlertReceiver
        dests[0] = ReactiveMonitor.DestConfig({
            chainId: 11155111,
            alertReceiver: 0xDfa0A5FB820dad9f94259a51C340a227706bf566
        });

        // Base Sepolia AlertReceiver
        dests[1] = ReactiveMonitor.DestConfig({
            chainId: 84532,
            alertReceiver: 0xCFdAf5c867592BFB967d63839E5738da366814dC
        });

        // Unichain Sepolia AlertReceiver
        dests[2] = ReactiveMonitor.DestConfig({
            chainId: 1301,
            alertReceiver: 0x137b8d50BD5c3794103636E4E18a49e973c2d9a2
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
