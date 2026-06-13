// Types de la couche de consolidation (résumés de session).

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
