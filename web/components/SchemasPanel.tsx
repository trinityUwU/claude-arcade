import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, TrendingUp } from "lucide-react";
import type { ChampionsData, ChampionEntry, SchemaInstance } from "../../src/consolidate/types.ts";
import { fitnessBreakdown, type FitnessBreakdown } from "../../src/consolidate/fitness.ts";
import { fitnessColor, fitnessBg, OutcomeBadge, SeverityBadge, SectionHeader } from "../lib/format.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

const BAR_ROWS: { key: keyof Pick<FitnessBreakdown, "turns" | "backtracks" | "toolErrors" | "quality">; label: string }[] = [
  { key: "turns", label: "tours (0.35)" },
  { key: "backtracks", label: "retours (0.25)" },
  { key: "toolErrors", label: "err. outils (0.20)" },
  { key: "quality", label: "qualité (0.20)" },
];

function FitnessBars({ bd }: { bd: FitnessBreakdown }): React.JSX.Element {
  return (
    <div className="mt-2 space-y-1">
      {BAR_ROWS.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-[10px] text-white/40">{row.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={`h-full rounded-full ${fitnessBg(bd[row.key] / 0.35)}`}
              style={{ width: `${Math.min(100, (bd[row.key] / 0.35) * 100)}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-white/45">{bd[row.key].toFixed(3)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1 text-[11px] text-white/50">
        <span>× outcome {bd.multiplier.toFixed(1)}</span>
        <span className={`font-bold tabular-nums ${fitnessColor(bd.total)}`}>fitness {bd.total.toFixed(3)}</span>
      </div>
    </div>
  );
}

function SchemaCard({ c, isChampion }: { c: SchemaInstance; isChampion: boolean }): React.JSX.Element {
  const rs = c.resolution;
  const bd = fitnessBreakdown(rs, c.sessionQuality);
  return (
    <div className={`rounded-xl border p-4 ${isChampion
      ? "border-fuchsia-400/30 bg-fuchsia-400/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {isChampion && <Crown size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-fuchsia-200" />}
          <p className="text-[12.5px] leading-snug text-white/80">{c.description}</p>
        </div>
        <div className="flex shrink-0 gap-1"><SeverityBadge severity={c.severity} /><OutcomeBadge outcome={rs.outcome} /></div>
      </div>
      {rs.steps.length > 0 && (
        <ol className="mt-2 space-y-0.5">
          {rs.steps.map((st, i) => (
            <li key={i} className="text-[12px] leading-snug text-white/60">
              <span className="mr-1.5 tabular-nums text-white/30">{i + 1}.</span>{st}
            </li>
          ))}
        </ol>
      )}
      {rs.tools_used.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {rs.tools_used.map((t, i) => (
            <span key={i} className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5
              font-mono text-[10px] text-sky-300/70">{t}</span>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex gap-3 text-[11px] tabular-nums text-white/45">
        <span>{rs.turns_to_resolve} tours</span><span>{rs.backtracks} retours</span><span>{rs.tool_errors} err.</span>
      </div>
      <FitnessBars bd={bd} />
    </div>
  );
}

function HistoryStrip({ entry }: { entry: ChampionEntry }): React.JSX.Element | null {
  if (entry.history.length < 2) return null;
  return (
    <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <SectionHeader label="Lignée du champion" />
      <div className="flex items-end gap-1.5">
        {entry.history.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className={`w-full rounded-t ${fitnessBg(h.fitness)}`}
              style={{ height: `${Math.max(4, h.fitness * 48)}px` }} />
            <span className="text-[9px] tabular-nums text-white/30">{h.fitness.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryDetail({ entry }: { entry: ChampionEntry }): React.JSX.Element {
  const others = entry.champion
    ? [...entry.contenders].filter((c) => c !== entry.champion).sort((a, b) => b.fitness - a.fitness)
    : [...entry.contenders].sort((a, b) => b.fitness - a.fitness);
  const single = entry.contenders.length <= 1;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp size={15} className="text-fuchsia-200/70" />
        <h2 className="text-[15px] font-bold text-white/90">{entry.label}</h2>
        <span className="text-[11px] tabular-nums text-white/40">{entry.occurrences}×</span>
      </div>
      <HistoryStrip entry={entry} />
      {entry.champion && <SchemaCard c={entry.champion} isChampion />}
      {single && (
        <p className="mt-2 text-[12px] italic text-white/40">Vu 1× — pas encore de comparaison.</p>
      )}
      {others.length > 0 && (
        <div className="mt-4 space-y-3">
          <SectionHeader label="Autres tentatives" />
          {others.map((c) => <SchemaCard key={`${c.sessionId}:${c.problemId}`} c={c} isChampion={false} />)}
        </div>
      )}
    </div>
  );
}

function CategoryList({ entries, selected, onPick }:
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

export function SchemasPanel(): React.JSX.Element {
  const [data, setData] = useState<ChampionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

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

  useEffect(() => {
    const first = sorted[0];
    if (first && !sorted.some((e) => e.category === selected)) setSelected(first.category);
  }, [sorted, selected]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  const active = sorted.find((e) => e.category === selected) ?? sorted[0];
  if (!active) return <PanelMessage text="Aucun champion élu pour l'instant." />;
  return (
    <div className="flex flex-1 flex-col overflow-hidden px-8 py-6">
      <header className="mb-4 flex items-center gap-3">
        <Trophy size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Schémas</h1>
          <p className="text-[12px] text-white/45">
            Le champion est le schéma de résolution élu par fitness — moins de tours, retours et erreurs.
          </p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-5">
        <CategoryList entries={sorted} selected={active.category} onPick={setSelected} />
        <motion.div key={active.category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }} className="min-w-0 flex-1 overflow-y-auto pr-1">
          <CategoryDetail entry={active} />
        </motion.div>
      </div>
    </div>
  );
}
