// Types de la couche de consolidation (résumés de session).

export type DifficultyLevel = "easy" | "medium" | "hard";
export type ProblemSeverity = "trivial" | "minor" | "major";
export type ResolutionOutcome = "resolved" | "partial" | "unresolved";

/** Schéma de résolution d'un problème rencontré dans la session. */
export interface ResolutionSchema {
  steps: string[];
  tools_used: string[];
  turns_to_resolve: number;
  backtracks: number;
  tool_errors: number;
  outcome: ResolutionOutcome;
}

/** Un problème rencontré dans la session, avec son schéma de résolution. */
export interface Problem {
  id: string;
  description: string;
  category: string;
  severity: ProblemSeverity;
  resolution_schema: ResolutionSchema;
}

/** Champs produits par le `claude -p` de résumé (cf. summary-prompt.ts). */
export interface SummaryFields {
  project: string;
  topic: string;
  wins: string[];
  errors_claude: string[];
  errors_chris: string[];
  decisions: string[];
  quality_score: number;
  links_hint: string[];
  difficulty: { level: DifficultyLevel; why: string };
  problems: Problem[];
}

/** Résumé persisté d'une session, avec métadonnées de traçabilité. */
export interface SessionSummary extends SummaryFields {
  sessionId: string;
  file: string;
  fingerprint: string;
  model: string;
  summarizedAt: number;
  schemaVersion: number;
}

/** Index des sessions déjà résumées (idempotence + zéro-perte). */
export interface ConsolidationIndex {
  schemaVersion: number;
  lastRun: number;
  processed: Record<string, { fingerprint: string; at: number }>;
}

export interface ConsolidationRun {
  scanned: number;
  pending: number;
  summarized: number;
  failed: number;
  skipped: number;
  quota: number;
  ms: number;
}

/** Progression d'un run, émise après chaque session traitée. */
export interface RunProgress {
  done: number;
  total: number;
  summarized: number;
  skipped: number;
  failed: number;
  current?: string;
}

export interface RunOptions {
  quota?: number;
  /** Ne traiter que les sessions modifiées à partir de ce timestamp (mode auto, sans rattrapage). */
  since?: number;
  onProgress?: (p: RunProgress) => void;
  shouldStop?: () => boolean;
}

/** État du job de consolidation exposé à l'app (déclenchement manuel). */
export interface ConsolidateStatus {
  running: boolean;
  pending: number;
  progress: RunProgress | null;
  lastRun: ConsolidationRun | null;
  startedAt: number | null;
  finishedAt: number | null;
}

// ── Couche 2 : insights ──────────────────────────────────────────────

/** Bilan par projet (regroupement des résumés). */
export interface ProjectRollup {
  project: string;
  sessions: number;
  avgQuality: number;
  topNotions: string[];
}

/** Item récurrent (erreur ou process) détecté sur plusieurs sessions. */
export interface RecurringItem {
  text: string;
  count: number;
  projects: string[];
  sessions: string[];
}

export interface Insights {
  generatedAt: number;
  sessionCount: number;
  projects: ProjectRollup[];
  recurringErrorsClaude: RecurringItem[];
  recurringErrorsChris: RecurringItem[];
  winningProcesses: RecurringItem[];
  topNotions: Array<{ text: string; count: number }>;
}

// ── Couche 2 : graphe écosystème (LISTE 1, type Obsidian 2D) ─────────

export type GraphNodeType = "session" | "project" | "notion" | "error" | "process";
export type GraphHealth = "strong" | "weak" | "watch" | "neutral";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  weight: number;
  health: GraphHealth;
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: string;
  weight: number;
}

export interface GraphData {
  generatedAt: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Couche 2 : champions (évolution darwinienne des schémas de résolution) ──

/** Instance plate d'un schéma de résolution, scorée par fitness. */
export interface SchemaInstance {
  sessionId: string;
  project: string;
  problemId: string;
  description: string;
  category: string;
  severity: ProblemSeverity;
  resolution: ResolutionSchema;
  fitness: number;
  sessionQuality: number;
  at: number;
}

export interface ChampionHistoryPoint { sessionId: string; fitness: number; at: number; }

export interface ChampionEntry {
  category: string;
  label: string;
  champion: SchemaInstance | null;
  contenders: SchemaInstance[];
  occurrences: number;
  resolvedRate: number;
  history: ChampionHistoryPoint[];
}

export interface ChampionsData { generatedAt: number; categories: ChampionEntry[]; }

// ── Couche 2 : évolution (le système d'apprentissage s'améliore-t-il ?) ──

export type TrendDirection = "improving" | "worsening" | "flat";

export interface EvolutionBucket {
  period: string;          // libellé ISO semaine, ex "2026-W24"
  start: number;           // epoch ms du début de semaine (lundi)
  sessions: number;
  avgQuality: number;      // moyenne quality_score des sessions du bucket, arrondi
  problems: number;        // nb total de problèmes du bucket
  recurringProblems: number;   // problèmes dont la catégorie était déjà vue dans un bucket ANTÉRIEUR
  recurrenceRate: number;  // recurringProblems / problems, 0-1 arrondi 2 déc (0 si problems=0)
  avgChampionFitness: number;  // fitness moyen des champions connus à la fin de ce bucket, arrondi 3 déc
  difficulty: { easy: number; medium: number; hard: number };
}

export interface EvolutionData {
  generatedAt: number;
  buckets: EvolutionBucket[];        // chronologiques croissants
  overallRecurrenceRate: number;     // global, 0-1 arrondi 2 déc
  recurrenceTrend: TrendDirection;   // recurrenceRate baisse = "improving"
  avgChampionFitness: number;        // global, arrondi 3 déc
  fitnessTrend: TrendDirection;      // fitness monte = "improving"
}
