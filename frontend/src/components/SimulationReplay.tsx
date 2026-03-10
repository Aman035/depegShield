"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { scenarios, type ScenarioData, type WaveData } from "@/lib/simulationData";
import { ratioToMultiplier, ratioToSplit, getZone, ZONE_COLORS } from "@/lib/feeCurve";

export function SimulationReplay() {
  const [activeScenario, setActiveScenario] = useState(0);
  const [currentWave, setCurrentWave] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const scenario = scenarios[activeScenario];
  const totalWaves = scenario.waves.length;

  const reset = useCallback(() => {
    setCurrentWave(-1);
    setIsPlaying(false);
  }, []);

  const stepForward = useCallback(() => {
    setCurrentWave((prev) => Math.min(prev + 1, totalWaves - 1));
  }, [totalWaves]);

  useEffect(() => {
    if (!isPlaying) return;
    if (currentWave >= totalWaves - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(stepForward, 1200);
    return () => clearTimeout(timer);
  }, [isPlaying, currentWave, totalWaves, stepForward]);

  useEffect(() => {
    reset();
  }, [activeScenario, reset]);

  // Calculate cumulative fees up to current wave
  const { shieldFeesAccum, flatFeesAccum } = (() => {
    let sf = 0;
    let ff = 0;
    for (let i = 0; i <= currentWave; i++) {
      const w = scenario.waves[i];
      sf += (w.amount * w.shieldFeeBps) / 10000;
      ff += (w.amount * 1) / 10000; // 1bp flat fee
    }
    return { shieldFeesAccum: sf, flatFeesAccum: ff };
  })();

  const currentRatio =
    currentWave >= 0 ? scenario.waves[currentWave].ratioEnd : 10000;
  const zone = getZone(currentRatio);
  const zoneColors = ZONE_COLORS[zone];

  return (
    <div className="space-y-6">
      {/* Scenario tabs */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveScenario(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              i === activeScenario
                ? "bg-[var(--bg-tertiary)] border-[var(--accent-green)]/30 text-[var(--accent-green)]"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)]"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Scenario description */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              {scenario.title}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {scenario.date} &middot; {scenario.subtitle}
            </p>
          </div>
          <OutcomeBadge outcome={scenario.outcome} />
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {scenario.description}
        </p>
      </div>

      {/* Controls + Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (currentWave >= totalWaves - 1) {
              reset();
              setTimeout(() => setIsPlaying(true), 100);
            } else {
              setIsPlaying(!isPlaying);
            }
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-green)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 transition-all"
        >
          {isPlaying ? (
            <PauseIcon />
          ) : currentWave >= totalWaves - 1 ? (
            <ReplayIcon />
          ) : (
            <PlayIcon />
          )}
          {isPlaying ? "Pause" : currentWave >= totalWaves - 1 ? "Replay" : "Play"}
        </button>
        <button
          onClick={stepForward}
          disabled={currentWave >= totalWaves - 1}
          className="px-4 py-2.5 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Step
        </button>
        <button
          onClick={reset}
          className="px-4 py-2.5 rounded-lg border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-all"
        >
          Reset
        </button>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: zoneColors.text }} />
            <span className="font-display text-xs uppercase tracking-wider" style={{ color: zoneColors.text }}>
              {zone === "safe" ? "Safe" : zone === "warning" ? "Warning" : "Circuit Breaker"}
            </span>
          </div>
          <span className="text-[var(--text-muted)] font-display">
            {ratioToMultiplier(currentRatio)} ({ratioToSplit(currentRatio)})
          </span>
        </div>
      </div>

      {/* Wave timeline */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="grid grid-cols-[140px_80px_1fr_100px_100px_100px] gap-0 text-xs font-display uppercase tracking-wider text-[var(--text-muted)] px-5 py-3 border-b border-[var(--border-subtle)]">
          <span>Wave</span>
          <span>Amount</span>
          <span>Pool Ratio</span>
          <span className="text-right">Shield Fee</span>
          <span className="text-right">Shield Out</span>
          <span className="text-right">Flat Out</span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]/50">
          <AnimatePresence>
            {scenario.waves.map((wave, i) => (
              <WaveRow
                key={`${scenario.id}-${i}`}
                wave={wave}
                index={i}
                isActive={i === currentWave}
                isRevealed={i <= currentWave}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {currentWave >= totalWaves - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card rounded-xl p-6 space-y-5"
            style={{ boxShadow: `0 0 30px ${zoneColors.glow}` }}
          >
            <h4 className="font-display text-sm uppercase tracking-wider text-[var(--text-muted)]">
              Final Results
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResultCard
                label="DepegShield Fees"
                value={`${scenario.result.shieldFees} mTok`}
                color="var(--accent-green)"
              />
              <ResultCard
                label="Flat Fee Pool"
                value={`${scenario.result.flatFees} mTok`}
                color="var(--text-muted)"
              />
              <ResultCard
                label="Advantage"
                value={`${scenario.result.multiplier}x`}
                color="var(--accent-blue)"
                highlight
              />
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {scenario.result.summary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WaveRow({
  wave,
  index,
  isActive,
  isRevealed,
}: {
  wave: WaveData;
  index: number;
  isActive: boolean;
  isRevealed: boolean;
}) {
  const zone = getZone(wave.ratioEnd);
  const zoneColors = ZONE_COLORS[zone];

  return (
    <motion.div
      initial={false}
      animate={{
        backgroundColor: isActive
          ? "rgba(96, 165, 250, 0.06)"
          : "transparent",
        opacity: isRevealed ? 1 : 0.3,
      }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-[140px_80px_1fr_100px_100px_100px] gap-0 px-5 py-3 items-center text-sm"
    >
      <span className="flex items-center gap-2">
        {wave.isBuy && (
          <span className="text-[var(--accent-green)] text-xs">&#x2191;</span>
        )}
        <span className={isRevealed ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>
          {wave.label}
        </span>
      </span>

      <span className="font-display text-[var(--text-secondary)]">
        {wave.amount}
      </span>

      <div className="flex items-center gap-2">
        <span className="font-display text-[var(--text-muted)] text-xs">
          {ratioToMultiplier(wave.ratioStart)}
        </span>
        <svg width="16" height="8" viewBox="0 0 16 8" className="text-[var(--text-muted)]">
          <path d="M0 4h12M10 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="font-display text-xs" style={{ color: zoneColors.text }}>
          {ratioToMultiplier(wave.ratioEnd)}
        </span>
        <span className="text-[var(--text-muted)] text-xs">
          ({ratioToSplit(wave.ratioEnd)})
        </span>
      </div>

      <span className="text-right font-display" style={{ color: wave.shieldFeeBps === 0 ? "var(--accent-green)" : zoneColors.text }}>
        {wave.shieldFeeBps} bps
      </span>
      <span className="text-right font-display text-[var(--text-secondary)]">
        {wave.shieldOut}
      </span>
      <span className="text-right font-display text-[var(--text-muted)]">
        {wave.flatOut}
      </span>
    </motion.div>
  );
}

function ResultCard({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 border ${
        highlight
          ? "border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/5"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
      }`}
    >
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1 font-display">
        {label}
      </p>
      <p className="font-display text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const config = {
    recovery: { label: "Recovery", color: "var(--accent-green)", bg: "var(--accent-green-dim)" },
    "attack-recovery": { label: "Attack + Recovery", color: "var(--accent-amber)", bg: "var(--accent-amber-dim)" },
    collapse: { label: "Total Collapse", color: "var(--accent-red)", bg: "var(--accent-red-dim)" },
  }[outcome] || { label: outcome, color: "var(--text-muted)", bg: "var(--bg-tertiary)" };

  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-display font-medium"
      style={{ color: config.color, backgroundColor: config.bg + "33" }}
    >
      {config.label}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}
