// Modèle de la config Claude Code (~/.claude) telle qu'observée et versionnée par Arcade.

export type ConfigKind = "instruction" | "skill" | "command" | "setting";

export interface ConfigEntry {
  kind: ConfigKind;
  relPath: string;          // chemin relatif à ~/.claude (clé stable, sert d'autorisation)
  name: string;
  description?: string;
  bytes: number;
  managed: boolean;         // contient une région <!-- arcade:managed -->
  patchable: boolean;       // Arcade a le droit d'évoluer ce fichier (whitelist, hors CLAUDE.md)
}

export interface ConfigTree {
  generatedAt: number;
  versioned: boolean;       // un dépôt git existe-t-il sur ~/.claude
  entries: ConfigEntry[];
}

export interface ConfigCommit {
  hash: string;
  date: string;             // ISO
  subject: string;
}

export interface ConfigFile {
  relPath: string;
  content: string;
}

// --- Couverture skills (incrément 2) : gaps à créer + morts à archiver ---

export type GapBlock = "env-failure" | "banned" | null;

export interface CoverageGap {
  classId: string;
  className: string;
  definition: string;
  occurrences: number;
  projects: string[];
  championFitness: number | null;
  creatable: boolean;    // false si bloqué (échec env transitoire ou banni manuellement)
  block: GapBlock;       // raison du blocage de création, sinon null
}

export interface CoverageDeadSkill {
  name: string;
  relPath: string;
  invocations: number;   // via le tool Skill ; 0 = jamais invoqué explicitement (signal, pas verdict)
  sessions: number;
  silentLoad: boolean;   // agent/llm-* chargé silencieusement → 0 invoc. normal, jamais archivé auto
  archivable: boolean;   // candidat archivage auto (= !silentLoad)
}

export interface CoverageReport {
  generatedAt: number;
  gaps: CoverageGap[];
  dead: CoverageDeadSkill[];
}
