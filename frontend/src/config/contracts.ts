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

export const ALERT_RECEIVER_ABI = [
  {
    type: "function",
    name: "getCrossChainRatio",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "ratio", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAlert",
    inputs: [{ name: "pairId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sourceRatio", type: "uint128" },
          { name: "timestamp", type: "uint40" },
          { name: "ttl", type: "uint40" },
          { name: "sourceChainId", type: "uint48" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAlertForTokens",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "sourceRatio", type: "uint128" },
          { name: "timestamp", type: "uint40" },
          { name: "ttl", type: "uint40" },
          { name: "sourceChainId", type: "uint48" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerPair",
    inputs: [
      { name: "pairId", type: "bytes32" },
      { name: "localToken0", type: "address" },
      { name: "localToken1", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "handleAlert",
    inputs: [
      { name: "rvmId", type: "address" },
      { name: "pairId", type: "bytes32" },
      { name: "sourceRatio", type: "uint256" },
      { name: "sourceChainId", type: "uint256" },
      { name: "ttl", type: "uint40" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AlertSet",
    inputs: [
      { name: "pairId", type: "bytes32", indexed: true },
      { name: "sourceRatio", type: "uint128", indexed: false },
      { name: "sourceChainId", type: "uint48", indexed: false },
      { name: "ttl", type: "uint40", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PairRegistered",
    inputs: [
      { name: "pairId", type: "bytes32", indexed: true },
      { name: "token0", type: "address", indexed: false },
      { name: "token1", type: "address", indexed: false },
    ],
  },
] as const;

// AlertReceiver addresses per chain (deployed alongside hooks)
export const ALERT_RECEIVER_ADDRESSES: Record<number, `0x${string}`> = {
  1301: "0x137b8d50bd5c3794103636e4e18a49e973c2d9a2",     // Unichain Sepolia
  11155111: "0xdfa0a5fb820dad9f94259a51c340a227706bf566",  // Sepolia
  84532: "0xcfdaf5c867592bfb967d63839e5738da366814dc",     // Base Sepolia
};

// Chain display names
export const CHAIN_NAMES: Record<number, string> = {
  1301: "Unichain Sepolia",
  11155111: "Sepolia",
  84532: "Base Sepolia",
  5318007: "Reactive Lasna",
};

export const DYNAMIC_FEE_FLAG = 0x800000;
export const DEFAULT_TICK_SPACING = 10;

// Deployed DepegShieldHook addresses per chain
export const HOOK_ADDRESSES: Record<number, `0x${string}`> = {
  1301: "0x8eab304b3a950f7c85e168a1ce6b159f132100c0",     // Unichain Sepolia
  11155111: "0xd3ad90041576954255d8fa1325774b90e501c0c0",  // Sepolia
  84532: "0x057cb98f4891c6bef266497524e64f09ef5180c0",     // Base Sepolia
};

// Hookmate V4 SwapRouter addresses per chain
export const SWAP_ROUTER_ADDRESSES: Record<number, `0x${string}`> = {
  1301: "0x9cD2b0a732dd5e023a5539921e0FD1c30E198Dba",     // Unichain Sepolia
  11155111: "0xf13D190e9117920c703d79B5F33732e10049b115",  // Sepolia
  84532: "0x71cD4Ea054F9Cb3D3BF6251A00673303411A7DD9",     // Base Sepolia
};

// Deployed mock stablecoin addresses (same on all chains via CREATE2)
export const TOKEN_ADDRESSES = {
  mUSDC: "0x58C414Bd85bf1d39985476Dfa5fBd59af356E8f0" as `0x${string}`,
  mUSDT: "0x2170d1eC7B1392611323A4c1793e580349CC5CC0" as `0x${string}`,
};

// Token decimals
export const TOKEN_DECIMALS = 6;

// Explorer URLs per chain
export const EXPLORER_URLS: Record<number, string> = {
  1301: "https://sepolia.uniscan.xyz",
  11155111: "https://sepolia.etherscan.io",
  84532: "https://sepolia.basescan.org",
};
