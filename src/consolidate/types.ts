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

export type PrinciplePolarity = "positive" | "negative";
export type PrincipleSource = "stated" | "inferred";

/** Un principe / process de pensée exprimé par Chris ou observé dans le déroulé.
 *  Grain de la couche (B) : capturer COMMENT Chris veut qu'on travaille, pas un bug. */
export interface Principle {
  id: string;                  // slug stable dans la session, ex "pr1"
  statement: string;           // la règle, formulée comme directive réutilisable
  domain: string;              // domaine court générique réutilisable, ex "design ui", "workflow git"
  trigger: string;             // le contexte où l'appliquer
  polarity: PrinciplePolarity; // positive = à faire / negative = à éviter
  source: PrincipleSource;     // stated = dit explicitement par Chris / inferred = déduit du déroulé
  rationale: string;           // le motif derrière le principe
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
  principles: Principle[];
}

/** Résumé persisté d'une session, avec métadonnées de traçabilité. */
export interface SessionSummary extends SummaryFields {
  sessionId: string;
  file: string;
  fingerprint: string;
  model: string;
  startTs: number; // epoch ms réel de la session, 0 si inconnu (anciens JSON → redaté ou fallback)
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

// ── Couche (B) : principes / process de pensée (compétition de méthodes de travail) ──

/** Instance plate d'un principe, rattachée à sa session source. */
export interface PrincipleInstance {
  sessionId: string;
  project: string;
  principleId: string;
  statement: string;
  domain: string;
  trigger: string;
  polarity: PrinciplePolarity;
  source: PrincipleSource;
  rationale: string;
  sessionQuality: number;
  at: number;
}

/** Un domaine de pensée consolidé : les instances en compétition, leur confiance, leur contestation. */
export interface PrincipleEntry {
  domain: string;                  // clé de regroupement
  label: string;                   // libellé lisible (domaine le plus court du groupe)
  statement: string;               // énoncé représentant (instance dominante la plus récente)
  polarity: PrinciplePolarity;     // polarité dominante du domaine
  occurrences: number;
  confidence: number;              // 0-1 déterministe : 1 - 1/(1+occ), ×0.5 si contesté, arrondi 3 déc
  contested: boolean;              // true si un même énoncé porte les deux polarités (contradiction)
  statedCount: number;             // nb d'instances explicitement énoncées par Chris (source=stated)
  instances: PrincipleInstance[];  // les plus récentes d'abord
}

export interface PrinciplesData { generatedAt: number; domains: PrincipleEntry[]; }

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

// ── Couche 2 : trace des injections de champions dans le contexte des sessions ──

export type InjectionEvent = "session-start" | "user-prompt-submit";

export interface InjectionRecord {
  at: number;                // epoch ms
  event: InjectionEvent;
  cwd: string;               // répertoire de la session qui a reçu l'injection
  categories: string[];      // labels des catégories injectées
  charCount: number;         // taille du contexte injecté
}

export interface InjectionLog {
  generatedAt: number;
  records: InjectionRecord[];   // les plus récents en premier, capés
}

// ── Couche 3 : trace des consolidations déclenchées en temps réel par le hook SessionEnd ──

export type SessionEndOutcome = "consolidated" | "skipped" | "empty" | "failed";

export interface SessionEndEvent {
  at: number;                  // epoch ms du déclenchement
  sessionId: string;
  project: string;             // projet/cwd de la session terminée
  reason: string;              // raison de fin renvoyée par Claude Code (clear/resume/logout/other…)
  outcome: SessionEndOutcome;  // résultat de la consolidation ciblée
  quality?: number;            // quality_score si la session a été résumée
}

export interface SessionEndLog {
  generatedAt: number;
  records: SessionEndEvent[];  // les plus récents en premier, capés
}
