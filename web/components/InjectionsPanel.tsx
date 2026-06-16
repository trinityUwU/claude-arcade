import { useMemo } from "react";
import { motion } from "framer-motion";
import { Zap, PlayCircle, MessageSquare } from "lucide-react";
import type { InjectionLog, InjectionRecord, InjectionEvent } from "../../src/consolidate/types.ts";
import { basename, formatDate } from "../lib/format.tsx";
import { useLiveResource } from "../lib/live.tsx";
import { reveal } from "../lib/motion.ts";
import { PanelMessage } from "./SessionsPanel.tsx";

const EVENT_STYLE: Record<InjectionEvent, { label: string; cls: string; Icon: typeof Zap }> = {
  "session-start": { label: "démarrage", cls: "text-fuchsia-200 bg-fuchsia-400/12 border-fuchsia-400/20", Icon: PlayCircle },
  "user-prompt-submit": { label: "prompt", cls: "text-sky-300 bg-sky-400/12 border-sky-400/20", Icon: MessageSquare },
};

function EventBadge({ event }: { event: InjectionEvent }): React.JSX.Element {
  const s = EVENT_STYLE[event];
  return (
    <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]
      font-semibold uppercase tracking-wider ${s.cls}`}>
      <s.Icon size={11} strokeWidth={2} />{s.label}
    </span>
  );
}

function RecordRow({ r, index, silent }: { r: InjectionRecord; index: number; silent: boolean }): React.JSX.Element {
  return (
    <motion.div {...reveal(silent, index)}
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <EventBadge event={r.event} />
          <span className="text-[12px] text-white/70">{basename(r.cwd)}</span>
        </div>
        <span className="text-[11px] tabular-nums text-white/35">{formatDate(r.at)}</span>
      </div>
      {r.categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {r.categories.map((c, i) => (
            <span key={i} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5
              text-[11px] text-white/55">{c}</span>
          ))}
        </div>
      )}
      <div className="mt-1.5 text-[11px] tabular-nums text-white/35">{r.charCount.toLocaleString("fr")} car. injectés</div>
    </motion.div>
  );
}

export function InjectionsPanel(): React.JSX.Element {
  const { data, silent, error } = useLiveResource<InjectionLog>("/api/injections");

  const counts = useMemo(() => {
    const records = data?.records ?? [];
    return {
      start: records.filter((r) => r.event === "session-start").length,
      prompt: records.filter((r) => r.event === "user-prompt-submit").length,
    };
  }, [data]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  if (!data.records.length) {
    return <PanelMessage text="Aucune injection. Elles apparaîtront quand les hooks seront actifs." />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <header className="mb-5 flex items-center gap-3">
        <Zap size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Injection</h1>
          <p className="text-[12px] text-white/45">
            {data.records.length} injections · {counts.start} démarrages · {counts.prompt} prompts
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-2.5">
        {data.records.map((r, i) => <RecordRow key={`${r.at}:${i}`} r={r} index={i} silent={silent} />)}
      </div>
    </div>
  );
}
