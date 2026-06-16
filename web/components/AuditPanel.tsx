import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Loader2, Maximize2, ChevronDown, X, Eye, Code2, FileText } from "lucide-react";
import type { AuditReport, EntryAudit, AuditGrade, AuditCheck, DeepAudit } from "../../src/audit/types.ts";
import { useLiveResource } from "../lib/live.tsx";
import { reveal, cardHover } from "../lib/motion.ts";
import { Markdown } from "../lib/Markdown.tsx";
import { PanelMessage } from "./SessionsPanel.tsx";

const GRADES: AuditGrade[] = ["excellent", "solid", "mediocre", "overloaded", "thin"];
const GRADE_STYLE: Record<AuditGrade, { label: string; cls: string }> = {
  excellent: { label: "Excellent", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]" },
  solid: { label: "Correct", cls: "text-sky-300 border-sky-400/30 bg-sky-400/[0.06]" },
  mediocre: { label: "Médiocre", cls: "text-amber-300 border-amber-400/30 bg-amber-400/[0.06]" },
  overloaded: { label: "Surchargé", cls: "text-rose-300 border-rose-400/30 bg-rose-400/[0.06]" },
  thin: { label: "Maigre", cls: "text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/[0.06]" },
};

function GradeBadge({ grade }: { grade: AuditGrade }): React.JSX.Element {
  const s = GRADE_STYLE[grade];
  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

function CheckChip({ c }: { c: AuditCheck }): React.JSX.Element {
  const tone = c.ok ? "border-emerald-400/20 text-emerald-200/70"
    : c.severity === "bad" ? "border-rose-400/40 text-rose-200" : "border-amber-400/40 text-amber-200";
  const dot = c.ok ? "bg-emerald-400" : c.severity === "bad" ? "bg-rose-400" : "bg-amber-400";
  return (
    <span title={c.message ?? `${c.label} : OK`}
      className={`flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{c.label}
    </span>
  );
}

function Overlay(
  { title, onClose, children, headerExtra }:
  { title: string; onClose: () => void; children: React.ReactNode; headerExtra?: React.ReactNode },
): React.JSX.Element {
  // Portal vers <body> : échappe au transform/filter des cartes (sinon `fixed` se cadre sur la carte).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ duration: 0.24 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c10]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <span className="truncate font-mono text-[13px] text-white/85">{title}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerExtra}
            <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
}

function DeepBody({ d }: { d: DeepAudit }): React.JSX.Element {
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="mb-2 flex items-center gap-2">
        <GradeBadge grade={d.verdict} /><span className="text-white/40">verdict approfondi</span>
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

/** Vue live pendant le streaming : markdown partiel qui se construit token par token. */
function StreamingBody({ text, elapsed }: { text: string; elapsed: number }): React.JSX.Element {
  const md = text.replace(/^\s*VERDICT:\s*\w*/i, "").trim();
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="mb-2 flex items-center gap-2 text-white/40">
        <Loader2 size={12} className="animate-spin" />
        {md ? "analyse en cours (sonnet, streaming)…" : `démarrage de l'analyse sonnet… ${elapsed}s`}
      </div>
      {md
        ? <Markdown content={md} />
        : <span className="text-white/30">Le premier token arrive après l'ingestion du fichier + de la rubrique (quelques secondes).</span>}
    </div>
  );
}

function ContentModal({ relPath, onClose }: { relPath: string; onClose: () => void }): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null);
  const [rendered, setRendered] = useState(relPath.endsWith(".md"));  // markdown stylisé par défaut
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/config/file?path=${encodeURIComponent(relPath)}`);
        setContent(r.ok ? ((await r.json()) as { content: string }).content : "(illisible)");
      } catch { setContent("(erreur de lecture)"); }
    })();
  }, [relPath]);

  const toggle = (
    <button onClick={() => setRendered((v) => !v)} title={rendered ? "Voir le brut" : "Voir le rendu stylisé"}
      className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:text-white/85">
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

const BTN = "flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:text-white/80 disabled:opacity-50";

interface RowActions {
  onContent: (path: string) => void;
  onFullscreen: (path: string) => void;
  onDeep: (path: string, d: DeepAudit) => void;
}

function EntryRow(
  { e, rank, silent, deep, actions }:
  { e: EntryAudit; rank: number; silent: boolean; deep?: DeepAudit; actions: RowActions },
): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    esRef.current?.close(); esRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);
  useEffect(() => stop, [stop]);  // ferme l'EventSource si on quitte (anti-fuite, anti-reconnexion)

  const runDeep = useCallback(() => {
    if (esRef.current) return;  // une seule analyse à la fois sur cette ligne
    setBusy(true); setStream(""); setOpen(true); setElapsed(0);
    const started = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    const es = new EventSource(`/api/audit/deep/stream?path=${encodeURIComponent(e.relPath)}`);
    esRef.current = es;
    es.addEventListener("delta", (ev) => {
      const { text } = JSON.parse((ev as MessageEvent).data) as { text: string };
      setStream((prev) => (prev ?? "") + text);
    });
    es.addEventListener("done", (ev) => {
      actions.onDeep(e.relPath, JSON.parse((ev as MessageEvent).data) as DeepAudit);
      setStream(null); setBusy(false); stop();
    });
    es.addEventListener("error", () => { setBusy(false); stop(); });  // close → pas de reconnexion auto
  }, [e.relPath, actions, stop]);

  return (
    <motion.div {...reveal(silent, rank)} {...cardHover} layout
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.14] hover:bg-white/[0.035]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-mono text-[13px] text-white/85">{e.relPath}</span>
          <span className="shrink-0 text-[11px] text-white/30">~{e.estTokens} tok</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {deep && <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-white/40">analysé</span>}
          <span className="text-[11px] tabular-nums text-white/40">{e.score}/100</span>
          <GradeBadge grade={e.grade} />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">{e.checks.map((c) => <CheckChip key={c.code} c={c} />)}</div>
      <div className="mt-2.5 flex items-center gap-2">
        <button onClick={() => actions.onContent(e.relPath)} className={BTN}><Eye size={12} />Contenu</button>
        {!deep ? (
          <button onClick={runDeep} disabled={busy} className={BTN}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Stethoscope size={12} />}
            {busy ? "Analyse claude -p…" : "Audit profond (claude -p)"}
          </button>
        ) : (
          <>
            <button onClick={() => setOpen((o) => !o)} className={BTN}>
              <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />{open ? "Replier" : "Dérouler"}
            </button>
            <button onClick={() => actions.onFullscreen(e.relPath)} className={BTN}><Maximize2 size={12} />Plein écran</button>
          </>
        )}
      </div>
      <AnimatePresence>
        {(stream !== null || (deep && open)) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/20 p-3">
              {stream !== null ? <StreamingBody text={stream} elapsed={elapsed} /> : deep ? <DeepBody d={deep} /> : null}
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

export function AuditPanel(): React.JSX.Element {
  const { data: report, silent, error } = useLiveResource<AuditReport>("/api/audit");
  const [active, setActive] = useState<Set<AuditGrade>>(new Set(GRADES));
  const [analyzedOnly, setAnalyzedOnly] = useState(false);
  const [deepMap, setDeepMap] = useState<Map<string, DeepAudit>>(new Map());
  const [modal, setModal] = useState<{ kind: "content" | "deep"; relPath: string } | null>(null);

  // Réhydrate les verdicts persistés depuis le rapport (durables entre rechargements).
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
  const actions = useMemo<RowActions>(() => ({
    onContent: (relPath) => setModal({ kind: "content", relPath }),
    onFullscreen: (relPath) => setModal({ kind: "deep", relPath }),
    onDeep,
  }), [onDeep]);

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
    </div>
  );
}
