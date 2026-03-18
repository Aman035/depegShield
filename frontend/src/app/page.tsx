"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FeeCurveChart } from "@/components/FeeCurveChart";
import { SimulationReplay } from "@/components/SimulationReplay";
import { ProblemVisual } from "@/components/ProblemVisual";
import { SolutionVisual } from "@/components/SolutionVisual";
import { ContagionVisual } from "@/components/ContagionVisual";
import { CrossChainFlow } from "@/components/CrossChainFlow";


const HeroShield = dynamic(
  () => import("@/components/HeroShield").then((m) => m.HeroShield),
  { ssr: false }
);

const StarsBackground = dynamic(
  () => import("@/components/StarsBackground").then((m) => m.StarsBackground),
  { ssr: false }
);

export default function LandingPage() {
  return (
    <div className="min-h-screen relative">
      <StarsBackground />

      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        <div className="w-full mx-auto max-w-6xl px-6 relative z-10 flex items-center">
          <div className="max-w-3xl flex-1">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--green)]/20 bg-[var(--green)]/5 text-[var(--green)] text-[11px] font-mono uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse-dot" />
              Built on Uniswap v4
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-[-0.04em] leading-[0.9]">
              Depeg<span className="text-[var(--green)]">Shield</span>
            </h1>
            <p className="text-xl md:text-2xl font-light tracking-[-0.01em] text-[var(--text-secondary)] leading-snug mt-6 max-w-lg">
              The first Uniswap v4 hook that shields LPs across every chain
            </p>
            <div className="mt-8 flex flex-wrap gap-3 max-w-lg">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[13px] text-[var(--text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                Cross-chain contagion shield
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[13px] text-[var(--text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
                Escalating fees on panic sells
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border)] text-[13px] text-[var(--text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                Zero fees on recovery flow
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


      {/* 2. The Problem */}
      <section className="relative z-10 bg-[var(--bg-raised)]/40">
        <div className="w-full mx-auto max-w-5xl px-6">
          <SectionLabel>The Problem</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            Flat fees fail when it matters most
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-2xl mb-10">
            Standard pools charge the same 1bp fee whether the pool is balanced or in a death spiral. LPs absorb millions in toxic flow for pennies. No directional awareness means zero incentive to rebalance.
          </p>

          <div>
            <ProblemVisual />
          </div>

          <div className="grid grid-cols-2 gap-6 mt-10">
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


      {/* 3. The Solution */}
      <section className="relative z-10">
        <div className="w-full mx-auto max-w-5xl px-6">
          <SectionLabel>The Solution</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            Directional fees that adapt in real time
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-2xl mb-10">
            DepegShield reads pool state on every swap. Fees escalate for panic sellers and drop to zero for rebalancers. Watch the same pool scenario with the hook active.
          </p>

          <div>
            <SolutionVisual />
          </div>

          <div className="grid grid-cols-3 gap-6 mt-10">
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


      {/* 4. The Bigger Problem */}
      <section className="relative z-10 bg-[var(--bg-raised)]/40">
        <div className="w-full mx-auto max-w-5xl px-6">
          <SectionLabel>The Bigger Problem</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            Depegs don&apos;t stay on one chain
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-2xl mb-10">
            When a stablecoin depegs on one chain, the same token trades on dozens of others. Arbitrageurs exploit the lag, draining LP value on other chains before local pools show stress. Per-chain hooks are blind to this.
          </p>

          <div>
            <ContagionVisual />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
            <div>
              <h3 className="text-base font-medium mb-1.5 tracking-tight text-[var(--text)]">Contagion lag</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Minutes between depeg on one chain and arbitrageurs draining others. By the time local pools react, the damage is done.
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium mb-1.5 tracking-tight text-[var(--text)]">Invisible to local hooks</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Per-chain hooks only see their own pool state. A crisis on Ethereum is invisible to the same pool on Arbitrum or Base.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* 5. Cross-Chain Shield */}
      <section className="relative z-10">
        <div className="w-full mx-auto max-w-5xl px-6">
          <SectionLabel>Cross-Chain Shield</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            One depeg detected. Every chain protected.
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-2xl mb-10">
            ReactiveMonitor watches pools across all chains. When imbalance crosses threshold anywhere, it fires callbacks to AlertReceivers on every other chain. Local hooks read the signal, apply a fee floor instantly. Rebalancing swaps stay free.
          </p>

          <div>
            <CrossChainFlow />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mt-10">
            {[
              {
                step: "01",
                title: "Monitor",
                desc: "Watches pools across all chains via Reactive Network subscriptions.",
              },
              {
                step: "02",
                title: "Detect",
                desc: "Decodes imbalance ratio from swap events in real time.",
              },
              {
                step: "03",
                title: "Relay",
                desc: "Cross-chain callbacks delivered to AlertReceivers on every destination chain.",
              },
              {
                step: "04",
                title: "Shield",
                desc: "Fee floor applied using the same 5-zone curve. Rebalancing stays free.",
              },
            ].map((item) => (
              <div key={item.step}>
                <span className="font-mono text-sm text-[var(--amber)]/60">{item.step}</span>
                <h3 className="text-base font-medium mt-1 mb-1.5 tracking-tight">{item.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 6. How It Works */}
      <section className="relative z-10 bg-[var(--bg-raised)]/40">
        <div className="w-full mx-auto max-w-5xl px-6">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2 mb-4">
            Five zones, one continuous curve
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-2xl mb-10">
            Every swap passes through the hook. The fee curve reads pool state, computes the imbalance ratio, and returns a dynamic fee in a single atomic transaction.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/30 p-2 md:p-4">
              <FeeCurveChart height={280} />
            </div>

            <div className="flex flex-col gap-4">
              {[
                { step: "01", title: "Read pool state", code: "sqrtPriceX96 + liquidity", desc: "Derive reserves and compute imbalance ratio." },
                { step: "02", title: "Apply fee curve", code: "FeeCurve.getFee(ratio)", desc: "5-zone curve returns fee. Rebalancing gets 0bp." },
              ].map((item) => (
                <div key={item.step} className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/30 p-4 flex-1">
                  <span className="font-mono text-sm text-[var(--green)]/50">{item.step}</span>
                  <h3 className="text-base font-medium mt-1 mb-1.5 tracking-tight">{item.title}</h3>
                  <code className="inline-block px-2 py-0.5 rounded bg-[var(--bg)] text-[var(--text-secondary)] text-[11px] font-mono mb-1.5">
                    {item.code}
                  </code>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* 7. Simulations */}
      <section className="relative z-10">
        <div className="w-full mx-auto max-w-5xl px-6">
          <SectionLabel>Simulations</SectionLabel>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] mt-2">
            Real depeg events, simulated on-chain
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] mt-4 max-w-2xl leading-relaxed mb-10">
            Three historical depeg events modeled with forge tests. Comparing LP outcomes under DepegShield vs a standard flat-fee pool.
          </p>
          <div>
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
