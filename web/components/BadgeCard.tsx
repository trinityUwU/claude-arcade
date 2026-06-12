import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { AchievementResult } from "../../src/types.ts";
import { TIER_COLOR, TIER_GLOW } from "../lib/tiers.ts";
import { achievementIcon } from "../lib/icons.tsx";

const TIER_DOTS = ["Copper", "Silver", "Gold", "Diamond", "Olympian"] as const;

function ProgressBar({ a }: { a: AchievementResult }): React.JSX.Element {
  const pct = Math.round(a.progress * 100);
  return (
    <div className="mt-3">
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] tabular-nums text-white/35">
        {a.nextThreshold ? `${a.value.toLocaleString("fr")} / ${a.nextThreshold.toLocaleString("fr")}` : `${a.value.toLocaleString("fr")} · MAX`}
      </div>
    </div>
  );
}

function TierLadder({ reached }: { reached: number }): React.JSX.Element {
  return (
    <div className="flex gap-1">
      {TIER_DOTS.map((tier, i) => (
        <span key={tier} title={tier}
          className={`h-1 w-4 rounded-full ${i <= reached ? TIER_COLOR[tier].replace("text-", "bg-") : "bg-white/10"}`} />
      ))}
    </div>
  );
}

export function BadgeCard({ a, index }: { a: AchievementResult; index: number }): React.JSX.Element {
  const isSecret = a.state === "secret";
  const isUnlocked = a.state === "unlocked";
  const Icon = isSecret ? Lock : achievementIcon(a.icon);
  const glow = isUnlocked && a.tierName ? TIER_GLOW[a.tierName] : "";
  const iconTint = isUnlocked && a.tierName ? TIER_COLOR[a.tierName] : "text-white/40";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.012, 0.3) }}
      whileHover={{ y: -2 }}
      className={`group rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition-colors
        hover:border-white/15 ${glow} ${isUnlocked ? "" : "opacity-65"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex size-9 items-center justify-center rounded-lg bg-white/[0.04] ${iconTint}`}>
          <Icon size={18} strokeWidth={1.75} />
        </div>
        {isUnlocked && a.tierName && (
          <span className={`rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold
            uppercase tracking-wider ${TIER_COLOR[a.tierName]}`}>
            {a.tierName}
          </span>
        )}
        {a.state === "discovered" && <Lock size={13} className="text-white/25" />}
      </div>
      <h3 className="mt-2.5 text-[13px] font-semibold text-white/90">
        {isSecret ? "Achievement secret" : a.name}
      </h3>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-white/40">
        {isSecret ? "Débloque le premier signal pour le révéler." : a.description}
      </p>
      {!isSecret && <ProgressBar a={a} />}
      <div className="mt-2.5"><TierLadder reached={a.tierIndex} /></div>
    </motion.div>
  );
}
