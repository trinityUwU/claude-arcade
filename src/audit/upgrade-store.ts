// Persistance de l'historique d'upgrades par fichier de config (boucle d'amélioration).
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stateDir } from "../engine/state.ts";
import { logger } from "../logger.ts";
import type { Upgrade } from "./types.ts";

interface UpgradeStore { generatedAt: number; upgrades: Record<string, Upgrade[]>; }

function storePath(): string {
  return join(stateDir(), "upgrades.json");
}

export async function loadAllUpgrades(): Promise<Record<string, Upgrade[]>> {
  try {
    const f = Bun.file(storePath());
    if (await f.exists()) {
      const d = (await f.json()) as UpgradeStore;
      if (d.upgrades && typeof d.upgrades === "object") return d.upgrades;
    }
  } catch (err) {
    logger.error({ err }, "loadAllUpgrades failed");
  }
  return {};
}

export async function loadUpgrades(relPath: string): Promise<Upgrade[]> {
  return (await loadAllUpgrades())[relPath] ?? [];
}

/** Ajoute un upgrade en tête de l'historique du fichier (plus récent d'abord). */
export async function recordUpgrade(relPath: string, upgrade: Upgrade): Promise<void> {
  const all = await loadAllUpgrades();
  all[relPath] = [upgrade, ...(all[relPath] ?? [])];
  try {
    await mkdir(stateDir(), { recursive: true });
    await Bun.write(storePath(), JSON.stringify({ generatedAt: Date.now(), upgrades: all }, null, 2));
  } catch (err) {
    logger.error({ err, relPath }, "recordUpgrade failed");
  }
}
