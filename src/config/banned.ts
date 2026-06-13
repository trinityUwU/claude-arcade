// Liste manuelle des classes canoniques bannies de création de skill (override Chris).
// Complète l'heuristique env-failure : ce que l'heuristique rate, Chris le bannit à la main.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stateDir } from "../engine/state.ts";
import { logger } from "../logger.ts";

interface BannedData { classIds: string[]; updatedAt: number }

function bannedPath(): string {
  return join(stateDir(), "banned-classes.json");
}

export async function loadBanned(): Promise<string[]> {
  try {
    const f = Bun.file(bannedPath());
    if (await f.exists()) {
      const d = (await f.json()) as BannedData;
      if (Array.isArray(d.classIds)) return d.classIds;
    }
  } catch (err) {
    logger.error({ err }, "loadBanned failed");
  }
  return [];
}

export async function setBanned(classId: string, banned: boolean): Promise<string[]> {
  const cur = new Set(await loadBanned());
  if (banned) cur.add(classId); else cur.delete(classId);
  const arr = [...cur];
  try {
    await mkdir(stateDir(), { recursive: true });
    await Bun.write(bannedPath(), JSON.stringify({ classIds: arr, updatedAt: Date.now() }, null, 2));
  } catch (err) {
    logger.error({ err }, "setBanned failed");
  }
  return arr;
}
