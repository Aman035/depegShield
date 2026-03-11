"use client";

import { useState, useEffect, useCallback } from "react";
import { scenarios, type WaveData } from "@/lib/simulationData";
import { ratioToMultiplier, ratioToSplit, getZone } from "@/lib/feeCurve";

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
    if (currentWave >= totalWaves - 1) { setIsPlaying(false); return; }
    const timer = setTimeout(stepForward, 1200);
    return () => clearTimeout(timer);
  }, [isPlaying, currentWave, totalWaves, stepForward]);

  useEffect(() => { reset(); }, [activeScenario, reset]);

  const currentRatio = currentWave >= 0 && currentWave < scenario.waves.length ? scenario.waves[currentWave].ratioEnd : 10000;
  const zone = getZone(currentRatio);

  return (
    <div className="space-y-5 w-full overflow-hidden">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveScenario(i)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-[1px] transition-colors ${
              i === activeScenario
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Description / Results -- swap when simulation completes */}
      {currentWave >= totalWaves - 1 ? (
        <div>
          <div className="flex items-center gap-6">
            <div className="grid grid-cols-3 gap-6 flex-1">
              <div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">DepegShield</p>
                <p className="text-xl font-mono font-semibold mt-0.5">{scenario.result.shieldFees} <span className="text-xs text-[var(--text-dim)]">mTok</span></p>
              </div>
              <div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Flat Fee</p>
                <p className="text-xl font-mono font-semibold text-[var(--text-secondary)] mt-0.5">{scenario.result.flatFees} <span className="text-xs text-[var(--text-dim)]">mTok</span></p>
              </div>
              <div>
                <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Advantage</p>
                <p className="text-xl font-mono font-semibold text-[var(--green)] mt-0.5">{scenario.result.multiplier}x</p>
              </div>
            </div>
            <span className={`shrink-0 text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded ${
              scenario.outcome === "recovery" ? "text-[var(--green)] bg-[var(--green-muted)]" :
              scenario.outcome === "attack-recovery" ? "text-[var(--amber)] bg-[var(--amber-muted)]" :
              "text-[var(--red)] bg-[var(--red-muted)]"
            }`}>
              {scenario.outcome === "recovery" ? "Recovery" :
               scenario.outcome === "attack-recovery" ? "Attack" : "Collapse"}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{scenario.result.summary}</p>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13px] text-[var(--text-dim)]">{scenario.date}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
              {scenario.description}
            </p>
          </div>
          <span className={`shrink-0 text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded ${
            scenario.outcome === "recovery" ? "text-[var(--green)] bg-[var(--green-muted)]" :
            scenario.outcome === "attack-recovery" ? "text-[var(--amber)] bg-[var(--amber-muted)]" :
            "text-[var(--red)] bg-[var(--red-muted)]"
          }`}>
            {scenario.outcome === "recovery" ? "Recovery" :
             scenario.outcome === "attack-recovery" ? "Attack" : "Collapse"}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (currentWave >= totalWaves - 1) { reset(); setTimeout(() => setIsPlaying(true), 50); }
            else setIsPlaying(!isPlaying);
          }}
          className="h-8 px-4 rounded-md bg-[var(--text)] text-[var(--bg)] text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          {isPlaying ? "Pause" : currentWave >= totalWaves - 1 ? "Replay" : "Play"}
        </button>
        <button
          onClick={stepForward}
          disabled={currentWave >= totalWaves - 1}
          className="h-8 px-3 rounded-md border border-[var(--border)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-hover)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          Step
        </button>
        <button
          onClick={reset}
          className="h-8 px-3 rounded-md border border-[var(--border)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors"
        >
          Reset
        </button>

        <div className="ml-auto font-mono text-[12px] text-[var(--text-dim)]">
          {ratioToMultiplier(currentRatio)} ({ratioToSplit(currentRatio)})
          <span className={`ml-2 ${
            zone === "safe" ? "text-[var(--green)]" :
            zone === "warning" ? "text-[var(--amber)]" : "text-[var(--red)]"
          }`}>
            {zone === "safe" ? "SAFE" : zone === "warning" ? "WARNING" : "CIRCUIT BREAKER"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-[12px] table-fixed">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
              <th className="text-left px-3 py-1.5 font-medium">Wave</th>
              <th className="text-left px-3 py-1.5 font-medium">Amount</th>
              <th className="text-left px-3 py-1.5 font-medium">Ratio</th>
              <th className="text-right px-3 py-1.5 font-medium">Fee</th>
              <th className="text-right px-3 py-1.5 font-medium">Shield</th>
              <th className="text-right px-3 py-1.5 font-medium">Flat</th>
            </tr>
          </thead>
          <tbody>
            {scenario.waves.map((wave, i) => (
              <WaveRow key={`${scenario.id}-${i}`} wave={wave} index={i} isActive={i === currentWave} isRevealed={i <= currentWave} />
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

function WaveRow({ wave, index, isActive, isRevealed }: { wave: WaveData; index: number; isActive: boolean; isRevealed: boolean }) {
  const endZone = getZone(wave.ratioEnd);
  const feeColor = wave.shieldFeeBps === 0 ? "var(--green)" :
    endZone === "safe" ? "var(--text)" :
    endZone === "warning" ? "var(--amber)" : "var(--red)";

  return (
    <tr
      className={`border-b border-[var(--border)] last:border-0 transition-colors ${
        isActive ? "bg-[var(--bg-hover)]" : ""
      } ${!isRevealed ? "opacity-25" : ""}`}
    >
      <td className="px-3 py-1.5">
        {wave.isBuy && <span className="text-[var(--green)] mr-1">&#8593;</span>}
        {wave.label}
      </td>
      <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">{wave.amount}</td>
      <td className="px-3 py-1.5 font-mono text-[var(--text-dim)]">
        {ratioToMultiplier(wave.ratioStart)} <span className="text-[var(--text-dim)]">&rarr;</span>{" "}
        <span style={{ color: feeColor }}>{ratioToMultiplier(wave.ratioEnd)}</span>
      </td>
      <td className="px-3 py-1.5 text-right font-mono" style={{ color: feeColor }}>
        {wave.shieldFeeBps}bp
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{wave.shieldOut}</td>
      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-dim)]">{wave.flatOut}</td>
    </tr>
  );
}
