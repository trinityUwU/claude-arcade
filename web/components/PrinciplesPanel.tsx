import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Check, Ban, TriangleAlert, Quote, Scale, Loader, Plus, Minus } from "lucide-react";
import type {
  PrinciplesData, PrincipleEntry, PrincipleInstance, PrinciplePolarity, RankedApproach, JudgeStatus,
} from "../../src/consolidate/types.ts";
import { SectionHeader, formatDate, basename } from "../lib/format.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

function powerBg(p: number): string {
  if (p >= 0.66) return "bg-emerald-400";
  if (p < 0.4) return "bg-rose-400";
  return "bg-amber-300";
}

function confidenceColor(c: number): string {
  if (c >= 0.66) return "text-emerald-400";
  if (c < 0.4) return "text-white/45";
  return "text-amber-300";
}
function confidenceBg(c: number): string {
  if (c >= 0.66) return "bg-emerald-400";
  if (c < 0.4) return "bg-white/30";
  return "bg-amber-300";
}

function PolarityBadge({ polarity }: { polarity: PrinciplePolarity }): React.JSX.Element {
  return polarity === "positive" ? (
    <span className="flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-400/12
      px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
      <Check size={11} strokeWidth={2.5} />à faire
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-400/12
      px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
      <Ban size={11} strokeWidth={2.5} />à éviter
    </span>
  );
}

function ConfidenceBar({ entry }: { entry: PrincipleEntry }): React.JSX.Element {
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] text-white/40">confiance</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${confidenceBg(entry.confidence)}`}
          style={{ width: `${Math.min(100, entry.confidence * 100)}%` }} />
      </div>
      <span className={`w-10 shrink-0 text-right text-[10px] font-bold tabular-nums
        ${confidenceColor(entry.confidence)}`}>
        {entry.confidence.toFixed(3)}
      </span>
    </div>
  );
}

function InstanceCard({ inst }: { inst: PrincipleInstance }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] leading-snug text-white/80">{inst.statement}</p>
        <PolarityBadge polarity={inst.polarity} />
      </div>
      {inst.trigger && <p className="mt-1.5 text-[12px] leading-snug text-white/55">Quand : {inst.trigger}</p>}
      {inst.rationale && <p className="mt-1 text-[12px] italic leading-snug text-white/45">{inst.rationale}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/35">
        <span className={`rounded border px-1.5 py-0.5 font-semibold uppercase tracking-wider ${inst.source === "stated"
          ? "border-sky-400/20 bg-sky-400/10 text-sky-300" : "border-white/10 bg-white/[0.03] text-white/45"}`}>
          {inst.source === "stated" ? "énoncé" : "déduit"}
        </span>
        <span className="font-mono">{basename(inst.project) || "—"}</span>
        <span className="tabular-nums">{formatDate(inst.at)}</span>
      </div>
    </div>
  );
}

function DominantCard({ entry }: { entry: PrincipleEntry }): React.JSX.Element {
  return (
    <div className="mb-4 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/[0.04] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Quote size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-fuchsia-200" />
          <p className="text-[13px] font-medium leading-snug text-white/85">{entry.statement}</p>
        </div>
        <PolarityBadge polarity={entry.polarity} />
      </div>
      <ConfidenceBar entry={entry} />
      {entry.contested && (
        <p className="mt-2 text-[11px] italic text-amber-300/80">
          Des instances contradictoires coexistent — à arbitrer avec Chris.
        </p>
      )}
      {entry.occurrences <= 1 && (
        <p className="mt-2 text-[12px] italic text-white/40">Vu 1× — pas encore en compétition.</p>
      )}
    </div>
  );
}

function ProsCons({ items, kind }: { items: string[]; kind: "pro" | "con" }): React.JSX.Element | null {
  if (items.length === 0) return null;
  const Icon = kind === "pro" ? Plus : Minus;
  const color = kind === "pro" ? "text-emerald-400" : "text-rose-400";
  return (
    <ul className="space-y-0.5">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-white/60">
          <Icon size={11} strokeWidth={2.5} className={`mt-0.5 shrink-0 ${color}`} />{t}
        </li>
      ))}
    </ul>
  );
}

function RankedRow({ approach, rank }: { approach: RankedApproach; rank: number }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] leading-snug text-white/80">
          <span className="mr-1.5 tabular-nums text-white/30">#{rank}</span>{approach.statement}
        </p>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/60">
          {Math.round(approach.power * 100)}%
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${powerBg(approach.power)}`}
          style={{ width: `${approach.power * 100}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <ProsCons items={approach.pros} kind="pro" />
        <ProsCons items={approach.cons} kind="con" />
      </div>
    </div>
  );
}

