// Phase 3 — onglet « Apprentissage » : la PREUVE du North Star (session N+1 > N). KPI causaux en
// tête (dont l'injectionLift = impact mesuré du PUSH) + trajectoire de fitness par classe récurrente.
import { useCallback, useState } from "react";
import { useLiveResource } from "../lib/live.tsx";
import { reveal } from "../lib/motion.ts";
import { AnimatePresence, motion } from "framer-motion";
import { LineChart, TrendingUp, TrendingDown, Zap, ChevronRight, PanelRightOpen } from "lucide-react";
import type { LearningData, ClassLearningCurve, LearningEncounter } from "../../src/consolidate/types.ts";
import { fitnessBg, fitnessColor, OutcomeBadge, SourceBadge } from "../lib/format.tsx";
import { SessionDrawer } from "./SessionDetail.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

type OpenSession = { sessionId: string; title: string; subtitle: string };

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

/** Sparkline de fitness : une barre par rencontre (chronologique), cliquable → session source. */
function Spark({ curve, onOpen }: { curve: ClassLearningCurve; onOpen: (e: LearningEncounter) => void }): React.JSX.Element {
  return (
    <div className="flex items-end gap-1" style={{ height: 40 }}>
      {curve.encounters.map((e, i) => (
        <button key={i} onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}
          className="flex w-3 flex-col items-center gap-0.5"
          title={`${e.topic || "session"} · fit ${e.fitness.toFixed(3)} · ${e.turns} tours`}>
          <div className={`w-full rounded-t ${fitnessBg(e.fitness)} ${e.injected ? "ring-1 ring-sky-300/70" : ""}
            transition-transform hover:scale-y-110`}
            style={{ height: `${Math.max(3, e.fitness * 36)}px` }} />
        </button>
      ))}
    </div>
  );
}

/** Une rencontre dépliée : provenance + métriques, cliquable → session source. */
function EncounterRow({ e, onOpen }: { e: LearningEncounter; onOpen: (e: LearningEncounter) => void }): React.JSX.Element {
  return (
    <button onClick={() => onOpen(e)}
      className="group flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015]
        px-3 py-2 text-left transition-colors hover:border-fuchsia-400/30 hover:bg-white/[0.04]">
      <SourceBadge project={e.project} at={e.at} />
      {e.topic && <span className="min-w-0 flex-1 truncate text-[11px] italic text-white/40">« {e.topic} »</span>}
      <span className={`shrink-0 text-[11px] tabular-nums ${fitnessColor(e.fitness)}`}>fit {e.fitness.toFixed(3)}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-white/40">{e.turns}t</span>
      {e.injected && <Zap size={11} className="shrink-0 text-sky-300/80" />}
      <OutcomeBadge outcome={e.outcome} />
      <PanelRightOpen size={13} className="shrink-0 text-white/20 transition-colors group-hover:text-fuchsia-200/80" />
    </button>
  );
}

function CurveRow({ curve, expanded, onToggle, onOpen }:
  { curve: ClassLearningCurve; expanded: boolean; onToggle: () => void;
    onOpen: (e: LearningEncounter) => void }): React.JSX.Element {
  const up = curve.trend === "improving";
  const Icon = up ? TrendingUp : curve.trend === "worsening" ? TrendingDown : LineChart;
  const tone = up ? "text-emerald-400" : curve.trend === "worsening" ? "text-rose-400" : "text-white/40";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <div onClick={onToggle} className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-white/[0.02]">
        <ChevronRight size={14} className={`shrink-0 text-white/35 transition-transform ${expanded ? "rotate-90" : ""}`} />
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
        <Spark curve={curve} onOpen={onOpen} />
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="space-y-1.5 border-t border-white/[0.06] px-4 py-3">
              {[...curve.encounters].sort((a, b) => b.at - a.at).map((e, i) => (
                <EncounterRow key={i} e={e} onOpen={onOpen} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LearningPanel(): React.JSX.Element {
  const { data, silent, error } = useLiveResource<LearningData>("/api/learning");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenSession | null>(null);

  const openFrom = useCallback((label: string) => (e: LearningEncounter): void => {
    setOpen({ sessionId: e.sessionId, title: e.topic || label, subtitle: label });
  }, []);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <header className="mb-5 flex items-center gap-3">
          <LineChart size={20} strokeWidth={1.75} className="text-fuchsia-200" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white/90">Courbe d'apprentissage</h1>
            <p className="text-[12px] text-white/45">
              La preuve : les classes déjà vues se résolvent-elles mieux ? Déplie une courbe, clique une rencontre pour ouvrir sa session.
            </p>
          </div>
        </header>
        <Kpis d={data} />
        {data.curves.length === 0 ? (
          <p className="mt-8 text-center text-[12px] italic text-white/40">
            Pas encore de classe récurrente. La courbe se construit à mesure que les mêmes problèmes reviennent.
          </p>
        ) : (
          <motion.div {...reveal(silent)} className="mt-5 space-y-2">
            {data.curves.map((c) => (
              <CurveRow key={c.classId} curve={c} expanded={expanded === c.classId}
                onToggle={() => setExpanded(expanded === c.classId ? null : c.classId)} onOpen={openFrom(c.label)} />
            ))}
          </motion.div>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <SessionDrawer key={open.sessionId} sessionId={open.sessionId} title={open.title}
            subtitle={open.subtitle} onClose={() => setOpen(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
