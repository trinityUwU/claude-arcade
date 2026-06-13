// Phase 2 — onglet « Résolutions » : pour chaque classe canonique de problème, le(s)
// GRAPHIQUE(S) de résolution. Champion mis en avant + approches concurrentes côte à côte →
// on compare visuellement les chemins, on voit lequel a gagné. Complète l'onglet Schémas (fitness/barres).
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GitBranch } from "lucide-react";
import type { ChampionsData, ChampionEntry, CanonicalRegistry } from "../../src/consolidate/types.ts";
import { SectionHeader, SourceBadge } from "../lib/format.tsx";
import { ResolutionFlow } from "./ResolutionFlow.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

function ClassList({ entries, selected, onPick }:
  { entries: ChampionEntry[]; selected: string; onPick: (cat: string) => void }): React.JSX.Element {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-white/[0.07] pr-3">
      {entries.map((e) => (
        <button key={e.category} onClick={() => onPick(e.category)}
          className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px]
            transition-colors ${e.category === selected
              ? "nav-active" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85"}`}>
          <span className="truncate">{e.label}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-white/35">{e.occurrences}</span>
        </button>
      ))}
    </div>
  );
}

/** Liste les projets/cibles distincts où la classe est apparue (du plus fréquent au moins). */
function SourceSummary({ entry }: { entry: ChampionEntry }): React.JSX.Element | null {
  const counts = new Map<string, { at: number; n: number }>();
  for (const c of entry.contenders) {
    const cur = counts.get(c.project) ?? { at: 0, n: 0 };
    counts.set(c.project, { at: Math.max(cur.at, c.at), n: cur.n + 1 });
  }
  const sources = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
  if (sources.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] text-white/35">Rencontré dans :</span>
      {sources.map(([project, v]) => <SourceBadge key={project} project={project} at={v.at} />)}
    </div>
  );
}

function ClassDetail({ entry, definition }:
  { entry: ChampionEntry; definition: string | null }): React.JSX.Element {
  const others = entry.champion
    ? entry.contenders.filter((c) => c !== entry.champion)
    : [...entry.contenders];
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <GitBranch size={15} className="text-fuchsia-200/70" />
        <h2 className="text-[15px] font-bold text-white/90">{entry.label}</h2>
        <span className="text-[11px] tabular-nums text-white/40">{entry.occurrences} rencontre(s)</span>
      </div>
      {definition && <p className="mb-3 max-w-2xl text-[12px] leading-relaxed text-white/45">{definition}</p>}
      <SourceSummary entry={entry} />

      {entry.champion && (
        <ResolutionFlow rs={entry.champion.resolution} title={entry.champion.description}
          isChampion fitness={entry.champion.fitness} project={entry.champion.project}
          at={entry.champion.at} topic={entry.champion.topic} />
      )}
      {others.length === 0 && entry.champion && (
        <p className="mt-2 text-[12px] italic text-white/40">
          Vu 1× — pas encore d'approche concurrente à comparer.
        </p>
      )}
      {others.length > 0 && (
        <div className="mt-5">
          <SectionHeader label={`Approches concurrentes (${others.length})`} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {others.sort((a, b) => b.fitness - a.fitness).map((c) => (
              <ResolutionFlow key={`${c.sessionId}:${c.problemId}`} rs={c.resolution}
                title={c.description} fitness={c.fitness} project={c.project} at={c.at} topic={c.topic} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ResolutionsPanel(): React.JSX.Element {
  const [data, setData] = useState<ChampionsData | null>(null);
  const [registry, setRegistry] = useState<CanonicalRegistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([fetch("/api/champions"), fetch("/api/canonical")]);
      setData((await c.json()) as ChampionsData);
      setRegistry((await r.json()) as CanonicalRegistry);
    } catch (e: unknown) { setError(String(e)); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(
    () => (data ? [...data.categories].sort((a, b) => b.occurrences - a.occurrences) : []),
    [data],
  );
  const defByClass = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of registry?.classes ?? []) m.set(c.id, c.definition);
    return m;
  }, [registry]);

  useEffect(() => {
    const first = sorted[0];
    if (first && !sorted.some((e) => e.category === selected)) setSelected(first.category);
  }, [sorted, selected]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  const active = sorted.find((e) => e.category === selected) ?? sorted[0];
  if (!active) return <PanelMessage text="Aucune résolution capturée pour l'instant." />;
  return (
    <div className="flex flex-1 flex-col overflow-hidden px-8 py-6">
      <header className="mb-4 flex items-center gap-3">
        <GitBranch size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Résolutions</h1>
          <p className="text-[12px] text-white/45">
            Le chemin de résolution de chaque classe de problème, en graphique — champion et approches concurrentes.
          </p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-5">
        <ClassList entries={sorted} selected={active.category} onPick={setSelected} />
        <motion.div key={active.category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }} className="min-w-0 flex-1 overflow-y-auto pr-1">
          <ClassDetail entry={active} definition={defByClass.get(active.category) ?? null} />
        </motion.div>
      </div>
    </div>
  );
}
