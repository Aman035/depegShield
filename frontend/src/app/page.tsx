"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FeeCurveChart } from "@/components/FeeCurveChart";
import { SimulationReplay } from "@/components/SimulationReplay";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-primary)]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-20 md:pt-36 md:pb-32">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <motion.div
              custom={0}
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-xs font-display text-[var(--text-secondary)] mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] pulse-dot" />
              Uniswap v4 Hook
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              className="text-4xl md:text-6xl lg:text-7xl font-body font-bold tracking-tight leading-[1.1] mb-6"
            >
              Adaptive fees that{" "}
              <span className="gradient-text">shield LPs</span>{" "}
              during stablecoin depegs
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              className="text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed mb-10 max-w-2xl"
            >
              DepegShield charges escalating fees on imbalance-worsening swaps and zero fees on rebalancing swaps. LPs earn more during crises. Arbitrageurs recover pools faster.
            </motion.p>

            <motion.div custom={3} variants={fadeUp} className="flex gap-4">
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent-green)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 transition-all"
              >
                Explore a Pool
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href="https://github.com/aman035/depegShield"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-medium)] text-[var(--text-secondary)] font-semibold text-sm hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
              >
                View Source
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="py-20 md:py-28 border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            tag="The Problem"
            title="Flat fees fail when it matters most"
          />

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <ProblemCard
              icon="&#x26A0;"
              title="1bp during a crisis"
              description="Standard AMM pools charge the same 1 basis point fee whether the pool is balanced or 90/10 during a death spiral. LPs absorb millions in toxic flow for pennies."
            />
            <ProblemCard
              icon="&#x21C4;"
              title="No directional awareness"
              description="A swap that pushes a pool from 60/40 to 80/20 pays the same fee as one that restores it from 80/20 to 60/40. There is zero economic signal to encourage recovery."
            />
          </div>

          <div className="mt-16">
            <SectionHeader
              tag="The Solution"
              title="Three mechanisms, one hook"
            />

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <SolutionCard
                step="01"
                title="Measure Imbalance"
                description="Read pool reserves in real time. Compute the imbalance ratio from sqrtPriceX96 and liquidity. Classify the pool into Safe, Warning, or Circuit Breaker zone."
                color="var(--accent-green)"
              />
              <SolutionCard
                step="02"
                title="Directional Fees"
                description="Swaps that worsen the imbalance pay escalating fees via a 3-zone curve. Swaps that improve the imbalance pay zero fees, incentivizing arbitrageurs to rebalance."
                color="var(--accent-amber)"
              />
              <SolutionCard
                step="03"
                title="Protect LPs"
                description="During a depeg, panic sellers pay proportionally more. During recovery, rebalancers pay nothing. LPs earn 10-58x more fees for bearing the same risk."
                color="var(--accent-red)"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Fee Curve */}
      <section className="py-20 md:py-28 border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            tag="Fee Curve"
            title="Three zones, one continuous curve"
          />
          <p className="text-[var(--text-secondary)] mt-4 max-w-2xl">
            The fee curve ramps smoothly from 1bp (safe) through a quadratic warning zone to a linear circuit breaker. No cliff edges, no discontinuities. Hover to explore.
          </p>

          <div className="glass-card rounded-2xl p-6 mt-10">
            <div className="flex flex-wrap items-center gap-6 mb-6 text-xs font-display">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-[var(--accent-green)]" />
                <span className="text-[var(--text-muted)]">Safe (1bp flat)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-[var(--accent-amber)]" />
                <span className="text-[var(--text-muted)]">Warning (1-15bp quadratic)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-[var(--accent-red)]" />
                <span className="text-[var(--text-muted)]">Circuit Breaker (15bp+ linear)</span>
              </div>
            </div>
            <FeeCurveChart height={400} />
          </div>
        </div>
      </section>

      {/* Simulation */}
      <section className="py-20 md:py-28 border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            tag="Simulations"
            title="Real depeg events, simulated on-chain"
          />
          <p className="text-[var(--text-secondary)] mt-4 max-w-2xl mb-10">
            We modeled three historical depeg events and compared LP outcomes under DepegShield vs a standard flat-fee pool. Press play to watch each scenario unfold.
          </p>
          <SimulationReplay />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28 border-t border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeader
            tag="How It Works"
            title="Under the hood"
          />

          <div className="mt-12 grid md:grid-cols-3 gap-0">
            {[
              {
                step: "1",
                title: "beforeSwap reads state",
                code: "sqrtPriceX96 + liquidity",
                desc: "The hook reads the pool's current price and liquidity to derive virtual reserves and compute the imbalance ratio.",
              },
              {
                step: "2",
                title: "Fee curve applied",
                code: "FeeCurve.calculateFee(ratio)",
                desc: "The 3-zone fee curve returns a fee in hundredths-of-bip. Rebalancing swaps on imbalanced pools get 0bp.",
              },
              {
                step: "3",
                title: "Fee returned with override",
                code: "fee | OVERRIDE_FEE_FLAG",
                desc: "The fee is OR'd with the override flag and returned. The PoolManager applies it to the swap's input amount.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`p-6 ${i < 2 ? "md:border-r border-[var(--border-subtle)]" : ""}`}
              >
                <div className="font-display text-xs text-[var(--accent-green)] mb-3">
                  Step {item.step}
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {item.title}
                </h3>
                <code className="inline-block px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--accent-blue)] text-xs font-display mb-3">
                  {item.code}
                </code>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-[var(--accent-green)] to-[var(--accent-blue)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--bg-primary)]">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="font-display text-sm text-[var(--text-muted)]">
              DepegShield
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Built for the Uniswap v4 Hookathon
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div>
      <span className="font-display text-xs uppercase tracking-widest text-[var(--accent-green)]">
        {tag}
      </span>
      <h2 className="text-3xl md:text-4xl font-body font-bold text-[var(--text-primary)] mt-2">
        {title}
      </h2>
    </div>
  );
}

function ProblemCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card rounded-xl p-6 glow-red">
      <span className="text-2xl mb-3 block">{icon}</span>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function SolutionCard({
  step,
  title,
  description,
  color,
}: {
  step: string;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="glass-card rounded-xl p-6">
      <span
        className="font-display text-3xl font-bold block mb-3"
        style={{ color, opacity: 0.4 }}
      >
        {step}
      </span>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}
