// Helpers d'affichage partagés par les panneaux d'apprentissage (couleurs sémantiques, badges, dates).
import { Folder, Target, Boxes } from "lucide-react";
import type {
  ResolutionOutcome, ProblemSeverity, DifficultyLevel,
} from "../../src/consolidate/types.ts";

export function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Devine la famille de contexte d'un cwd : bug bounty (test sur cible), projet /mnt/projects, ou autre. */
function sourceKind(path: string): { Icon: typeof Folder; tone: string } {
  if (/bug.?bounty|engagement|target/i.test(path)) return { Icon: Target, tone: "text-rose-300/80" };
  if (/\/mnt\/projects\//.test(path)) return { Icon: Boxes, tone: "text-sky-300/80" };
  return { Icon: Folder, tone: "text-white/45" };
}

/** Badge de provenance : d'où vient une résolution (projet / cible) + date. Tooltip = chemin complet. */
export function SourceBadge({ project, at }: { project: string; at?: number }): React.JSX.Element {
  const name = basename(project) || "session locale";
  const { Icon, tone } = sourceKind(project);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5"
      title={project || "cwd inconnu"}>
      <Icon size={11} strokeWidth={2} className={tone} />
      <span className="max-w-[180px] truncate text-[10.5px] font-medium text-white/65">{name}</span>
      {at !== undefined && at > 0 && <span className="text-[10px] tabular-nums text-white/30">{formatDate(at)}</span>}
    </span>
  );
}

export function qualityColor(q: number): string {
  if (q >= 75) return "text-emerald-400";
  if (q < 40) return "text-rose-400";
  return "text-amber-300";
}

export function fitnessColor(f: number): string {
  if (f >= 0.55) return "text-emerald-400";
  if (f < 0.3) return "text-rose-400";
  return "text-amber-300";
}

export function fitnessBg(f: number): string {
  if (f >= 0.55) return "bg-emerald-400";
  if (f < 0.3) return "bg-rose-400";
  return "bg-amber-300";
}

const OUTCOME_STYLE: Record<ResolutionOutcome, { label: string; cls: string }> = {
  resolved: { label: "résolu", cls: "text-emerald-300 bg-emerald-400/12 border-emerald-400/20" },
  partial: { label: "partiel", cls: "text-amber-300 bg-amber-300/12 border-amber-300/20" },
  unresolved: { label: "non résolu", cls: "text-rose-400 bg-rose-400/12 border-rose-400/20" },
};

const SEVERITY_STYLE: Record<ProblemSeverity, { label: string; cls: string }> = {
  trivial: { label: "trivial", cls: "text-white/45 bg-white/[0.04] border-white/10" },
  minor: { label: "mineur", cls: "text-amber-300 bg-amber-300/10 border-amber-300/20" },
  major: { label: "majeur", cls: "text-rose-400 bg-rose-400/12 border-rose-400/20" },
};

const DIFFICULTY_STYLE: Record<DifficultyLevel, { label: string; cls: string }> = {
  easy: { label: "facile", cls: "text-emerald-400 bg-emerald-400/12 border-emerald-400/20" },
  medium: { label: "moyen", cls: "text-amber-300 bg-amber-300/12 border-amber-300/20" },
  hard: { label: "difficile", cls: "text-rose-400 bg-rose-400/12 border-rose-400/20" },
};

function Pill({ label, cls }: { label: string; cls: string }): React.JSX.Element {
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: ResolutionOutcome }): React.JSX.Element {
  const s = OUTCOME_STYLE[outcome];
  return <Pill label={s.label} cls={s.cls} />;
}

export function SeverityBadge({ severity }: { severity: ProblemSeverity }): React.JSX.Element {
  const s = SEVERITY_STYLE[severity];
  return <Pill label={s.label} cls={s.cls} />;
}

export function DifficultyBadge({ level }: { level: DifficultyLevel }): React.JSX.Element {
  const s = DIFFICULTY_STYLE[level];
  return <Pill label={s.label} cls={s.cls} />;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("fr", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function SectionHeader({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</div>
  );
}
