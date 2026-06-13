import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TriangleAlert, ChevronRight } from "lucide-react";
import type {
  ChampionsData, ChampionEntry, SchemaInstance, ProblemSeverity,
} from "../../src/consolidate/types.ts";
import { qualityColor, fitnessColor, OutcomeBadge } from "../lib/format.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

type Filter = ProblemSeverity | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "tous" },
  { key: "trivial", label: "trivial" },
  { key: "minor", label: "mineur" },
  { key: "major", label: "majeur" },
];

function severityCounts(contenders: SchemaInstance[]): Record<ProblemSeverity, number> {
  const acc: Record<ProblemSeverity, number> = { trivial: 0, minor: 0, major: 0 };
  for (const c of contenders) acc[c.severity] += 1;
  return acc;
}

function ContenderRow({ c }: { c: SchemaInstance }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2 border-t border-white/[0.05] py-2">
      <p className="text-[12px] leading-snug text-white/65">{c.description}</p>
      <div className="flex shrink-0 items-center gap-2">
        <OutcomeBadge outcome={c.resolution.outcome} />
        <span className={`text-[11px] font-semibold tabular-nums ${fitnessColor(c.fitness)}`}>
          {c.fitness.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function CategoryCard({ e, filter, index }: { e: ChampionEntry; filter: Filter; index: number }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const counts = severityCounts(e.contenders);
  const pct = Math.round(e.resolvedRate * 100);
  const shown = filter === "all" ? e.contenders : e.contenders.filter((c) => c.severity === filter);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.015, 0.3) }}
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <ChevronRight size={16} strokeWidth={2}
          className={`shrink-0 text-white/30 transition-transform ${open ? "rotate-90" : ""}`} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13.5px] font-semibold text-white/90">{e.label}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
            <span className="tabular-nums">{e.occurrences}×</span>
            <span>major {counts.major}</span><span>mineur {counts.minor}</span><span>trivial {counts.trivial}</span>
          </div>
        </div>
        <span className={`shrink-0 text-[13px] font-bold tabular-nums ${qualityColor(pct)}`}>{pct}%</span>
      </button>
      {open && (
        <div className="mt-2">
          {shown.length
            ? shown.map((c) => <ContenderRow key={`${c.sessionId}:${c.problemId}`} c={c} />)
            : <p className="py-2 text-[12px] text-white/35">Aucun problème de cette sévérité.</p>}
        </div>
      )}
    </motion.div>
  );
}

function FilterBar({ filter, onPick }: { filter: Filter; onPick: (f: Filter) => void }): React.JSX.Element {
  return (
    <div className="mb-4 flex gap-1.5">
      {FILTERS.map((f) => (
        <button key={f.key} onClick={() => onPick(f.key)}
          className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
            filter === f.key ? "nav-active" : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"}`}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function ProblemsPanel(): React.JSX.Element {
  const [data, setData] = useState<ChampionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/champions");
      setData((await r.json()) as ChampionsData);
    } catch (e: unknown) { setError(String(e)); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(
    () => (data ? [...data.categories].sort((a, b) => b.occurrences - a.occurrences) : []),
    [data],
  );
  const totalProblems = useMemo(() => sorted.reduce((n, e) => n + e.occurrences, 0), [sorted]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  if (!sorted.length) return <PanelMessage text="Aucun problème catégorisé pour l'instant." />;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <header className="mb-5 flex items-center gap-3">
        <TriangleAlert size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Problèmes</h1>
          <p className="text-[12px] text-white/45">{sorted.length} catégories · {totalProblems} problèmes</p>
        </div>
      </header>
      <FilterBar filter={filter} onPick={setFilter} />
      <div className="flex flex-col gap-3">
        {sorted.map((e, i) => <CategoryCard key={e.category} e={e} filter={filter} index={i} />)}
      </div>
    </div>
  );
}
