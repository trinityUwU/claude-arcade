// Types partagés du moteur d'achievements claude-arcade.

/** Une ligne brute d'un transcript Claude Code (.jsonl). Volontairement permissif. */
export interface TranscriptLine {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  isSidechain?: boolean;
  cwd?: string;
  message?: {
    role?: string;
    model?: string;
    content?: unknown;
  };
}

/** Compteurs sommables d'une session (additionnés pour le lifetime, maxés pour le best_session). */
export type Counters = Record<string, number>;

/** Métadonnées d'une session, hors compteurs purs. */
export interface SessionMeta {
  sessionId: string;
  file: string;
  startTs: number; // epoch ms, 0 si inconnu
  isWeekend: boolean;
  isNight: boolean; // 0h–6h locale
  models: string[]; // modèles distincts utilisés
  mcpServers: string[]; // serveurs MCP distincts touchés
  messageCount: number;
  distinctTools: number;
}

/** Résultat de l'analyse d'une session. */
export interface SessionStats {
  counters: Counters;
  meta: SessionMeta;
  skills: Counters; // nom de skill (input.skill du tool Skill) → nb d'invocations dans la session
}

/** Agrégat plat : chaque clé = un threshold_metric référencé par le catalogue. */
export type Aggregate = Record<string, number>;

export type TierName = "Copper" | "Silver" | "Gold" | "Diamond" | "Olympian";

export interface Tier {
  name: TierName;
  threshold: number;
}

export type AchievementKind = "lifetime" | "best_session";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: AchievementKind;
  icon: string;
  thresholdMetric: string;
  tiers: Tier[];
  secret?: boolean;
}

export type AchievementState = "unlocked" | "discovered" | "secret";

export interface AchievementResult {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  secret: boolean;
  state: AchievementState;
  /** Index du tier atteint : -1 = aucun, 0 = Copper … 4 = Olympian. */
  tierIndex: number;
  tierName: TierName | null;
  /** Valeur courante de la métrique. */
  value: number;
  /** Seuil du prochain tier (null si Olympian atteint). */
  nextThreshold: number | null;
  /** Progression 0–1 vers le prochain tier. */
  progress: number;
  tiers: Tier[];
}

/** Usage cumulé d'un skill sur toutes les sessions (classement). */
export interface SkillUsage {
  name: string;
  count: number;     // invocations totales
  sessions: number;  // nombre de sessions distinctes l'ayant utilisé
}

export interface ScanResult {
  generatedAt: number;
  sessionCount: number;
  aggregate: Aggregate;
  achievements: AchievementResult[];
  score: ScoreSummary;
  topSkills: SkillUsage[]; // skills les plus utilisés, count décroissant
}

export interface ScoreSummary {
  totalPoints: number;
  unlockedCount: number;
  totalCount: number;
  rank: TierName;
  byCategory: Record<string, { unlocked: number; total: number; points: number }>;
}
