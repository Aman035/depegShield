import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { unichainSepolia, baseSepolia } from "./chains";
import { sepolia } from "viem/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "DepegShield",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
  chains: [unichainSepolia, sepolia, baseSepolia],
  ssr: true,
});
