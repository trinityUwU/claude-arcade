// Phase 3 — onglet « Apprentissage » : la PREUVE du North Star (session N+1 > N). KPI causaux en
// tête (dont l'injectionLift = impact mesuré du PUSH) + trajectoire de fitness par classe récurrente.
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { LearningData, ClassLearningCurve } from "../../src/consolidate/types.ts";
import { fitnessBg, fitnessColor } from "../lib/format.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

function signed(n: number, digits = 3): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
}

function Kpi({ label, value, tone, hint }:
  { label: string; value: string; tone?: string; hint?: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${tone ?? "text-white/90"}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-white/40">{hint}</div>}
    </div>
  );
}

/** Bandeau de preuve : les chiffres qui disent si l'exécution progresse. */
function Kpis({ d }: { d: LearningData }): React.JSX.Element {
  const lift = d.injectionLift;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Classes récurrentes" value={String(d.recurringClasses)} hint="vues 2 fois ou plus" />
      <Kpi label="S'améliorent" value={`${d.improvingClasses} / ${d.recurringClasses}`}
        tone={d.improvingClasses >= d.worseningClasses ? "text-emerald-400" : "text-rose-400"}
        hint={`${d.worseningClasses} en régression`} />
      <Kpi label="Δ fitness moyen" value={signed(d.avgFitnessDelta)}
        tone={fitnessColor(0.4 + d.avgFitnessDelta)} hint="dernière − première rencontre" />
      <Kpi label="Lift d'injection" value={lift === null ? "—" : signed(lift)}
        tone={lift === null ? "text-white/40" : lift > 0 ? "text-emerald-400" : "text-rose-400"}
        hint={lift === null ? "données insuffisantes" : `${d.injectedEncounters} rencontre(s) injectée(s)`} />
    </div>
  );
}

/** Sparkline de fitness : une barre par rencontre, teintée injectée (anneau). */
function Spark({ curve }: { curve: ClassLearningCurve }): React.JSX.Element {
  return (
    <div className="flex items-end gap-1" style={{ height: 40 }}>
      {curve.encounters.map((e, i) => (
        <div key={i} className="flex w-3 flex-col items-center gap-0.5" title={`fit ${e.fitness.toFixed(3)} · ${e.turns} tours`}>
          <div className={`w-full rounded-t ${fitnessBg(e.fitness)} ${e.injected ? "ring-1 ring-sky-300/70" : ""}`}
            style={{ height: `${Math.max(3, e.fitness * 36)}px` }} />
        </div>
      ))}
    </div>
  );
}

function CurveRow({ curve }: { curve: ClassLearningCurve }): React.JSX.Element {
  const up = curve.trend === "improving";
  const Icon = up ? TrendingUp : curve.trend === "worsening" ? TrendingDown : LineChart;
  const tone = up ? "text-emerald-400" : curve.trend === "worsening" ? "text-rose-400" : "text-white/40";
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon size={14} className={tone} />
          <span className="truncate text-[13px] font-medium text-white/85">{curve.label}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-white/35">{curve.encounters.length}×</span>
          {curve.injectedCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-sky-300/80">
              <Zap size={10} />{curve.injectedCount}
            </span>
          )}
        </div>
        <div className="mt-1 flex gap-4 text-[11px] tabular-nums text-white/45">
          <span className={fitnessColor(0.4 + curve.fitnessDelta)}>Δ fit {signed(curve.fitnessDelta)}</span>
          <span className={curve.turnsDelta < 0 ? "text-emerald-400" : curve.turnsDelta > 0 ? "text-rose-400" : ""}>
            Δ tours {signed(curve.turnsDelta, 0)}
          </span>
        </div>
      </div>
      <Spark curve={curve} />
    </div>
  );
}

export function LearningPanel(): React.JSX.Element {
  const [data, setData] = useState<LearningData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/learning");
      setData((await r.json()) as LearningData);
    } catch (e: unknown) { setError(String(e)); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
      <header className="mb-5 flex items-center gap-3">
        <LineChart size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Courbe d'apprentissage</h1>
          <p className="text-[12px] text-white/45">
            La preuve : les classes de problèmes déjà vues se résolvent-elles mieux ? L'injection aide-t-elle ?
          </p>
        </div>
      </header>
      <Kpis d={data} />
      {data.curves.length === 0 ? (
        <p className="mt-8 text-center text-[12px] italic text-white/40">
          Pas encore de classe récurrente. La courbe se construit à mesure que les mêmes problèmes reviennent.
        </p>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          className="mt-5 space-y-2">
          {data.curves.map((c) => <CurveRow key={c.classId} curve={c} />)}
        </motion.div>
      )}
    </div>
  );
}
