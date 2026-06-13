// Phase 2 — graphique de résolution : rend le CHEMIN d'un schéma de résolution comme une
// timeline verticale (nœuds reliés), pas une liste de texte. Le texte des étapes reste, mais
// devient visuel : on voit la séquence, les outils, les retours/erreurs et l'issue d'un coup d'œil.
import { motion } from "framer-motion";
import { Check, CircleDashed, X, CornerDownLeft, TriangleAlert, Crown, Wrench } from "lucide-react";
import type { ResolutionSchema, ResolutionOutcome } from "../../src/consolidate/types.ts";
import { OutcomeBadge } from "../lib/format.tsx";

const RAIL: Record<ResolutionOutcome, string> = {
  resolved: "bg-emerald-400/40", partial: "bg-amber-300/40", unresolved: "bg-rose-400/40",
};
const NODE: Record<ResolutionOutcome, string> = {
  resolved: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  partial: "border-amber-300/50 bg-amber-300/10 text-amber-300",
  unresolved: "border-rose-400/50 bg-rose-400/10 text-rose-400",
};
const OUTCOME_ICON = { resolved: Check, partial: CircleDashed, unresolved: X } as const;

/** Puce métrique compacte (tours / retours / erreurs). `warn` la teinte si > 0. */
function Metric({ icon: Icon, value, label, warn }:
  { icon: typeof Wrench; value: number; label: string; warn?: boolean }): React.JSX.Element {
  const tone = warn && value > 0 ? "text-amber-300/80" : "text-white/40";
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${tone}`} title={label}>
      <Icon size={11} strokeWidth={2} />{value}
    </span>
  );
}

/** Un nœud d'étape : pastille sur le rail + carte texte. */
function StepNode({ index, text, outcome, last }:
  { index: number; text: string; outcome: ResolutionOutcome; last: boolean }): React.JSX.Element {
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4) }}
      className="relative flex gap-3 pb-3">
      <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full
        border border-white/15 bg-[#16161c] text-[11px] font-bold tabular-nums text-white/70">
        {index + 1}
      </div>
      <div className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-[12.5px] leading-snug
        ${last ? NODE[outcome] : "border-white/[0.07] bg-white/[0.02] text-white/75"}`}>
        {text}
      </div>
    </motion.div>
  );
}

/** Nœud terminal : l'issue (résolu / partiel / non résolu). */
function OutcomeNode({ outcome }: { outcome: ResolutionOutcome }): React.JSX.Element {
  const Icon = OUTCOME_ICON[outcome];
  return (
    <div className="relative flex items-center gap-3">
      <div className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border
        ${NODE[outcome]}`}>
        <Icon size={13} strokeWidth={2.5} />
      </div>
      <OutcomeBadge outcome={outcome} />
    </div>
  );
}

export function ResolutionFlow({ rs, title, isChampion, fitness }:
  { rs: ResolutionSchema; title?: string; isChampion?: boolean; fitness?: number }): React.JSX.Element {
  return (
    <div className={`rounded-xl border p-4 ${isChampion
      ? "border-fuchsia-400/30 bg-fuchsia-400/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
      {title && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {isChampion && <Crown size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-fuchsia-200" />}
            <p className="text-[12.5px] font-medium leading-snug text-white/85">{title}</p>
          </div>
          {fitness !== undefined && (
            <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5
              text-[10px] tabular-nums text-white/55">fit {fitness.toFixed(3)}</span>
          )}
        </div>
      )}

      <div className="relative">
        {/* rail vertical continu reliant les nœuds */}
        <div className={`absolute bottom-2 left-3 top-2 w-px ${RAIL[rs.outcome]}`} />
        {rs.steps.map((st, i) => (
          <StepNode key={i} index={i} text={st} outcome={rs.outcome} last={false} />
        ))}
        {rs.steps.length === 0 && (
          <p className="mb-3 pl-9 text-[12px] italic text-white/35">Aucune étape capturée.</p>
        )}
        <OutcomeNode outcome={rs.outcome} />
      </div>

      {rs.tools_used.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-white/[0.05] pt-2.5">
          <Wrench size={11} className="mr-0.5 text-white/30" />
          {rs.tools_used.map((t, i) => (
            <span key={i} className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5
              font-mono text-[10px] text-sky-300/70">{t}</span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <Metric icon={Wrench} value={rs.turns_to_resolve} label="tours" />
        <Metric icon={CornerDownLeft} value={rs.backtracks} label="retours (bifurcations)" warn />
        <Metric icon={TriangleAlert} value={rs.tool_errors} label="erreurs d'outil" warn />
      </div>
    </div>
  );
}
