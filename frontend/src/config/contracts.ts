export const DEPEG_SHIELD_ABI = [
  {
    type: "function",
    name: "getImbalanceRatio",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVirtualReserves",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    outputs: [
      { name: "reserve0", type: "uint256" },
      { name: "reserve1", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getFeeForRatio",
    inputs: [{ name: "ratio", type: "uint256" }],
    outputs: [{ name: "", type: "uint24" }],
    stateMutability: "pure",
  },
  {
    type: "event",
    name: "SwapFeeApplied",
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "imbalanceRatio", type: "uint256", indexed: false },
      { name: "worsensImbalance", type: "bool", indexed: false },
      { name: "feeApplied", type: "uint24", indexed: false },
    ],
  },
] as const;

export const DYNAMIC_FEE_FLAG = 0x800000;
export const DEFAULT_TICK_SPACING = 60;

// Deployed DepegShieldHook addresses per chain
export const HOOK_ADDRESSES: Record<number, `0x${string}`> = {
  1301: "0x412F8228bEBF33F6Ee201160E45acE3aC80Fc0C0",     // Unichain Sepolia
  11155111: "0x36B139874ad990949D27f2Dd18e7C0EF9F6040C0",  // Sepolia
  84532: "0x18C33E2e1327f2b4782cb06a47cFe7D932C500C0",     // Base Sepolia
};

// Deployed mock stablecoin addresses (same across all chains via CREATE2)
export const TOKEN_ADDRESSES = {
  mUSDC: "0x996644D92645985292D57Ae903C14E58e8b6377C" as `0x${string}`,
  mUSDT: "0x2ce34021d26ef21bd74E16544e117814593A9588" as `0x${string}`,
};
