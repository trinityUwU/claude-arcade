import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, ChevronRight, NotebookPen, Paperclip } from "lucide-react";
import { useLiveResource } from "../lib/live.tsx";
import { reveal } from "../lib/motion.ts";
import type { SessionSummary, Problem } from "../../src/consolidate/types.ts";
import type { SessionNote, NoteKind } from "../../src/notes/types.ts";
import {
  basename, qualityColor, DifficultyBadge, SeverityBadge, OutcomeBadge, SectionHeader,
} from "../lib/format.tsx";

const NOTE_TONE: Record<NoteKind, string> = {
  decision: "text-sky-300/90 border-sky-400/30",
  contradiction: "text-rose-300/90 border-rose-400/30",
  stack: "text-violet-300/90 border-violet-400/30",
  pattern: "text-emerald-300/90 border-emerald-400/30",
  summary: "text-amber-300/90 border-amber-400/30",
  artifact: "text-fuchsia-300/90 border-fuchsia-400/30",
  note: "text-white/60 border-white/15",
};

function NoteRow({ n }: { n: SessionNote }): React.JSX.Element {
  const href = n.archivedPath ?? n.artifactPath;
  return (
    <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${NOTE_TONE[n.kind]}`}>{n.kind}</span>
        {n.tags?.map((t) => <span key={t} className="text-[10px] text-white/30">#{t}</span>)}
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-white/75">{n.text}</p>
      {n.artifactPath && (
        <a href={href ? `/api/artifact?path=${encodeURIComponent(href)}` : undefined}
          target="_blank" rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-fuchsia-300/80 hover:text-fuchsia-200">
          <Paperclip size={11} strokeWidth={2} /><span className="font-mono">{basename(n.artifactPath)}</span>
        </a>
      )}
    </li>
  );
}

function NotesBlock({ notes }: { notes: SessionNote[] }): React.JSX.Element | null {
  if (!notes.length) return null;
  return (
    <div className="mt-3">
      <SectionHeader label="Notes de session" />
      <ul className="mt-2 space-y-1.5">{notes.map((n, i) => <NoteRow key={i} n={n} />)}</ul>
    </div>
  );
}

function Bullets({ title, items, tone }: { title: string; items: string[]; tone: string }): React.JSX.Element | null {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <div className={`mb-1 text-[11px] font-semibold ${tone}`}>{title}</div>
      <ul className="space-y-0.5">
        {items.map((it, i) => <li key={i} className="text-[12px] leading-snug text-white/65">• {it}</li>)}
      </ul>
    </div>
  );
}

function Metrics({ turns, backtracks, errors }: { turns: number; backtracks: number; errors: number }): React.JSX.Element {
  return (
    <div className="mt-1.5 flex gap-3 text-[11px] tabular-nums text-white/45">
      <span>{turns} tours</span><span>{backtracks} retours</span><span>{errors} err. outils</span>
    </div>
  );
}

function ProblemBlock({ p }: { p: Problem }): React.JSX.Element {
  const rs = p.resolution_schema;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] leading-snug text-white/80">{p.description}</p>
        <div className="flex shrink-0 gap-1"><SeverityBadge severity={p.severity} /><OutcomeBadge outcome={rs.outcome} /></div>
      </div>
      <div className="mt-1 text-[11px] text-white/35">{p.category}</div>
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
      <Metrics turns={rs.turns_to_resolve} backtracks={rs.backtracks} errors={rs.tool_errors} />
    </div>
  );
}

function SessionExtras({ s }: { s: SessionSummary }): React.JSX.Element {
  return (
    <>
      <Bullets title="Ce qui a marché" items={s.wins} tone="text-emerald-400/90" />
      <Bullets title="Décisions" items={s.decisions} tone="text-sky-400/90" />
      <Bullets title="Erreurs agent" items={s.errors_claude} tone="text-rose-400/90" />
      <Bullets title="Côté Chris" items={s.errors_chris} tone="text-amber-300/90" />
    </>
  );
}

function SessionCard({ s, index, silent }: { s: SessionSummary; index: number; silent: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const problems = s.problems ?? [];
  const notes = s.notes ?? [];
  const isV1 = s.difficulty === undefined && s.problems === undefined;
  return (
    <motion.div {...reveal(silent, index)}
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left">
        <ChevronRight size={16} strokeWidth={2}
          className={`mt-0.5 shrink-0 text-white/30 transition-transform ${open ? "rotate-90" : ""}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13.5px] font-semibold text-white/90">{s.topic}</h3>
            {isV1 && <span className="rounded bg-white/[0.05] px-1 py-0.5 text-[9px] uppercase text-white/35">v1</span>}
          </div>
          <div className="mt-0.5 text-[11px] text-white/40">{basename(s.project)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {s.difficulty && <DifficultyBadge level={s.difficulty.level} />}
          {notes.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] tabular-nums text-fuchsia-300/70">
              <NotebookPen size={12} strokeWidth={2} />{notes.length}
            </span>
          )}
          {!isV1 && <span className="text-[11px] tabular-nums text-white/40">{problems.length} pb</span>}
          <span className={`text-base font-black tabular-nums ${qualityColor(s.quality_score)}`}>{s.quality_score}</span>
        </div>
      </button>
      {open && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          {s.difficulty && <p className="text-[12px] italic leading-snug text-white/50">{s.difficulty.why}</p>}
          <NotesBlock notes={notes} />
          {problems.length > 0 && (
            <div className="mt-3 space-y-2">
              <SectionHeader label="Problèmes" />
              {problems.map((p) => <ProblemBlock key={p.id} p={p} />)}
            </div>
          )}
          <SessionExtras s={s} />
        </div>
      )}
    </motion.div>
  );
}

export function SessionsPanel(): React.JSX.Element {
  const { data: raw, silent, error } = useLiveResource<SessionSummary[]>("/api/sessions");
  const data = useMemo(() => raw ? [...raw].sort((a, b) => b.summarizedAt - a.summarizedAt) : null, [raw]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  if (!data.length) return <PanelMessage text="Aucune session résumée. Lance une consolidation." />;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <header className="mb-5 flex items-center gap-3">
        <ScrollText size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Sessions</h1>
          <p className="text-[12px] text-white/45">{data.length} sessions résumées</p>
        </div>
      </header>
      <div className="flex flex-col gap-3">
        {data.map((s, i) => <SessionCard key={s.sessionId} s={s} index={i} silent={silent} />)}
      </div>
    </div>
  );
}

export function PanelMessage({ text }: { text: string }): React.JSX.Element {
  return <div className="flex flex-1 items-center justify-center text-[13px] text-white/40">{text}</div>;
}
