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

export const scenarios: ScenarioData[] = [
  {
    id: "usdc",
    title: "SVB / USDC Depeg",
    subtitle: "Recovery in 48h",
    date: "March 2023",
    description:
      "Circle disclosed $3.3B stuck at SVB. USDC dropped to $0.87. 3,400 Aave positions liquidated. Peg recovered in 48h after FDIC backstop.",
    outcome: "recovery",
    waves: [
      { label: "Early sells", amount: 100, ratioStart: 10000, ratioEnd: 12099, shieldFeeBps: 1, shieldOut: 90, flatOut: 90 },
      { label: "Panic builds", amount: 150, ratioStart: 12099, ratioEnd: 15624, shieldFeeBps: 1, shieldOut: 109, flatOut: 109 },
      { label: "Peak crisis", amount: 150, ratioStart: 15624, ratioEnd: 19590, shieldFeeBps: 21, shieldOut: 85, flatOut: 85 },
      { label: "Late sellers", amount: 100, ratioStart: 19590, ratioEnd: 22471, shieldFeeBps: 60, shieldOut: 47, flatOut: 47 },
      { label: "Recovery", amount: 400, ratioStart: 22471, ratioEnd: 11386, shieldFeeBps: 0, shieldOut: 561, flatOut: 562, isBuy: true },
    ],
    result: {
      shieldFees: 952,
      flatFees: 90,
      multiplier: 10,
      summary: "Pool recovered to ~50/50. DepegShield LPs earned 10x more for bearing the same risk. Zero-fee rebalancing accelerated recovery.",
    },
  },
  {
    id: "usdt",
    title: "USDT Whale Attack",
    subtitle: "Quick Recovery",
    date: "June 2023",
    description:
      "A single entity dumped 31.5M USDT across DEX pools. USDT depegged to $0.997. $120M+ in sell pressure absorbed at flat fees. Recovery within hours.",
    outcome: "attack-recovery",
    waves: [
      { label: "Tranche 1", amount: 100, ratioStart: 10000, ratioEnd: 12099, shieldFeeBps: 1, shieldOut: 90, flatOut: 90 },
      { label: "Tranche 2", amount: 100, ratioStart: 12099, ratioEnd: 14399, shieldFeeBps: 1, shieldOut: 75, flatOut: 75 },
      { label: "Tranche 3", amount: 100, ratioStart: 14399, ratioEnd: 16896, shieldFeeBps: 9, shieldOut: 64, flatOut: 64 },
      { label: "Tranche 4", amount: 100, ratioStart: 16896, ratioEnd: 19587, shieldFeeBps: 33, shieldOut: 54, flatOut: 54 },
      { label: "Tranche 5", amount: 100, ratioStart: 19587, ratioEnd: 22468, shieldFeeBps: 60, shieldOut: 47, flatOut: 47 },
      { label: "Tranche 6", amount: 100, ratioStart: 22468, ratioEnd: 25537, shieldFeeBps: 89, shieldOut: 41, flatOut: 41 },
      { label: "Tranche 7", amount: 100, ratioStart: 25537, ratioEnd: 28792, shieldFeeBps: 120, shieldOut: 36, flatOut: 36 },
      { label: "Tranche 8", amount: 100, ratioStart: 28792, ratioEnd: 32231, shieldFeeBps: 152, shieldOut: 32, flatOut: 32 },
      { label: "Arb recovery", amount: 600, ratioStart: 32231, ratioEnd: 13386, shieldFeeBps: 0, shieldOut: 931, flatOut: 934, isBuy: true },
    ],
    result: {
      shieldFees: 4694,
      flatFees: 140,
      multiplier: 58,
      summary: "Pool recovered. Attack cost 58x more under DepegShield. Manipulation becomes economically impractical.",
    },
  },
  {
    id: "ust",
    title: "UST / LUNA Collapse",
    subtitle: "No Recovery",
    date: "May 2022",
    description:
      "UST lost its algorithmic peg and collapsed to $0. Over $50B in market cap destroyed. LPs suffered total loss as positions converted to a worthless token.",
    outcome: "collapse",
    waves: [
      { label: "Initial panic", amount: 150, ratioStart: 10000, ratioEnd: 13224, shieldFeeBps: 1, shieldOut: 130, flatOut: 130 },
      { label: "Cascade sell", amount: 250, ratioStart: 13224, ratioEnd: 19597, shieldFeeBps: 2, shieldOut: 155, flatOut: 155 },
      { label: "Final drain", amount: 250, ratioStart: 19597, ratioEnd: 27171, shieldFeeBps: 60, shieldOut: 107, flatOut: 108 },
      { label: "Trickle out", amount: 250, ratioStart: 27171, ratioEnd: 35909, shieldFeeBps: 136, shieldOut: 78, flatOut: 79 },
    ],
    result: {
      shieldFees: 5028,
      flatFees: 90,
      multiplier: 55,
      summary: "Total collapse -- both pools worthless. But DepegShield extracted 55x more fees from panic sellers. Partial offset, not a rescue.",
    },
  },
];
