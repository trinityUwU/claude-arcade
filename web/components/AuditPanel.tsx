import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Loader2, Maximize2, ChevronDown, Eye, Code2, FileText, Wand2, ArrowUpCircle, X, History } from "lucide-react";
import type { AuditReport, EntryAudit, AuditGrade, AuditCheck, DeepAudit, Correction } from "../../src/audit/types.ts";
import { useLiveResource } from "../lib/live.tsx";
import { useClaudeStream } from "../lib/useClaudeStream.ts";
import { reveal, cardHover } from "../lib/motion.ts";
import { Markdown } from "../lib/Markdown.tsx";
import { Overlay } from "../lib/Overlay.tsx";
import { UpgradeHistory } from "./UpgradeHistory.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

const GRADES: AuditGrade[] = ["excellent", "solid", "mediocre", "overloaded", "thin"];
const GRADE_STYLE: Record<AuditGrade, { label: string; cls: string }> = {
  excellent: { label: "Excellent", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]" },
  solid: { label: "Correct", cls: "text-sky-300 border-sky-400/30 bg-sky-400/[0.06]" },
  mediocre: { label: "Médiocre", cls: "text-amber-300 border-amber-400/30 bg-amber-400/[0.06]" },
  overloaded: { label: "Surchargé", cls: "text-rose-300 border-rose-400/30 bg-rose-400/[0.06]" },
  thin: { label: "Maigre", cls: "text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/[0.06]" },
};
const BTN = "flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:text-white/80 disabled:opacity-50";

function GradeBadge({ grade }: { grade: AuditGrade }): React.JSX.Element {
  const s = GRADE_STYLE[grade];
  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

function CheckChip({ c }: { c: AuditCheck }): React.JSX.Element {
  const tone = c.ok ? "border-emerald-400/20 text-emerald-200/70"
    : c.severity === "bad" ? "border-rose-400/40 text-rose-200" : "border-amber-400/40 text-amber-200";
  const dot = c.ok ? "bg-emerald-400" : c.severity === "bad" ? "bg-rose-400" : "bg-amber-400";
  return (
    <span title={c.message ?? `${c.label} : OK`} className={`flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{c.label}
    </span>
  );
}

function DeepBody({ d }: { d: DeepAudit }): React.JSX.Element {
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="mb-2 flex items-center gap-2">
        <GradeBadge grade={d.verdict} /><span className="text-white/40">verdict approfondi (sonnet)</span>
        <span className="ml-auto rounded-md border border-emerald-400/20 px-1.5 py-0.5 text-[10px] text-emerald-200/70">${d.costUsd.toFixed(4)}</span>
      </div>
      {d.markdown ? <Markdown content={d.markdown} /> : (
        <>
          {(d.strengths ?? []).map((x, i) => <div key={`s${i}`} className="text-emerald-200/80">+ {x}</div>)}
          {(d.issues ?? []).map((x, i) => <div key={`i${i}`} className="text-rose-200/80">− {x}</div>)}
          {d.rewriteHint && <div className="mt-2 text-sky-200/85">→ {d.rewriteHint}</div>}
        </>
      )}
    </div>
  );
}

/** Vue live d'analyse (markdown qui se construit, ligne VERDICT masquée). */
function AnalysisStreaming({ text, elapsed }: { text: string; elapsed: number }): React.JSX.Element {
  const md = text.replace(/^\s*VERDICT:\s*\w*/i, "").trim();
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="mb-2 flex items-center gap-2 text-white/40">
        <Loader2 size={12} className="animate-spin" />
        {md ? "analyse en cours (sonnet, streaming)…" : `démarrage de l'analyse sonnet… ${elapsed}s`}
      </div>
      {md ? <Markdown content={md} /> : <span className="text-white/30">Premier token après ingestion du fichier + rubrique (quelques secondes).</span>}
    </div>
  );
}

/** Vue live de correction : on masque le préambule, on affiche le fichier dès la sentinelle. */
function CorrectionStreaming({ text, elapsed }: { text: string; elapsed: number }): React.JSX.Element {
  const START = "===ARCADE_CORRECTION_START===";
  const i = text.indexOf(START);
  const file = i >= 0 ? text.slice(i + START.length).replace("===ARCADE_CORRECTION_END===", "").trimStart() : "";
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="mb-2 flex items-center gap-2 text-fuchsia-200/70">
        <Loader2 size={12} className="animate-spin" />
        {file ? "correction en cours (opus, streaming)…" : `analyse & rédaction par opus… ${elapsed}s`}
      </div>
      <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[12px] text-white/75">{file || "…"}</pre>
    </div>
  );
}

/** Correction opus terminée, avant application : aperçu + Mettre à jour / Annuler. */
function CorrectionReview(
  { c, applying, onApply, onCancel }: { c: Correction; applying: boolean; onApply: () => void; onCancel: () => void },
): React.JSX.Element {
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="mb-2 flex items-center gap-2">
        <Wand2 size={13} className="text-fuchsia-200" /><span className="text-white/55">correction opus prête</span>
        <span className="text-white/30">{c.before.length} → {c.after.length} c.</span>
        <span className="ml-auto rounded-md border border-fuchsia-400/20 px-1.5 py-0.5 text-[10px] text-fuchsia-200/70">${c.costUsd.toFixed(4)}</span>
      </div>
      <pre className="mb-2 max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-2 font-mono text-[12px] text-white/75">{c.after}</pre>
      <div className="flex items-center gap-2">
        <button onClick={onApply} disabled={applying}
          className="flex items-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-400/[0.08] px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/[0.14] disabled:opacity-50">
          {applying ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}Mettre à jour le fichier
        </button>
        <button onClick={onCancel} disabled={applying} className={BTN}><X size={12} />Annuler</button>
      </div>
    </div>
  );
}

