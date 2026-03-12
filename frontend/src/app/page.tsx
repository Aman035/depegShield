"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FeeCurveChart } from "@/components/FeeCurveChart";
import { SimulationReplay } from "@/components/SimulationReplay";
import { ProblemVisual } from "@/components/ProblemVisual";
import { SolutionVisual } from "@/components/SolutionVisual";
import { useFullPageScroll } from "@/hooks/useFullPageScroll";


const HeroShield = dynamic(
  () => import("@/components/HeroShield").then((m) => m.HeroShield),
  { ssr: false }
);

const StarsBackground = dynamic(
  () => import("@/components/StarsBackground").then((m) => m.StarsBackground),
  { ssr: false }
);

export default function LandingPage() {
  const containerRef = useFullPageScroll();

  return (
    <div ref={containerRef} className="min-h-screen relative">
      <StarsBackground />

      {/* Hero */}
      <section data-section className="border-b border-[var(--border)] relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 relative z-10 flex items-center">
          <div className="max-w-3xl flex-1">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--green)]/20 bg-[var(--green)]/5 text-[var(--green)] text-[11px] font-mono uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse-dot" />
              Built on Uniswap v4
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-[-0.04em] leading-[0.9]">
              Depeg<span className="text-[var(--green)]">Shield</span>
            </h1>
            <p className="text-xl md:text-2xl font-light tracking-[-0.01em] text-[var(--text-secondary)] leading-snug mt-6 max-w-lg">
              Adaptive fees that protect liquidity providers during stablecoin depegs
            </p>
            <div className="mt-8 flex flex-wrap gap-3 max-w-lg">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[13px] text-[var(--text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
                Escalating fees on panic sells
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[13px] text-[var(--text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                Zero fees on recovery flow
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[13px] text-[var(--text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                Cross-chain early warnings
              </span>
            </div>
            <div className="mt-10">
              <Link
                href="/explore"
                className="h-11 px-6 rounded-lg bg-[var(--green)] text-[var(--bg)] text-sm font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all"
              >
                Monitor Pools
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>
          </div>

          <div className="hidden md:block flex-shrink-0 w-[380px] ml-auto">
            <HeroShield />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section data-section className="border-b border-[var(--border)] relative z-10">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel>The Problem</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            Flat fees fail when it matters most
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-xl mb-10">
            Standard pools charge the same 1bp fee whether the pool is balanced or in a death spiral. LPs absorb millions in toxic flow for pennies. No directional awareness means zero incentive to rebalance.
          </p>

          <div className="max-w-3xl">
            <ProblemVisual />
          </div>

          <div className="grid grid-cols-2 gap-6 mt-10 max-w-3xl">
            <div>
              <h3 className="text-base font-medium mb-1.5 tracking-tight text-[var(--text)]">Same fee at 50/50 and 90/10</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Pool goes from balanced to death spiral. Fee stays at 1bp the whole way down.
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium mb-1.5 tracking-tight text-[var(--text)]">No directional signal</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Panic selling and recovery rebalancing cost the same. Nothing encourages arbitrageurs to help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section data-section className="border-b border-[var(--border)] relative z-10">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel>The Solution</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            Directional fees that adapt in real time
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-xl mb-10">
            DepegShield reads pool state on every swap. Fees escalate for panic sellers and drop to zero for rebalancers. Watch the same pool scenario with the hook active.
          </p>

          <div className="max-w-3xl">
            <SolutionVisual />
          </div>

          <div className="grid grid-cols-3 gap-6 mt-10 max-w-3xl">
            {[
              {
                num: "01",
                title: "Measure Imbalance",
                desc: "Compute the ratio from sqrtPriceX96 and liquidity. Classify into Stable, Drift, Stress, Crisis, or Emergency zone.",
              },
              {
                num: "02",
                title: "Directional Fees",
                desc: "Worsening swaps pay escalating fees via a 5-zone curve. Rebalancing swaps pay zero.",
              },
              {
                num: "03",
                title: "Protect LPs",
                desc: "Panic sellers pay proportionally more. Rebalancers pay nothing. LPs earn 18-4,000x+ more.",
              },
            ].map((item) => (
              <div key={item.num}>
                <span className="font-mono text-sm text-[var(--green)]/50">{item.num}</span>
                <h3 className="text-base font-medium mt-1 mb-1.5 tracking-tight">{item.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section data-section className="border-b border-[var(--border)] relative z-10">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            Five zones, one continuous curve
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-xl mb-10">
            Every swap passes through the hook. The fee curve reads pool state, computes the imbalance ratio, and returns a dynamic fee in a single atomic transaction.
          </p>

          <div className="max-w-3xl">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/30 p-2 md:p-4">
              <FeeCurveChart height={280} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-5 mt-8 max-w-3xl">
            {[
              { step: "01", title: "Read pool state", code: "sqrtPriceX96 + liquidity", desc: "Derive reserves and compute imbalance ratio." },
              { step: "02", title: "Apply fee curve", code: "FeeCurve.getFee(ratio)", desc: "5-zone curve returns fee. Rebalancing gets 0bp." },
              { step: "03", title: "Cross-chain alert", code: "ReactiveNetwork", desc: "Monitors other chain pools. Multiplies fees 1.5-3x before depeg arrives." },
              { step: "04", title: "Return override", code: "fee | OVERRIDE_FLAG", desc: "PoolManager applies the dynamic fee to the swap." },
            ].map((item) => (
              <div key={item.step}>
                <span className="font-mono text-sm text-[var(--green)]/50">{item.step}</span>
                <h3 className="text-base font-medium mt-1 mb-1.5 tracking-tight">{item.title}</h3>
                <code className="inline-block px-2 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-secondary)] text-[11px] font-mono mb-1.5">
                  {item.code}
                </code>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulations */}
      <section data-section className="border-b border-[var(--border)] relative z-10">
        <div className="mx-auto max-w-6xl px-6" data-scroll-inside>
          <SectionLabel>Simulations</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2">
            Real depeg events, simulated on-chain
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] mt-4 max-w-xl leading-relaxed mb-10">
            Three historical depeg events modeled with forge tests. Comparing LP outcomes under DepegShield vs a standard flat-fee pool.
          </p>
          <div className="max-w-3xl">
            <SimulationReplay />
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[12px] uppercase tracking-widest text-[var(--green)]">
      {children}
    </p>
  );
}
