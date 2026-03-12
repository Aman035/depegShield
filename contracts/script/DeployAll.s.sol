// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {AddressConstants} from "hookmate/constants/AddressConstants.sol";

import {MockStablecoin} from "../src/MockStablecoin.sol";
import {DepegShieldHook} from "../src/DepegShieldHook.sol";

/// @notice Deploys mUSDC, mUSDT, DepegShieldHook, creates pool, and adds liquidity.
/// Run once per chain. Logs all deployed addresses.
contract DeployAllScript is Script {
    using CurrencyLibrary for Currency;

    int24 constant TICK_SPACING = 10;           // ~0.1% per tick, suitable for stablecoins
    uint160 constant STARTING_PRICE = 2 ** 96; // 1:1
    uint256 constant MINT_AMOUNT = 1_000_000e6; // 1M tokens (6 decimals)
    uint256 constant LP_AMOUNT = 100_000e6;   // 100K per side
    int24 constant LP_TICK_RANGE = 1000;       // ±1000 ticks = ~±10% price range

    function run() external {
        address deployer = msg.sender;
        IPoolManager poolManager = IPoolManager(AddressConstants.getPoolManagerAddress(block.chainid));
        IPositionManager positionManager = IPositionManager(AddressConstants.getPositionManagerAddress(block.chainid));
        IPermit2 permit2 = IPermit2(AddressConstants.getPermit2Address());

        vm.startBroadcast();

        // 1. Deploy tokens + mint
        MockStablecoin mUSDC = new MockStablecoin("Mock USDC", "mUSDC");
        MockStablecoin mUSDT = new MockStablecoin("Mock USDT", "mUSDT");
        mUSDC.mint(deployer, MINT_AMOUNT);
        mUSDT.mint(deployer, MINT_AMOUNT);

        // 2. Deploy hook
        DepegShieldHook hook = _deployHook(poolManager);

        // 3. Sort tokens
        (address addr0, address addr1) = address(mUSDC) < address(mUSDT)
            ? (address(mUSDC), address(mUSDT))
            : (address(mUSDT), address(mUSDC));

        // 4. Approvals
        _approveTokens(addr0, addr1, permit2, positionManager);

        // 5. Create pool + add liquidity
        _createPoolAndLiquidity(addr0, addr1, hook, positionManager, deployer);

        vm.stopBroadcast();

        console.log("--- Deployment Summary ---");
        console.log("Chain ID:", block.chainid);
        console.log("mUSDC:", address(mUSDC));
        console.log("mUSDT:", address(mUSDT));
        console.log("Hook:", address(hook));
        console.log("currency0:", addr0);
        console.log("currency1:", addr1);
        console.log("tickSpacing:", uint24(TICK_SPACING));
        console.log("LP range: +/-", uint24(LP_TICK_RANGE), "ticks (~+/-10%)");
    }

    function _deployHook(IPoolManager poolManager) internal returns (DepegShieldHook) {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        bytes memory constructorArgs = abi.encode(poolManager);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(DepegShieldHook).creationCode, constructorArgs);

        DepegShieldHook hook = new DepegShieldHook{salt: salt}(poolManager);
        require(address(hook) == hookAddress, "Hook address mismatch");
        return hook;
    }

    function _approveTokens(
        address token0,
        address token1,
        IPermit2 permit2,
        IPositionManager positionManager
    ) internal {
        MockStablecoin(token0).approve(address(permit2), type(uint256).max);
        MockStablecoin(token1).approve(address(permit2), type(uint256).max);
        permit2.approve(token0, address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(token1, address(positionManager), type(uint160).max, type(uint48).max);
    }

    function _createPoolAndLiquidity(
        address token0,
        address token1,
        DepegShieldHook hook,
        IPositionManager positionManager,
        address deployer
    ) internal {
        Currency currency0 = Currency.wrap(token0);
        Currency currency1 = Currency.wrap(token1);

        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });

        int24 currentTick = TickMath.getTickAtSqrtPrice(STARTING_PRICE);
        int24 tickLower = _truncate(currentTick - LP_TICK_RANGE, TICK_SPACING);
        int24 tickUpper = _truncate(currentTick + LP_TICK_RANGE, TICK_SPACING);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            STARTING_PRICE,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            LP_AMOUNT,
            LP_AMOUNT
        );

        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR),
            uint8(Actions.SWEEP),
            uint8(Actions.SWEEP)
        );

        bytes[] memory mintParams = new bytes[](4);
        mintParams[0] = abi.encode(poolKey, tickLower, tickUpper, liquidity, LP_AMOUNT + 1, LP_AMOUNT + 1, deployer, new bytes(0));
        mintParams[1] = abi.encode(currency0, currency1);
        mintParams[2] = abi.encode(currency0, deployer);
        mintParams[3] = abi.encode(currency1, deployer);

        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSelector(positionManager.initializePool.selector, poolKey, STARTING_PRICE, new bytes(0));
        calls[1] = abi.encodeWithSelector(
            positionManager.modifyLiquidities.selector,
            abi.encode(actions, mintParams),
            block.timestamp + 3600
        );

        positionManager.multicall(calls);
    }

    function _truncate(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        /// forge-lint: disable-next-line(divide-before-multiply)
        return (tick / tickSpacing) * tickSpacing;
    }
}
