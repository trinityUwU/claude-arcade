import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Trophy, AlertTriangle, User, GitCommitHorizontal, Tag } from "lucide-react";
import type { GraphNode, SessionSummary } from "../../src/consolidate/types.ts";
import type { TranscriptView } from "../../src/consolidate/transcript-view.ts";

interface Props { node: GraphNode; onClose: () => void }

const TYPE_LABEL: Record<string, string> = {
  session: "Session", project: "Projet", notion: "Notion", error: "Erreur récurrente", process: "Process gagnant",
};

function qualityColor(q: number): string {
  if (q >= 75) return "text-emerald-400";
  if (q < 40) return "text-rose-400";
  return "text-amber-400";
}

function Bullets({ icon, title, items, tone }:
  { icon: React.ReactNode; title: string; items: string[]; tone: string }): React.JSX.Element | null {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <div className={`mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold ${tone}`}>{icon}{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className="text-[12.5px] leading-snug text-white/70">• {it}</li>)}
      </ul>
    </div>
  );
}

function SummaryBlock({ s }: { s: SessionSummary }): React.JSX.Element {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] uppercase tracking-widest text-white/35">Qualité</span>
        <span className={`text-xl font-black tabular-nums ${qualityColor(s.quality_score)}`}>{s.quality_score}</span>
      </div>
      <Bullets icon={<Trophy size={13} />} title="Ce qui a marché" items={s.wins} tone="text-emerald-400/90" />
      <Bullets icon={<AlertTriangle size={13} />} title="Erreurs agent"
        items={s.errors_claude} tone="text-rose-400/90" />
      <Bullets icon={<User size={13} />} title="Côté Chris" items={s.errors_chris} tone="text-amber-400/90" />
      <Bullets icon={<GitCommitHorizontal size={13} />} title="Décisions" items={s.decisions} tone="text-sky-400/90" />
      {s.links_hint.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {s.links_hint.map((h, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03]
              px-2 py-0.5 text-[11px] text-white/55"><Tag size={10} />{h}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Turn({ t }: { t: TranscriptView["turns"][number] }): React.JSX.Element {
  const isUser = t.role === "user";
  return (
    <div className={`rounded-lg border px-3 py-2 ${isUser
      ? "border-fuchsia-400/15 bg-fuchsia-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
        {isUser ? "Chris" : "Claude"}
      </div>
      {t.text && <p className="whitespace-pre-wrap text-[12.5px] leading-snug text-white/75">{t.text}</p>}
      {t.tools.map((tool, i) => (
        <div key={i} className="mt-1 truncate font-mono text-[11px] text-sky-300/70">⚙ {tool}</div>
      ))}
      {t.errors.map((e, i) => <div key={i} className="mt-1 text-[11px] text-rose-400/80">✕ {e}</div>)}
    </div>
  );
}

function SessionDetail({ id }: { id: string }): React.JSX.Element {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [tr, setTr] = useState<TranscriptView | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch(`/api/session/${id}`).then((r) => (r.ok ? r.json() : null)).then(setSummary).catch(() => {});
  }, [id]);
  useEffect(() => {
    if (open && !tr) fetch(`/api/transcript/${id}`).then((r) => (r.ok ? r.json() : null)).then(setTr).catch(() => {});
  }, [open, tr, id]);
  if (!summary) return <p className="text-sm text-white/40">Chargement…</p>;
  return (
    <div>
      <SummaryBlock s={summary} />
      <button onClick={() => setOpen(!open)}
        className="mt-5 w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 text-[12px]
          text-white/65 transition hover:text-white/90">
        {open ? "Masquer le transcript" : `Voir le transcript${tr ? ` (${tr.turnCount} tours)` : ""}`}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {tr ? tr.turns.map((t, i) => <Turn key={i} t={t} />) : <p className="text-sm text-white/40">Chargement…</p>}
        </div>
      )}
    </div>
  );
}

function MetaDetail({ node }: { node: GraphNode }): React.JSX.Element {
  const m = node.meta ?? {};
  const rows = Object.entries(m).filter(([k]) => k !== "file");
  return (
    <dl className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-white/[0.05] pb-1.5">
          <dt className="text-[12px] text-white/40">{k}</dt>
          <dd className="text-right text-[12.5px] text-white/75">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
        </div>
      ))}
      {!rows.length && <p className="text-sm text-white/40">Nœud de type « {node.type} » — relié dans le réseau.</p>}
    </dl>
  );
}

export function NodeDetail({ node, onClose }: Props): React.JSX.Element {
  const isSession = node.type === "session";
  const sessionId = node.id.startsWith("sess:") ? node.id.slice(5) : "";
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute right-0 top-0 z-20 flex h-full w-[380px] flex-col border-l border-white/[0.08]
        bg-[#0d0c15]/95 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300/70">
            {TYPE_LABEL[node.type] ?? node.type}
          </div>
          <h3 className="mt-0.5 text-[15px] font-bold leading-tight text-white/90">{node.label}</h3>
        </div>
        <button onClick={onClose} className="text-white/40 transition hover:text-white/80"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isSession && sessionId ? <SessionDetail id={sessionId} /> : <MetaDetail node={node} />}
      </div>
    </motion.div>
  );
}
