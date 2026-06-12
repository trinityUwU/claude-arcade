import { motion } from "framer-motion";
import type { AchievementResult } from "../../src/types.ts";
import { TIER_COLOR, TIER_GLOW, iconFor } from "../lib/tiers.ts";

const TIER_DOTS = ["Copper", "Silver", "Gold", "Diamond", "Olympian"] as const;

function ProgressBar({ a }: { a: AchievementResult }): React.JSX.Element {
  const pct = Math.round(a.progress * 100);
  return (
    <div className="mt-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] text-white/40">
        {a.nextThreshold ? `${a.value} / ${a.nextThreshold}` : `${a.value} · MAX`}
      </div>
    </div>
  );
}

function TierLadder({ reached }: { reached: number }): React.JSX.Element {
  return (
    <div className="flex gap-1">
      {TIER_DOTS.map((tier, i) => (
        <span key={tier} title={tier}
          className={`h-1.5 w-1.5 rounded-full ${i <= reached ? TIER_COLOR[tier].replace("text-", "bg-") : "bg-white/12"}`} />
      ))}
    </div>
  );
}

export function BadgeCard({ a, index }: { a: AchievementResult; index: number }): React.JSX.Element {
  const isSecret = a.state === "secret";
  const isUnlocked = a.state === "unlocked";
  const glow = isUnlocked && a.tierName ? TIER_GLOW[a.tierName] : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.015, 0.4) }}
      whileHover={{ y: -3 }}
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm
        ${glow} ${isUnlocked ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`text-2xl ${isUnlocked ? "" : "grayscale"}`}>{isSecret ? "❔" : iconFor(a.icon)}</div>
        {isUnlocked && a.tierName && (
          <span className={`rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold
            uppercase tracking-wide ${TIER_COLOR[a.tierName]}`}>
            {a.tierName}
          </span>
        )}
        {a.state === "discovered" && <span className="text-[10px] uppercase tracking-wide text-white/30">Discovered</span>}
        {isSecret && <span className="text-[10px] uppercase tracking-wide text-white/30">Secret</span>}
      </div>
      <h3 className="mt-2 text-sm font-bold text-white/90">{isSecret ? "Achievement secret" : a.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/45">
        {isSecret ? "Débloque le premier signal pour le révéler." : a.description}
      </p>
      {!isSecret && <ProgressBar a={a} />}
      <div className="mt-3 flex items-center justify-between">
        <TierLadder reached={a.tierIndex} />
        <span className="text-[10px] uppercase tracking-wider text-white/25">{a.category}</span>
      </div>
    </motion.div>
  );
}
