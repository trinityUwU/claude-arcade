import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { SkillUsage } from "../../src/types.ts";
import { useLiveResource } from "../lib/live.tsx";
import { reveal } from "../lib/motion.ts";
import { PanelMessage } from "./SessionsPanel.tsx";

function SkillRow({ s, max, rank, silent }: { s: SkillUsage; max: number; rank: number; silent: boolean }): React.JSX.Element {
  const pct = max > 0 ? Math.round((s.count / max) * 100) : 0;
  return (
    <motion.div {...reveal(silent, rank)}
      className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-white/30">{rank + 1}</span>
          <span className="truncate font-mono text-[13px] text-white/85">{s.name}</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-2">
          <span className="text-[11px] text-white/35">{s.sessions} sess.</span>
          <span className="text-base font-black tabular-nums text-fuchsia-200">{s.count}</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500/70 to-fuchsia-300/70" />
      </div>
    </motion.div>
  );
}

export function SkillsPanel(): React.JSX.Element {
  const { data, silent, error } = useLiveResource<SkillUsage[]>("/api/skills");

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Chargement…" />;
  if (!data.length) return <PanelMessage text="Aucun skill invoqué (tool Skill) dans les sessions scannées." />;

  const max = data[0]?.count ?? 0;
  const total = data.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <header className="mb-5 flex items-center gap-3">
        <Sparkles size={20} strokeWidth={1.75} className="text-fuchsia-200" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Skills les plus utilisés</h1>
          <p className="text-[12px] text-white/45">{data.length} skills · {total} invocations</p>
        </div>
      </header>
      <div className="flex flex-col gap-2">
        {data.map((s, i) => <SkillRow key={s.name} s={s} max={max} rank={i} silent={silent} />)}
      </div>
    </div>
  );
}
