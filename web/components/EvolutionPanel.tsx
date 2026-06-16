import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Repeat, Trophy } from "lucide-react";
import type { EvolutionData, EvolutionBucket, TrendDirection } from "../../src/consolidate/types.ts";
import { SectionHeader } from "../lib/format.tsx";
import { useLiveResource } from "../lib/live.tsx";
import { reveal } from "../lib/motion.ts";
import { PanelMessage } from "./SessionsPanel.tsx";

type TrendDir = "up" | "down";

function TrendIcon({ trend, good }: { trend: TrendDirection; good: TrendDir }): React.JSX.Element {
  if (trend === "flat") return <Minus size={16} className="text-amber-300" />;
  const isImproving = trend === "improving";
  const up = (good === "up") === isImproving;
  const cls = isImproving ? "text-emerald-400" : "text-rose-400";
  return up ? <TrendingUp size={16} className={cls} /> : <TrendingDown size={16} className={cls} />;
}

function SignalCard({ icon, title, value, hint, trend, good }:
  { icon: React.ReactNode; title: string; value: string; hint: string; trend: TrendDirection; good: TrendDir }):
  React.JSX.Element {
  return (
    <div className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-white/55">{icon}{title}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-3xl font-black tabular-nums text-white/90">{value}</span>
        <TrendIcon trend={trend} good={good} />
      </div>
      <p className="mt-1 text-[11px] text-white/40">{hint}</p>
    </div>
  );
}

const CHART_W = 640;
const CHART_H = 180;
const PAD = 28;

function pointsFor(buckets: EvolutionBucket[], pick: (b: EvolutionBucket) => number): string {
  const n = buckets.length;
  const dx = n > 1 ? (CHART_W - PAD * 2) / (n - 1) : 0;
  return buckets.map((b, i) => {
    const x = PAD + i * dx;
    const y = CHART_H - PAD - pick(b) * (CHART_H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function ChartLegend(): React.JSX.Element {
  return (
    <div className="mb-2 flex gap-4 text-[11px]">
      <span className="flex items-center gap-1.5 text-rose-400">
        <span className="h-0.5 w-4 rounded bg-rose-400" />réapparition</span>
      <span className="flex items-center gap-1.5 text-emerald-400">
        <span className="h-0.5 w-4 rounded bg-emerald-400" />fitness champions</span>
    </div>
  );
}

function EvolutionChart({ buckets }: { buckets: EvolutionBucket[] }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <SectionHeader label="Tendances dans le temps" />
      <ChartLegend />
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-label="Évolution">
        <line x1={PAD} y1={CHART_H - PAD} x2={CHART_W - PAD} y2={CHART_H - PAD} stroke="rgba(255,255,255,0.1)" />
        <polyline fill="none" stroke="#fb7185" strokeWidth="2"
          points={pointsFor(buckets, (b) => b.recurrenceRate)} />
        <polyline fill="none" stroke="#34d399" strokeWidth="2"
          points={pointsFor(buckets, (b) => b.avgChampionFitness)} />
        {buckets.map((b, i) => {
          const dx = buckets.length > 1 ? (CHART_W - PAD * 2) / (buckets.length - 1) : 0;
          return (
            <text key={b.period} x={PAD + i * dx} y={CHART_H - PAD + 14} textAnchor="middle"
              fill="rgba(255,255,255,0.3)" fontSize="9">{b.period.replace(/^\d{4}-/, "")}</text>
          );
        })}
      </svg>
    </div>
  );
}

function DifficultyBars({ buckets }: { buckets: EvolutionBucket[] }): React.JSX.Element {
  const agg = buckets.reduce((a, b) => ({
    easy: a.easy + b.difficulty.easy, medium: a.medium + b.difficulty.medium, hard: a.hard + b.difficulty.hard,
  }), { easy: 0, medium: 0, hard: 0 });
  const total = Math.max(1, agg.easy + agg.medium + agg.hard);
  const rows: { label: string; v: number; cls: string }[] = [
    { label: "facile", v: agg.easy, cls: "bg-emerald-400" },
    { label: "moyen", v: agg.medium, cls: "bg-amber-300" },
    { label: "difficile", v: agg.hard, cls: "bg-rose-400" },
  ];
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <SectionHeader label="Distribution de difficulté" />
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-white/45">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${r.cls}`} style={{ width: `${(r.v / total) * 100}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-white/45">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Signals({ d }: { d: EvolutionData }): React.JSX.Element {
  return (
    <div className="mb-4 flex gap-4">
      <SignalCard icon={<Repeat size={15} />} title="Taux de réapparition"
        value={`${Math.round(d.overallRecurrenceRate * 100)}%`} hint="doit baisser"
        trend={d.recurrenceTrend} good="down" />
      <SignalCard icon={<Trophy size={15} />} title="Fitness moyen des champions"
        value={Math.round(d.avgChampionFitness * 100).toString()} hint="doit monter"
        trend={d.fitnessTrend} good="up" />
    </div>
  );
}

export function EvolutionPanel(): React.JSX.Element {
  const { data, silent, error } = useLiveResource<EvolutionData>("/api/evolution");

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;

  const enough = data.buckets.length >= 2;
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <header className="mb-5 flex items-center gap-3">
        <TrendingUp size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Évolution</h1>
          <p className="text-[12px] text-white/45">Le système d'apprentissage s'améliore-t-il ?</p>
        </div>
      </header>
      <motion.div {...reveal(silent)}>
        <Signals d={data} />
        {enough ? (
          <div className="flex flex-col gap-4">
            <EvolutionChart buckets={data.buckets} />
            <DifficultyBars buckets={data.buckets} />
          </div>
        ) : (
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-[12px] text-white/40">
            Pas encore assez d'historique pour les tendances (se densifie avec le backfill).
          </p>
        )}
      </motion.div>
    </div>
  );
}
