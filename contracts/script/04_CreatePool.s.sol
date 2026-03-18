// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {AddressConstants} from "hookmate/constants/AddressConstants.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {DepegShieldHook} from "../src/DepegShieldHook.sol";

/// @notice Initialize a mUSDC/mUSDT pool with a DepegShieldHook and seed liquidity.
///         Requires HOOK env var (the deployed hook address from step 03).
///         Mints tokens to deployer if needed, then creates pool at 1:1 price.
///
/// Usage:
///   HOOK=0x... forge script script/04_CreatePool.s.sol --rpc-url <chain> --broadcast
contract CreatePoolScript is Script {
    int24 constant TICK_SPACING = 10;
    uint160 constant STARTING_PRICE = 2 ** 96; // 1:1
    uint256 constant LP_AMOUNT = 100_000e6;     // 100K per side
    int24 constant LP_TICK_RANGE = 1000;        // +/-10% range

    address constant MUSDC = 0x58C414Bd85bf1d39985476Dfa5fBd59af356E8f0;
    address constant MUSDT = 0x2170d1eC7B1392611323A4c1793e580349CC5CC0;

    function run() external {
        address hookAddr = vm.envAddress("HOOK");
        (address token0, address token1) = MUSDC < MUSDT ? (MUSDC, MUSDT) : (MUSDT, MUSDC);

        vm.startBroadcast();
        _mintAndApprove(token0, token1);
        _initPoolAndMintLP(token0, token1, hookAddr);
        vm.stopBroadcast();

        console.log("Pool created on chain:", block.chainid);
        console.log("Hook:", hookAddr);
        console.log("currency0:", token0);
        console.log("currency1:", token1);
    }

    function _mintAndApprove(address token0, address token1) internal {
        IPermit2 permit2 = IPermit2(AddressConstants.getPermit2Address());
        IPositionManager posm = IPositionManager(AddressConstants.getPositionManagerAddress(block.chainid));

        MockStablecoin(MUSDC).mint(msg.sender, LP_AMOUNT + 1000e6);
        MockStablecoin(MUSDT).mint(msg.sender, LP_AMOUNT + 1000e6);
        MockStablecoin(token0).approve(address(permit2), type(uint256).max);
        MockStablecoin(token1).approve(address(permit2), type(uint256).max);
        permit2.approve(token0, address(posm), type(uint160).max, type(uint48).max);
        permit2.approve(token1, address(posm), type(uint160).max, type(uint48).max);
    }

    function _initPoolAndMintLP(address token0, address token1, address hookAddr) internal {
        IPositionManager posm = IPositionManager(AddressConstants.getPositionManagerAddress(block.chainid));

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: DepegShieldHook(hookAddr)
        });

        int24 tickLower = _truncate(-LP_TICK_RANGE, TICK_SPACING);
        int24 tickUpper = _truncate(LP_TICK_RANGE, TICK_SPACING);

        uint128 liq = LiquidityAmounts.getLiquidityForAmounts(
            STARTING_PRICE,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            LP_AMOUNT, LP_AMOUNT
        );

        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSelector(posm.initializePool.selector, poolKey, STARTING_PRICE, new bytes(0));
        calls[1] = _encodeMintCall(posm, poolKey, tickLower, tickUpper, liq);
        posm.multicall(calls);
    }

    function _encodeMintCall(
        IPositionManager posm,
        PoolKey memory poolKey,
        int24 tickLower,
        int24 tickUpper,
        uint128 liq
    ) internal view returns (bytes memory) {
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR),
            uint8(Actions.SWEEP), uint8(Actions.SWEEP)
        );
        bytes[] memory p = new bytes[](4);
        p[0] = abi.encode(poolKey, tickLower, tickUpper, liq, LP_AMOUNT + 1, LP_AMOUNT + 1, msg.sender, new bytes(0));
        p[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        p[2] = abi.encode(poolKey.currency0, msg.sender);
        p[3] = abi.encode(poolKey.currency1, msg.sender);
        return abi.encodeWithSelector(posm.modifyLiquidities.selector, abi.encode(actions, p), block.timestamp + 3600);
    }

    function _truncate(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        /// forge-lint: disable-next-line(divide-before-multiply)
        return (tick / tickSpacing) * tickSpacing;
    }
}
