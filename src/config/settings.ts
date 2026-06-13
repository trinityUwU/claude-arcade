// Réglages d'évolution auto de la config. Défauts = auto activé partout, cap anti-batch à 3.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stateDir } from "../engine/state.ts";
import { logger } from "../logger.ts";
import type { AutoSettings } from "./types.ts";

// autoArchive OFF par défaut : « 0 invocation » est un signal trop faible pour supprimer des skills
// faits main (beaucoup sont chargés silencieusement). Patch/create sont additifs et réversibles → ON.
const DEFAULTS: AutoSettings = {
  autoGenerate: true, autoPatch: true, autoCreate: true, autoArchive: false, maxPerCycle: 3,
};

function settingsPath(): string {
  return join(stateDir(), "config-evolution-settings.json");
}

export async function loadSettings(): Promise<AutoSettings> {
  try {
    const f = Bun.file(settingsPath());
    if (await f.exists()) return { ...DEFAULTS, ...(await f.json()) as Partial<AutoSettings> };
  } catch (err) {
    logger.error({ err }, "loadSettings failed");
  }
  return { ...DEFAULTS };
}

export async function saveSettings(patch: Partial<AutoSettings>): Promise<AutoSettings> {
  const next = { ...(await loadSettings()), ...patch };
  next.maxPerCycle = Math.max(1, Math.min(20, Math.floor(next.maxPerCycle)));
  try {
    await mkdir(stateDir(), { recursive: true });
    await Bun.write(settingsPath(), JSON.stringify(next, null, 2));
  } catch (err) {
    logger.error({ err }, "saveSettings failed");
  }
  return next;
}