function JudgmentCard({ entry }: { entry: PrincipleEntry }): React.JSX.Element | null {
  const j = entry.judgment;
  if (!j) return null;
  return (
    <div className="mb-4 rounded-xl border border-sky-400/25 bg-sky-400/[0.04] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Scale size={15} className="text-sky-300" />
        <span className="text-[12px] font-semibold uppercase tracking-widest text-sky-300/90">Verdict</span>
        <span className="ml-auto text-[10px] tabular-nums text-white/30">{formatDate(j.judgedAt)}</span>
      </div>
      {j.synthesis && <p className="mb-3 text-[12.5px] leading-snug text-white/75">{j.synthesis}</p>}
      <div className="space-y-2">
        {j.ranked.map((a, i) => <RankedRow key={i} approach={a} rank={i + 1} />)}
      </div>
      {j.recommendation && (
        <div className="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-sky-300/80">Recommandation</span>
          <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-white/85">{j.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function DomainDetail({ entry }: { entry: PrincipleEntry }): React.JSX.Element {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Compass size={15} className="text-fuchsia-200/70" />
        <h2 className="text-[15px] font-bold text-white/90">{entry.label}</h2>
        <span className="text-[11px] tabular-nums text-white/40">{entry.occurrences}×</span>
        {entry.contested && (
          <span className="flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/10
            px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            <TriangleAlert size={11} strokeWidth={2.5} />contesté
          </span>
        )}
      </div>
      <DominantCard entry={entry} />
      <JudgmentCard entry={entry} />
      <SectionHeader label={`Instances (${entry.instances.length})`} />
      <div className="space-y-3">
        {entry.instances.map((inst) => (
          <InstanceCard key={`${inst.sessionId}:${inst.principleId}`} inst={inst} />
        ))}
      </div>
    </div>
  );
}

function DomainList({ entries, selected, onPick }:
  { entries: PrincipleEntry[]; selected: string; onPick: (d: string) => void }): React.JSX.Element {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-white/[0.07] pr-3">
      {entries.map((e) => (
        <button key={e.domain} onClick={() => onPick(e.domain)}
          className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px]
            transition-colors ${e.domain === selected
              ? "nav-active" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85"}`}>
          <span className="flex min-w-0 items-center gap-1.5">
            {e.contested && <TriangleAlert size={12} className="shrink-0 text-amber-300" />}
            <span className="truncate">{e.label}</span>
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-white/35">{e.occurrences}</span>
        </button>
      ))}
    </div>
  );
}

function JudgeButton(
  { status, onStart }: { status: JudgeStatus | null; onStart: () => void },
): React.JSX.Element | null {
  if (!status) return null;
  const { running, pending, judged } = status;
  const disabled = running || pending === 0;
  const label = running ? `Jugement… (${judged})` : pending > 0 ? `Juger ${pending}` : "Tout jugé";
  return (
    <button onClick={onStart} disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors
        ${disabled ? "border-white/[0.07] text-white/30"
          : "border-sky-400/30 bg-sky-400/[0.06] text-sky-200 hover:bg-sky-400/[0.12]"}`}>
      {running ? <Loader size={14} className="animate-spin" /> : <Scale size={14} />}{label}
    </button>
  );
}

function useJudge(onJudged: () => void): { status: JudgeStatus | null; start: () => void } {
  const [status, setStatus] = useState<JudgeStatus | null>(null);
  const refresh = useCallback(async (): Promise<JudgeStatus | null> => {
    try {
      const s = (await (await fetch("/api/principles/judge/status")).json()) as JudgeStatus;
      setStatus(s);
      return s;
    } catch { return null; }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!status?.running) return;
    const t = setInterval(() => { void refresh().then((s) => { if (s && !s.running) onJudged(); }); }, 2000);
    return () => clearInterval(t);
  }, [status?.running, refresh, onJudged]);
  const start = useCallback(() => {
    void fetch("/api/principles/judge", { method: "POST" }).then(() => refresh());
  }, [refresh]);
  return { status, start };
}

function PanelHeader({ onJudged }: { onJudged: () => void }): React.JSX.Element {
  const { status, start } = useJudge(onJudged);
  return (
    <header className="mb-4 flex items-center gap-3">
      <Compass size={20} strokeWidth={1.75} className="text-fuchsia-200" />
      <div>
        <h1 className="text-lg font-bold tracking-tight text-white/90">Principes</h1>
        <p className="text-[12px] text-white/45">
          Process de pensée appris des sessions — la confiance croît avec la récurrence,
          les contradictions sont signalées.
        </p>
      </div>
      <div className="ml-auto"><JudgeButton status={status} onStart={start} /></div>
    </header>
  );
}

function PrinciplesBody({ entries }: { entries: PrincipleEntry[] }): React.JSX.Element {
  const [selected, setSelected] = useState<string>("");
  useEffect(() => {
    const first = entries[0];
    if (first && !entries.some((e) => e.domain === selected)) setSelected(first.domain);
  }, [entries, selected]);
  const active = entries.find((e) => e.domain === selected) ?? entries[0];
  if (!active) return <PanelMessage text="Aucun principe dégagé pour l'instant." />;
  return (
    <div className="flex min-h-0 flex-1 gap-5">
      <DomainList entries={entries} selected={active.domain} onPick={setSelected} />
      <motion.div key={active.domain} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }} className="min-w-0 flex-1 overflow-y-auto pr-1">
        <DomainDetail entry={active} />
      </motion.div>
    </div>
  );
}

export function PrinciplesPanel(): React.JSX.Element {
  const [data, setData] = useState<PrinciplesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/principles")
      .then((r) => r.json())
      .then((d: PrinciplesData) => setData(d))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => (data ? [...data.domains].sort((a, b) => b.occurrences - a.occurrences || b.confidence - a.confidence) : []),
    [data],
  );

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  return (
    <div className="flex flex-1 flex-col overflow-hidden px-8 py-6">
      <PanelHeader onJudged={load} />
      <PrinciplesBody entries={sorted} />
    </div>
  );
}