function ContentModal({ relPath, onClose }: { relPath: string; onClose: () => void }): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null);
  const [rendered, setRendered] = useState(relPath.endsWith(".md"));
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/config/file?path=${encodeURIComponent(relPath)}`);
        setContent(r.ok ? ((await r.json()) as { content: string }).content : "(illisible)");
      } catch { setContent("(erreur de lecture)"); }
    })();
  }, [relPath]);
  const toggle = (
    <button onClick={() => setRendered((v) => !v)} className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:text-white/85">
      {rendered ? <><Code2 size={12} />Brut</> : <><FileText size={12} />Rendu</>}
    </button>
  );
  return (
    <Overlay title={relPath} onClose={onClose} headerExtra={toggle}>
      {content === null ? <span className="text-white/40">Chargement…</span>
        : rendered ? <Markdown content={content} />
        : <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-white/75">{content}</pre>}
    </Overlay>
  );
}

interface RowActions {
  onContent: (path: string) => void;
  onFullscreen: (path: string) => void;
  onHistory: (path: string) => void;
  onDeep: (path: string, d: DeepAudit) => void;
  onUpgraded: (path: string) => void;
}

function EntryRow(
  { e, rank, silent, deep, actions }: { e: EntryAudit; rank: number; silent: boolean; deep?: DeepAudit; actions: RowActions },
): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [applying, setApplying] = useState(false);
  const enc = encodeURIComponent(e.relPath);
  const analysis = useClaudeStream<DeepAudit>(`/api/audit/deep/stream?path=${enc}`, (d) => actions.onDeep(e.relPath, d));
  const correct = useClaudeStream<Correction>(`/api/audit/correct/stream?path=${enc}`, (c) => setCorrection(c));

  const runDeep = useCallback(() => { setOpen(true); analysis.start(); }, [analysis]);
  const runCorrect = useCallback(() => { setOpen(true); setCorrection(null); correct.start(); }, [correct]);
  const apply = useCallback(async () => {
    if (!correction) return;
    setApplying(true);
    try {
      const r = await fetch("/api/audit/upgrade", {
        method: "POST", body: JSON.stringify({ path: e.relPath, after: correction.after, costUsd: correction.costUsd }),
      });
      if (r.ok) { setCorrection(null); actions.onUpgraded(e.relPath); }  // reset → la boucle recommence
    } finally { setApplying(false); }
  }, [correction, e.relPath, actions]);

  const expandOpen = analysis.running || correct.running || correction !== null || (deep && open);
  return (
    <motion.div {...reveal(silent, rank)} {...cardHover} layout
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.14] hover:bg-white/[0.035]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-mono text-[13px] text-white/85">{e.relPath}</span>
          <span className="shrink-0 text-[11px] text-white/30">~{e.estTokens} tok</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {e.upgradeCount > 0 && <span className="rounded-md border border-emerald-400/20 px-1.5 py-0.5 text-[10px] text-emerald-200/60">↑{e.upgradeCount}</span>}
          <span className="text-[11px] tabular-nums text-white/40">{e.score}/100</span>
          <GradeBadge grade={e.grade} />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">{e.checks.map((c) => <CheckChip key={c.code} c={c} />)}</div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button onClick={() => actions.onContent(e.relPath)} className={BTN}><Eye size={12} />Contenu</button>
        {!deep ? (
          <button onClick={runDeep} disabled={analysis.running} className={BTN}>
            {analysis.running ? <Loader2 size={12} className="animate-spin" /> : <Stethoscope size={12} />}
            {analysis.running ? "Analyse sonnet…" : "Audit profond (sonnet)"}
          </button>
        ) : (
          <>
            <button onClick={() => setOpen((o) => !o)} className={BTN}>
              <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />{open ? "Replier" : "Dérouler"}
            </button>
            <button onClick={() => actions.onFullscreen(e.relPath)} className={BTN}><Maximize2 size={12} />Plein écran</button>
            {!correction && (
              <button onClick={runCorrect} disabled={correct.running}
                className="flex items-center gap-1.5 rounded-md border border-fuchsia-400/30 bg-fuchsia-400/[0.06] px-2 py-1 text-[11px] text-fuchsia-200 hover:bg-fuchsia-400/[0.12] disabled:opacity-50">
                {correct.running ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {correct.running ? "Correction opus…" : "Corriger (opus)"}
              </button>
            )}
          </>
        )}
        {e.upgradeCount > 0 && (
          <button onClick={() => actions.onHistory(e.relPath)} className={BTN}><History size={12} />Historique ({e.upgradeCount})</button>
        )}
      </div>
      <AnimatePresence>
        {expandOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/20 p-3">
              {analysis.running ? <AnalysisStreaming text={analysis.text ?? ""} elapsed={analysis.elapsed} />
                : correct.running ? <CorrectionStreaming text={correct.text ?? ""} elapsed={correct.elapsed} />
                : correction ? <CorrectionReview c={correction} applying={applying} onApply={apply} onCancel={() => setCorrection(null)} />
                : deep ? <DeepBody d={deep} /> : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Filters(
  { byGrade, active, onToggle, analyzedOnly, onAnalyzed, analyzedCount }:
  { byGrade: Record<AuditGrade, number>; active: Set<AuditGrade>; onToggle: (g: AuditGrade) => void;
    analyzedOnly: boolean; onAnalyzed: () => void; analyzedCount: number },
): React.JSX.Element {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {GRADES.map((k) => byGrade[k] > 0 && (
        <button key={k} onClick={() => onToggle(k)}
          className={`rounded-md border px-2 py-0.5 text-[11px] transition ${GRADE_STYLE[k].cls} ${active.has(k) ? "" : "opacity-35 hover:opacity-70"}`}>
          {byGrade[k]} {GRADE_STYLE[k].label.toLowerCase()}
        </button>
      ))}
      <button onClick={onAnalyzed} disabled={analyzedCount === 0}
        className={`ml-1 flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] transition disabled:opacity-30 ${analyzedOnly ? "border-sky-400/40 bg-sky-400/[0.08] text-sky-200" : "border-white/10 text-white/45 hover:text-white/70"}`}>
        <Stethoscope size={11} />{analyzedCount} analysé{analyzedCount > 1 ? "s" : ""}
      </button>
    </div>
  );
}

type Modal = { kind: "content" | "deep" | "upgrades"; relPath: string };

export function AuditPanel(): React.JSX.Element {
  const { data: report, silent, error, reload } = useLiveResource<AuditReport>("/api/audit");
  const [active, setActive] = useState<Set<AuditGrade>>(new Set(GRADES));
  const [analyzedOnly, setAnalyzedOnly] = useState(false);
  const [deepMap, setDeepMap] = useState<Map<string, DeepAudit>>(new Map());
  const [modal, setModal] = useState<Modal | null>(null);

  useEffect(() => {
    if (!report) return;
    setDeepMap((prev) => {
      const next = new Map(prev);
      for (const e of report.entries) if (e.deep) next.set(e.relPath, e.deep);
      return next;
    });
  }, [report]);

  const toggle = useCallback((g: AuditGrade) => setActive((prev) => {
    if (prev.size >= GRADES.length) return new Set([g]);
    const next = new Set(prev);
    next.has(g) ? next.delete(g) : next.add(g);
    return next.size === 0 ? new Set(GRADES) : next;
  }), []);
  const onDeep = useCallback((path: string, d: DeepAudit) => setDeepMap((p) => new Map(p).set(path, d)), []);
  const onUpgraded = useCallback((path: string) => {
    setDeepMap((p) => { const n = new Map(p); n.delete(path); return n; });  // reset analyse
    reload();  // recharge le rapport : fichier corrigé → nouveaux score/checks + upgradeCount
  }, [reload]);
  const actions = useMemo<RowActions>(() => ({
    onContent: (relPath) => setModal({ kind: "content", relPath }),
    onFullscreen: (relPath) => setModal({ kind: "deep", relPath }),
    onHistory: (relPath) => setModal({ kind: "upgrades", relPath }),
    onDeep, onUpgraded,
  }), [onDeep, onUpgraded]);

  const shown = useMemo(() => (report?.entries ?? []).filter(
    (e) => active.has(e.grade) && (!analyzedOnly || deepMap.has(e.relPath)),
  ), [report, active, analyzedOnly, deepMap]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!report) return <PanelMessage text="Diagnostic en cours…" />;
  if (!report.entries.length) return <PanelMessage text="Aucune entrée de config détectée dans ~/.claude." />;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <header className="mb-4 flex items-center gap-3">
        <Stethoscope size={20} strokeWidth={1.75} className="text-emerald-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Diagnostic de config</h1>
          <p className="text-[12px] text-white/45">
            {report.entries.length} fichiers · ~{report.summary.totalTokens.toLocaleString()} tokens · normes Anthropic
          </p>
        </div>
      </header>
      <Filters byGrade={report.summary.byGrade} active={active} onToggle={toggle}
        analyzedOnly={analyzedOnly} onAnalyzed={() => setAnalyzedOnly((v) => !v)} analyzedCount={deepMap.size} />
      <motion.div layout className="flex flex-col gap-2">
        {shown.map((e, i) => (
          <EntryRow key={e.relPath} e={e} rank={i} silent={silent} deep={deepMap.get(e.relPath)} actions={actions} />
        ))}
      </motion.div>
      {modal?.kind === "content" && <ContentModal relPath={modal.relPath} onClose={() => setModal(null)} />}
      {modal?.kind === "deep" && deepMap.has(modal.relPath) && (
        <Overlay title={modal.relPath} onClose={() => setModal(null)}><DeepBody d={deepMap.get(modal.relPath)!} /></Overlay>
      )}
      {modal?.kind === "upgrades" && <UpgradeHistory relPath={modal.relPath} onClose={() => setModal(null)} />}
    </div>
  );
}
