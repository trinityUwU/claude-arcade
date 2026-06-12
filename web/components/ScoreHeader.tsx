import { motion } from "framer-motion";
import type { ScanResult } from "../../src/types.ts";
import { TIER_COLOR } from "../lib/tiers.ts";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3">
      <div className="text-[11px] uppercase tracking-widest text-white/35">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold ${accent ?? "text-white/90"}`}>{value}</div>
    </div>
  );
}

export function ScoreHeader({ data }: { data: ScanResult }): React.JSX.Element {
  const s = data.score;
  return (
    <header className="mb-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-baseline gap-3">
          <h1 className={`bg-gradient-to-r from-amber-200 via-fuchsia-200 to-indigo-200
            bg-clip-text text-4xl font-black tracking-tight text-transparent`}>
            CLAUDE ARCADE
          </h1>
          <span className="text-amber-200/70">☤</span>
        </div>
        <p className="mt-1 text-sm text-white/40">
          {data.sessionCount} sessions scannées · 100% local · zéro API externe
        </p>
      </motion.div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rang" value={s.rank} accent={TIER_COLOR[s.rank]} />
        <Stat label="Score" value={`${s.totalPoints} pts`} />
        <Stat label="Débloqués" value={`${s.unlockedCount}/${s.totalCount}`} accent="text-emerald-300" />
        <Stat label="Catégories" value={String(Object.keys(s.byCategory).length)} />
      </div>
    </header>
  );
}
