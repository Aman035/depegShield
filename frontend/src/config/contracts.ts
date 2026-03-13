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

export const MOCK_STABLECOIN_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "zeroForOne", type: "bool" },
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "hookData", type: "bytes" },
      { name: "receiver", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "payable",
  },
] as const;

export const DYNAMIC_FEE_FLAG = 0x800000;
export const DEFAULT_TICK_SPACING = 10;

// Deployed DepegShieldHook addresses per chain
export const HOOK_ADDRESSES: Record<number, `0x${string}`> = {
  1301: "0x3B101a77A6467E457b3CEFa7Fb4964Da1FBD40c0",     // Unichain Sepolia
  11155111: "0x06AAaA578EFe1A6ACbE78DAB5cdE791a0BF040C0",  // Sepolia
  84532: "0x1CF03b90D93D33C73d3215Ba73003C69EF6040c0",     // Base Sepolia
};

// Hookmate V4 SwapRouter addresses per chain
export const SWAP_ROUTER_ADDRESSES: Record<number, `0x${string}`> = {
  1301: "0x9cD2b0a732dd5e023a5539921e0FD1c30E198Dba",     // Unichain Sepolia
  11155111: "0xf13D190e9117920c703d79B5F33732e10049b115",  // Sepolia
  84532: "0x71cD4Ea054F9Cb3D3BF6251A00673303411A7DD9",     // Base Sepolia
};

// Deployed mock stablecoin addresses (same across all chains via CREATE2)
export const TOKEN_ADDRESSES = {
  mUSDC: "0xD6E322dE450F9A276f2F3AFe72bC0C93D5284Ef0" as `0x${string}`,
  mUSDT: "0xf02383D4eBcF11016Df5AdAEB5899B947bcC0098" as `0x${string}`,
};

// Token decimals
export const TOKEN_DECIMALS = 6;

// Explorer URLs per chain
export const EXPLORER_URLS: Record<number, string> = {
  1301: "https://sepolia.uniscan.xyz",
  11155111: "https://sepolia.etherscan.io",
  84532: "https://sepolia.basescan.org",
};
