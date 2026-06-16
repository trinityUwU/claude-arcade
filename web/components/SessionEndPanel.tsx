import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, SkipForward, CircleSlash, XCircle } from "lucide-react";
import type { SessionEndLog, SessionEndEvent, SessionEndOutcome } from "../../src/consolidate/types.ts";
import { basename, formatDate, qualityColor } from "../lib/format.tsx";
import { useLiveResource } from "../lib/live.tsx";
import { reveal } from "../lib/motion.ts";
import { PanelMessage } from "./SessionsPanel.tsx";

const OUTCOME_STYLE: Record<SessionEndOutcome, { label: string; cls: string; Icon: typeof Activity }> = {
  consolidated: { label: "consolidée", cls: "text-emerald-300 bg-emerald-400/12 border-emerald-400/20", Icon: CheckCircle2 },
  skipped: { label: "déjà à jour", cls: "text-white/45 bg-white/[0.04] border-white/10", Icon: SkipForward },
  empty: { label: "triviale", cls: "text-white/45 bg-white/[0.04] border-white/10", Icon: CircleSlash },
  failed: { label: "échec", cls: "text-rose-400 bg-rose-400/12 border-rose-400/20", Icon: XCircle },
};

function OutcomeBadge({ outcome }: { outcome: SessionEndOutcome }): React.JSX.Element {
  const s = OUTCOME_STYLE[outcome];
  return (
    <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]
      font-semibold uppercase tracking-wider ${s.cls}`}>
      <s.Icon size={11} strokeWidth={2} />{s.label}
    </span>
  );
}

function EventRow({ e, index, silent }: { e: SessionEndEvent; index: number; silent: boolean }): React.JSX.Element {
  return (
    <motion.div {...reveal(silent, index)}
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <OutcomeBadge outcome={e.outcome} />
          <span className="text-[12px] text-white/70">{e.project ? basename(e.project) : e.sessionId.slice(0, 8)}</span>
        </div>
        <span className="text-[11px] tabular-nums text-white/35">{formatDate(e.at)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/35">
        <span>fin : {e.reason}</span>
        {e.quality !== undefined && <span className={qualityColor(e.quality)}>qualité {e.quality}</span>}
      </div>
    </motion.div>
  );
}

export function SessionEndPanel(): React.JSX.Element {
  const { data, silent, error } = useLiveResource<SessionEndLog>("/api/session-events");

  const consolidated = useMemo(
    () => (data?.records ?? []).filter((e) => e.outcome === "consolidated").length,
    [data],
  );

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  if (!data.records.length) {
    return <PanelMessage text="Aucune fin de session captée. Elles apparaîtront dès que le hook SessionEnd sera actif." />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <header className="mb-5 flex items-center gap-3">
        <Activity size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Temps réel</h1>
          <p className="text-[12px] text-white/45">
            {data.records.length} fins de session · {consolidated} consolidées à la volée
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-2.5">
        {data.records.map((e, i) => <EventRow key={`${e.at}:${i}`} e={e} index={i} silent={silent} />)}
      </div>
    </div>
  );
}
