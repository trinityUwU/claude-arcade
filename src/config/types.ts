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
