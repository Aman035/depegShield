export interface WaveData {
  label: string;
  amount: number;
  ratioStart: number;
  ratioEnd: number;
  shieldFeeBps: number;
  shieldOut: number;
  flatOut: number;
  isBuy?: boolean;
}

export interface ScenarioData {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  description: string;
  outcome: "recovery" | "attack-recovery" | "collapse";
  waves: WaveData[];
  result: {
    shieldFees: number; // millitokens
    flatFees: number;
    multiplier: number;
    summary: string;
  };
}

// Wave data calibrated from forge test output (DepegScenario.t.sol)
// Pool: L=1000e18 full-range, starting at 1:1
export const scenarios: ScenarioData[] = [
  {
    id: "usdc",
    title: "SVB / USDC Depeg",
    subtitle: "Recovery in 48h",
    date: "March 2023",
    description:
      "Circle disclosed $3.3B stuck at SVB. USDC dropped to $0.87 (~13% depeg). 3,400 Aave positions liquidated. Peg recovered in 48h after FDIC backstop.",
    outcome: "recovery",
    waves: [
      { label: "Early sells", amount: 15, ratioStart: 10000, ratioEnd: 10302, shieldFeeBps: 1, shieldOut: 14, flatOut: 14 },
      { label: "Panic builds", amount: 20, ratioStart: 10302, ratioEnd: 10710, shieldFeeBps: 50, shieldOut: 18, flatOut: 19 },
      { label: "Peak crisis", amount: 22, ratioStart: 10710, ratioEnd: 11160, shieldFeeBps: 208, shieldOut: 19, flatOut: 20 },
      { label: "Late sellers", amount: 15, ratioStart: 11160, ratioEnd: 11470, shieldFeeBps: 287, shieldOut: 12, flatOut: 13 },
      { label: "Recovery", amount: 80, ratioStart: 11470, ratioEnd: 10274, shieldFeeBps: 0, shieldOut: 84, flatOut: 84, isBuy: true },
    ],
    result: {
      shieldFees: 991,
      flatFees: 15,
      multiplier: 65,
      summary: "Pool recovered to ~50/50. DepegShield LPs earned 65x more for bearing the same risk. Zero-fee rebalancing accelerated recovery.",
    },
  },
  {
    id: "usdt",
    title: "USDT Whale Attack",
    subtitle: "Quick Recovery",
    date: "June 2023",
    description:
      "A single entity dumped 31.5M USDT across DEX pools. USDT depegged to $0.997. Individual pool tilts reached 3-4%. Recovery within hours.",
    outcome: "attack-recovery",
    waves: [
      { label: "Tranche 1", amount: 5, ratioStart: 10000, ratioEnd: 10100, shieldFeeBps: 1, shieldOut: 4, flatOut: 4 },
      { label: "Tranche 2", amount: 5, ratioStart: 10100, ratioEnd: 10200, shieldFeeBps: 5, shieldOut: 4, flatOut: 4 },
      { label: "Tranche 3", amount: 5, ratioStart: 10200, ratioEnd: 10302, shieldFeeBps: 16, shieldOut: 4, flatOut: 4 },
      { label: "Tranche 4", amount: 5, ratioStart: 10302, ratioEnd: 10403, shieldFeeBps: 50, shieldOut: 4, flatOut: 4 },
      { label: "Arb recovery", amount: 25, ratioStart: 10403, ratioEnd: 10108, shieldFeeBps: 0, shieldOut: 25, flatOut: 25, isBuy: true },
    ],
    result: {
      shieldFees: 36,
      flatFees: 4,
      multiplier: 18,
      summary: "Pool recovered. Attack cost 18x more under DepegShield. Manipulation becomes economically impractical.",
    },
  },
  {
    id: "ust",
    title: "UST / LUNA Collapse",
    subtitle: "No Recovery",
    date: "May 2022",
    description:
      "UST lost its algorithmic peg and collapsed to ~$0.10. Over $50B in market cap destroyed. LPs suffered near-total loss as positions converted to a worthless token.",
    outcome: "collapse",
    waves: [
      { label: "Initial panic", amount: 50, ratioStart: 10000, ratioEnd: 11024, shieldFeeBps: 1, shieldOut: 47, flatOut: 47 },
      { label: "Cascade sell", amount: 200, ratioStart: 11024, ratioEnd: 15497, shieldFeeBps: 254, shieldOut: 149, flatOut: 152 },
      { label: "Death spiral", amount: 500, ratioStart: 15497, ratioEnd: 22347, shieldFeeBps: 5000, shieldOut: 134, flatOut: 228 },
      { label: "Final drain", amount: 1000, ratioStart: 22347, ratioEnd: 39796, shieldFeeBps: 5000, shieldOut: 167, flatOut: 207 },
    ],
    result: {
      shieldFees: 755103,
      flatFees: 175,
      multiplier: 4314,
      summary: "Total collapse, both pools worthless. But DepegShield extracted 4,314x more fees from panic sellers. Partial offset, not a rescue.",
    },
  },
];
