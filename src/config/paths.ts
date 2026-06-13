// Racine de la config Claude Code. Override par env pour les tests.
import { homedir } from "node:os";
import { join } from "node:path";

export function configRoot(): string {
  return process.env.ARCADE_CONFIG_ROOT?.trim() || join(homedir(), ".claude");
}

/** CLAUDE.md est observable mais hors whitelist d'écriture auto (décision Chris 2026-06-13). */
export function isPatchable(relPath: string, kind: string): boolean {
  return relPath !== "CLAUDE.md" && kind !== "setting";
}
