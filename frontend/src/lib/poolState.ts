/**
 * Read Uniswap v4 pool state directly from PoolManager via extsload.
 *
 * PoolManager exposes `extsload(bytes32 slot) -> bytes32` publicly.
 * StateLibrary's storage layout:
 *   POOLS_SLOT = 6
 *   stateSlot = keccak256(abi.encode(poolId, POOLS_SLOT))
 *   slot0 (stateSlot + 0): sqrtPriceX96 (160) | tick (24) | protocolFee (24) | lpFee (24)
 *   slot3 (stateSlot + 3): liquidity (128)
 *
 * poolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
 */

import { type Address, encodeAbiParameters, keccak256, pad, toHex } from "viem";

const POOLS_SLOT = BigInt(6);
const LIQUIDITY_OFFSET = BigInt(3);

export const EXTSLOAD_ABI = [
  {
    type: "function",
    name: "extsload",
    inputs: [{ name: "slot", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;

export const POOL_MANAGER_ADDRESSES: Record<number, Address> = {
  1301: "0x00B036B58a818B1BC34d502D3fE730Db729e62AC",     // Unichain Sepolia
  11155111: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",  // Sepolia
  84532: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",     // Base Sepolia
};

/** Compute poolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks)) */
export function computePoolId(
  currency0: Address,
  currency1: Address,
  fee: number,
  tickSpacing: number,
  hooks: Address,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [currency0.toLowerCase() as Address, currency1.toLowerCase() as Address, fee, tickSpacing, hooks.toLowerCase() as Address],
    ),
  );
}

/** Compute the base storage slot for a pool's state */
export function getPoolStateSlot(poolId: `0x${string}`): bigint {
  const slot = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [poolId, POOLS_SLOT],
    ),
  );
  return BigInt(slot);
}

/** Parse slot0 packed data: sqrtPriceX96 (160) | tick (24) | protocolFee (24) | lpFee (24) */
export function parseSlot0(data: `0x${string}`) {
  const value = BigInt(data);
  const MASK_160 = (BigInt(1) << BigInt(160)) - BigInt(1);
  const MASK_24 = (BigInt(1) << BigInt(24)) - BigInt(1);

  const sqrtPriceX96 = value & MASK_160;
  const tickRaw = Number((value >> BigInt(160)) & MASK_24);
  // Sign-extend 24-bit tick
  const tick = tickRaw >= 0x800000 ? tickRaw - 0x1000000 : tickRaw;
  const protocolFee = Number((value >> BigInt(184)) & MASK_24);
  const lpFee = Number((value >> BigInt(208)) & MASK_24);

  return { sqrtPriceX96, tick, protocolFee, lpFee };
}

/** Parse liquidity slot: lower 128 bits */
export function parseLiquidity(data: `0x${string}`): bigint {
  const MASK_128 = (BigInt(1) << BigInt(128)) - BigInt(1);
  return BigInt(data) & MASK_128;
}

/** Get the extsload slot for slot0 (sqrtPriceX96 + tick) */
export function getSlot0Key(poolId: `0x${string}`): `0x${string}` {
  const base = getPoolStateSlot(poolId);
  return pad(toHex(base), { size: 32 });
}

/** Get the extsload slot for liquidity */
export function getLiquidityKey(poolId: `0x${string}`): `0x${string}` {
  const base = getPoolStateSlot(poolId);
  return pad(toHex(base + LIQUIDITY_OFFSET), { size: 32 });
}
